import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

const DEFAULT_RESOURCE = "https://flow.sosaiko.com";
const TOKEN_EXPIRY_MARGIN_MS = 30_000;

export class AuthenticationRequiredError extends Error {
  constructor(message = "Entre no FocusFlow para continuar.") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

function encodeForm(values) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") form.set(key, String(value));
  }
  return form;
}

function ensureHttpsEndpoint(value, expectedHostSuffix = ".cloudflareaccess.com") {
  const url = new URL(value);
  if (url.protocol !== "https:" || !url.hostname.endsWith(expectedHostSuffix)) {
    throw new Error("Endpoint OAuth não confiável.");
  }
  return url.toString();
}

async function readJsonResponse(response, label) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || `${label} falhou (${response.status}).`);
  }
  return payload;
}

function createLoopbackCallback(timeoutMilliseconds) {
  let resolveCallback;
  let rejectCallback;
  const callback = new Promise((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });

  const server = createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname !== "/oauth/callback") {
      response.writeHead(404).end();
      return;
    }

    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "Cache-Control": "no-store",
    });
    response.end("<!doctype html><meta charset=utf-8><title>FocusFlow</title><style>body{background:#050505;color:#f5f7fa;font:16px system-ui;display:grid;place-items:center;min-height:100vh;margin:0}main{text-align:center}</style><main><h1>Login concluído</h1><p>Você pode fechar esta janela e voltar ao FocusFlow.</p></main>");

    const error = url.searchParams.get("error");
    if (error) rejectCallback(new Error(url.searchParams.get("error_description") || error));
    else resolveCallback({ code: url.searchParams.get("code"), state: url.searchParams.get("state") });
  });

  const timeout = setTimeout(() => rejectCallback(new Error("Tempo de login esgotado.")), timeoutMilliseconds);

  return {
    async listen() {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address();
      return `http://127.0.0.1:${address.port}/oauth/callback`;
    },
    callback,
    close() {
      clearTimeout(timeout);
      server.close();
    },
  };
}

export class ManagedOAuthClient {
  constructor(options = {}) {
    this.resource = String(options.resource || DEFAULT_RESOURCE).replace(/\/$/, "");
    this.fetchImplementation = options.fetchImplementation || globalThis.fetch;
    this.openExternal = options.openExternal;
    this.tokenStore = options.tokenStore || null;
    this.loginTimeoutMilliseconds = options.loginTimeoutMilliseconds || 5 * 60 * 1000;
    this.metadata = null;
    this.tokens = null;
    this.tokensLoaded = false;
    this.tokenLoadPromise = null;
    this.loginPromise = null;
    this.refreshPromise = null;
  }

  async loadPersistedTokens() {
    if (this.tokensLoaded) return;
    if (!this.tokenLoadPromise) {
      this.tokenLoadPromise = Promise.resolve(this.tokenStore?.load?.())
        .then((tokens) => {
          if (!this.tokens && tokens) this.tokens = tokens;
          this.tokensLoaded = true;
        })
        .catch(() => {
          this.tokensLoaded = true;
        })
        .finally(() => {
          this.tokenLoadPromise = null;
        });
    }
    await this.tokenLoadPromise;
  }

  async clearTokens(expectedAccessToken = null) {
    if (expectedAccessToken && this.tokens?.accessToken !== expectedAccessToken) return false;
    this.tokens = null;
    this.tokensLoaded = true;
    await this.tokenStore?.clear?.().catch(() => {});
    return true;
  }

  async hasSession() {
    await this.loadPersistedTokens();
    return Boolean(this.tokens && (this.tokens.refreshToken || Date.now() < this.tokens.expiresAt - TOKEN_EXPIRY_MARGIN_MS));
  }

  async discover() {
    if (this.metadata) return this.metadata;
    const response = await this.fetchImplementation(`${this.resource}/.well-known/oauth-authorization-server`, {
      headers: { Accept: "application/json" },
    });
    const metadata = await readJsonResponse(response, "Descoberta OAuth");
    this.metadata = {
      authorizationEndpoint: ensureHttpsEndpoint(metadata.authorization_endpoint),
      tokenEndpoint: ensureHttpsEndpoint(metadata.token_endpoint),
      registrationEndpoint: ensureHttpsEndpoint(metadata.registration_endpoint),
    };
    return this.metadata;
  }

