import { readFile, writeFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const version = String(packageJson.version || "dev").trim();

const pwaVersion = {
  version,
  cacheName: `gaveteira-pwa-${version}`,
};

await writeFile(
  new URL("../public/pwa-version.json", import.meta.url),
  `${JSON.stringify(pwaVersion, null, 2)}\n`,
  "utf8",
);

await writeFile(
  new URL("../public/pwa-build.js", import.meta.url),
  `self.__GAVETEIRA_PWA_VERSION__ = ${JSON.stringify(pwaVersion)};\n`,
  "utf8",
);

console.log(`PWA version synced: ${pwaVersion.cacheName}`);
