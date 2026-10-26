import { useEffect, useRef } from "react";
import Icon from "./Icons.jsx";
import { Meter } from "./ui.jsx";

export default function CameraStage({
  engine,
  status,
  error,
  settings,
  live,
  onRetry,
  title = "Cámara frontal",
  footer = null,
  children = null,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (status !== "ready") return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) engine.bind(video, canvas);
    return () => engine.unbind(video);
  }, [engine, status]);

  const goFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  };

  return (
    <div className={`stage-wrap ${settings.mirror ? "is-mirrored" : ""}`}>
      <div className="stage" ref={wrapRef}>
        <video ref={videoRef} muted playsInline autoPlay />
        <canvas ref={canvasRef} />

        <div className="stage-top">
          <span className={`live-tag ${status === "ready" ? "is-on" : ""}`}>
            <i />
            {status === "ready" ? "EN VIVO" : "SIN SEÑAL"}
          </span>
          <div className="stage-top-right">
            {status === "ready" && (
              <>
                <span className="stage-chip">{Math.round(live.fps || 0)} fps</span>
                <span className="stage-chip">{Math.round(live.ms || 0)} ms</span>
                <span className="stage-chip is-dim">{live.device || "—"}</span>
              </>
            )}
            <button className="icon-btn on-dark" onClick={goFullscreen} title="Pantalla completa" type="button">
              <Icon name="expand" size={16} />
            </button>
          </div>
        </div>

        {status !== "ready" && (
          <div className="stage-overlay">
            {status === "loading" && (
              <>
                <span className="spinner" />
                <p className="overlay-title">Cargando modelos de IA</p>
                <p className="overlay-sub">MediaPipe Hands + Pose · 13,6 MB locales</p>
              </>
            )}
            {status === "error" && (
              <>
                <span className="overlay-icon">
                  <Icon name="alert" size={22} />
                </span>
                <p className="overlay-title">No se pudo iniciar la cámara</p>
                <p className="overlay-sub">{error}</p>
                <button className="btn btn-accent" onClick={onRetry} type="button">
                  Reintentar
                </button>
                <p className="overlay-hint">
                  Usa Chrome o Edge, permite el acceso a la cámara y vuelve a intentarlo.
                </p>
              </>
            )}
          </div>
        )}

        {status === "ready" && live.hands === 0 && (
          <div className="stage-hint">
            <Icon name="hand" size={16} />
            Muestra las manos dentro del encuadre
          </div>
        )}

        {children}

        <div className="stage-bottom">
          <div className="stage-caption">
            <Icon name="camera" size={14} />
            <span>{title}</span>
          </div>
          <div className="stage-progress">
            <span>Estabilidad</span>
            <Meter value={live.progress || 0} tone={live.locked ? "teal" : "accent"} height={4} />
          </div>
        </div>
      </div>
      {footer}
    </div>
  );
}
