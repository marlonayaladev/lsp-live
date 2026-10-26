import { useRef } from "react";
import Icon from "./Icons.jsx";
import { Card, Chip, Range, Segmented, Toggle } from "./ui.jsx";

export default function SettingsView({
  settings,
  onChange,
  onExport,
  onImport,
  onClearHistory,
  onReset,
  stats,
}) {
  const fileRef = useRef(null);

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
    <div className="settings-grid">
      <div className="settings-col">
        <Card title="Apariencia" subtitle="Interfaz de la aplicación">
          <Segmented
            label="Tema"
            value={settings.theme}
            onChange={(v) => onChange("theme", v)}
            options={[
              { value: "dark", label: "Oscuro" },
              { value: "light", label: "Claro" },
            ]}
          />
          <div className="divider" />
          <Toggle
            label="Espejar imagen"
            hint="Modo espejo, como mirarte en un espejo. Recomendado para el usuario que hace las señas."
            checked={settings.mirror}
            onChange={(v) => onChange("mirror", v)}
          />
          <div className="divider" />
          <Toggle
            label="Mostrar esqueleto de manos"
            hint="Dibuja los 21 puntos de cada mano sobre el video."
            checked={settings.showHands}
            onChange={(v) => onChange("showHands", v)}
          />
          <Toggle
            label="Mostrar pose del torso"
            hint="Dibuja hombros, codos y muñecas detectados."
            checked={settings.showPose}
            onChange={(v) => onChange("showPose", v)}
          />
        </Card>

        <Card title="Reconocimiento" subtitle="Ajusta la sensibilidad del clasificador">
          <Range
            label="Umbral de confianza"
            hint="Confianza mínima para aceptar una seña."
            value={settings.threshold}
            min={0.3}
            max={0.95}
            step={0.01}
            onChange={(v) => onChange("threshold", v)}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <div className="divider" />
          <Range
            label="Tiempo de confirmación"
            hint="Cuánto debe mantenerse la seña antes de agregarla a la transcripción."
            value={settings.holdMs}
            min={300}
            max={1500}
            step={50}
            onChange={(v) => onChange("holdMs", v)}
            format={(v) => `${(v / 1000).toFixed(2)} s`}
          />
          <div className="divider" />
          <Segmented
            label="Mano dominante"
            value={settings.dominant}
            onChange={(v) => onChange("dominant", v)}
            options={[
              { value: "right", label: "Derecha" },
              { value: "left", label: "Izquierda" },
            ]}
          />
          <div className="divider" />
          <Segmented
            label="Frecuencia de análisis"
            value={String(settings.targetFps)}
            onChange={(v) => onChange("targetFps", Number(v))}
            options={[
              { value: "15", label: "15 fps" },
              { value: "20", label: "20 fps" },
              { value: "30", label: "30 fps" },
            ]}
          />
          <div className="divider" />
          <Toggle
            label="Incluir pose en las características"
            hint="Mejora señas con ubicación corporal; desactívalo para ahorrar cómputo."
            checked={settings.usePose}
            onChange={(v) => onChange("usePose", v)}
          />
        </Card>
      </div>

      <div className="settings-col">
        <Card title="Datos" subtitle="Todo permanece en este navegador">
          <div className="dataset-stats">
            <div>
              <span className="ds-label">Señas</span>
              <span className="ds-value">{stats.signs}</span>
            </div>
            <div>
              <span className="ds-label">Muestras</span>
              <span className="ds-value">{stats.samples}</span>
            </div>
            <div>
              <span className="ds-label">Entradas</span>
              <span className="ds-value">{stats.transcript}</span>
            </div>
          </div>

          <div className="settings-actions">
            <button className="btn btn-soft" onClick={onExport} type="button">
              <Icon name="download" size={15} /> Exportar dataset
            </button>
            <button className="btn btn-soft" onClick={() => fileRef.current?.click()} type="button">
              <Icon name="upload" size={15} /> Importar dataset
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleFile} />
          </div>
          <div className="settings-actions">
            <button className="btn btn-ghost is-danger" onClick={onClearHistory} type="button">
              <Icon name="trash" size={15} /> Borrar historial
            </button>
            <button className="btn btn-ghost is-danger" onClick={onReset} type="button">
              <Icon name="alert" size={15} /> Restablecer todo
            </button>
          </div>
          <p className="fine">
            «Restablecer todo» borra las señas, las muestras y el historial de este equipo. Exporta antes el dataset si
            quieres conservarlo.
          </p>
        </Card>

        <Card title="Acerca de esta demo" subtitle="Prototipo funcional para el proyecto LSP">
          <div className="about">
            <Chip tone="accent" icon="bolt">
              Edge AI en el navegador
            </Chip>
            <p>
              Reconocimiento de lengua de señas peruana con <strong>MediaPipe</strong> (landmarks) y un clasificador
              temporal <strong>k-NN + DTW</strong> que corre en el dispositivo, sin servidor ni modelo en la nube.
            </p>
            <p>
              Cada seña se describe como una secuencia de 16 cuadros con 150 características normalizadas; la
              comparación usa Dynamic Time Warping para tolerar distintas velocidades.
            </p>
            <p className="fine">
              Versión web de escritorio. La versión móvil del informe usa React Native con TensorFlow Lite; comparten el
              mismo pipeline de características.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
