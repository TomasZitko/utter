// Records the REAL Utter app (no mock-ups) for the film.
// Chrome gets a real TORGO recording as its microphone (--use-file-for-fake-audio-capture), so the app
// teaches and recognises exactly as it would with a person. Needs the film server:
//   set UTTER_STATE_DIR=...\data\film_state && python -m uvicorn app.server:app --port 8010
// Usage: node scripts/capture_app.mjs <session> <mic.wav> <outDir>
//   session = home | teach | listen
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const [session, mic, outDir] = process.argv.slice(2);
const URL = "http://127.0.0.1:8010/";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${path.resolve(mic)}`,
    "--autoplay-policy=no-user-gesture-required", "--mute-audio",
  ],
});
const page = await browser.newPage();
// Render the app's own phone element at 3x: same UI, crisp at film resolution.
await page.setViewport({ width: 1170, height: 2532, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument(() => {
  localStorage.setItem("utter.prefs", JSON.stringify({ onboarded: true, name: "" }));
});

// screencast: every changed frame with its timestamp
const cdp = await page.createCDPSession();
const frames = [];
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  const file = path.join(outDir, `f${String(frames.length).padStart(5, "0")}.jpg`);
  fs.writeFileSync(file, Buffer.from(data, "base64"));
  frames.push({ file, t: metadata.timestamp });
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
const events = [];
const t0 = Date.now() / 1000;
const mark = (name) => { events.push({ name, t: Date.now() / 1000 - t0 }); console.log(`${(Date.now() / 1000 - t0).toFixed(2)}s  ${name}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = async (sel) => { await page.waitForSelector(sel, { visible: true, timeout: 15000 }); await page.click(sel); };
const state = (expr) => page.evaluate(expr);
const until = async (expr, ms = 30000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await state(expr)) return true; await wait(100); }
  throw new Error("timeout: " + expr);
};

await page.goto(URL, { waitUntil: "networkidle0" });
await page.addStyleTag({ content: `#phone{position:fixed!important;left:0!important;top:0!important;margin:0!important;transform:scale(3);transform-origin:0 0;border-radius:0!important;z-index:2147483000;box-shadow:none!important}` });
await wait(1500);
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1170, maxHeight: 2532, everyNthFrame: 1 });
const box = await page.evaluate(() => { const r = document.querySelector("#phone").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
mark("start");
await wait(2500);

if (session === "teach") {
  mark("home"); await wait(1200);
  await click('[data-act="tab"][data-arg="teach1"]'); mark("teach1"); await wait(1800);
  const idx = await state(() => [...document.querySelectorAll('[data-act="pickMeaning"]')].findIndex((b) => b.textContent.includes("Tired")));
  await click(`[data-act="pickMeaning"][data-arg="${idx}"]`); mark("picked"); await wait(1400);
  await click('[data-act="teachContinue"]'); mark("teach2"); await wait(1500);
  for (let i = 1; i <= 3; i++) {
    await click('[data-act="record"]'); mark(`record${i}`);
    await until(`S.teach.count >= ${i} || S.screen === "teach3"`);
    mark(`take${i}`); await wait(900);
  }
  await until('S.screen === "teach3"'); mark("teach3"); await wait(3000);
  const home = await page.$('[data-act="goHome"]');
  if (home) { await home.click(); mark("home2"); await wait(2500); }
} else if (session === "listen") {
  mark("home"); await wait(1000);
  await click('[data-act="startListen"]'); mark("listen");
  await until('S.screen === "result" || S.screen === "speak"'); mark("result");
  await until("S.result !== null"); mark("answer"); await wait(2200);
  const sure = await state("S.result && S.result.accepted");
  console.log("accepted:", sure, JSON.stringify(await state("S.result")).slice(0, 400));
  if (sure) {
    const c = await page.$('[data-act="confirm"]');
    if (c) { await c.click(); mark("speak"); }
    await wait(4500);
  } else {
    await wait(4000);
  }
} else {
  mark("home"); await wait(3000);
  await click('[data-act="tab"][data-arg="words"]').catch(() => {}); mark("words"); await wait(3000);
}

await cdp.send("Page.stopScreencast");
mark("end");
await browser.close();

// frames -> constant 30 fps video using each frame's real display time
const list = frames.map((f, i) => {
  const d = i + 1 < frames.length ? frames[i + 1].t - f.t : 1.0;
  return `file '${path.resolve(f.file).replace(/\\/g, "/")}'\nduration ${Math.max(0.001, d).toFixed(4)}`;
}).join("\n") + `\nfile '${path.resolve(frames.at(-1).file).replace(/\\/g, "/")}'\n`;
fs.writeFileSync(path.join(outDir, "frames.txt"), list);
fs.writeFileSync(path.join(outDir, "events.json"), JSON.stringify({ firstFrame: frames[0]?.t, startWall: t0, box, events }, null, 2));
console.log(`${frames.length} frames`);
