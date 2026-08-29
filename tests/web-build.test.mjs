import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("a página carrega os recursos principais e declara o PWA", async () => {
  const html = await read("index.html");
  assert.match(html, /<html lang="pt-BR"/);
  assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
  assert.match(html, /<script defer src="config\.js"><\/script>/);
  assert.match(html, /<script defer src="app\.js"><\/script>/);
  assert.doesNotMatch(html, /type="module"/);
});

test("os clientes nativos mantêm sessão segura e notificações Android", async () => {
  const [app, desktop, android, androidManifest, androidNotifications] = await Promise.all([
    read("app.js"),
    read("desktop/main.mjs"),
    read("android/app/src/main/java/com/focusflow/app/MainActivity.java"),
    read("android/app/src/main/AndroidManifest.xml"),
    read("android/app/src/main/java/com/focusflow/app/FocusFlowNotifications.java"),
  ]);
  assert.match(app, /data-action="native-login"/);
  assert.match(app, /nativeAuthRequest\("status"\)/);
  assert.match(app, /response\.status === 401 && IS_NATIVE_CLIENT/);
  assert.match(desktop, /SecureTokenStore/);
  assert.match(desktop, /interactive: false/);
  assert.match(android, /AndroidKeyStore/);
  assert.match(android, /requireAccessToken\(false\)/);
  assert.match(android, /refreshAfterUnauthorized/);
  assert.match(android, /HttpStatusException/);
  assert.match(androidManifest, /android\.permission\.POST_NOTIFICATIONS/);
  assert.match(android, /syncNotificationState/);
  assert.match(androidNotifications, /NotificationChannel/);
  assert.match(androidNotifications, /setUsesChronometer\(true\)/);
  assert.match(androidNotifications, /setOngoing\(true\)/);
  assert.match(app, /FocusFlowAndroid\.syncNotificationState/);
});

test("a sincronização mantém formulários ativos e aplica o estado em cache depois", async () => {
  const [app, styles] = await Promise.all([read("app.js"), read("styles.css")]);
  assert.match(app, /let pendingRemoteState = null/);
  assert.match(app, /let hasHydratedState = false/);
  assert.match(app, /function hasActiveDraft\(\)/);
  assert.match(app, /if \(shouldApplyRemote && hasActiveDraft\(\)\)/);
  assert.match(app, /function applyPendingRemoteState\(\)/);
  assert.match(app, /pendingRemoteState = null;\s+state = cached\.state/);
  assert.match(app, /setTimeout\(\(\) => applyPendingRemoteState\(\), 0\)/);
  assert.match(app, /function renderDataLoading\(\)/);
  assert.match(app, /if \(!hasHydratedState\)[\s\S]*?renderDataLoading\(\)/);
  assert.match(app, /if \(syncStatus === status\) return/);
  assert.match(app, /else if \(announce\) setSyncStatus\("syncing"\)/);
  assert.match(app, /statusChanged && ui\.route === "settings"/);
  assert.match(styles, /\.sync-badge\.cached/);
  assert.match(styles, /\.data-loading-skeleton/);
  assert.doesNotMatch(styles, /@keyframes page-in/);
});

