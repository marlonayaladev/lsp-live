import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "./components/Icons.jsx";
import LiveView from "./components/LiveView.jsx";
import TrainView from "./components/TrainView.jsx";
import HistoryView from "./components/HistoryView.jsx";
import SettingsView from "./components/SettingsView.jsx";
import { Engine } from "./lib/vision.js";
import * as store from "./lib/store.js";
import {
  loadSettings,
  saveSettings,
  loadTranscript,
  saveTranscript,
  download,
  sleep,
  toPlainText,
  uid,
} from "./lib/storage.js";

const VIEWS = {
  live: {
    icon: "camera",
    label: "En vivo",
    title: "Reconocimiento en vivo",
    desc: "Cámara, landmarks y traducción a texto en tiempo real.",
  },
  train: {
    icon: "train",
    label: "Entrenar",
    title: "Entrenar el vocabulario",
    desc: "Graba muestras de cada seña y el clasificador se recalcula al instante.",
  },
  history: {
    icon: "history",
    label: "Historial",
    title: "Historial de traducciones",
    desc: "Registro de la sesión, métricas y exportación.",
  },
  settings: {
    icon: "settings",
    label: "Ajustes",
    title: "Ajustes y datos",
    desc: "Preferencias de cámara, clasificador y gestión del dataset.",
  },
};

const EMPTY_LIVE = {
  label: null,
  conf: 0,
  top3: [],
  source: null,
  progress: 0,
  locked: false,
  fps: 0,
  ms: 0,
  hands: 0,
  device: "—",
};

function humanizeError(err) {
  const name = err?.name || "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Permiso de cámara denegado. Habilítalo desde el ícono de la barra de direcciones y recarga.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return "No se encontró ninguna cámara conectada.";
  if (name === "NotReadableError")
    return "La cámara está siendo usada por otra aplicación.";
  if (name === "OverconstrainedError")
    return "La cámara no admite la resolución solicitada.";
  return err?.message || "Error desconocido al iniciar la cámara.";
}

