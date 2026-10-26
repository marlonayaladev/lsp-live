/** Captura las cuatro vistas desde una sola pestaña. */
import { writeFileSync } from "node:fs";

const PORT = Number(process.argv[2] || 9336);
const OUTDIR = process.argv[3] || "tests";
const URL_APP = "http://127.0.0.1:5180/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
const page = targets.find((t) => t.type === "page");

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

const evaluate = (expression) =>
  send("Runtime.evaluate", { expression, returnByValue: true }).then((r) => r.result?.value);

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: URL_APP });
await sleep(11000);

const capture = async (name) => {
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  const path = `${OUTDIR}/shot-${name}.png`;
  writeFileSync(path, Buffer.from(data, "base64"));
  console.log("saved", path);
};

const status = await evaluate(`document.querySelector('.live-tag')?.innerText + ' | ' + (document.querySelector('.stage-chip')?.innerText || '')`);
console.log("estado:", status);

await capture("live");

for (const [view, label] of [["train", "Entrenar"], ["history", "Historial"], ["settings", "Ajustes"]]) {
  await evaluate(`[...document.querySelectorAll('.nav-item')].find(b => b.innerText.includes(${JSON.stringify(label)})).click()`);
  await sleep(1400);
  await capture(view);
}

ws.close();
