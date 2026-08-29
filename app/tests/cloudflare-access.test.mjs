import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { createCloudflareAccessVerifier, verifyAccessJwt } from "../server/cloudflare-access.mjs";

const issuer = "https://example-team.cloudflareaccess.com";
const audience = "focusflow-test-audience";
const nowSeconds = 1_800_000_000;
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = { ...publicKey.export({ format: "jwk" }), alg: "RS256", kid: "test-key", use: "sig" };

function createToken(overrides = {}, signingKey = privateKey) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: publicJwk.kid, typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: issuer,
    aud: audience,
    sub: "user-id",
    email: "usuario@example.com",
    nbf: nowSeconds - 10,
    exp: nowSeconds + 300,
    ...overrides,
  })).toString("base64url");
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), signingKey).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

test("valida assinatura e claims do JWT do Cloudflare Access", () => {
  const payload = verifyAccessJwt(createToken(), publicJwk, { issuer, audience, nowSeconds });
  assert.equal(payload.email, "usuario@example.com");
  assert.throws(
    () => verifyAccessJwt(createToken({ aud: "outro-app" }), publicJwk, { issuer, audience, nowSeconds }),
    /Audiência JWT inválida/,
  );
  assert.throws(
    () => verifyAccessJwt(createToken({ exp: nowSeconds - 120 }), publicJwk, { issuer, audience, nowSeconds }),
    /JWT expirado/,
  );
});

test("carrega e reutiliza o JWKS publicado pelo Access", async () => {
  let requests = 0;
  const verifier = createCloudflareAccessVerifier({
    teamDomain: `${issuer}/`,
    audience,
    clockToleranceSeconds: Number.MAX_SAFE_INTEGER,
    fetchImplementation: async (url) => {
      requests += 1;
      assert.equal(url, `${issuer}/cdn-cgi/access/certs`);
      return new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  assert.equal((await verifier(createToken())).sub, "user-id");
  assert.equal((await verifier(createToken())).sub, "user-id");
  assert.equal(requests, 1);
});
