/** Preferencias y utilidades de sesión (localStorage + helpers). */

const SETTINGS_KEY = "lsp-live:settings";
const TRANSCRIPT_KEY = "lsp-live:transcript";

export const DEFAULT_SETTINGS = {
  theme: "dark",
  mirror: true,
  showHands: true,
  showPose: true,
  usePose: true,
  threshold: 0.55,
  holdMs: 700,
  dominant: "right",
  targetFps: 20,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* almacenamiento lleno o bloqueado */
  }
}

export function loadTranscript() {
  try {
    const raw = localStorage.getItem(TRANSCRIPT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTranscript(entries) {
  try {
    localStorage.setItem(TRANSCRIPT_KEY, JSON.stringify(entries.slice(-200)));
  } catch {
    /* noop */
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDate(ts) {
  return new Date(ts).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
  });
}

export function download(filename, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function toPlainText(entries) {
  const lines = entries.map(
    (e) =>
      `[${formatTime(e.ts)}] ${e.label}  (${Math.round((e.conf || 0) * 100)}% · ${
        e.source === "demo" ? "demo" : "modelo"
      })`
  );
  return `LSP Live — transcripción\nGenerado: ${new Date().toLocaleString("es-PE")}\n\n${lines.join("\n")}\n`;
}