export default function App() {
  const [view, setView] = useState("live");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [bootKey, setBootKey] = useState(0);
  const [settings, setSettings] = useState(loadSettings);
  const [live, setLive] = useState(EMPTY_LIVE);
  const [spark, setSpark] = useState([]);
  const [transcript, setTranscript] = useState(loadTranscript);
  const [signs, setSigns] = useState([]);
  const [dataset, setDataset] = useState([]);
  const [training, setTraining] = useState(null);
  const [toast, setToast] = useState(null);

  const engineRef = useRef(null);
  const settingsRef = useRef(settings);
  const recordingRef = useRef({ cancel: false });
  const toastTimer = useRef(0);

  settingsRef.current = settings;

  const notify = useCallback((message, tone = "ok") => {
    setToast({ message, tone });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3400);
  }, []);

  const refresh = useCallback(async () => {
    const [nextSigns, nextDataset] = await Promise.all([store.listSigns(), store.loadDataset()]);
    setSigns(nextSigns);
    setDataset(nextDataset);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Arranque: semilla, modelos y cámara                               */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;
    const engine = new Engine();
    engineRef.current = engine;
    engine.setSettings(settingsRef.current);

    engine.onCommit = (entry) => {
      setTranscript((prev) => [...prev, { ...entry, id: uid() }].slice(-300));
    };
    engine.onFrame = (frame) => {
      setLive(frame);
      if (frame.label) setSpark((prev) => [...prev.slice(-63), frame.conf]);
    };

    (async () => {
      try {
        await store.ensureSeed();
        await refresh();
        await engine.init();
        if (cancelled) return;
        await engine.openCamera();
        if (cancelled) return;
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setStatus("error");
        setError(humanizeError(err));
      }
    })();

    return () => {
      cancelled = true;
      engine.destroy();
      if (engineRef.current === engine) engineRef.current = null;
    };
    // dataset se inyecta luego vía efecto; aquí solo importa el arranque
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootKey, refresh]);

  useEffect(() => {
    saveSettings(settings);
    document.documentElement.dataset.theme = settings.theme;
    engineRef.current?.setSettings(settings);
  }, [settings]);

  useEffect(() => {
    engineRef.current?.setDataset(dataset);
  }, [dataset]);

  useEffect(() => {
    saveTranscript(transcript);
  }, [transcript]);

  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;
      const map = { 1: "live", 2: "train", 3: "history", 4: "settings" };
      if (map[e.key]) setView(map[e.key]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Si el usuario sale de la vista de entrenamiento, se cancela la grabación.
  useEffect(() => {
    if (view !== "train") recordingRef.current.cancel = true;
  }, [view]);

  /* ---------------------------------------------------------------- */
  /* Acciones                                                          */
  /* ---------------------------------------------------------------- */
  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const retry = useCallback(() => {
    setStatus("loading");
    setError("");
    setLive(EMPTY_LIVE);
    setBootKey((k) => k + 1);
  }, []);

  const addSign = useCallback(
    async (label, note) => {
      try {
        const clean = await store.addSign(label, note);
        await refresh();
        notify(`«${clean}» añadida. Pulsa Grabar para capturar muestras.`);
      } catch (err) {
        notify(err.message || "No se pudo añadir la seña", "err");
      }
    },
    [notify, refresh]
  );

  const deleteSign = useCallback(
    async (label) => {
      if (!window.confirm(`¿Eliminar «${label}» y todas sus muestras?`)) return;
      await store.deleteSign(label);
      await refresh();
      notify(`«${label}» eliminada`);
    },
    [notify, refresh]
  );

  const clearSamples = useCallback(
    async (label) => {
      await store.clearSamples(label);
      await refresh();
      notify(`Muestras de «${label}» borradas`);
    },
    [notify, refresh]
  );

  const stopRecording = useCallback(() => {
    recordingRef.current.cancel = true;
  }, []);

  const record = useCallback(
    async (label, count = 12) => {
      const engine = engineRef.current;
      if (!engine || status !== "ready" || training) {
        notify("La cámara aún no está lista", "err");
        return;
      }
      recordingRef.current = { cancel: false };
      engine.recording = true;
      const seqs = [];
      setTraining({ label, done: 0, total: count });
      await sleep(450);

      let misses = 0;
      while (seqs.length < count && misses < 10 && !recordingRef.current.cancel) {
        const seq = engine.captureWindow();
        if (seq) {
          misses = 0;
          seqs.push(seq);
          setTraining({ label, done: seqs.length, total: count });
        } else {
          misses += 1;
        }
        if (seqs.length >= count) break;
        await sleep(760);
      }

      engine.recording = false;
      setTraining(null);
      recordingRef.current = { cancel: false };

      if (!seqs.length) {
        notify("No se capturó ninguna muestra: revisa la luz y encuadra las manos", "err");
        return;
      }
      await store.addSamples(label, seqs);
      await refresh();
      notify(`«${label}»: ${seqs.length} muestras guardadas`);
    },
    [notify, refresh, status, training]
  );

  const exportDataset = useCallback(async () => {
    const data = await store.exportDataset();
    download(`lsp-live-dataset-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json");
    notify("Dataset exportado");
  }, [notify]);

  const importDataset = useCallback(
    async (data, err) => {
      if (err || !data) {
        notify("El archivo no se pudo leer como dataset", "err");
        return;
      }
      try {
        await store.importDataset(data);
        await refresh();
        notify("Dataset importado");
      } catch (e) {
        notify(e.message || "Dataset inválido", "err");
      }
    },
    [notify, refresh]
  );

  const exportTxt = useCallback(() => {
    download(`lsp-live-transcripcion-${new Date().toISOString().slice(0, 10)}.txt`, toPlainText(transcript));
    notify("Transcripción descargada");
  }, [notify, transcript]);

  const copyTranscript = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(toPlainText(transcript));
      notify("Transcripción copiada");
    } catch {
      notify("El navegador bloqueó el portapapeles", "err");
    }
  }, [notify, transcript]);

  const clearTranscript = useCallback(() => {
    setTranscript([]);
    setSpark([]);
    notify("Historial borrado");
  }, [notify]);

  const resetAll = useCallback(async () => {
    if (!window.confirm("Se borrarán señas, muestras e historial. ¿Continuar?")) return;
    await store.resetAll();
    await store.ensureSeed();
    await refresh();
    setTranscript([]);
    setSpark([]);
    notify("Datos restablecidos");
  }, [notify, refresh]);

  const meta = VIEWS[view];
  const hasModel = dataset.length > 0;
  const trainedSigns = signs.filter((s) => s.count > 0).length;
  const totalSamples = signs.reduce((acc, s) => acc + s.count, 0);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">LS</span>
          <div className="brand-text">
            <strong>LSP Live</strong>
            <span>Edge AI · demo web</span>
          </div>
        </div>

        <nav className="nav">
          {Object.entries(VIEWS).map(([key, item], i) => (
            <button
              key={key}
              type="button"
              className={`nav-item ${view === key ? "is-active" : ""}`}
              onClick={() => setView(key)}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
              <kbd>{i + 1}</kbd>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="status-card">
            <span className={`dot ${status === "ready" ? "is-live" : status === "error" ? "is-err" : ""}`} />
            <div>
              <p>{status === "ready" ? "Cámara activa" : status === "error" ? "Sin cámara" : "Iniciando…"}</p>
              <span>{hasModel ? `${trainedSigns} señas · ${totalSamples} muestras` : "Modo demostración"}</span>
            </div>
          </div>
          <p className="sidebar-note">
            <Icon name="bolt" size={13} /> Procesamiento 100% local
          </p>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{meta.title}</h1>
            <p>{meta.desc}</p>
          </div>
          <div className="topbar-actions">
            <span className={`pill ${hasModel ? "is-accent" : ""}`}>
              <Icon name={hasModel ? "bolt" : "spark"} size={13} />
              {hasModel ? `Modelo k-NN · ${dataset.length} muestras` : "Demo de formas de mano"}
            </span>
            <button
              className="icon-btn"
              type="button"
              title={settings.theme === "dark" ? "Tema claro" : "Tema oscuro"}
              onClick={() => updateSetting("theme", settings.theme === "dark" ? "light" : "dark")}
            >
              <Icon name={settings.theme === "dark" ? "sun" : "moon"} size={17} />
            </button>
          </div>
        </header>

        <main className="content">
          {view === "live" && (
            <LiveView
              engine={engineRef.current}
              status={status}
              error={error}
              settings={settings}
              live={live}
              spark={spark}
              transcript={transcript}
              hasModel={hasModel}
              signs={signs}
              onRetry={retry}
              onClear={clearTranscript}
              onCopy={copyTranscript}
              onExport={exportTxt}
              onGoTrain={() => setView("train")}
            />
          )}

          {view === "train" && (
            <TrainView
              engine={engineRef.current}
              status={status}
              error={error}
              settings={settings}
              live={live}
              signs={signs}
              training={training}
              hasModel={hasModel}
              onRetry={retry}
              onAddSign={addSign}
              onDeleteSign={deleteSign}
              onRecord={(label) => record(label, 12)}
              onStop={stopRecording}
              onExport={exportDataset}
              onImport={importDataset}
              onClearSamples={clearSamples}
            />
          )}

          {view === "history" && (
            <HistoryView
              transcript={transcript}
              onExport={exportTxt}
              onClear={clearTranscript}
              onCopy={copyTranscript}
              onPrint={() => window.print()}
            />
          )}

          {view === "settings" && (
            <SettingsView
              settings={settings}
              onChange={updateSetting}
              onExport={exportDataset}
              onImport={importDataset}
              onClearHistory={clearTranscript}
              onReset={resetAll}
              stats={{ signs: signs.length, samples: totalSamples, transcript: transcript.length }}
            />
          )}
        </main>
      </div>

      {toast && <div className={`toast ${toast.tone === "err" ? "is-err" : ""}`}>{toast.message}</div>}
    </div>
  );
}
