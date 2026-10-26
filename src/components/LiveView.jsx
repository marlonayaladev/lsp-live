import { useEffect, useRef } from "react";
import CameraStage from "./CameraStage.jsx";
import Icon from "./Icons.jsx";
import { Card, Chip, Empty, Meter } from "./ui.jsx";
import { formatTime } from "../lib/storage.js";

function Sparkline({ values }) {
  const data = values.slice(-64);
  if (data.length < 2) {
    return <div className="spark is-empty" />;
  }
  const w = 100;
  const h = 30;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(2)},${(h - v * h).toFixed(2)}`).join(" ");
  const area = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon points={area} className="spark-area" />
      <polyline points={pts} className="spark-line" />
    </svg>
  );
}

function TranslationCard({ live, hasModel, onGoTrain }) {
  const label = live.label;
  const conf = live.conf || 0;
  const isDemo = live.source === "demo";

  return (
    <Card
      className="translation"
      title="Traducción en vivo"
      subtitle={hasModel ? "Clasificador entrenado en este equipo" : "Modo demostración · formas de mano"}
      right={
        <Chip tone={live.source ? (isDemo ? "warn" : "accent") : "neutral"} icon={isDemo ? "spark" : "bolt"}>
          {live.source ? (isDemo ? "Demo" : "Modelo") : "En espera"}
        </Chip>
      }
    >
      <div className="translation-main">
        <div className={`big-word ${label ? "is-active" : ""}`}>
          {label || <span className="big-word-ghost">Esperando seña…</span>}
        </div>

        <div className="confidence">
          <div className="confidence-top">
            <span>Confianza</span>
            <strong>{Math.round(conf * 100)}%</strong>
          </div>
          <Meter value={conf} tone={isDemo ? "warn" : "accent"} height={7} />
        </div>

        <div className="hold">
          <div className="hold-top">
            <span>{live.locked ? "Seña confirmada" : "Mantén la seña para confirmar"}</span>
            <span className="hold-pct">{Math.round((live.progress || 0) * 100)}%</span>
          </div>
          <Meter value={live.progress || 0} tone="teal" height={4} />
        </div>

        <div className="spark-wrap">
          <div className="spark-top">
            <span>Señal de confianza</span>
            <span className="spark-legend">{live.top3?.length > 1 ? "top 3" : "últimos 60 cuadros"}</span>
          </div>
          <Sparkline values={live.spark || []} />
        </div>
      </div>

      {live.top3?.length > 1 && (
        <div className="top3">
          {live.top3.map((item) => (
            <div className="top3-row" key={item.label}>
              <span className="top3-label">{item.label}</span>
              <Meter value={item.conf} tone="muted" height={4} />
              <span className="top3-val">{Math.round(item.conf * 100)}%</span>
            </div>
          ))}
        </div>
      )}

      {!hasModel && (
        <div className="inline-note">
          <Icon name="spark" size={15} />
          <p>
            Aún no hay señas entrenadas: se reconocen formas de mano. Graba tu vocabulario LSP en{" "}
            <button className="link" onClick={onGoTrain} type="button">
              Entrenar
            </button>
            .
          </p>
        </div>
      )}
    </Card>
  );
}

function TranscriptCard({ transcript, onClear, onCopy, onExport }) {
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript.length]);

  return (
    <Card
      className="transcript"
      title="Transcripción"
      subtitle="Historial de esta sesión"
      right={<Chip tone="neutral">{transcript.length} señas</Chip>}
    >
      <div className="transcript-list" ref={listRef}>
        {transcript.length === 0 ? (
          <Empty icon="wave" title="Sin traducciones todavía" text="Haz una seña frente a la cámara y aparecerá aquí." />
        ) : (
          transcript.map((entry) => (
            <div className="t-item" key={entry.id}>
              <span className="t-time">{formatTime(entry.ts)}</span>
              <span className="t-label">{entry.label}</span>
              <span className={`t-conf ${entry.source === "demo" ? "is-demo" : ""}`}>
                {Math.round((entry.conf || 0) * 100)}%
              </span>
              {entry.source === "demo" && <span className="t-tag">demo</span>}
            </div>
          ))
        )}
      </div>
      <div className="transcript-actions">
        <button className="btn btn-ghost" onClick={onCopy} disabled={!transcript.length} type="button">
          <Icon name="copy" size={15} /> Copiar
        </button>
        <button className="btn btn-ghost" onClick={onExport} disabled={!transcript.length} type="button">
          <Icon name="download" size={15} /> .txt
        </button>
        <button className="btn btn-ghost is-danger" onClick={onClear} disabled={!transcript.length} type="button">
          <Icon name="trash" size={15} /> Limpiar
        </button>
      </div>
    </Card>
  );
}

function PipelineStrip({ hasModel, signs }) {
  const steps = [
    { n: "01", t: "Captura", d: "webcam 30 fps" },
    { n: "02", t: "Landmarks", d: "manos + torso" },
    { n: "03", t: "Normalización", d: "escala y posición" },
    { n: "04", t: hasModel ? "Clasificación" : "Heurística", d: hasModel ? "k-NN + DTW" : "formas de mano" },
    { n: "05", t: "Texto", d: "salida en español" },
  ];
  return (
    <div className="pipeline">
      <div className="pipeline-head">
        <h3>Cómo funciona</h3>
        <Chip tone="teal" icon="bolt">
          Todo en tu equipo
        </Chip>
      </div>
      <div className="pipeline-steps">
        {steps.map((s, i) => (
          <div className="p-step" key={s.n}>
            <span className="p-n">{s.n}</span>
            <div>
              <p className="p-t">{s.t}</p>
              <p className="p-d">{s.d}</p>
            </div>
            {i < steps.length - 1 && <Icon name="arrow" size={14} className="p-arrow" />}
          </div>
        ))}
      </div>
      <div className="pipeline-foot">
        <span>Vocabulario: {signs.filter((s) => s.count > 0).length} señas entrenadas</span>
        <span>Nada se sube a internet</span>
      </div>
    </div>
  );
}

export default function LiveView({
  engine,
  status,
  error,
  settings,
  live,
  spark,
  transcript,
  hasModel,
  signs,
  onRetry,
  onClear,
  onCopy,
  onExport,
  onGoTrain,
}) {
  return (
    <div className="live-grid">
      <div className="live-main">
        <CameraStage
          engine={engine}
          status={status}
          error={error}
          settings={settings}
          live={live}
          onRetry={onRetry}
          title="Cámara frontal · 1280 × 720"
        />
        <PipelineStrip hasModel={hasModel} signs={signs} />
      </div>

      <aside className="live-side">
        <TranslationCard live={{ ...live, spark }} hasModel={hasModel} onGoTrain={onGoTrain} />
        <TranscriptCard
          transcript={transcript}
          onClear={onClear}
          onCopy={onCopy}
          onExport={onExport}
        />
      </aside>
    </div>
  );
}
