/** Pruebas del núcleo: geometría de manos y clasificador temporal. */
import { handShape, extractFeatures, FEATURE_LEN } from "../src/lib/features.js";
import { classify, dtw, resample, SEQ_LEN } from "../src/lib/classifier.js";

let pass = 0;
let fail = 0;

function check(name, cond, extra = "") {
  if (cond) {
    pass += 1;
    console.log(`  ok  ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${name} ${extra}`);
  }
}

const P = (x, y) => ({ x, y, z: 0 });

function buildHand({ fingers = [true, true, true, true], thumb = true } = {}) {
  const pts = new Array(21);
  pts[0] = P(0.5, 0.9);
  pts[1] = P(0.44, 0.86);
  pts[2] = P(0.4, 0.78);
  pts[3] = P(0.34, 0.74);
  pts[4] = thumb ? P(0.28, 0.7) : P(0.5, 0.86);

  const xs = [0.44, 0.5, 0.56, 0.62];
  const base = [5, 9, 13, 17];
  for (let i = 0; i < 4; i++) {
    const x = xs[i];
    pts[base[i]] = P(x, 0.62);
    pts[base[i] + 1] = P(x, fingers[i] ? 0.5 : 0.82);
    pts[base[i] + 2] = P(x, fingers[i] ? 0.4 : 0.85);
    pts[base[i] + 3] = P(x, fingers[i] ? 0.3 : 0.86);
  }
  return pts;
}

console.log("handShape");
check("mano abierta", handShape(buildHand())?.label === "MANO ABIERTA", JSON.stringify(handShape(buildHand())));
check(
  "puño",
  handShape(buildHand({ fingers: [false, false, false, false], thumb: false }))?.label === "PUÑO",
  JSON.stringify(handShape(buildHand({ fingers: [false, false, false, false], thumb: false })))
);
check(
  "victoria",
  handShape(buildHand({ fingers: [true, true, false, false], thumb: false }))?.label === "VICTORIA"
);
check("índice", handShape(buildHand({ fingers: [true, false, false, false], thumb: false }))?.label === "ÍNDICE");
check("pulgar arriba", handShape(buildHand({ fingers: [false, false, false, false], thumb: true }))?.label === "PULGAR ARRIBA");
check("sin mano", handShape(null) === null);
check(
  "confianza en rango",
  (() => {
    const s = handShape(buildHand());
    return s && s.confidence > 0.5 && s.confidence <= 1;
  })()
);

console.log("extractFeatures");
const features = extractFeatures(
  { landmarks: [buildHand()], handedness: [[{ categoryName: "Right" }]] },
  null,
  { dominant: "right", usePose: false }
);
check("vector de 150 dims", features?.vec?.length === FEATURE_LEN, String(features?.vec?.length));
check("vector con datos", features?.vec?.some((v) => v !== 0));
check(
  "dos manos",
  (() => {
    const f = extractFeatures(
      {
        landmarks: [buildHand(), buildHand()],
        handedness: [[{ categoryName: "Right" }], [{ categoryName: "Left" }]],
      },
      null,
      { dominant: "right", usePose: false }
    );
    return f && f.vec.slice(63, 126).some((v) => v !== 0);
  })()
);
check("sin manos devuelve null", extractFeatures({ landmarks: [] }, null, { dominant: "right" }) === null);

console.log("classifier");
const mkSeq = (value, jitter = 0) =>
  Array.from({ length: SEQ_LEN }, () => {
    const f = new Float32Array(FEATURE_LEN);
    for (let i = 0; i < FEATURE_LEN; i++) f[i] = value[i];
    return f;
  });

const a = new Float32Array(FEATURE_LEN).fill(0.1);
const b = new Float32Array(FEATURE_LEN).fill(0.6);
const dataset = [
  { label: "A", seq: mkSeq(a) },
  { label: "B", seq: mkSeq(b) },
];
const windowA = mkSeq(a, 0);
const ranked = classify(windowA, dataset, 3);
check("clasifica etiqueta correcta", ranked?.[0]?.label === "A", JSON.stringify(ranked?.[0]));
check("confianza alta con muestra idéntica", (ranked?.[0]?.conf || 0) > 0.8, String(ranked?.[0]?.conf));
check("dtw de secuencias idénticas ~0", dtw(resample(windowA), resample(windowA)) < 1e-6);
check(
  "resample conserva longitud",
  resample(mkSeq(a, 0).slice(0, 30), 16).length === 16
);
check("clasificar sin dataset devuelve null", classify(windowA, []) === null);

// Una sola etiqueta entrenada no debe dar 100% ante un gesto desconocido
const single = classify(mkSeq(b), [{ label: "A", seq: mkSeq(a) }], 3);
check("una etiqueta lejana baja la confianza", (single?.[0]?.conf || 1) < 0.5, String(single?.[0]?.conf));
check("una etiqueta cercana mantiene confianza", (classify(windowA, [{ label: "A", seq: mkSeq(a) }])?.[0]?.conf || 0) > 0.8);

console.log(`\n${pass} ok · ${fail} fail`);
process.exit(fail ? 1 : 0);
