const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export function parseVersion(value) {
  const match = VERSION_PATTERN.exec(String(value || ""));
  if (!match) throw new Error("Versão de atualização inválida.");
  return {
    numbers: match.slice(1, 4).map(Number),
    prerelease: match[4] || "",
  };
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a.numbers[index] !== b.numbers[index]) return a.numbers[index] > b.numbers[index] ? 1 : -1;
  }
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease, "en", { numeric: true });
}

export function packageTypeFor(platform, appImagePath = "") {
  if (platform === "win32") return "nsis";
  if (platform === "linux") return appImagePath ? "appimage" : "deb";
  return null;
}

export function validateRelease(payload) {
  const release = payload && typeof payload === "object" ? payload : {};
  const version = String(release.version || "");
  const file = String(release.file || "");
  const sha256 = String(release.sha256 || "").toLowerCase();
  const size = Number(release.size);
  const url = String(release.url || "");
  parseVersion(version);
  if (!/^[A-Za-z0-9._-]+$/.test(file) || file.includes("..")) throw new Error("Nome do pacote de atualização inválido.");
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("Hash da atualização inválido.");
  if (!Number.isSafeInteger(size) || size < 1) throw new Error("Tamanho da atualização inválido.");
  if (!url.startsWith("/api/desktop-updates/download/")) throw new Error("URL da atualização inválida.");
  return {
    version,
    file,
    sha256,
    size,
    url,
    target: String(release.target || ""),
    mandatory: release.mandatory === true,
    notes: String(release.notes || ""),
    publishedAt: String(release.publishedAt || ""),
  };
}
