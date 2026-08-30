(() => {
  if (!globalThis.FocusFlowConfig?.demoMode) return;

  const domain = globalThis.FocusFlowDomain;
  const identity = Object.freeze({
    id: "demo:github-pages",
    email: "demo@focusflow.local",
    name: "Visitante Demo",
  });
  const storageKey = "focusflow-static-demo-v1";
  const originalFetch = globalThis.fetch.bind(globalThis);
  let revision = 1;
  let state = loadState();

  function loadState() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (saved?.state && Number.isInteger(saved.revision)) {
        revision = Math.max(1, saved.revision);
        return domain.normalizeState(saved.state, identity);
      }
    } catch {
      // Ambientes que bloqueiam sessionStorage continuam funcionando em memória.
    }
    return globalThis.createFocusFlowDemoState(identity);
  }

  function persist() {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ state, revision }));
    } catch {
      // A sessão em memória ainda é suficiente para explorar a demonstração.
    }
  }

  function jsonResponse(payload, status = 200, headers = {}) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
    });
  }

  async function requestBody(input, options) {
    if (typeof options?.body === "string") return JSON.parse(options.body || "{}");
    if (input instanceof Request) return JSON.parse(await input.clone().text() || "{}");
    return {};
  }

  globalThis.fetch = async (input, options = {}) => {
    const rawUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(rawUrl, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith("/api/")) {
      return originalFetch(input, options);
    }

    const method = String(options.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const updatedAt = new Date().toISOString();

    if (url.pathname === "/api/health" && method === "GET") {
      return jsonResponse({ status: "ok", database: "session", demoMode: true, timestamp: updatedAt });
    }
    if (url.pathname === "/api/auth" && method === "GET") {
      return jsonResponse({ authenticated: false, user: null });
    }
    if (url.pathname === "/api/state" && method === "GET") {
      return jsonResponse({ state: domain.buildClientState(state, identity), revision, updatedAt, demoMode: true });
    }
    if (url.pathname === "/api/action" && method === "POST") {
      try {
        const body = await requestBody(input, options);
        if (Number.isInteger(body.baseRevision) && body.baseRevision !== revision) {
          return jsonResponse({ error: "Os dados foram atualizados em outra aba.", revision, updatedAt }, 409);
        }
        state = body.action === "reset"
          ? globalThis.createFocusFlowDemoState(identity)
          : domain.applyAction(state, body.action, body.payload, identity);
        revision += 1;
        persist();
        return jsonResponse({ state: domain.buildClientState(state, identity), revision, updatedAt, demoMode: true });
      } catch (error) {
        return jsonResponse({ error: error.message || "Não foi possível concluir a ação." }, error.statusCode || 422);
      }
    }
    if (url.pathname === "/api/export" && method === "GET") {
      try {
        const exported = domain.exportState(state, url.searchParams.get("format"), identity);
        return new Response(exported.content, {
          status: 200,
          headers: {
            "Content-Type": exported.contentType,
            "X-FocusFlow-Filename": exported.filename,
            "Cache-Control": "no-store",
          },
        });
      } catch (error) {
        return jsonResponse({ error: error.message || "Formato inválido." }, error.statusCode || 422);
      }
    }

    return jsonResponse({ error: "Endpoint não encontrado." }, 404);
  };
})();
