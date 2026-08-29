import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SecureTokenStore } from "../desktop/secure-token-store.mjs";

const tokens = {
  accessToken: "oauth:secret-access-token",
  refreshToken: "oauth:secret-refresh-token",
  clientId: "desktop-client",
  expiresAt: 1_900_000_000_000,
};

test("o armazenamento desktop cifra, restaura e remove a sessão OAuth", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "focusflow-token-store-"));
  const filePath = join(temporaryDirectory, "oauth-session.bin");
  const store = new SecureTokenStore({
    filePath,
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`sealed:${Buffer.from(value).toString("base64")}`),
    decryptString: (value) => Buffer.from(String(value).slice("sealed:".length), "base64").toString("utf8"),
  });

  try {
    assert.equal(await store.save(tokens), true);
    const encrypted = await readFile(filePath, "utf8");
    assert.doesNotMatch(encrypted, /secret-access-token|secret-refresh-token/);
    assert.deepEqual(await store.load(), tokens);
    await store.clear();
    assert.equal(await store.load(), null);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("o armazenamento desktop não grava tokens sem cofre seguro disponível", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "focusflow-token-store-disabled-"));
  const filePath = join(temporaryDirectory, "oauth-session.bin");
  const store = new SecureTokenStore({
    filePath,
    isEncryptionAvailable: () => false,
    encryptString: () => {
      throw new Error("não deveria cifrar");
    },
    decryptString: () => {
      throw new Error("não deveria decifrar");
    },
  });

  try {
    assert.equal(await store.save(tokens), false);
    assert.equal(await store.load(), null);
    await assert.rejects(readFile(filePath), { code: "ENOENT" });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
