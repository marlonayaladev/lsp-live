/**
 * Persistencia local con IndexedDB.
 * Los datos nunca salen del equipo: no hay backend ni llamadas de red.
 */

const DB_NAME = "lsp-live";
const DB_VER = 1;

const SEED_SIGNS = [
  { label: "HOLA", note: "Saludo inicial" },
  { label: "GRACIAS", note: "Agradecimiento" },
  { label: "POR FAVOR", note: "Petición" },
  { label: "SÍ", note: "Afirmación" },
  { label: "NO", note: "Negación" },
  { label: "AYUDA", note: "Emergencia" },
  { label: "ADIÓS", note: "Despedida" },
  { label: "BUENOS DÍAS", note: "Saludo" },
  { label: "¿CÓMO ESTÁS?", note: "Pregunta" },
  { label: "PERDÓN", note: "Disculpa" },
];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("signs")) {
        db.createObjectStore("signs", { keyPath: "label" });
      }
      if (!db.objectStoreNames.contains("samples")) {
        const store = db.createObjectStore("samples", { keyPath: "id", autoIncrement: true });
        store.createIndex("label", "label", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run(storeName, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let request;
        let result;
        try {
          request = fn(store);
        } catch (err) {
          reject(err);
          return;
        }
        if (request) request.onsuccess = () => (result = request.result);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export async function listSigns() {
  const signs = (await run("signs", "readonly", (s) => s.getAll())) || [];
  const samples = (await run("samples", "readonly", (s) => s.getAll())) || [];
  const counts = new Map();
  for (const smp of samples) counts.set(smp.label, (counts.get(smp.label) || 0) + 1);
  return signs
    .map((s) => ({ ...s, count: counts.get(s.label) || 0 }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export async function ensureSeed() {
  const signs = (await run("signs", "readonly", (s) => s.getAll())) || [];
  if (signs.length) return;
  for (const item of SEED_SIGNS) {
    await run("signs", "readwrite", (s) =>
      s.put({ label: item.label, note: item.note, createdAt: Date.now() })
    );
  }
}

export async function addSign(label, note = "") {
  const clean = label.trim().toUpperCase();
  if (!clean) throw new Error("El nombre de la seña no puede estar vacío");
  const existing = await run("signs", "readonly", (s) => s.get(clean));
  if (existing) throw new Error("Esa seña ya existe");
  await run("signs", "readwrite", (s) =>
    s.put({ label: clean, note: note.trim(), createdAt: Date.now() })
  );
  return clean;
}

export async function deleteSign(label) {
  await run("samples", "readwrite", (s) => {
    const idx = s.index("label");
    const req = idx.openCursor(IDBKeyRange.only(label));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
  });
  await run("signs", "readwrite", (s) => s.delete(label));
}

export async function addSamples(label, seqs) {
  if (!seqs?.length) return 0;
  await run("samples", "readwrite", (s) => {
    for (const seq of seqs) {
      s.add({ label, seq, createdAt: Date.now() });
    }
  });
  return seqs.length;
}

export async function clearSamples(label) {
  await run("samples", "readwrite", (s) => {
    const idx = s.index("label");
    const req = idx.openCursor(IDBKeyRange.only(label));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
  });
}

export async function loadDataset() {
  const samples = (await run("samples", "readonly", (s) => s.getAll())) || [];
  return samples
    .filter((s) => Array.isArray(s.seq) && s.seq.length)
    .map((s) => ({
      label: s.label,
      seq: s.seq.map((frame) => Float32Array.from(frame)),
    }));
}

export async function exportDataset() {
  const signs = (await run("signs", "readonly", (s) => s.getAll())) || [];
  const samples = (await run("samples", "readonly", (s) => s.getAll())) || [];
  return {
    app: "LSP Live",
    version: 1,
    exportedAt: new Date().toISOString(),
    signs: signs.map(({ label, note }) => ({ label, note })),
    samples: samples.map(({ label, seq }) => ({ label, seq })),
  };
}

export async function importDataset(data) {
  if (!data || !Array.isArray(data.signs) || !Array.isArray(data.samples)) {
    throw new Error("El archivo no tiene el formato de dataset de LSP Live");
  }
  await resetAll();
  for (const sign of data.signs) {
    if (!sign?.label) continue;
    await run("signs", "readwrite", (s) =>
      s.put({ label: String(sign.label).toUpperCase(), note: sign.note || "", createdAt: Date.now() })
    );
  }
  for (const smp of data.samples) {
    if (!smp?.label || !Array.isArray(smp.seq)) continue;
    await run("samples", "readwrite", (s) =>
      s.add({ label: String(smp.label).toUpperCase(), seq: smp.seq, createdAt: Date.now() })
    );
  }
}

export async function resetAll() {
  await run("samples", "readwrite", (s) => s.clear());
  await run("signs", "readwrite", (s) => s.clear());
}
