import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function normalizeTokens(value) {
  if (!value || typeof value !== "object") throw new Error("Sessão OAuth inválida.");
  const accessToken = typeof value.accessToken === "string" ? value.accessToken : "";
  const refreshToken = typeof value.refreshToken === "string" && value.refreshToken ? value.refreshToken : null;
  const clientId = typeof value.clientId === "string" ? value.clientId : "";
  const expiresAt = Number(value.expiresAt);
  if (!accessToken || !clientId || !Number.isFinite(expiresAt) || expiresAt <= 0) {
    throw new Error("Sessão OAuth incompleta.");
  }
  return { accessToken, refreshToken, clientId, expiresAt };
}

export class SecureTokenStore {
  constructor({ filePath, isEncryptionAvailable, encryptString, decryptString }) {
    this.resolveFilePath = typeof filePath === "function" ? filePath : () => filePath;
    this.isEncryptionAvailable = isEncryptionAvailable;
    this.encryptString = encryptString;
    this.decryptString = decryptString;
  }

  encryptionAvailable() {
    try {
      return Boolean(this.isEncryptionAvailable());
    } catch {
      return false;
    }
  }

  filePath() {
    const value = this.resolveFilePath();
    if (typeof value !== "string" || !value) throw new Error("Destino da sessão OAuth inválido.");
    return value;
  }

  async load() {
    if (!this.encryptionAvailable()) return null;
    try {
      const encrypted = await readFile(this.filePath());
      const payload = JSON.parse(this.decryptString(encrypted));
      if (payload.schema !== 1) throw new Error("Formato de sessão OAuth incompatível.");
      return normalizeTokens(payload.tokens);
    } catch (error) {
      if (error?.code !== "ENOENT") await this.clear();
      return null;
    }
  }

  async save(tokens) {
    if (!this.encryptionAvailable()) return false;
    const filePath = this.filePath();
    const temporaryPath = `${filePath}.tmp`;
    const encrypted = this.encryptString(JSON.stringify({ schema: 1, tokens: normalizeTokens(tokens) }));
    await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
    await writeFile(temporaryPath, encrypted, { mode: 0o600 });
    await rename(temporaryPath, filePath);
    await chmod(filePath, 0o600).catch(() => {});
    return true;
  }

  async clear() {
    const filePath = this.filePath();
    await Promise.all([
      rm(filePath, { force: true }),
      rm(`${filePath}.tmp`, { force: true }),
    ]);
  }
}
