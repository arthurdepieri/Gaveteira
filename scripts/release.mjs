import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];

if (!version) {
  console.error("Informe a versão. Exemplo: npm run release -- 0.6.3-beta");
  process.exit(1);
}

const packagePath = path.join(rootDir, "package.json");
const changelogPath = path.join(rootDir, "CHANGELOG.md");
const distDir = path.join(rootDir, "dist");
const releasesDir = path.join(rootDir, "releases");
const notesDir = path.join(releasesDir, "notes");
const driveDir = path.join(releasesDir, "drive");
const zipFileName = `Gaveteira-${version}.zip`;
const zipPath = path.join(releasesDir, zipFileName);
const notesFileName = `Gaveteira-${version}-release-notes.md`;
const handoffFileName = `Gaveteira-${version}-drive-handoff.json`;
const manifestPath = path.join(releasesDir, "manifest.json");
const driveFolderName = process.env.GAVETEIRA_GOOGLE_DRIVE_FOLDER_NAME
  ?? process.env.GAVETEIRA_RELEASE_DRIVE_FOLDER
  ?? "Gaveteira Versions";
const npmCommand = "npm";

function run(command, args, options = {}) {
  const cwd = options.cwd ?? rootDir;
  const useShell = options.shell ?? process.platform === "win32";

  if (process.platform === "win32" && useShell) {
    execFileSync("cmd.exe", ["/d", "/s", "/c", [command, ...args].map(quoteCmdArg).join(" ")], {
      cwd,
      stdio: "inherit",
      shell: false,
    });
    return;
  }

  execFileSync(command, args, {
    cwd: options.cwd ?? rootDir,
    stdio: "inherit",
    shell: useShell,
  });
}

function quoteCmdArg(value) {
  if (/^[A-Za-z0-9_@%+=:,./\\-]+$/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '\\"')}"`;
}

function extractChangelogSection(targetVersion) {
  const changelog = readFileSync(changelogPath, "utf8");
  const lines = changelog.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.startsWith(`## ${targetVersion}`));

  if (headerIndex === -1) {
    throw new Error(`Não encontrei a seção "${targetVersion}" no CHANGELOG.md.`);
  }

  const nextHeaderIndex = lines.findIndex((line, index) => index > headerIndex && line.startsWith("## "));
  const sectionLines = lines.slice(headerIndex + 1, nextHeaderIndex === -1 ? lines.length : nextHeaderIndex);
  const headerTail = lines[headerIndex].replace(`## ${targetVersion}`, "").trim();
  const body = sectionLines.join("\n").trim();
  const dateMatch = headerTail.match(/\d{4}-\d{2}-\d{2}/);

  return {
    date: dateMatch?.[0] ?? new Date().toISOString().slice(0, 10),
    title: headerTail.replace(/^-\s*/, "").replace(/\s+-\s+\d{4}-\d{2}-\d{2}\s*$/, "").trim(),
    notes: body,
  };
}

function buildShortNotes(changelogSection) {
  const lines = changelogSection.notes.split(/\r?\n/);
  const summary = lines.find((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("-");
  })?.trim() ?? "";

  const highlights = [];
  let isInHighlights = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^###\s+Destaques/i.test(trimmed)) {
      isInHighlights = true;
      continue;
    }

    if (isInHighlights && /^###\s+/.test(trimmed)) {
      break;
    }

    if (isInHighlights && trimmed.startsWith("- ")) {
      highlights.push(trimmed.slice(2).trim());
    }
  }

  return {
    summary,
    highlights: highlights.slice(0, 5),
  };
}

function formatShortNotesMarkdown(release) {
  const headingTitle = release.title ? ` - ${release.title}` : "";
  const highlights = release.shortNotes.highlights.length > 0
    ? release.shortNotes.highlights.map((item) => `- ${item}`).join("\n")
    : "- Sem destaques curtos extraidos automaticamente.";

  return `# Gaveteira ${release.version}${headingTitle}

Data: ${release.date}
Arquivo final: ${release.drive.finalFileName}
Pasta no Google Drive: ${release.drive.folderName}

## Resumo

${release.shortNotes.summary || "Release beta da Gaveteira."}

## Destaques

${highlights}

## Upload

Com token do Google Drive configurado:

\`\`\`bash
npm run release:drive -- ${release.version}
\`\`\`
`;
}

function createDriveHandoff(release) {
  mkdirSync(notesDir, { recursive: true });
  mkdirSync(driveDir, { recursive: true });

  const notesPath = path.join(notesDir, notesFileName);
  const handoffPath = path.join(driveDir, handoffFileName);
  const notesManifestPath = `releases/notes/${notesFileName}`;
  const handoffManifestPath = `releases/drive/${handoffFileName}`;

  release.drive.notesPath = notesManifestPath;
  release.drive.handoffPath = handoffManifestPath;

  writeFileSync(notesPath, formatShortNotesMarkdown(release), "utf8");
  writeFileSync(
    handoffPath,
    `${JSON.stringify({
      version: release.version,
      date: release.date,
      title: release.title,
      archivePath: release.archivePath,
      archiveSizeBytes: release.archiveSizeBytes,
      archiveSha256: release.archiveSha256,
      shortNotes: release.shortNotes,
      drive: release.drive,
    }, null, 2)}\n`,
    "utf8",
  );
}

function getFileSha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function compressDist() {
  if (!existsSync(distDir)) {
    throw new Error("A pasta dist não existe. O build precisa terminar antes de criar o zip.");
  }

  mkdirSync(releasesDir, { recursive: true });

  if (existsSync(zipPath)) {
    rmSync(zipPath, { force: true });
  }

  if (process.platform === "win32") {
    const escapedZipPath = zipPath.replace(/'/g, "''");
    run("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Compress-Archive -Path 'dist\\*' -DestinationPath '${escapedZipPath}' -Force`,
    ], { shell: false });
    return;
  }

  run("zip", ["-r", zipPath, "."], { cwd: distDir });
}

function writeManifest(release) {
  const previousManifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8"))
    : { latest: null, releases: [] };

  const releases = Array.isArray(previousManifest.releases)
    ? previousManifest.releases.filter((entry) => entry.version !== release.version)
    : [];

  releases.unshift(release);

  writeFileSync(
    manifestPath,
    `${JSON.stringify({ latest: release.version, releases }, null, 2)}\n`,
    "utf8",
  );
}

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

if (packageJson.version !== version) {
  console.warn(`Aviso: package.json está em ${packageJson.version}, mas o release solicitado é ${version}.`);
}

const changelogSection = extractChangelogSection(version);
const shortNotes = buildShortNotes(changelogSection);

run(npmCommand, ["run", "build"]);
compressDist();

const release = {
  version,
  date: changelogSection.date,
  title: changelogSection.title,
  notes: changelogSection.notes,
  shortNotes,
  archivePath: `releases/${zipFileName}`,
  archiveSizeBytes: statSync(zipPath).size,
  archiveSha256: getFileSha256(zipPath),
  drive: {
    folderName: driveFolderName,
    finalFileName: zipFileName,
    archivePath: `releases/${zipFileName}`,
    notesFileName,
    uploadScript: `npm run release:drive -- ${version}`,
    status: "pending",
  },
};

createDriveHandoff(release);
writeManifest(release);

console.log(`Release criado: ${release.archivePath}`);
console.log(`Manifest atualizado: releases/manifest.json`);
console.log(`Pacote para Drive: ${release.drive.folderName}/${release.drive.finalFileName}`);
console.log(`Notas curtas: ${release.drive.notesPath}`);
console.log(`Upload conectado: ${release.drive.uploadScript}`);
