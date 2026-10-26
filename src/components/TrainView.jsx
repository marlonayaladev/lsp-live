import { useRef, useState } from "react";
import CameraStage from "./CameraStage.jsx";
import Icon from "./Icons.jsx";
import { Card, Chip, Meter } from "./ui.jsx";

export default function TrainView({
  engine,
  status,
  error,
  settings,
  live,
  signs,
  training,
  hasModel,
  onRetry,
  onAddSign,
  onDeleteSign,
  onRecord,
  onStop,
  onExport,
  onImport,
  onClearSamples,
}) {
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const totalSamples = signs.reduce((acc, s) => acc + (s.count || 0), 0);
  const trained = signs.filter((s) => s.count > 0).length;
  const isRecording = !!training;
  const progress = training ? training.done / Math.max(1, training.total) : 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    try {
      await onAddSign(label, note);
      setLabel("");
      setNote("");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      await onImport(JSON.parse(text));
    } catch (err) {
      await onImport(null, err);
    }
  };

  return (
    <div className="train-grid">
      <div className="train-main">
        <CameraStage
          engine={engine}
          status={status}
          error={error}
          settings={settings}
          live={live}
          onRetry={onRetry}
          title={isRecording ? `Grabando «${training.label}»` : "Cámara de entrenamiento"}
        >
          {isRecording && (
            <div className="rec-overlay">
              <span className="rec-dot" />
              <div className="rec-copy">
                <strong>
                  {training.label} · muestra {Math.min(training.done + 1, training.total)} de {training.total}
                </strong>
                <span>Repite la seña de forma natural, sin cortes</span>
              </div>
              <button className="btn btn-dark" onClick={onStop} type="button">
                <Icon name="stop" size={15} /> Detener
              </button>
            </div>
          )}
        </CameraStage>

        <Card title="Cómo grabar una seña" subtitle="Calidad de datos = calidad del reconocimiento">
          <ol className="steps">
            <li>
              <span className="step-n">1</span>
              <div>
                <p className="step-t">Encuadra el torso y ambas manos</p>
                <p className="step-d">Cuerpo a un metro de la cámara, luz frontal, fondo sin movimiento.</p>
              </div>
            </li>
            <li>
              <span className="step-n">2</span>
              <div>
                <p className="step-t">Repite la misma seña 12 veces</p>
                <p className="step-d">Igual que en una conversación real: inicio, movimiento y regreso a reposo.</p>
              </div>
            </li>
            <li>
              <span className="step-n">3</span>
              <div>
                <p className="step-t">Varía ligeramente entre repeticiones</p>
                <p className="step-d">Así el clasificador tolera distintas velocidades, distancias y ángulos.</p>
              </div>
            </li>
          </ol>
        </Card>
      </div>

      <aside className="train-side">
        <Card title="Nueva seña" subtitle="Añade una palabra o frase al vocabulario">
          <form className="sign-form" onSubmit={submit}>
            <label className="field">
              <span>Seña</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value.toUpperCase())}
                placeholder="Ej. HOLA"
                maxLength={28}
                disabled={busy}
              />
            </label>
            <label className="field">
              <span>Nota (opcional)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Descripción breve del movimiento"
                maxLength={60}
                disabled={busy}
              />
            </label>
            <button className="btn btn-accent btn-block" type="submit" disabled={busy || !label.trim()}>
              <Icon name="plus" size={15} /> Añadir al vocabulario
            </button>
          </form>
        </Card>

        <Card
          title="Vocabulario"
          subtitle={`${trained} de ${signs.length} señas con muestras`}
          right={<Chip tone={hasModel ? "accent" : "warn"}>{hasModel ? "Modelo activo" : "Sin modelo"}</Chip>}
        >
          <div className="sign-list">
            {signs.map((sign) => {
              const active = training?.label === sign.label;
              return (
                <div className={`sign-row ${active ? "is-recording" : ""}`} key={sign.label}>
                  <div className="sign-info">
                    <span className="sign-name">{sign.label}</span>
                    <span className="sign-meta">
                      {sign.count > 0 ? `${sign.count} muestras` : "sin entrenar"}
                      {sign.note ? ` · ${sign.note}` : ""}
                    </span>
                    {active && <Meter value={progress} tone="warn" height={4} />}
                  </div>
                  <div className="sign-actions">
                    {sign.count > 0 && (
                      <button
                        className="icon-btn is-ghost"
                        title="Borrar muestras de esta seña"
                        onClick={() => onClearSamples(sign.label)}
                        type="button"
                        disabled={isRecording}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    )}
                    <button
                      className={`btn btn-mini ${active ? "btn-warn" : "btn-soft"}`}
                      onClick={() => (active ? onStop() : onRecord(sign.label))}
                      type="button"
                      disabled={status !== "ready" || (isRecording && !active)}
                    >
                      <Icon name={active ? "stop" : "play"} size={13} />
                      {active ? `${training.done}/${training.total}` : "Grabar"}
                    </button>
                    <button
                      className="icon-btn is-ghost is-danger"
                      title="Eliminar seña"
                      onClick={() => onDeleteSign(sign.label)}
                      type="button"
                      disabled={isRecording}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Dataset" subtitle="Todo se guarda en IndexedDB, en tu equipo">
          <div className="dataset-stats">
            <div>
              <span className="ds-label">Muestras</span>
              <span className="ds-value">{totalSamples}</span>
            </div>
            <div>
              <span className="ds-label">Señas</span>
              <span className="ds-value">{signs.length}</span>
            </div>
            <div>
              <span className="ds-label">Entrenadas</span>
              <span className="ds-value">{trained}</span>
            </div>
          </div>
          <div className="dataset-actions">
            <button className="btn btn-soft" onClick={onExport} type="button">
              <Icon name="download" size={15} /> Exportar JSON
            </button>
            <button className="btn btn-soft" onClick={() => fileRef.current?.click()} type="button">
              <Icon name="upload" size={15} /> Importar
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleFile} />
          </div>
          <p className="fine">
            Exporta el dataset para llevarlo a otro equipo o adjuntarlo a tu informe. El reconocimiento se recalcula
            automáticamente al añadir muestras.
          </p>
        </Card>
      </aside>
    </div>
  );
}