  async registerClient(redirectUri) {
    const metadata = await this.discover();
    const response = await this.fetchImplementation(metadata.registrationEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_name: "FocusFlow Desktop",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      }),
    });
    const registration = await readJsonResponse(response, "Registro do cliente OAuth");
    if (!registration.client_id) throw new Error("O Access não retornou um client_id.");
    return registration.client_id;
  }

  async login() {
    if (this.loginPromise) return this.loginPromise;
    this.loginPromise = this.performLogin().finally(() => {
      this.loginPromise = null;
    });
    return this.loginPromise;
  }

  async performLogin() {
    if (typeof this.openExternal !== "function") throw new Error("Navegador externo indisponível.");
    const callbackServer = createLoopbackCallback(this.loginTimeoutMilliseconds);

    try {
      const redirectUri = await callbackServer.listen();
      const [metadata, clientId] = await Promise.all([
        this.discover(),
        this.registerClient(redirectUri),
      ]);
      const state = randomBytes(24).toString("base64url");
      const verifier = randomBytes(48).toString("base64url");
      const challenge = createHash("sha256").update(verifier).digest("base64url");
      const authorizationUrl = new URL(metadata.authorizationEndpoint);
      authorizationUrl.search = encodeForm({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
        resource: this.resource,
      }).toString();

      await this.openExternal(authorizationUrl.toString());
      const callback = await callbackServer.callback;
      if (!callback.code || callback.state !== state) throw new Error("Retorno OAuth inválido.");

      const response = await this.fetchImplementation(metadata.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: encodeForm({
          grant_type: "authorization_code",
          code: callback.code,
          client_id: clientId,
          redirect_uri: redirectUri,
          code_verifier: verifier,
          resource: this.resource,
        }),
      });
      const tokenPayload = await readJsonResponse(response, "Troca do código OAuth");
      await this.storeTokens(tokenPayload, clientId);
      return this.tokens.accessToken;
    } finally {
      callbackServer.close();
    }
  }

  async storeTokens(payload, clientId) {
    if (!payload.access_token) throw new Error("O Access não retornou um token.");
    this.tokens = {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token || null,
      clientId,
      expiresAt: Date.now() + Math.max(1, Number(payload.expires_in || 300)) * 1000,
    };
    this.tokensLoaded = true;
    await this.tokenStore?.save?.(this.tokens).catch(() => {});
  }

  async refresh(options = {}) {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.performRefresh(options).finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  async performRefresh({ interactive = true } = {}) {
    const currentTokens = this.tokens;
    if (!currentTokens?.refreshToken) {
      if (!interactive) throw new AuthenticationRequiredError();
      return this.login();
    }
    const metadata = await this.discover();
    const response = await this.fetchImplementation(metadata.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: encodeForm({
        grant_type: "refresh_token",
        refresh_token: currentTokens.refreshToken,
        client_id: currentTokens.clientId,
        resource: this.resource,
      }),
    });
    if (!response.ok) {
      const cleared = await this.clearTokens(currentTokens.accessToken);
      if (!cleared && this.tokens) return this.tokens.accessToken;
      if (!interactive) throw new AuthenticationRequiredError("Sua sessão expirou. Entre novamente.");
      return this.login();
    }
    const payload = await response.json();
    await this.storeTokens({ ...payload, refresh_token: payload.refresh_token || currentTokens.refreshToken }, currentTokens.clientId);
    return this.tokens.accessToken;
  }

  async getAccessToken({ interactive = true } = {}) {
    await this.loadPersistedTokens();
    if (!this.tokens) {
      if (!interactive) throw new AuthenticationRequiredError();
      return this.login();
    }
    if (Date.now() >= this.tokens.expiresAt - TOKEN_EXPIRY_MARGIN_MS) return this.refresh({ interactive });
    return this.tokens.accessToken;
  }

  async authorizedFetch(path, init = {}, { interactive = true } = {}) {
    const request = async () => {
      const token = await this.getAccessToken({ interactive });
      const response = await this.fetchImplementation(new URL(path, `${this.resource}/`), {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${token}` },
        redirect: "manual",
      });
      return { response, accessToken: token };
    };

    let attempt = await request();
    if (attempt.response.status !== 401) return attempt.response;

    if (this.tokens?.accessToken === attempt.accessToken) {
      try {
        await this.refresh({ interactive: false });
      } catch (error) {
        if (!(interactive && error instanceof AuthenticationRequiredError)) throw error;
        await this.login();
      }
    }

    attempt = await request();
    if (attempt.response.status !== 401) return attempt.response;

    const cleared = await this.clearTokens(attempt.accessToken);
    if (!cleared && this.tokens) return (await request()).response;
    if (!interactive) throw new AuthenticationRequiredError("Sua sessão expirou. Entre novamente.");
    await this.login();
    return (await request()).response;
  }
}
