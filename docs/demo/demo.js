// Utter online demo: the real app's screens, without a server and without the model.
//
// Nothing is recognised here. Every answer is a replay of what the real app answered when
// experiments/record_demo_fixtures.py ran it on recordings from the TORGO database (the files in
// fixtures/). The microphone is not used either: a soft hum stands in for a voice, so the screens
// move the way they do in the real app. This file only replaces the two things the page cannot have
// on a static host: the server (fetch to /api/...) and the microphone.
(() => {
  // ---------------- Settings ----------------
  const FIXTURES = "fixtures/";
  const THINK_MS = 450;          // pretend-time of one recognition (the real app: about 0.1 s on a GPU)
  const WHISPER_MS = 1100;       // the regular assistant answers a little later, as in the real app
  const TEACH_MS = 350;
  const HUM_SECONDS = 1.3;       // length of the stand-in "voice"
  // -------------------------------------------

  const realFetch = window.fetch.bind(window);
  const cache = {};
  const load = (name) => cache[name] || (cache[name] = realFetch(FIXTURES + name).then((r) => r.json()));
  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const id = () => Math.random().toString(16).slice(2, 12);
  const copy = (o) => JSON.parse(JSON.stringify(o));
  const reply = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
  const missing = (detail = "Not found") => reply({ detail }, 404);

  // ---- state of the pretend server ----
  const ME = { id: "me", kind: "me", name: "My voice", sim: null };
  let profile = ME, words = null, log = [], cursor = 0, sim = null, fresh = null;
  const recent = {};
  async function myWords() {
    if (!words) words = copy((await load("me.json")).words);
    return words;
  }
  const active = async () => (sim ? sim.start.words : await myWords());

  // a waveform shape for display, like the server's peaks()
  const shape = (n) => Array.from({ length: n }, (_, i) => +(Math.sin(Math.PI * (i + 0.5) / n) * (0.45 + 0.55 * Math.random())).toFixed(3));

  // ---- a soft hum instead of a voice ----
  function humSamples(seconds, envelope, sr = 16000) {
    const n = Math.floor(seconds * sr), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / sr, e = envelope[Math.min(envelope.length - 1, Math.floor(i / n * envelope.length))];
      const f = 132 * (1 + 0.03 * Math.sin(2 * Math.PI * 4.5 * t));
      out[i] = 0.3 * e * (0.6 * Math.sin(2 * Math.PI * f * t) + 0.28 * Math.sin(2 * Math.PI * 2 * f * t) + 0.12 * Math.sin(2 * Math.PI * 3 * f * t));
    }
    return out;
  }
  const humWav = (seconds, envelope) => encodeWav(humSamples(seconds, envelope), 16000);   // encodeWav comes from recorder.js
  function soundFor(path) {
    const parts = path.split("/"), key = parts[2] === "sim" ? parts[4] : parts[3];
    const r = (sim && sim.answers[key]) || recent[key];
    return r ? humWav(Math.max(0.5, r.seconds), r.peaks) : humWav(1.1, shape(24));
  }

  // the microphone: a hum that starts, lasts a moment and stops, so listening ends by itself
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * HUM_SECONDS), ctx.sampleRate);
    buf.copyToChannel(humSamples(HUM_SECONDS, shape(24), ctx.sampleRate), 0);
    const src = ctx.createBufferSource(), out = ctx.createMediaStreamDestination();
    src.buffer = buf; src.connect(out); src.start(ctx.currentTime + 0.45);
    return out.stream;
  };
  // recordings played with <audio>
  const RealAudio = window.Audio;
  window.Audio = function (url) { return new RealAudio(/^\/api\//.test(url || "") ? URL.createObjectURL(soundFor(url)) : url); };

  // ---- the pretend server ----
  const wordOf = async (wid) => (await active()).find((w) => w.id === wid);
  function addTake(w, source = null) {
    w.take_list.unshift({ id: id(), when: Date.now() / 1000, peaks: shape(24), whisper: null, source });
    w.takes = w.take_list.length;
  }

  async function recognise() {
    const me = await load("me.json"), list = await myWords();
    await wait(THINK_MS);
    const known = new Set(list.filter((w) => w.takes).map((w) => w.id));
    // answers whose words are still in "My language"
    const usable = me.results.filter((r) => r.guesses.filter((g) => known.has(g.id)).length >= 2);
    if (!usable.length) return reply({ detail: "Teach at least 2 words first." }, 400);
    const r = copy(usable[cursor++ % usable.length]);
    r.guesses = r.guesses.filter((g) => known.has(g.id));
    r.align = r.align.filter((a) => known.has(a.word));
    // a word taught a moment ago in this demo: show it as the answer once, so the whole flow can be walked through
    const w = fresh && list.find((x) => x.id === fresh && x.takes);
    if (w) {
      fresh = null;
      Object.assign(r.guesses[0], { id: w.id, label: w.label, icon: w.icon, main: w.main, pale: w.pale });
      if (r.align[0]) Object.assign(r.align[0], { word: w.id, label: w.label });
      if (r.margin < r.threshold) { r.margin = r.threshold * 1.8; }
      r.accepted = true;
    }
    r.rec_id = id();
    recent[r.rec_id] = r;
    return reply(r);
  }

  async function route(path, method, body) {
    const p = path.split("/").slice(2);            // ["words", "<id>", "takes"]
    const get = (k) => (body && body.get ? body.get(k) : null);
    if (path === "/api/config") return reply({ ...(await load("me.json")).config, profile, demo: true });
    if (path === "/api/results") return reply(await load("results.json"));
    if (path === "/api/examples") return reply([]);
    if (path === "/api/profile") { sim = null; profile = ME; return reply(profile); }

    if (path === "/api/words" && method === "GET") return reply(await active());
    if (path === "/api/words") {
      const list = await myWords(), label = String(get("label") || "").trim().slice(0, 40);
      let w = list.find((x) => x.label.toLowerCase() === label.toLowerCase());
      if (!w) list.push(w = { id: id().slice(0, 8), label, phrase: String(get("phrase") || label + "."), icon: get("icon") || "chat-circle-dots",
        main: get("main") || "#8FD9B0", pale: get("pale") || "#D5F2E2", takes: 0, sound: null, conf: null, take_list: [] });
      return reply(w);
    }
    if (p[0] === "words" && p[2] === "takes") {
      const w = await wordOf(p[1]); if (!w) return missing("Unknown word");
      await wait(TEACH_MS); addTake(w); fresh = w.id;
      return reply(w);
    }
    if (p[0] === "words" && p[2] === "edit") {
      const w = await wordOf(p[1]); if (!w) return missing("Unknown word");
      if (get("phrase")) w.phrase = String(get("phrase")).slice(0, 200);
      return reply(w);
    }
    if (p[0] === "words" && p[2] === "archive") { words = (await myWords()).filter((w) => w.id !== p[1]); return reply({ ok: true }); }
    if (p[0] === "takes" && p[2] === "archive") {
      const w = (await myWords()).find((x) => x.take_list.some((t) => t.id === p[1])); if (!w) return missing();
      w.take_list = w.take_list.filter((t) => t.id !== p[1]); w.takes = w.take_list.length;
      return reply(w);
    }
    if (p[0] === "takes" && p[2] === "audio") return new Response(soundFor(path));

    if (path === "/api/recognize") return recognise();
    if (p[0] === "recent" && p[2] === "whisper") {
      const r = recent[p[1]]; if (!r) return missing();
      await wait(WHISPER_MS);
      return reply(r.whisper);
    }
    if (p[0] === "recent" && p[2] === "audio") return new Response(soundFor(path));
    if (path === "/api/confirm") {
      const w = await wordOf(get("word_id")), r = recent[get("rec_id")];
      if (!w || !r || r.confirmed) return missing();
      r.confirmed = true;
      if (get("learn") === "1") addTake(w, "confirmed");
      log.push({ label: w.label, phrase: w.phrase, icon: w.icon, main: w.main, source: "voice", when: Date.now() / 1000 });
      return reply(w);
    }
    if (path === "/api/log" && method === "GET") return reply(log.slice(-100).reverse());
    if (path === "/api/log") {
      log.push({ label: get("label"), phrase: get("phrase"), icon: get("icon") || "chat-circle-dots", main: get("main") || "#FFC93C", source: get("source") || "tap", when: Date.now() / 1000 });
      return reply({ ok: true });
    }
    if (path === "/api/reset") { words = []; log = []; return reply({ ok: true }); }

    if (path === "/api/sim/speakers") return reply(await load("speakers.json"));
    if (path === "/api/sim/start") {
      const data = copy(await load(`sim_${get("speaker")}.json`));
      await wait(1400);                           // the real app spends about this long learning the person's words
      sim = data; profile = data.start.profile;
      return reply(data.start);
    }
    if (p[0] === "sim" && p[1] === "audio") return new Response(soundFor(path));
    if (path === "/api/sim/recognize") {
      const r = sim && sim.answers[get("clip")]; if (!r) return missing();
      await wait(THINK_MS);
      recent[r.rec_id] = r;
      return reply(r);
    }
    return missing();
  }

  window.fetch = (input, opts = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    if (!url.pathname.startsWith("/api/")) return realFetch(input, opts);
    return route(url.pathname, (opts.method || "GET").toUpperCase(), opts.body).catch((e) => reply({ detail: String(e.message || e) }, 500));
  };
})();
