// Local-only QAT-03 viewport probe. Run with: node scripts/qa-responsive-browser.mjs
// No credentials are loaded; protected pages are intentionally reported as redirects.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const chromePath = process.env.QA_CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const baseUrl = process.env.QA_BASE_URL ?? "http://localhost:3000";
const sizes = [[1440, 900], [1365, 768], [1024, 768], [768, 1024], [390, 844], [360, 800], [320, 700]];
if (!existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
const profileDir = await mkdtemp(join(tmpdir(), "zevantaa-qat03-chrome-"));
const chrome = spawn(chromePath, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profileDir}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu", "about:blank"], { stdio: "ignore" });

async function pageSocket() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const [port] = (await readFile(join(profileDir, "DevToolsActivePort"), "utf8")).trim().split("\n");
      const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
      if (response.ok) {
        const page = await response.json();
        if (page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch { /* Chrome is starting. */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error("Chrome debugging endpoint did not start");
}

try {
  const socket = new WebSocket(await pageSocket());
  await new Promise((done, reject) => { socket.addEventListener("open", done, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: done, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else done(message.result);
  });
  const send = (method, params = {}) => new Promise((done, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve: done, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  await send("Page.enable");
  for (const [width, height] of sizes) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 390 });
    await send("Page.navigate", { url: `${baseUrl}/login` });
    await new Promise((done) => setTimeout(done, 1000));
    const { result } = await send("Runtime.evaluate", { returnByValue: true, expression: `(() => {
      const box = (selector) => { const element = document.querySelector(selector); if (!element) return null;
        const rect = element.getBoundingClientRect(); return { x: Math.round(rect.x), right: Math.round(rect.right), width: Math.round(rect.width) }; };
      return { url: location.pathname, viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth, shell: box('.auth-shell'), form: box('.auth-form-panel'),
        switcher: box('.auth-portal-switch'), submit: box('.auth-submit') };
    })()` });
    process.stdout.write(`${JSON.stringify({ width, height, ...result.value })}\n`);
    const measured = result.value;
    if (measured.url !== "/login" || measured.documentWidth > measured.viewport + 1 ||
      [measured.shell, measured.form, measured.switcher, measured.submit].some((box) => !box || box.x < -1 || box.right > measured.viewport + 1))
      throw new Error(`Login layout exceeds ${width}px viewport`);
    if (width === 390 && process.env.QA_SCREENSHOT) {
      const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      await writeFile(process.env.QA_SCREENSHOT, Buffer.from(shot.data, "base64"));
    }
  }
  socket.close();
} finally {
  chrome.kill();
  const resolved = resolve(profileDir);
  if (resolved.startsWith(resolve(tmpdir()) + sep) && resolved.includes("zevantaa-qat03-chrome-"))
    await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
