import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants, createWriteStream } from "node:fs";
import { access, chmod, copyFile, mkdir, rename, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { compareVersions, packageTypeFor, validateRelease } from "./update-domain.mjs";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function displayError(error) {
  return String(error?.message || "Não foi possível atualizar o FocusFlow.").slice(0, 300);
}

export class DesktopUpdater {
  constructor({ app, oauth, shell, platform = process.platform, arch = process.arch, appImagePath = process.env.APPIMAGE || "" }) {
    this.app = app;
    this.oauth = oauth;
    this.shell = shell;
    this.platform = platform;
    this.arch = arch;
    this.appImagePath = appImagePath;
    this.packageType = packageTypeFor(platform, appImagePath);
    this.release = null;
    this.downloadedFile = null;
    this.checkPromise = null;
    this.timer = null;
    this.state = {
      status: this.packageType ? "idle" : "unsupported",
      currentVersion: app.getVersion(),
      platform,
      arch,
      packageType: this.packageType,
      progress: 0,
      message: this.packageType ? "Atualizações automáticas ativadas." : "Sistema não suportado para atualização automática.",
    };
  }

  getStatus() {
    return { ...this.state };
  }

  setState(values) {
    this.state = { ...this.state, ...values };
  }

  start() {
    if (!this.packageType || !this.app.isPackaged || this.timer) return;
    const firstCheck = setTimeout(() => this.check().catch(() => {}), 20_000);
    firstCheck.unref?.();
    this.timer = setInterval(() => this.check().catch(() => {}), CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async check() {
    if (!this.packageType) return this.getStatus();
    if (!this.app.isPackaged) {
      this.setState({ status: "development", message: "Verificação disponível no aplicativo instalado." });
      return this.getStatus();
    }
    if (this.checkPromise) return this.checkPromise;
    this.checkPromise = this.performCheck().finally(() => {
      this.checkPromise = null;
    });
    return this.checkPromise;
  }

  async performCheck() {
    this.setState({ status: "checking", progress: 0, message: "Consultando o servidor de atualizações..." });
    try {
      const query = new URLSearchParams({ platform: this.platform, arch: this.arch, package: this.packageType });
      const response = await this.oauth.authorizedFetch(`/api/desktop-updates/latest?${query}`, {}, { interactive: false });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Servidor de atualizações respondeu ${response.status}.`);
      const release = validateRelease(payload);
      if (compareVersions(release.version, this.app.getVersion()) <= 0) {
        this.release = null;
        this.downloadedFile = null;
        this.setState({ status: "up-to-date", version: release.version, progress: 100, message: "Você está usando a versão mais recente." });
        return this.getStatus();
      }
      this.release = release;
      this.setState({ status: "available", version: release.version, notes: release.notes, mandatory: release.mandatory, progress: 0, message: `Versão ${release.version} disponível.` });
      await this.download(release);
    } catch (error) {
      this.setState({ status: "error", progress: 0, message: displayError(error) });
    }
    return this.getStatus();
  }

  async download(release = this.release) {
    if (!release) throw new Error("Nenhuma atualização disponível.");
    const updatesDirectory = join(this.app.getPath("userData"), "updates");
    const finalPath = join(updatesDirectory, basename(release.file));
    const partialPath = `${finalPath}.partial`;
    await mkdir(updatesDirectory, { recursive: true });
    await rm(partialPath, { force: true });
    this.setState({ status: "downloading", progress: 0, message: `Baixando a versão ${release.version}...` });

    try {
      const response = await this.oauth.authorizedFetch(release.url, { headers: { Accept: "application/octet-stream" } }, { interactive: false });
      if (!response.ok || !response.body) throw new Error(`Download da atualização falhou (${response.status}).`);
      const hash = createHash("sha256");
      let received = 0;
      let reportedProgress = -1;
      const verifier = new Transform({
        transform: (chunk, encoding, callback) => {
          received += chunk.length;
          hash.update(chunk);
          const progress = Math.min(99, Math.floor((received / release.size) * 100));
          if (progress !== reportedProgress) {
            reportedProgress = progress;
            this.setState({ progress, message: `Baixando a versão ${release.version}: ${progress}%` });
          }
          callback(null, chunk);
        },
      });
      await pipeline(Readable.fromWeb(response.body), verifier, createWriteStream(partialPath, { flags: "wx" }));
      if (received !== release.size) throw new Error("O pacote baixado está incompleto.");
      if (hash.digest("hex") !== release.sha256) throw new Error("A assinatura SHA-256 do pacote não confere.");
      await rm(finalPath, { force: true });
      await rename(partialPath, finalPath);
      this.downloadedFile = finalPath;
      this.setState({ status: "ready", progress: 100, message: `Versão ${release.version} pronta para instalar.` });
    } catch (error) {
      await rm(partialPath, { force: true }).catch(() => {});
      this.setState({ status: "error", progress: 0, message: displayError(error) });
      throw error;
    }
    return this.getStatus();
  }

  async install() {
    if (!this.release || !this.downloadedFile || this.state.status !== "ready") throw new Error("A atualização ainda não está pronta.");
    this.setState({ status: "installing", message: "Iniciando a instalação..." });
    try {
      if (this.platform === "win32") {
        spawn(this.downloadedFile, [], { detached: true, stdio: "ignore" }).unref();
        setTimeout(() => this.app.quit(), 500);
        return this.getStatus();
      }
      if (this.packageType === "appimage") {
        await this.replaceAppImage();
        return this.getStatus();
      }
      const openError = await this.shell.openPath(this.downloadedFile);
      if (openError) throw new Error(openError);
      this.setState({ status: "installing", message: "Confirme a instalação no gerenciador de pacotes do Linux." });
      return this.getStatus();
    } catch (error) {
      this.setState({ status: "error", message: displayError(error) });
      throw error;
    }
  }

  async replaceAppImage() {
    const currentPath = resolve(this.appImagePath);
    const stagedPath = `${currentPath}.update`;
    const backupPath = `${currentPath}.previous`;
    if (!this.appImagePath || dirname(currentPath) === currentPath) throw new Error("Caminho do AppImage atual inválido.");
    await access(dirname(currentPath), constants.W_OK);
    await rm(stagedPath, { force: true });
    await copyFile(this.downloadedFile, stagedPath);
    await chmod(stagedPath, 0o755);
    await rm(backupPath, { force: true });
    await rename(currentPath, backupPath);
    try {
      await rename(stagedPath, currentPath);
    } catch (error) {
      await rename(backupPath, currentPath).catch(() => {});
      throw error;
    }
    spawn(currentPath, [], { detached: true, stdio: "ignore", env: process.env }).unref();
    setTimeout(() => this.app.quit(), 500);
  }
}
