import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compareVersions, packageTypeFor, validateRelease } from "../desktop/update-domain.mjs";
import { DesktopUpdater } from "../desktop/updater.mjs";
import { createFocusFlowServer } from "../server/index.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");

test("o domínio de atualizações compara versões e valida o contrato do backend", () => {
  assert.equal(compareVersions("1.3.0", "1.2.9"), 1);
  assert.equal(compareVersions("1.3.0", "1.3.0"), 0);
  assert.equal(compareVersions("1.3.0-beta.2", "1.3.0"), -1);
  assert.equal(packageTypeFor("win32"), "nsis");
  assert.equal(packageTypeFor("linux", "/opt/FocusFlow.AppImage"), "appimage");
  assert.equal(packageTypeFor("linux"), "deb");
  assert.throws(() => validateRelease({ version: "1.3.0", file: "../evil.exe" }), /pacote|Hash/i);
});

test("o backend entrega somente pacotes publicados e autenticados, inclusive por intervalo", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "focusflow-updates-api-"));
  const updatesRoot = join(temporaryDirectory, "updates");
  await mkdir(updatesRoot);
  const contents = Buffer.from("pacote-focusflow-validado");
  const file = "FocusFlow-1.3.0-win-x64.exe";
  await writeFile(join(updatesRoot, file), contents);
  await writeFile(join(updatesRoot, "catalog.json"), JSON.stringify({
    schema: 1,
    targets: {
      "win32-x64-nsis": {
        version: "1.3.0",
        file,
        size: contents.length,
        sha256: hash(contents),
        notes: "Atualização segura",
      },
    },
  }));
  const server = createFocusFlowServer({
    dataFile: join(temporaryDirectory, "data.sqlite"),
    updatesRoot,
    requireAccessAuth: true,
    verifyAccessToken: async (token) => {
      if (token !== "valid-token") throw new Error("invalid");
      return { sub: "test-user", email: "user@example.com" };
    },
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const headers = { "Cf-Access-Jwt-Assertion": "valid-token" };

  try {
    const latestPath = "/api/desktop-updates/latest?platform=win32&arch=x64&package=nsis";
    assert.equal((await fetch(`${baseUrl}${latestPath}`)).status, 401);
    const latest = await fetch(`${baseUrl}${latestPath}`, { headers });
    assert.equal(latest.status, 200);
    const payload = await latest.json();
    assert.equal(payload.version, "1.3.0");
    assert.equal(payload.sha256, hash(contents));
    assert.equal(payload.url, `/api/desktop-updates/download/${file}`);

    const partial = await fetch(`${baseUrl}${payload.url}`, { headers: { ...headers, Range: "bytes=7-15" } });
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get("content-range"), `bytes 7-15/${contents.length}`);
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()), contents.subarray(7, 16));

    assert.equal((await fetch(`${baseUrl}/api/desktop-updates/download/nao-publicado.exe`, { headers })).status, 404);
    assert.equal((await fetch(`${baseUrl}/api/desktop-updates/latest?platform=darwin&arch=x64&package=dmg`, { headers })).status, 400);
  } finally {
    server.close();
    await once(server, "close");
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("o cliente baixa o pacote em streaming e verifica SHA-256 antes de liberá-lo", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "focusflow-updater-"));
  const contents = Buffer.from("instalador-validado-pelo-backend");
  const file = "FocusFlow-1.3.0-win-x64.exe";
  const release = {
    version: "1.3.0",
    file,
    size: contents.length,
    sha256: hash(contents),
    url: `/api/desktop-updates/download/${file}`,
    target: "win32-x64-nsis",
  };
  const calls = [];
  const updater = new DesktopUpdater({
    app: {
      isPackaged: true,
      getVersion: () => "1.2.0",
      getPath: () => temporaryDirectory,
      quit() {},
    },
    oauth: {
      async authorizedFetch(path, init, options) {
        calls.push(path);
        assert.deepEqual(options, { interactive: false });
        return path.startsWith("/api/desktop-updates/latest")
          ? Response.json(release)
          : new Response(contents, { headers: { "Content-Type": "application/octet-stream" } });
      },
    },
    shell: { openPath: async () => "" },
    platform: "win32",
    arch: "x64",
  });

  try {
    const status = await updater.check();
    assert.equal(status.status, "ready");
    assert.equal(status.progress, 100);
    assert.equal(calls.length, 2);
    assert.deepEqual(await readFile(join(temporaryDirectory, "updates", file)), contents);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
