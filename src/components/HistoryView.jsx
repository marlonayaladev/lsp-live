import Icon from "./Icons.jsx";
import { Card, Chip, Empty, Meter, Stat } from "./ui.jsx";
import { formatDate, formatTime } from "../lib/storage.js";

export default function HistoryView({ transcript, onExport, onClear, onCopy, onPrint }) {
  const total = transcript.length;
  const unique = new Set(transcript.map((t) => t.label)).size;
  const avg = total
    ? transcript.reduce((acc, t) => acc + (t.conf || 0), 0) / total
    : 0;

  const freq = new Map();
  for (const t of transcript) freq.set(t.label, (freq.get(t.label) || 0) + 1);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const reversed = [...transcript].reverse();

  return (
    <div className="history-view">
      <div className="stats-row">
        <Stat label="Señas traducidas" value={total} />
        <Stat label="Vocabulario usado" value={unique} />
        <Stat label="Confianza media" value={Math.round(avg * 100)} suffix="%" />
        <Stat label="Señas más frecuentes" value={top[0]?.[0] || "—"} tone="accent" />
      </div>

      <div className="history-grid">
        <Card
          title="Registro de traducciones"
          subtitle="Se guarda localmente en este navegador"
          right={
            <div className="card-actions">
              <button className="btn btn-ghost" onClick={onCopy} disabled={!total} type="button">
                <Icon name="copy" size={15} /> Copiar
              </button>
              <button className="btn btn-ghost" onClick={onExport} disabled={!total} type="button">
                <Icon name="download" size={15} /> .txt
              </button>
              <button className="btn btn-ghost" onClick={onPrint} disabled={!total} type="button">
                <Icon name="print" size={15} /> PDF
              </button>
              <button className="btn btn-ghost is-danger" onClick={onClear} disabled={!total} type="button">
                <Icon name="trash" size={15} /> Borrar
              </button>
            </div>
          }
        >
          {total === 0 ? (
            <Empty
              icon="history"
              title="Todavía no hay historial"
              text="Vuelve a la vista En vivo, haz algunas señas y aquí quedará el registro."
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Seña</th>
                    <th>Origen</th>
                    <th className="num">Confianza</th>
                  </tr>
                </thead>
                <tbody>
                  {reversed.map((entry) => (
                    <tr key={entry.id}>
                      <td className="mono">
                        {formatDate(entry.ts)} · {formatTime(entry.ts)}
                      </td>
                      <td className="strong">{entry.label}</td>
                      <td>
                        <Chip tone={entry.source === "demo" ? "warn" : "accent"}>
                          {entry.source === "demo" ? "Demo" : "Modelo"}
                        </Chip>
                      </td>
                      <td className="num">
                        <span className="cell-conf">
                          <Meter value={entry.conf} tone="muted" height={4} />
                          <span>{Math.round((entry.conf || 0) * 100)}%</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="history-side">
          <Card title="Frecuencia" subtitle="Señas más repetidas en la sesión">
            {top.length === 0 ? (
              <Empty icon="wave" title="Sin datos" text="Aún no hay señas registradas." />
            ) : (
              <div className="freq-list">
                {top.map(([label, count]) => (
                  <div className="freq-row" key={label}>
                    <span className="freq-label">{label}</span>
                    <Meter value={count / top[0][1]} tone="accent" height={5} />
                    <span className="freq-count">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Resumen" subtitle="Para tu informe">
            <dl className="summary-list">
              <div>
                <dt>Entradas registradas</dt>
                <dd>{total}</dd>
              </div>
              <div>
                <dt>Señas distintas</dt>
                <dd>{unique}</dd>
              </div>
              <div>
                <dt>Confianza media</dt>
                <dd>{Math.round(avg * 100)}%</dd>
              </div>
              <div>
                <dt>Última actividad</dt>
                <dd>{total ? formatTime(transcript[total - 1].ts) : "—"}</dd>
              </div>
            </dl>
            <p className="fine">
              Las métricas corresponden únicamente a esta sesión y a este navegador. Úsalas como evidencia preliminar,
              no como validación formal del modelo.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
