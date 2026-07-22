import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(rootDir, "releases", "manifest.json");
const args = process.argv.slice(2);
const versionArg = args.find((arg) => !arg.startsWith("--"));
const dryRun = args.includes("--dry-run");
const noCreateFolder = args.includes("--no-create-folder");
const accessToken = process.env.GAVETEIRA_GOOGLE_DRIVE_ACCESS_TOKEN;
const configuredFolderId = process.env.GAVETEIRA_GOOGLE_DRIVE_FOLDER_ID;
const configuredFolderName = process.env.GAVETEIRA_GOOGLE_DRIVE_FOLDER_NAME;

if (!existsSync(manifestPath)) {
  console.error("Nao encontrei releases/manifest.json. Rode npm run release primeiro.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const targetVersion = versionArg ?? manifest.latest;
const release = manifest.releases?.find((entry) => entry.version === targetVersion);

if (!release) {
  console.error(`Nao encontrei a versao ${targetVersion} em releases/manifest.json.`);
  process.exit(1);
}

if (!release.drive) {
  console.error(`A versao ${targetVersion} ainda nao tem metadados de Drive. Rode npm run release -- ${targetVersion}.`);
  process.exit(1);
}

const folderName = configuredFolderName ?? release.drive.folderName ?? "Gaveteira Versions";
const archivePath = path.join(rootDir, release.drive.archivePath ?? release.archivePath);
const notesPath = release.drive.notesPath ? path.join(rootDir, release.drive.notesPath) : null;

if (!existsSync(archivePath)) {
  console.error(`Nao encontrei o zip local: ${path.relative(rootDir, archivePath)}`);
  process.exit(1);
}

if (release.archiveSha256) {
  const archiveSha256 = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
  if (archiveSha256 !== String(release.archiveSha256).toLowerCase()) {
    console.error(`O checksum do zip nao corresponde ao manifesto: ${path.relative(rootDir, archivePath)}`);
    console.error(`Esperado: ${release.archiveSha256}`);
    console.error(`Encontrado: ${archiveSha256}`);
    process.exit(1);
  }
}

const uploadPlan = {
  version: release.version,
  folderName,
  folderId: configuredFolderId ?? null,
  files: [
    {
      kind: "archive",
      path: path.relative(rootDir, archivePath),
      name: release.drive.finalFileName,
      mimeType: "application/zip",
    },
  ],
};

if (notesPath && existsSync(notesPath)) {
  uploadPlan.files.push({
    kind: "notes",
    path: path.relative(rootDir, notesPath),
    name: release.drive.notesFileName ?? path.basename(notesPath),
    mimeType: "text/markdown; charset=utf-8",
  });
}

if (dryRun) {
  console.log(JSON.stringify(uploadPlan, null, 2));
  process.exit(0);
}

if (!accessToken) {
  console.error("Defina GAVETEIRA_GOOGLE_DRIVE_ACCESS_TOKEN com um OAuth access token do Google Drive.");
  console.error("Opcional: defina GAVETEIRA_GOOGLE_DRIVE_FOLDER_ID para evitar busca/criacao da pasta.");
  console.error(`Plano de upload: ${JSON.stringify(uploadPlan, null, 2)}`);
  process.exit(1);
}

const folderId = configuredFolderId ?? await ensureFolder(folderName);
const uploadedFiles = [];

for (const file of uploadPlan.files) {
  const absolutePath = path.join(rootDir, file.path);
  const existing = await findFileInFolder(file.name, folderId);
  const uploaded = await uploadFile({
    fileId: existing?.id,
    filePath: absolutePath,
    fileName: file.name,
    mimeType: file.mimeType,
    folderId,
  });

  uploadedFiles.push({
    kind: file.kind,
    id: uploaded.id,
    name: uploaded.name,
    webViewLink: uploaded.webViewLink,
    webContentLink: uploaded.webContentLink,
  });

  console.log(`${existing ? "Atualizado" : "Enviado"}: ${uploaded.name}`);
  if (uploaded.webViewLink) {
    console.log(uploaded.webViewLink);
  }
}

release.drive = {
  ...release.drive,
  folderName,
  folderId,
  status: "uploaded",
  uploadedAt: new Date().toISOString(),
  uploadedFiles,
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log("Manifest atualizado com os links do Google Drive.");

async function ensureFolder(name) {
  const existing = await findFolderByName(name);

  if (existing) {
    return existing.id;
  }

  if (noCreateFolder) {
    throw new Error(`Nao encontrei a pasta "${name}" e --no-create-folder foi informado.`);
  }

  const created = await driveRequest("files", {
    method: "POST",
    query: { fields: "id,name,webViewLink" },
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  console.log(`Pasta criada no Google Drive: ${created.name}`);
  return created.id;
}

async function findFolderByName(name) {
  const result = await driveRequest("files", {
    query: {
      q: [
        "mimeType = 'application/vnd.google-apps.folder'",
        `name = '${escapeDriveQuery(name)}'`,
        "trashed = false",
      ].join(" and "),
      fields: "files(id,name,webViewLink)",
      spaces: "drive",
    },
  });

  return result.files?.[0] ?? null;
}

async function findFileInFolder(name, folderId) {
  const result = await driveRequest("files", {
    query: {
      q: [
        `name = '${escapeDriveQuery(name)}'`,
        `'${escapeDriveQuery(folderId)}' in parents`,
        "trashed = false",
      ].join(" and "),
      fields: "files(id,name,webViewLink)",
      spaces: "drive",
    },
  });

  return result.files?.[0] ?? null;
}

async function uploadFile({ fileId, filePath, fileName, mimeType, folderId }) {
  const metadata = {
    name: fileName,
    ...(fileId ? {} : { parents: [folderId] }),
  };
  const boundary = `gaveteira_release_${Date.now()}`;
  const fileBytes = readFileSync(filePath);
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    ),
    fileBytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const endpoint = fileId ? `files/${fileId}` : "files";

  return driveUploadRequest(endpoint, {
    method: fileId ? "PATCH" : "POST",
    query: {
      uploadType: "multipart",
      fields: "id,name,webViewLink,webContentLink",
    },
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
}

async function driveRequest(endpoint, options = {}) {
  return googleRequest(`https://www.googleapis.com/drive/v3/${endpoint}`, options);
}

async function driveUploadRequest(endpoint, options = {}) {
  return googleRequest(`https://www.googleapis.com/upload/drive/v3/${endpoint}`, options);
}

async function googleRequest(baseUrl, options = {}) {
  const url = new URL(baseUrl);

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers ?? {}),
    },
    body: options.body,
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Google Drive respondeu ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

function escapeDriveQuery(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
