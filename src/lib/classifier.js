/**
 * Clasificador temporal k-NN con alineamiento DTW.
 *
 * Cada muestra guardada es una secuencia de 16 frames x 150 features.
 * Para clasificar, se remuestrea la ventana en vivo a 16 frames y se compara
 * contra todas las muestras con Dynamic Time Warping (tolera distintas
 * velocidades al hacer la seña). La etiqueta queda con la menor distancia;
 * la confianza sale de un softmax sobre las distancias por etiqueta.
 */

export const SEQ_LEN = 16;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function resample(seq, n = SEQ_LEN) {
  if (!seq || seq.length === 0) return [];
  if (seq.length === n) return seq.map((f) => (f instanceof Float32Array ? f : Float32Array.from(f)));
  const out = [];
  for (let i = 0; i < n; i++) {
    const pos = (i * (seq.length - 1)) / (n - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(seq.length - 1, lo + 1);
    const t = pos - lo;
    const a = seq[lo];
    const b = seq[hi];
    const f = new Float32Array(a.length);
    for (let j = 0; j < a.length; j++) f[j] = a[j] + (b[j] - a[j]) * t;
    out.push(f);
  }
  return out;
}

function frameDistance(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s / a.length);
}

export function dtw(a, b, band = 0.35) {
  const n = a.length;
  const m = b.length;
  if (!n || !m) return Infinity;
  const w = Math.max(1, Math.ceil(Math.max(n, m) * band));
  let prev = new Float32Array(m + 1).fill(Infinity);
  let cur = new Float32Array(m + 1).fill(Infinity);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    cur.fill(Infinity);
    const lo = Math.max(1, i - w);
    const hi = Math.min(m, i + w);
    for (let j = lo; j <= hi; j++) {
      const cost = frameDistance(a[i - 1], b[j - 1]);
      const best = Math.min(prev[j], cur[j - 1], prev[j - 1]);
      cur[j] = cost + best;
    }
    const tmp = prev;
    prev = cur;
    cur = tmp;
  }
  return prev[m] / (n + m);
}

/**
 * @param {Array<Float32Array>} window frames en vivo (se remuestrean)
 * @param {Array<{label:string, seq:Array<Float32Array>}>} dataset
 * @param {number} topK
 */
export function classify(window, dataset, topK = 3) {
  if (!dataset?.length || !window?.length) return null;
  const q = resample(window.slice(-30), SEQ_LEN);

  const perLabel = new Map();
  for (const item of dataset) {
    const s = item.seq;
    if (!s || s.length !== SEQ_LEN) continue;
    const d = dtw(q, s);
    const prev = perLabel.get(item.label);
    if (prev === undefined || d < prev) perLabel.set(item.label, d);
  }
  if (!perLabel.size) return null;

  const sorted = [...perLabel.entries()]
    .map(([label, dist]) => ({ label, dist }))
    .sort((a, b) => a.dist - b.dist);

  // Softmax con temperatura adaptativa (distancias típicas 0.05 - 0.4).
  const tau = 0.1;
  const exps = sorted.map((s) => Math.exp(-s.dist / tau));
  const total = exps.reduce((a, b) => a + b, 0);

  // Calidad absoluta del mejor match: evita que una única etiqueta entrenada
  // devuelva 100% de confianza ante cualquier gesto desconocido.
  const quality = Math.exp(-sorted[0].dist / 0.3);

  const ranked = sorted.map((s, i) => ({
    label: s.label,
    dist: s.dist,
    conf: clamp((exps[i] / total) * quality, 0, 0.999),
  }));

  return ranked.slice(0, Math.max(1, topK));
}
