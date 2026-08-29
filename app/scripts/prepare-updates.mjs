import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const version = packageJson.version;
const releaseNotes = String(process.env.FOCUSFLOW_UPDATE_NOTES || "Melhorias de estabilidade e segurança.").trim().slice(0, 1000);
const releaseDirectory = join(root, "release");
const updatesDirectory = join(root, "updates");
const publishedAt = new Date().toISOString();
const definitions = {
  "win32-x64-nsis": `FocusFlow-${version}-win-x64.exe`,
  "linux-x64-appimage": `FocusFlow-${version}-linux-x86_64.AppImage`,
  "linux-x64-deb": `FocusFlow-${version}-linux-amd64.deb`,
};

async function sha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

await mkdir(updatesDirectory, { recursive: true });
const targets = {};
for (const [target, file] of Object.entries(definitions)) {
  const source = join(releaseDirectory, file);
  const fileStat = await stat(source);
  if (!fileStat.isFile()) throw new Error(`Artefato não encontrado: ${file}`);
  await copyFile(source, join(updatesDirectory, file));
  targets[target] = {
    version,
    file,
    size: fileStat.size,
    sha256: await sha256(source),
    mandatory: false,
    publishedAt,
    notes: releaseNotes,
  };
}

const catalog = { schema: 1, channel: "stable", generatedAt: publishedAt, targets };
await writeFile(join(updatesDirectory, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Catálogo ${version} criado em ${updatesDirectory}`);
