globalThis.FocusFlowConfig = Object.freeze({
  apiBaseUrl: "",
  requestTimeoutMs: location.protocol === "file:" ? 300_000 : 7_000,
  appVersion: "1.4.4",
});
