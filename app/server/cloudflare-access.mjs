import { createPublicKey, verify as verifySignature } from "node:crypto";

const defaultClockToleranceSeconds = 60;
const defaultJwksCacheMilliseconds = 60 * 60 * 1000;
const maximumTokenLength = 32 * 1024;

function decodeBase64Url(value) {
  return Buffer.from(value, "base64url");
}

function decodeJsonSegment(value, label) {
  try {
    return JSON.parse(decodeBase64Url(value).toString("utf8"));
  } catch {
    throw new Error(`JWT ${label} inválido.`);
  }
}

function normalizeTeamDomain(teamDomain) {
  return String(teamDomain || "").trim().replace(/\/$/, "");
}

function audienceMatches(claim, expected) {
  if (typeof claim === "string") return claim === expected;
  return Array.isArray(claim) && claim.includes(expected);
}

export function verifyAccessJwt(token, jwk, options = {}) {
  const issuer = normalizeTeamDomain(options.issuer);
  const audience = String(options.audience || "").trim();
  const clockToleranceSeconds = Number(options.clockToleranceSeconds ?? defaultClockToleranceSeconds);
  const nowSeconds = Number(options.nowSeconds ?? Math.floor(Date.now() / 1000));

  if (!token || typeof token !== "string" || token.length > maximumTokenLength) {
    throw new Error("JWT ausente ou inválido.");
  }
  if (!issuer || !audience) throw new Error("Configuração do Access incompleta.");

  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) throw new Error("JWT malformado.");

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonSegment(encodedHeader, "header");
  const payload = decodeJsonSegment(encodedPayload, "payload");

  if (header.alg !== "RS256" || !header.kid) throw new Error("Algoritmo JWT não permitido.");
  if (!jwk || jwk.kid !== header.kid || jwk.kty !== "RSA") throw new Error("Chave JWT não encontrada.");

  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  const validSignature = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    decodeBase64Url(encodedSignature),
  );
  if (!validSignature) throw new Error("Assinatura JWT inválida.");

  if (payload.iss !== issuer) throw new Error("Emissor JWT inválido.");
  if (!audienceMatches(payload.aud, audience)) throw new Error("Audiência JWT inválida.");
  if (!Number.isFinite(payload.exp) || payload.exp <= nowSeconds - clockToleranceSeconds) {
    throw new Error("JWT expirado.");
  }
  if (Number.isFinite(payload.nbf) && payload.nbf > nowSeconds + clockToleranceSeconds) {
    throw new Error("JWT ainda não é válido.");
  }

  return payload;
}

export function createCloudflareAccessVerifier(options = {}) {
  const teamDomain = normalizeTeamDomain(options.teamDomain);
  const audience = String(options.audience || "").trim();
  const fetchImplementation = options.fetchImplementation || globalThis.fetch;
  const cacheMilliseconds = Number(options.cacheMilliseconds ?? defaultJwksCacheMilliseconds);
  let cachedKeys = [];
  let cacheExpiresAt = 0;

  if (!teamDomain || !audience) throw new Error("TEAM_DOMAIN e POLICY_AUD são obrigatórios quando o Access está ativo.");
  if (typeof fetchImplementation !== "function") throw new Error("fetch indisponível para carregar as chaves do Access.");

  async function loadKeys(forceRefresh = false) {
    if (!forceRefresh && cachedKeys.length > 0 && Date.now() < cacheExpiresAt) return cachedKeys;

    const response = await fetchImplementation(`${teamDomain}/cdn-cgi/access/certs`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Não foi possível carregar as chaves do Access.");

    const payload = await response.json();
    if (!Array.isArray(payload.keys) || payload.keys.length === 0) {
      throw new Error("O Access não retornou chaves de assinatura.");
    }

    cachedKeys = payload.keys.filter((key) => key?.kid && key.kty === "RSA");
    cacheExpiresAt = Date.now() + cacheMilliseconds;
    return cachedKeys;
  }

  return async function verifyCloudflareAccessToken(token) {
    if (!token || typeof token !== "string" || token.length > maximumTokenLength) {
      throw new Error("Token do Access ausente ou inválido.");
    }
    const headerPart = token.split(".", 1)[0];
    const header = decodeJsonSegment(headerPart, "header");
    let keys = await loadKeys();
    let key = keys.find((candidate) => candidate.kid === header.kid);

    if (!key) {
      keys = await loadKeys(true);
      key = keys.find((candidate) => candidate.kid === header.kid);
    }

    return verifyAccessJwt(token, key, {
      issuer: teamDomain,
      audience,
      clockToleranceSeconds: options.clockToleranceSeconds,
    });
  };
}
