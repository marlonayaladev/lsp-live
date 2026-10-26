/** Smoke test E2E: requiere `npm run dev` y un navegador con CDP en el puerto indicado. */
const PORT = Number(process.argv[2] || 9336);
const URL_APP = "http://127.0.0.1:5180/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
const page = targets.find((t) => t.type === "page");
if (!page) throw new Error("No hay pestaña disponible en el navegador de depuración");

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let id = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
    return;
  }
  if (msg.method === "Runtime.exceptionThrown") {
    errors.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
  }
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    errors.push((msg.params.args || []).map((a) => a.value ?? a.description).join(" "));
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
const evaluate = (expression) =>
  send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }).then(
    (r) => r.result?.value
  );

await send("Runtime.enable");
await send("Page.enable");
await send("Page.navigate", { url: URL_APP });
await sleep(10000);

const out = {};
out.live = await evaluate(
  `({ tag: document.querySelector('.live-tag')?.innerText, fps: document.querySelector('.stage-chip')?.innerText, overlay: document.querySelector('.overlay-title')?.innerText || null })`
);

await evaluate(`[...document.querySelectorAll('.nav-item')].find(b => b.innerText.includes('Historial')).click()`);
await sleep(900);
out.history = await evaluate(
  `({ view: !!document.querySelector('.history-view'), actions: [...document.querySelectorAll('.card-actions .btn')].map(b => b.innerText.trim()) })`
);

await evaluate(`[...document.querySelectorAll('.nav-item')].find(b => b.innerText.includes('Ajustes')).click()`);
await sleep(600);
out.settings = await evaluate(`({ view: !!document.querySelector('.settings-grid'), toggles: document.querySelectorAll('.switch').length })`);

await evaluate(`[...document.querySelectorAll('.nav-item')].find(b => b.innerText.includes('En vivo')).click()`);
await sleep(3000);
out.returned = await evaluate(`({ tag: document.querySelector('.live-tag')?.innerText, fps: document.querySelector('.stage-chip')?.innerText })`);

const ok =
  out.live.tag === "EN VIVO" &&
  out.history.actions.some((a) => a.includes("PDF")) &&
  out.settings.view &&
  out.returned.tag === "EN VIVO" &&
  errors.length === 0;

console.log(JSON.stringify({ ...out, errors }, null, 2));
console.log(ok ? "\nSMOKE OK" : "\nSMOKE FAIL");
process.exit(ok ? 0 : 1);