test("a configuração pública não contém dados privados de implantação", async () => {
  const [compose, environmentExample, gitignore, dockerignore, publishScript, packageJson] = await Promise.all([
    read("compose.yaml"),
    read(".env.example"),
    read(".gitignore"),
    read(".dockerignore"),
    read("scripts/publish-updates.mjs"),
    read("package.json").then(JSON.parse),
  ]);
  assert.match(compose, /POLICY_AUD:\s*"\$\{POLICY_AUD:/);
  assert.doesNotMatch(compose, /POLICY_AUD:\s*"[a-f0-9]{32,}"/i);
  assert.match(environmentExample, /replace-with-your-cloudflare-access-audience/);
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.secrets\/$/m);
  assert.match(gitignore, /^\*\.apk$/m);
  assert.match(dockerignore, /^\.env$/m);
  assert.match(publishScript, /process\.env\.FOCUSFLOW_UPDATE_HOST/);
  assert.doesNotMatch(publishScript, /const host = argument\("--host",\s*"[^"\s]+"\)/);
  assert.equal(typeof packageJson.author, "string");
});

test("a interface reparte a estimativa do projeto entre subtarefas", async () => {
  const [app, styles, domain] = await Promise.all([
    read("app.js"),
    read("styles.css"),
    read("server/domain.mjs"),
  ]);
  assert.match(app, /data-form="subtask"/);
  assert.match(app, /name="estimate"/);
  assert.match(app, /performAction\("subtask-save"/);
  assert.match(app, /performAction\("subtask-set-completed"/);
  assert.match(app, /performAction\("subtask-delete"/);
  assert.match(app, /distribuídas/);
  assert.match(app, /livres/);
  assert.match(app, /type === "projectDetail"[\s\S]*?document\.activeElement\?\.blur/);
  assert.match(app, /project-detail-hero/);
  assert.match(app, /project-detail-metrics/);
  assert.match(app, /subtask-progress-grid/);
  assert.match(app, /data-subtask-id/);
  assert.match(app, /state\.timer\.subtaskId/);
  assert.match(app, /timer-target-picker/);
  assert.match(styles, /\.subtask-budget/);
  assert.match(styles, /\.modal\.project-detail-modal/);
  assert.match(styles, /\.timer-target-option\.selected/);
  assert.match(styles, /\.project-detail-metrics\s*\{\s*display:\s*grid/);
  assert.match(domain, /case "subtask-save"/);
  assert.match(domain, /subtaskId:\s*subtask\?\.id/);
  assert.match(domain, /allocatedMinutes \+ estimateMinutes > project\.estimateMinutes/);
});

test("o service worker inclui todos os recursos locais", async () => {
  const serviceWorker = await read("service-worker.js");
  for (const asset of ["index.html", "config.js", "styles.css", "app.js", "manifest.webmanifest", "icon.svg"]) {
    assert.match(serviceWorker, new RegExp(asset.replace(".", "\\.")));
  }
});

test("a versão do aplicativo permanece alinhada entre web, desktop e Android", async () => {
  const [packageJson, config, app, android] = await Promise.all([
    read("package.json").then(JSON.parse),
    read("config.js"),
    read("app.js"),
    read("android/app/build.gradle"),
  ]);
  assert.match(config, new RegExp(`appVersion: "${packageJson.version.replaceAll(".", "\\.")}"`));
  assert.match(app, new RegExp(`appVersion \\|\\| "${packageJson.version.replaceAll(".", "\\.")}"`));
  assert.match(android, new RegExp(`versionName "${packageJson.version.replaceAll(".", "\\.")}"`));
});

test("o layout separa corretamente celular, tablet e desktop", async () => {
  const [app, styles] = await Promise.all([read("app.js"), read("styles.css")]);
  const tablet = styles.slice(styles.indexOf("@media (min-width: 800px)"), styles.indexOf("@media (min-width: 1024px)"));
  const desktop = styles.slice(styles.indexOf("@media (min-width: 1024px)"), styles.indexOf("@media (min-width: 1120px)"));
  const mobile = styles.slice(styles.indexOf("@media (max-width: 619px)"), styles.indexOf("@media (max-width: 480px)"));
  assert.match(tablet, /dashboard-grid/);
  assert.doesNotMatch(tablet, /\.sidebar\s*\{\s*display:\s*flex/);
  assert.match(desktop, /\.sidebar\s*\{\s*display:\s*flex/);
  assert.match(desktop, /\.app-main\s*\{\s*margin-left:\s*264px/);
  assert.match(mobile, /\.page-header\s*\{\s*flex-direction:\s*column/);
  assert.match(styles, /@media \(max-width: 360px\)[\s\S]*?\.timer-controls\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(styles, /safe-area-inset-bottom/);
  assert.match(app, /class="chart chart-\$\{range\}"/);
  assert.match(app, /class="topbar-account"/);
  assert.doesNotMatch(app, /class="sidebar-search"/);
  assert.doesNotMatch(app, /class="workspace-name"/);
  assert.doesNotMatch(app, /id="profile-email"/);
  assert.match(app, /id="project-search"/);
  assert.match(app, /function chartLine/);
  assert.match(styles, /--brand:\s*#f6821f/);
  assert.match(styles, /\.chart-line/);
});

test("o manifesto tem nome, rota inicial e modo standalone", async () => {
  const manifest = JSON.parse(await read("manifest.webmanifest"));
  assert.equal(manifest.short_name, "FocusFlow");
  assert.equal(manifest.start_url, "./#home");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.length > 0);
});

test("a interface oferece somente o modo escuro", async () => {
  const [html, app, styles] = await Promise.all([
    read("index.html"),
    read("app.js"),
    read("styles.css"),
  ]);
  assert.match(html, /data-theme="dark"/);
  assert.doesNotMatch(app, /theme-toggle|Tema claro|Tema escuro/);
  assert.doesNotMatch(styles, /data-theme="light"|color-scheme:\s*light/);
  assert.doesNotMatch(app, /localStorage|sessionStorage/);
  assert.match(app, /\/api\/action/);
});

test("a interface renderiza as notificações fornecidas pelo backend", async () => {
  const [app, styles] = await Promise.all([read("app.js"), read("styles.css")]);
  assert.match(app, /state\.notifications/);
  assert.match(app, /performAction\("notifications-read"/);
  assert.match(app, /data-action="notification-open"/);
  assert.match(app, /notification-mark-read/);
  assert.match(app, /name="dueDate" type="date"/);
  for (const preference of ["timerAlerts", "goalReminders", "riskAlerts", "deadlineAlerts", "weeklySummary"]) {
    assert.match(app, new RegExp(preference));
  }
  assert.match(styles, /\.notification-item\.unread/);
  assert.match(styles, /\.notification-item-button:hover/);
  assert.doesNotMatch(app, /Projeto em risco[\s\S]{0,120}Website Redesign/);
});

test("a interface permite revisar, corrigir e excluir lançamentos", async () => {
  const [app, styles] = await Promise.all([read("app.js"), read("styles.css")]);
  assert.match(app, /Revisar sessão/);
  assert.match(app, /data-action="edit-entry"/);
  assert.match(app, /data-action="delete-entry"/);
  assert.match(app, /performAction\(editing \? "entry-update" : "entry-create"/);
  assert.match(app, /Histórico de lançamentos/);
  assert.match(app, /name="startedAt" type="datetime-local"/);
  assert.match(app, /name="endedAt" type="datetime-local"/);
  assert.match(app, /Horário de Brasília/);
  assert.match(app, /data-sync-duration/);
  assert.match(app, /formatEntryTimeRange/);
  assert.match(app, /Projeto original · não pode ser alterado na correção/);
  assert.match(app, /const projectField = entry/);
  assert.match(styles, /\.data-warning/);
  assert.match(styles, /\.activity-actions/);
  assert.match(styles, /\.entry-time-fields/);
  assert.match(styles, /\.fixed-entry-project/);
});

test("o servidor local entrega a página e o manifesto", async () => {
  process.env.PORT = "0";
  const { default: server } = await import("../scripts/serve.mjs");
  if (!server.listening) await once(server, "listening");
  const { port } = server.address();

  try {
    const [page, manifest] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/index.html`),
      fetch(`http://127.0.0.1:${port}/manifest.webmanifest`),
    ]);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<title>FocusFlow<\/title>/);
    assert.equal(manifest.status, 200);
    assert.match(manifest.headers.get("content-type"), /application\/manifest\+json/);
  } finally {
    server.close();
    await once(server, "close");
    delete process.env.PORT;
  }
});
