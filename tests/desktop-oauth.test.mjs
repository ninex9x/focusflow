import assert from "node:assert/strict";
import test from "node:test";
import { AuthenticationRequiredError, ManagedOAuthClient } from "../desktop/oauth.mjs";

test("o cliente desktop descobre e registra um cliente OAuth loopback", async () => {
  const calls = [];
  const client = new ManagedOAuthClient({
    resource: "https://focusflow.example.com",
    fetchImplementation: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      if (String(url).includes(".well-known")) {
        return Response.json({
          authorization_endpoint: "https://example-team.cloudflareaccess.com/oauth/authorize",
          token_endpoint: "https://example-team.cloudflareaccess.com/oauth/token",
          registration_endpoint: "https://example-team.cloudflareaccess.com/oauth/register",
        });
      }
      return Response.json({ client_id: "desktop-client" }, { status: 201 });
    },
  });

  assert.equal(await client.registerClient("http://127.0.0.1:43123/oauth/callback"), "desktop-client");
  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(calls[1].init.body).redirect_uris, ["http://127.0.0.1:43123/oauth/callback"]);
  assert.equal(JSON.parse(calls[1].init.body).token_endpoint_auth_method, "none");
});

test("o cliente desktop envia o token opaco apenas ao recurso protegido", async () => {
  let receivedAuthorization;
  const client = new ManagedOAuthClient({
    resource: "https://focusflow.example.com",
    fetchImplementation: async (url, init = {}) => {
      assert.equal(String(url), "https://focusflow.example.com/api/state");
      receivedAuthorization = init.headers.Authorization;
      return Response.json({ state: {} });
    },
  });
  client.getAccessToken = async () => "oauth:opaque-access-token";

  const response = await client.authorizedFetch("/api/state");
  assert.equal(response.status, 200);
  assert.equal(receivedAuthorization, "Bearer oauth:opaque-access-token");
});

test("o cliente desktop restaura a sessão persistida sem abrir um novo login", async () => {
  let loads = 0;
  const client = new ManagedOAuthClient({
    tokenStore: {
      async load() {
        loads += 1;
        return {
          accessToken: "oauth:persisted-access-token",
          refreshToken: "oauth:persisted-refresh-token",
          clientId: "desktop-client",
          expiresAt: Date.now() + 60_000,
        };
      },
    },
  });

  assert.equal(await client.getAccessToken(), "oauth:persisted-access-token");
  assert.equal(await client.getAccessToken(), "oauth:persisted-access-token");
  assert.equal(loads, 1);
});

test("o cliente desktop persiste tokens renovados e limpa sessões recusadas", async () => {
  const saved = [];
  let cleared = 0;
  const client = new ManagedOAuthClient({
    tokenStore: {
      async load() {
        return null;
      },
      async save(tokens) {
        saved.push(tokens);
      },
      async clear() {
        cleared += 1;
      },
    },
  });

  await client.storeTokens({
    access_token: "oauth:new-access-token",
    refresh_token: "oauth:new-refresh-token",
    expires_in: 300,
  }, "desktop-client");
  assert.equal(saved[0].refreshToken, "oauth:new-refresh-token");

  await client.clearTokens();
  assert.equal(client.tokens, null);
  assert.equal(cleared, 1);
});

test("o cliente desktop não abre o navegador sem ação explícita do usuário", async () => {
  let browserOpens = 0;
  const client = new ManagedOAuthClient({
    openExternal: async () => {
      browserOpens += 1;
    },
    tokenStore: { async load() { return null; } },
  });

  assert.equal(await client.hasSession(), false);
  await assert.rejects(
    client.getAccessToken({ interactive: false }),
    AuthenticationRequiredError,
  );
  assert.equal(browserOpens, 0);
});

test("requisições simultâneas compartilham uma única renovação de token", async () => {
  let refreshCalls = 0;
  const saved = [];
  const client = new ManagedOAuthClient({
    fetchImplementation: async () => {
      refreshCalls += 1;
      return Response.json({ access_token: "oauth:renewed-access-token", expires_in: 300 });
    },
    tokenStore: {
      async save(tokens) {
        saved.push(tokens);
      },
    },
  });
  client.metadata = { tokenEndpoint: "https://example-team.cloudflareaccess.com/oauth/token" };
  client.tokens = {
    accessToken: "oauth:expired-access-token",
    refreshToken: "oauth:stable-refresh-token",
    clientId: "desktop-client",
    expiresAt: Date.now() - 1,
  };
  client.tokensLoaded = true;

  const tokens = await Promise.all([
    client.getAccessToken({ interactive: false }),
    client.getAccessToken({ interactive: false }),
    client.getAccessToken({ interactive: false }),
  ]);

  assert.deepEqual(tokens, [
    "oauth:renewed-access-token",
    "oauth:renewed-access-token",
    "oauth:renewed-access-token",
  ]);
  assert.equal(refreshCalls, 1);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].refreshToken, "oauth:stable-refresh-token");
});

test("um 401 renova o acesso silenciosamente antes de encerrar a sessão", async () => {
  let apiCalls = 0;
  let refreshCalls = 0;
  let cleared = 0;
  const client = new ManagedOAuthClient({
    resource: "https://focusflow.example.com",
    fetchImplementation: async (url, init = {}) => {
      if (String(url).includes("/oauth/token")) {
        refreshCalls += 1;
        return Response.json({ access_token: "oauth:renewed-access-token", expires_in: 300 });
      }
      apiCalls += 1;
      return init.headers.Authorization === "Bearer oauth:renewed-access-token"
        ? Response.json({ state: { ok: true } })
        : Response.json({ error: "token rejeitado" }, { status: 401 });
    },
    tokenStore: {
      async save() {},
      async clear() {
        cleared += 1;
      },
    },
  });
  client.metadata = { tokenEndpoint: "https://example-team.cloudflareaccess.com/oauth/token" };
  client.tokens = {
    accessToken: "oauth:apparently-valid-access-token",
    refreshToken: "oauth:stable-refresh-token",
    clientId: "desktop-client",
    expiresAt: Date.now() + 60_000,
  };
  client.tokensLoaded = true;

  const response = await client.authorizedFetch("/api/state", {}, { interactive: false });

  assert.equal(response.status, 200);
  assert.equal(apiCalls, 2);
  assert.equal(refreshCalls, 1);
  assert.equal(cleared, 0);
  assert.equal(client.tokens.refreshToken, "oauth:stable-refresh-token");
});

test("uma falha temporária na renovação preserva a sessão persistida", async () => {
  let cleared = 0;
  const client = new ManagedOAuthClient({
    fetchImplementation: async () => {
      throw new Error("rede temporariamente indisponível");
    },
    tokenStore: {
      async clear() {
        cleared += 1;
      },
    },
  });
  client.metadata = { tokenEndpoint: "https://example-team.cloudflareaccess.com/oauth/token" };
  client.tokens = {
    accessToken: "oauth:expired-access-token",
    refreshToken: "oauth:stable-refresh-token",
    clientId: "desktop-client",
    expiresAt: Date.now() - 1,
  };
  client.tokensLoaded = true;

  await assert.rejects(
    client.getAccessToken({ interactive: false }),
    /rede temporariamente indisponível/,
  );
  assert.equal(cleared, 0);
  assert.equal(client.tokens.refreshToken, "oauth:stable-refresh-token");
});
