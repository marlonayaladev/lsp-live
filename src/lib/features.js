/**
 * Extracción de características a partir de los landmarks de MediaPipe.
 *
 * Vector por frame (150 dimensiones):
 *   [0..62]    mano principal   (21 puntos x 3)
 *   [63..125]  segunda mano     (21 puntos x 3, relativa a la principal)
 *   [126..149] pose del torso   (8 puntos x 3, normalizados por ancho de hombros)
 *
 * La normalización elimina la posición del cuerpo y la distancia a la cámara,
 * manteniendo la orientación de la mano (que sí es información lingüística).
 */

export const FEATURE_LEN = 150;
const HAND_POINTS = 21;
const POSE_IDX = [11, 12, 13, 14, 15, 16, 0, 23];

const d3 = (a, b) =>
  Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));

function handBlock(lm, origin, scale) {
  const out = new Float32Array(HAND_POINTS * 3);
  if (!lm || !scale || scale < 1e-5) return out;
  for (let i = 0; i < HAND_POINTS; i++) {
    const p = lm[i];
    if (!p) continue;
    out[i * 3] = (p.x - origin.x) / scale;
    out[i * 3 + 1] = (p.y - origin.y) / scale;
    out[i * 3 + 2] = ((p.z || 0) - (origin.z || 0)) / scale;
  }
  return out;
}

function poseBlock(lm) {
  const out = new Float32Array(8 * 3);
  if (!lm) return out;
  const L = lm[11], R = lm[12];
  if (!L || !R) return out;
  const cx = (L.x + R.x) / 2, cy = (L.y + R.y) / 2, cz = ((L.z || 0) + (R.z || 0)) / 2;
  const scale = Math.max(1e-4, d3(L, R));
  let k = 0;
  for (const i of POSE_IDX) {
    const p = lm[i];
    if (!p) { k += 3; continue; }
    out[k++] = (p.x - cx) / scale;
    out[k++] = (p.y - cy) / scale;
    out[k++] = ((p.z || 0) - cz) / scale;
  }
  return out;
}

/** Elige la mano dominante y devuelve ambas ordenadas. */
function orderHands(handRes, dominant) {
  const lms = handRes?.landmarks || [];
  const tags = (handRes?.handedness || []).map(
    (h) => (h && h[0] && h[0].categoryName) || ""
  );
  if (!lms.length) return { primary: null, secondary: null };
  if (lms.length === 1) return { primary: lms[0], secondary: null };
  const wanted = dominant === "left" ? "Left" : "Right";
  const idx = tags.findIndex((t) => t === wanted);
  if (idx === -1) return { primary: lms[0], secondary: lms[1] };
  return { primary: lms[idx], secondary: lms[idx === 0 ? 1 : 0] };
}

export function extractFeatures(handRes, poseRes, settings) {
  const { primary, secondary } = orderHands(handRes, settings.dominant);
  if (!primary) return null;

  const wrist = primary[0];
  const mid = primary[9] || primary[5];
  const scale = mid ? Math.max(1e-4, d3(wrist, mid)) : 0.1;

  const vec = new Float32Array(FEATURE_LEN);
  vec.set(handBlock(primary, wrist, scale), 0);
  if (secondary) vec.set(handBlock(secondary, wrist, scale), 63);
  if (settings.usePose && poseRes?.landmarks?.[0]) {
    vec.set(poseBlock(poseRes.landmarks[0]), 126);
  }
  return { vec, primary, secondary, scale };
}

/* ------------------------------------------------------------------ */
/* Heurística de formas de mano (modo demo, sin entrenamiento)         */
/* ------------------------------------------------------------------ */

const TIPS = [8, 12, 16, 20];
const PIPS = [6, 10, 14, 18];

/** Devuelve {label, confidence, fingers} para formas de mano reconocibles. */
export function handShape(lm) {
  if (!lm || lm.length < 21) return null;
  const wrist = lm[0];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const fingers = TIPS.map((tip, i) => {
    const pip = lm[PIPS[i]];
    return dist(lm[tip], wrist) > dist(pip, wrist) * 1.12;
  });

  const thumb = dist(lm[4], wrist) > dist(lm[2], wrist) * 1.22;
  const [index, middle, ring, pinky] = fingers;
  const count = fingers.filter(Boolean).length + (thumb ? 1 : 0);

  let label = null;
  if (count === 5) label = "MANO ABIERTA";
  else if (count === 0) label = "PUÑO";
  else if (index && middle && !ring && !pinky) label = "VICTORIA";
  else if (thumb && !index && !middle && !ring && !pinky)
    label = lm[4].y < wrist.y ? "PULGAR ARRIBA" : "PULGAR ABAJO";
  else if (index && !middle && !ring && !pinky) label = "ÍNDICE";
  else if (thumb && index && !middle && !ring && !pinky) label = "ELE";

  if (!label) return null;

  // Confianza: claridad con la que se separan los dedos extendidos.
  const margins = TIPS.map((tip, i) => {
    const pip = lm[PIPS[i]];
    return Math.abs(dist(lm[tip], wrist) - dist(pip, wrist) * 1.12) / Math.max(0.01, dist(pip, wrist));
  });
  const clarity = margins.reduce((a, b) => a + b, 0) / margins.length;
  const confidence = Math.min(0.96, 0.7 + Math.min(0.26, clarity * 1.6));
  return { label, confidence, fingers: count };
}
