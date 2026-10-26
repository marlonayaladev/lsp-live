import Icon from "./Icons.jsx";

export function Card({ title, subtitle, right, children, className = "", flush = false }) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <header className="card-head">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="card-sub">{subtitle}</p>}
          </div>
          {right && <div className="card-right">{right}</div>}
        </header>
      )}
      <div className={flush ? "card-body is-flush" : "card-body"}>{children}</div>
    </section>
  );
}

export function Chip({ tone = "neutral", children, icon = null }) {
  return (
    <span className={`chip chip-${tone}`}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

export function Toggle({ label, hint, checked, onChange, disabled = false }) {
  return (
    <label className={`row-toggle ${disabled ? "is-disabled" : ""}`}>
      <span className="row-copy">
        <span className="row-label">{label}</span>
        {hint && <span className="row-hint">{hint}</span>}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={`switch ${checked ? "is-on" : ""}`} aria-hidden="true">
        <span className="knob" />
      </span>
    </label>
  );
}

export function Range({ label, hint, value, min, max, step = 1, onChange, format }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="row-range">
      <div className="range-top">
        <span className="row-label">{label}</span>
        <span className="range-value">{format ? format(value) : value}</span>
      </div>
      {hint && <span className="row-hint">{hint}</span>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--pct": `${pct}%` }}
      />
    </div>
  );
}

export function Segmented({ value, options, onChange, label }) {
  return (
    <div className="segmented-wrap">
      {label && <span className="row-label">{label}</span>}
      <div className="segmented">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`seg ${value === opt.value ? "is-active" : ""}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Meter({ value, tone = "accent", height = 6 }) {
  const width = Math.max(0, Math.min(1, value || 0)) * 100;
  return (
    <span className={`meter meter-${tone}`} style={{ height }}>
      <span className="meter-fill" style={{ width: `${width}%` }} />
    </span>
  );
}

export function Stat({ label, value, suffix, tone = "" }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${tone}`}>
        {value}
        {suffix && <em>{suffix}</em>}
      </span>
    </div>
  );
}

export function Empty({ icon = "hand", title, text, children }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}
