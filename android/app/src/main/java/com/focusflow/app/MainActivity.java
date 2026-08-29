package com.focusflow.app;

import android.annotation.SuppressLint;
import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Iterator;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class MainActivity extends Activity {
    static final String NOTIFICATION_ROUTE_EXTRA = "focusflow_notification_route";
    private static final int NOTIFICATION_PERMISSION_REQUEST = 4102;
    private static final String RESOURCE = "https://flow.sosaiko.com";
    private static final int LOGIN_TIMEOUT_MILLISECONDS = 5 * 60 * 1000;
    private static final int NETWORK_TIMEOUT_MILLISECONDS = 20 * 1000;
    private static final int MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
    private static final String TOKEN_PREFERENCES = "focusflow_auth";
    private static final String TOKEN_KEY_ALIAS = "focusflow_oauth_tokens";
    private static final String TOKEN_CIPHERTEXT = "ciphertext";
    private static final String TOKEN_INITIALIZATION_VECTOR = "initialization_vector";

    private final Object authenticationLock = new Object();
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final SecureRandom secureRandom = new SecureRandom();
    private volatile TokenSet tokens;
    private boolean tokensLoaded;
    private volatile boolean destroyed;
    private volatile String pendingNotificationState;
    private boolean notificationPermissionRequested;
    private FocusFlowNotifications notifications;
    private WebView webView;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applySystemTheme();
        notifications = new FocusFlowNotifications(this);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#050505"));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(false);
        settings.setDatabaseEnabled(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        webView.addJavascriptInterface(new AndroidBridge(), "FocusFlowAndroid");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("file".equals(uri.getScheme())) return false;
                openExternal(uri);
                return true;
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                Uri uri = Uri.parse(url);
                if ("file".equals(uri.getScheme())) return false;
                openExternal(uri);
                return true;
            }
        });

        webView.loadUrl("file:///android_asset/index.html#" + notificationRoute(getIntent()));
    }

    private String notificationRoute(Intent intent) {
        String route = intent == null ? null : intent.getStringExtra(NOTIFICATION_ROUTE_EXTRA);
        return route != null && (route.equals("home") || route.equals("projects") || route.equals("stats")) ? route : "home";
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String route = notificationRoute(intent);
        if (webView != null) webView.evaluateJavascript("location.hash=" + JSONObject.quote(route) + ";", null);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (pendingNotificationState != null && notifications != null && notifications.canPost()) {
            notifications.sync(pendingNotificationState);
        }
    }

    private void syncNotificationState(String serializedState) {
        pendingNotificationState = serializedState;
        runOnUiThread(() -> {
            if (destroyed || notifications == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                    && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                if (FocusFlowNotifications.needsPermission(serializedState) && !notificationPermissionRequested) {
                    notificationPermissionRequested = true;
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST);
                }
                return;
            }
            notifications.sync(serializedState);
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != NOTIFICATION_PERMISSION_REQUEST) return;
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (granted && pendingNotificationState != null) notifications.sync(pendingNotificationState);
        else if (!granted) showToast(getString(R.string.notification_permission_denied));
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception ignored) {
            showToast(getString(R.string.link_error));
        }
    }

    private void applySystemTheme() {
        int color = Color.parseColor("#050505");
        getWindow().setStatusBarColor(color);
        getWindow().setNavigationBarColor(color);
        getWindow().getDecorView().setSystemUiVisibility(0);
    }

    private void showToast(String message) {
        runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_LONG).show());
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        destroyed = true;
        executor.shutdownNow();
        if (webView != null) {
            webView.removeJavascriptInterface("FocusFlowAndroid");
            webView.destroy();
        }
        super.onDestroy();
    }

    private String requireAccessToken(boolean interactive) throws Exception {
        synchronized (authenticationLock) {
            if (!tokensLoaded) {
                tokens = loadPersistedTokens();
                tokensLoaded = true;
            }
            long now = System.currentTimeMillis();
            if (tokens != null && tokens.expiresAt > now + 30_000) return tokens.accessToken;
            if (tokens != null && tokens.refreshToken != null) {
                try {
                    replaceTokens(refreshTokens(tokens));
                    return tokens.accessToken;
                } catch (HttpStatusException error) {
                    if (error.isClientError()) replaceTokens(null);
                    else throw error;
                }
            }
            if (!interactive) throw new AuthenticationRequiredException();
            replaceTokens(performLogin());
            return tokens.accessToken;
        }
    }

    private boolean hasSession() {
        synchronized (authenticationLock) {
            if (!tokensLoaded) {
                tokens = loadPersistedTokens();
                tokensLoaded = true;
            }
            return tokens != null && (tokens.refreshToken != null || tokens.expiresAt > System.currentTimeMillis() + 30_000);
        }
    }

    private String refreshAfterUnauthorized(String rejectedAccessToken) throws Exception {
        synchronized (authenticationLock) {
            if (!tokensLoaded) {
                tokens = loadPersistedTokens();
                tokensLoaded = true;
            }
            if (tokens != null && !tokens.accessToken.equals(rejectedAccessToken)) return tokens.accessToken;
            if (tokens == null || tokens.refreshToken == null) {
                replaceTokens(null);
                throw new AuthenticationRequiredException();
            }
            try {
                replaceTokens(refreshTokens(tokens));
                return tokens.accessToken;
            } catch (HttpStatusException error) {
                if (error.isClientError()) {
                    replaceTokens(null);
                    throw new AuthenticationRequiredException();
                }
                throw error;
            }
        }
    }

    private void replaceTokens(TokenSet value) {
        tokens = value;
        tokensLoaded = true;
        if (value == null) clearPersistedTokens();
        else persistTokens(value);
    }

    private SharedPreferences tokenPreferences() {
        return getSharedPreferences(TOKEN_PREFERENCES, Context.MODE_PRIVATE);
    }

    private SecretKey authenticationKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(TOKEN_KEY_ALIAS)) {
            return (SecretKey) keyStore.getKey(TOKEN_KEY_ALIAS, null);
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(
                TOKEN_KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build());
        return generator.generateKey();
    }

    @SuppressLint("ApplySharedPref")
    private void persistTokens(TokenSet value) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, authenticationKey());
            byte[] encrypted = cipher.doFinal(value.toJson().toString().getBytes(StandardCharsets.UTF_8));
            tokenPreferences().edit()
                    .putString(TOKEN_CIPHERTEXT, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                    .putString(TOKEN_INITIALIZATION_VECTOR, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                    .commit(); // A sessão precisa estar durável antes de liberar o app.
        } catch (Exception ignored) {
            clearPersistedTokens();
        }
    }

    private TokenSet loadPersistedTokens() {
        SharedPreferences preferences = tokenPreferences();
        String encryptedValue = preferences.getString(TOKEN_CIPHERTEXT, null);
        String initializationVector = preferences.getString(TOKEN_INITIALIZATION_VECTOR, null);
        if (encryptedValue == null || initializationVector == null) return null;
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                    Cipher.DECRYPT_MODE,
                    authenticationKey(),
                    new GCMParameterSpec(128, Base64.decode(initializationVector, Base64.NO_WRAP))
            );
            byte[] decrypted = cipher.doFinal(Base64.decode(encryptedValue, Base64.NO_WRAP));
            return TokenSet.fromStoredJson(new JSONObject(new String(decrypted, StandardCharsets.UTF_8)));
        } catch (Exception ignored) {
            clearPersistedTokens();
            try {
                KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
                keyStore.load(null);
                keyStore.deleteEntry(TOKEN_KEY_ALIAS);
            } catch (Exception ignoredKeyError) { }
            return null;
        }
    }

    @SuppressLint("ApplySharedPref")
    private void clearPersistedTokens() {
        tokenPreferences().edit().clear().commit(); // Evita reutilização após uma recusa do servidor.
    }

    private TokenSet performLogin() throws Exception {
        OAuthMetadata metadata = discoverOAuth();
        try (ServerSocket callbackServer = new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))) {
            callbackServer.setSoTimeout(LOGIN_TIMEOUT_MILLISECONDS);
            String redirectUri = "http://127.0.0.1:" + callbackServer.getLocalPort() + "/oauth/callback";
            String clientId = registerClient(metadata.registrationEndpoint, redirectUri);
            String state = randomBase64Url(24);
            String verifier = randomBase64Url(48);
            String challenge = base64Url(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)));
            String authorizationUrl = metadata.authorizationEndpoint + "?" + formEncode(new String[][]{
                    {"response_type", "code"},
                    {"client_id", clientId},
                    {"redirect_uri", redirectUri},
                    {"code_challenge", challenge},
                    {"code_challenge_method", "S256"},
                    {"state", state},
                    {"resource", RESOURCE},
            });

            runOnUiThread(() -> openExternal(Uri.parse(authorizationUrl)));
            OAuthCallback callback = receiveCallback(callbackServer);
            if (callback.error != null) throw new IllegalStateException(callback.error);
            if (callback.code == null || !state.equals(callback.state)) throw new IllegalStateException("Retorno OAuth inválido.");

            JSONObject tokenPayload = postForm(metadata.tokenEndpoint, new String[][]{
                    {"grant_type", "authorization_code"},
                    {"code", callback.code},
                    {"client_id", clientId},
                    {"redirect_uri", redirectUri},
                    {"code_verifier", verifier},
                    {"resource", RESOURCE},
            });
            return TokenSet.fromJson(tokenPayload, clientId, null);
        }
    }

    private TokenSet refreshTokens(TokenSet current) throws Exception {
        OAuthMetadata metadata = discoverOAuth();
        JSONObject payload = postForm(metadata.tokenEndpoint, new String[][]{
                {"grant_type", "refresh_token"},
                {"refresh_token", current.refreshToken},
                {"client_id", current.clientId},
                {"resource", RESOURCE},
        });
        return TokenSet.fromJson(payload, current.clientId, current.refreshToken);
    }

    private OAuthMetadata discoverOAuth() throws Exception {
        JSONObject metadata = getJson(RESOURCE + "/.well-known/oauth-authorization-server");
        return new OAuthMetadata(
                trustedAccessEndpoint(metadata.getString("authorization_endpoint")),
                trustedAccessEndpoint(metadata.getString("token_endpoint")),
                trustedAccessEndpoint(metadata.getString("registration_endpoint"))
        );
    }

    private String registerClient(String endpoint, String redirectUri) throws Exception {
        JSONObject request = new JSONObject();
        request.put("client_name", "FocusFlow Android");
        request.put("redirect_uris", new org.json.JSONArray().put(redirectUri));
        request.put("grant_types", new org.json.JSONArray().put("authorization_code").put("refresh_token"));
        request.put("response_types", new org.json.JSONArray().put("code"));
        request.put("token_endpoint_auth_method", "none");
        JSONObject registration = sendJson(endpoint, request);
        return registration.getString("client_id");
    }

    private OAuthCallback receiveCallback(ServerSocket callbackServer) throws Exception {
        try (Socket socket = callbackServer.accept();
             BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.US_ASCII));
             OutputStream output = socket.getOutputStream()) {
            String requestLine = reader.readLine();
            if (requestLine == null || !requestLine.startsWith("GET ")) throw new IllegalStateException("Callback OAuth inválido.");
            String target = requestLine.split(" ")[1];
            Uri uri = Uri.parse("http://127.0.0.1" + target);
            byte[] page = "<!doctype html><meta charset=utf-8><title>FocusFlow</title><style>body{background:#050505;color:#f5f7fa;font:16px system-ui;display:grid;place-items:center;min-height:100vh;margin:0}main{text-align:center}</style><main><h1>Login concluído</h1><p>Volte ao FocusFlow.</p></main>".getBytes(StandardCharsets.UTF_8);
            String headers = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Security-Policy: default-src 'none'; style-src 'unsafe-inline'\r\nCache-Control: no-store\r\nContent-Length: " + page.length + "\r\nConnection: close\r\n\r\n";
            output.write(headers.getBytes(StandardCharsets.US_ASCII));
            output.write(page);
            output.flush();
            return new OAuthCallback(uri.getQueryParameter("code"), uri.getQueryParameter("state"), uri.getQueryParameter("error_description"));
        }
    }

    private NativeResponse requestApi(String method, String path, String body, String contentType) throws Exception {
        String normalizedMethod = method == null ? "GET" : method.toUpperCase(Locale.ROOT);
        if (!(normalizedMethod.equals("GET") || normalizedMethod.equals("POST"))) throw new IllegalArgumentException("Método não permitido.");
        if (path == null || !path.startsWith("/api/") || path.startsWith("//")) throw new IllegalArgumentException("Endpoint inválido.");

        String accessToken;
        try {
            accessToken = requireAccessToken(false);
        } catch (AuthenticationRequiredException error) {
            return jsonNativeResponse(401, new JSONObject().put("error", "Entre no FocusFlow para continuar."));
        }

        NativeResponse response = executeApiRequest(normalizedMethod, path, body, contentType, accessToken);
        if (response.status != 401) return response;

        try {
            accessToken = refreshAfterUnauthorized(accessToken);
        } catch (AuthenticationRequiredException error) {
            return jsonNativeResponse(401, new JSONObject().put("error", "Sua sessão expirou. Entre novamente."));
        }

        NativeResponse retried = executeApiRequest(normalizedMethod, path, body, contentType, accessToken);
        if (retried.status == 401) {
            synchronized (authenticationLock) {
                if (tokens != null && tokens.accessToken.equals(accessToken)) replaceTokens(null);
            }
            return jsonNativeResponse(401, new JSONObject().put("error", "Sua sessão expirou. Entre novamente."));
        }
        return retried;
    }

    private NativeResponse executeApiRequest(String method, String path, String body, String contentType, String accessToken) throws Exception {
        HttpURLConnection connection = openConnection(RESOURCE + path);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestMethod(method);
        connection.setRequestProperty("Accept", "application/json, text/csv;q=0.9");
        connection.setRequestProperty("Authorization", "Bearer " + accessToken);
        if (body != null && !body.isEmpty() && method.equals("POST")) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", contentType == null || contentType.isEmpty() ? "application/json" : contentType);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body.getBytes(StandardCharsets.UTF_8));
            }
        }

        int status = connection.getResponseCode();
        byte[] responseBody = readLimited(status >= 400 ? connection.getErrorStream() : connection.getInputStream());
        NativeResponse response = new NativeResponse(status, responseBody, connection.getContentType(), connection.getHeaderField("Content-Disposition"), connection.getHeaderField("X-FocusFlow-Filename"));
        connection.disconnect();
        return response;
    }

    private NativeResponse requestNativeAuth(String method, String path) throws Exception {
        String normalizedMethod = method == null ? "GET" : method.toUpperCase(Locale.ROOT);
        if (path.equals("/native/auth/status") && normalizedMethod.equals("GET")) {
            return jsonNativeResponse(200, new JSONObject().put("authenticated", hasSession()));
        }
        if (path.equals("/native/auth/login") && normalizedMethod.equals("POST")) {
            requireAccessToken(true);
            return jsonNativeResponse(200, new JSONObject().put("authenticated", true));
        }
        return jsonNativeResponse(404, new JSONObject().put("error", "Operação de autenticação não encontrada."));
    }

    private NativeResponse jsonNativeResponse(int status, JSONObject payload) {
        return new NativeResponse(
                status,
                payload.toString().getBytes(StandardCharsets.UTF_8),
                "application/json; charset=utf-8",
                null,
                null
        );
    }

    private JSONObject getJson(String endpoint) throws Exception {
        HttpURLConnection connection = openConnection(endpoint);
        connection.setRequestProperty("Accept", "application/json");
        return readJson(connection);
    }

    private JSONObject sendJson(String endpoint, JSONObject body) throws Exception {
        HttpURLConnection connection = openConnection(endpoint);
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Accept", "application/json");
        try (OutputStream output = connection.getOutputStream()) {
            output.write(body.toString().getBytes(StandardCharsets.UTF_8));
        }
        return readJson(connection);
    }

    private JSONObject postForm(String endpoint, String[][] fields) throws Exception {
        HttpURLConnection connection = openConnection(endpoint);
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        connection.setRequestProperty("Accept", "application/json");
        try (OutputStream output = connection.getOutputStream()) {
            output.write(formEncode(fields).getBytes(StandardCharsets.UTF_8));
        }
        return readJson(connection);
    }

    private JSONObject readJson(HttpURLConnection connection) throws Exception {
        int status = connection.getResponseCode();
        byte[] content = readLimited(status >= 400 ? connection.getErrorStream() : connection.getInputStream());
        connection.disconnect();
        JSONObject payload = content.length == 0 ? new JSONObject() : new JSONObject(new String(content, StandardCharsets.UTF_8));
        if (status < 200 || status >= 300) {
            throw new HttpStatusException(status, payload.optString("error_description", payload.optString("error", "HTTP " + status)));
        }
        return payload;
    }

    private HttpURLConnection openConnection(String endpoint) throws Exception {
        URL url = new URL(endpoint);
        if (!"https".equals(url.getProtocol())) throw new IllegalArgumentException("HTTPS obrigatório.");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(NETWORK_TIMEOUT_MILLISECONDS);
        connection.setReadTimeout(LOGIN_TIMEOUT_MILLISECONDS);
        connection.setUseCaches(false);
        return connection;
    }

    private byte[] readLimited(InputStream input) throws Exception {
        if (input == null) return new byte[0];
        try (InputStream source = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int total = 0;
            int count;
            while ((count = source.read(buffer)) != -1) {
                total += count;
                if (total > MAX_RESPONSE_BYTES) throw new IllegalStateException("Resposta muito grande.");
                output.write(buffer, 0, count);
            }
            return output.toByteArray();
        }
    }

    private String trustedAccessEndpoint(String value) throws Exception {
        URL url = new URL(value);
        if (!"https".equals(url.getProtocol()) || !url.getHost().endsWith(".cloudflareaccess.com")) {
            throw new IllegalArgumentException("Endpoint OAuth não confiável.");
        }
        return url.toString();
    }

    private String randomBase64Url(int byteCount) {
        byte[] value = new byte[byteCount];
        secureRandom.nextBytes(value);
        return base64Url(value);
    }

    private static String base64Url(byte[] value) {
        return Base64.encodeToString(value, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
    }

    private static String formEncode(String[][] fields) throws Exception {
        StringBuilder result = new StringBuilder();
        for (String[] field : fields) {
            if (field[1] == null) continue;
            if (result.length() > 0) result.append('&');
            result.append(URLEncoder.encode(field[0], "UTF-8"));
            result.append('=');
            result.append(URLEncoder.encode(field[1], "UTF-8"));
        }
        return result.toString();
    }

    private void resolveNativeRequest(String requestId, JSONObject payload) {
        if (destroyed || webView == null) return;
        runOnUiThread(() -> {
            if (!destroyed && webView != null) {
                webView.evaluateJavascript("globalThis.FocusFlowNativeResolve(" + JSONObject.quote(requestId) + "," + payload.toString() + ");", null);
            }
        });
    }

    private final class AndroidBridge {
        @JavascriptInterface
        public void syncNotificationState(String serializedState) {
            MainActivity.this.syncNotificationState(serializedState);
        }

        @JavascriptInterface
        public void request(String requestId, String method, String path, String body, String headersJson) {
            executor.execute(() -> {
                JSONObject payload = new JSONObject();
                try {
                    String contentType = null;
                    if (headersJson != null && !headersJson.isEmpty()) contentType = new JSONObject(headersJson).optString("content-type", null);
                    NativeResponse result = path != null && path.startsWith("/native/auth/")
                            ? requestNativeAuth(method, path)
                            : requestApi(method, path, body, contentType);
                    payload.put("status", result.status);
                    payload.put("bodyBase64", Base64.encodeToString(result.body, Base64.NO_WRAP));
                    JSONObject headers = new JSONObject();
                    if (result.contentType != null) headers.put("content-type", result.contentType);
                    if (result.contentDisposition != null) headers.put("content-disposition", result.contentDisposition);
                    if (result.filename != null) headers.put("x-focusflow-filename", result.filename);
                    payload.put("headers", headers);
                } catch (Exception error) {
                    try { payload.put("error", error.getMessage() == null ? "Falha na autenticação." : error.getMessage()); }
                    catch (Exception ignored) { }
                }
                resolveNativeRequest(requestId, payload);
            });
        }

        @JavascriptInterface
        public void saveFile(String fileName, String base64Content, String mimeType) {
            executor.execute(() -> {
                String safeName = fileName.replaceAll("[\\\\/:*?\"<>|]", "_");
                byte[] content;
                try {
                    content = Base64.decode(base64Content, Base64.DEFAULT);
                } catch (Exception error) {
                    showToast(getString(R.string.export_error));
                    return;
                }

                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ContentResolver resolver = getContentResolver();
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/FocusFlow");
                        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (uri == null) throw new IllegalStateException("MediaStore unavailable");
                        try (OutputStream output = resolver.openOutputStream(uri)) {
                            if (output == null) throw new IllegalStateException("Output unavailable");
                            output.write(content);
                        }
                        showToast(getString(R.string.export_success));
                    } else {
                        File root = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "FocusFlow");
                        if (!root.exists() && !root.mkdirs()) throw new IllegalStateException("Directory unavailable");
                        try (OutputStream output = new FileOutputStream(new File(root, safeName))) {
                            output.write(content);
                        }
                        showToast(getString(R.string.export_success_legacy));
                    }
                } catch (Exception error) {
                    showToast(getString(R.string.export_error));
                }
            });
        }

        @JavascriptInterface
        public void printPage() {
            runOnUiThread(() -> {
                PrintManager manager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                manager.print("FocusFlow - Relatório", webView.createPrintDocumentAdapter("FocusFlow"), null);
            });
        }
    }

    private static final class OAuthMetadata {
        final String authorizationEndpoint;
        final String tokenEndpoint;
        final String registrationEndpoint;

        OAuthMetadata(String authorizationEndpoint, String tokenEndpoint, String registrationEndpoint) {
            this.authorizationEndpoint = authorizationEndpoint;
            this.tokenEndpoint = tokenEndpoint;
            this.registrationEndpoint = registrationEndpoint;
        }
    }

    private static final class AuthenticationRequiredException extends Exception {
        AuthenticationRequiredException() {
            super("Entre no FocusFlow para continuar.");
        }
    }

    private static final class HttpStatusException extends Exception {
        final int status;

        HttpStatusException(int status, String message) {
            super(message);
            this.status = status;
        }

        boolean isClientError() {
            return status >= 400 && status < 500;
        }
    }

    private static final class OAuthCallback {
        final String code;
        final String state;
        final String error;

        OAuthCallback(String code, String state, String error) {
            this.code = code;
            this.state = state;
            this.error = error;
        }
    }

    private static final class TokenSet {
        final String accessToken;
        final String refreshToken;
        final String clientId;
        final long expiresAt;

        TokenSet(String accessToken, String refreshToken, String clientId, long expiresAt) {
            this.accessToken = accessToken;
            this.refreshToken = refreshToken;
            this.clientId = clientId;
            this.expiresAt = expiresAt;
        }

        static TokenSet fromJson(JSONObject payload, String clientId, String fallbackRefreshToken) throws Exception {
            String accessToken = payload.getString("access_token");
            String refreshToken = payload.optString("refresh_token", fallbackRefreshToken);
            long expiresIn = Math.max(1, payload.optLong("expires_in", 300));
            return new TokenSet(accessToken, refreshToken, clientId, System.currentTimeMillis() + expiresIn * 1000);
        }

        JSONObject toJson() throws Exception {
            JSONObject payload = new JSONObject();
            payload.put("accessToken", accessToken);
            if (refreshToken != null) payload.put("refreshToken", refreshToken);
            payload.put("clientId", clientId);
            payload.put("expiresAt", expiresAt);
            return payload;
        }

        static TokenSet fromStoredJson(JSONObject payload) throws Exception {
            String accessToken = payload.getString("accessToken");
            String refreshToken = payload.optString("refreshToken", null);
            String clientId = payload.getString("clientId");
            long expiresAt = payload.getLong("expiresAt");
            if (accessToken.isEmpty() || clientId.isEmpty() || expiresAt <= 0) {
                throw new IllegalStateException("Sessão OAuth persistida inválida.");
            }
            return new TokenSet(accessToken, refreshToken, clientId, expiresAt);
        }
    }

    private static final class NativeResponse {
        final int status;
        final byte[] body;
        final String contentType;
        final String contentDisposition;
        final String filename;

        NativeResponse(int status, byte[] body, String contentType, String contentDisposition, String filename) {
            this.status = status;
            this.body = body;
            this.contentType = contentType;
            this.contentDisposition = contentDisposition;
            this.filename = filename;
        }
    }
}
