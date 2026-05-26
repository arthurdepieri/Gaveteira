import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
const zipFileName = `Gaveteira-${version}.zip`;
const zipPath = path.join(releasesDir, zipFileName);
const manifestPath = path.join(releasesDir, "manifest.json");
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

run(npmCommand, ["run", "build"]);
compressDist();

const release = {
  version,
  date: changelogSection.date,
  title: changelogSection.title,
  notes: changelogSection.notes,
  archivePath: `releases/${zipFileName}`,
};

writeManifest(release);

console.log(`Release criado: ${release.archivePath}`);
console.log(`Manifest atualizado: releases/manifest.json`);
