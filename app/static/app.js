// Utter: the phone app (plain JS). Brand: brand.js · Engine panel: engine.js · Real voices: lab.js
// ---------------- Settings ----------------
const LISTEN_SECONDS = 5.5;     // longest listening time; it stops earlier when the person stops speaking
const TAKE_SECONDS = 4;         // longest single recording when teaching
const QUIET_MS = 900;           // silence after speech that ends a recording
const SPEAK_LEVEL = 0.2;        // loudness (0..1) that counts as speech
const QUIET_LEVEL = 0.08;       // loudness that counts as silence
const BARS = 41;                // bars in the wave
const CAUTION = { careful: 1.5, balanced: 1, quick: 0.6 };   // multiplies the "not sure" threshold from the notebook
const SLEEP_AFTER_MS = 30000;   // Blub dozes off on the home screen after this long without a touch
const DEFAULT_PREFS = { name: "", lang: "en", rate: 0.92, voice: "", caution: "balanced", learn: true,
  autoStop: true,      // stop recording by itself after the person stops speaking
  confirm: true,       // ask "Yes, say it" before speaking; off = speak a clear guess straight away
  motion: true,        // Blub and screens move
  onboarded: false };  // the guide has been seen
// -------------------------------------------

const MEANINGS = [
  { label: "Water", icon: "drop", main: "#4C7DFF", pale: "#C9D8FF", phrase: "Can I have some water, please?" },
  { label: "Pain", icon: "lightning", main: "#F4583E", pale: "#FFC3B5", phrase: "Something hurts. I am in pain." },
  { label: "Bathroom", icon: "toilet", main: "#9A88FF", pale: "#DDD6FF", phrase: "I need to use the bathroom." },
  { label: "Food", icon: "fork-knife", main: "#FF9E5E", pale: "#FFDCC2", phrase: "I'm hungry. Can I eat something?" },
  { label: "Walk", icon: "person-simple-walk", main: "#8FD9B0", pale: "#D5F2E2", phrase: "Can we go for a walk?" },
  { label: "TV", icon: "television-simple", main: "#C9A4FF", pale: "#EBDDFF", phrase: "Can you turn on the TV?" },
  { label: "Hot", icon: "thermometer-hot", main: "#FF9E5E", pale: "#FFDCC2", phrase: "I'm too hot." },
  { label: "Cold", icon: "snowflake", main: "#8FD3FF", pale: "#D9F0FF", phrase: "I'm cold. Can I have a blanket?" },
  { label: "Family", icon: "users-three", main: "#F8A4D2", pale: "#FFE0F1", phrase: "I want to see my family." },
  { label: "Medicine", icon: "pill", main: "#4C7DFF", pale: "#C9D8FF", phrase: "I need my medicine." },
  { label: "Phone", icon: "phone", main: "#FFC93C", pale: "#FBEBB0", phrase: "Can you pass me my phone?" },
  { label: "Tired", icon: "moon", main: "#FFC93C", pale: "#FBEBB0", phrase: "I'm tired. I'd like to rest." },
];
const QUICK = {
  yes: { label: "Yes", phrase: "Yes.", icon: "check", main: "#8FD9B0" },
  no: { label: "No", phrase: "No.", icon: "x", main: "#F8A4D2" },
  help: { label: "Help", phrase: "I need help, please come here.", icon: "hand-palm", main: "#F4583E", alarm: true },
};

// ---------------- language ----------------
// The app speaks English and Czech. New screens use G(english, czech) directly; older screens are
// translated after drawing by CS (exact sentences) and CS_RULES (sentences with a name or number in them).
// Recognition itself has no language: it matches sounds, not words.
const LANGS = [["en", "English"], ["cs", "Čeština"]];
const TTS_LANG = { en: "en-US", cs: "cs-CZ" };
const G = (en, cs) => (P.lang === "cs" ? cs : en);
const CS = {
  "Speak": "Mluvit", "Words": "Slova", "Teach": "Naučit", "Today": "Dnes", "Proof": "Důkazy",
  "Hello.": "Ahoj.", "What do you need?": "Co potřebuješ?", "Start listening": "Začít poslouchat",
  "Yes": "Ano", "No": "Ne", "Help": "Pomoc", "Teach a word": "Naučit slovo",
  "Teach Utter": "Nauč Utter", "your first word.": "své první slovo.", "One more word and": "Ještě jedno slovo", "we can talk.": "a můžeme mluvit.",
  "Say a sound three times and tell Utter what it means.": "Řekni zvuk třikrát a řekni Utteru, co znamená.",
  "Listening…": "Poslouchám…", "Listening": "Poslouchám", "Take your time. Say it your way.": "Nespěchej. Řekni to po svém.", "I'm done": "Hotovo",
  "Comparing with your words…": "Porovnávám s tvými slovy…", "Not sure…": "Nejsem si jistý…",
  "Say it again, or pick what you meant.": "Řekni to znovu, nebo vyber, co jsi myslel.",
  "Yes, say it": "Ano, řekni to", "Say it again": "Řekni to znovu", "None of these, teach it": "Nic z toho, naučit nové", "Again": "Znovu",
  "A regular assistant heard": "Běžný asistent slyšel",
  "I say": "Říkám", "Flip": "Otočit", "Done": "Hotovo", "Quick reply": "Rychlá odpověď", "Tapped on the board": "Vybráno dotykem",
  "Recognised from your voice": "Rozpoznáno z tvého hlasu", "Recognised from your voice · Utter learned from this": "Rozpoznáno z tvého hlasu · Utter se z toho učil",
  "From My language": "Z mého jazyka", "Said again from Today": "Zopakováno z dneška",
  "My language": "Můj jazyk",
  "The quote is what a regular assistant hears in your recording. The bar is how often Utter recognises your own recordings of the word when it is left out and tested.": "Citát je to, co ve tvé nahrávce slyší běžný asistent. Pruh ukazuje, jak často Utter pozná tvé vlastní nahrávky slova, když je vynechá a otestuje.",
  "Utter says": "Utter říká", "Recognised in self-test": "Poznáno ve vlastním testu", "Recordings": "Nahrávek", "Say it aloud": "Říct nahlas",
  "Forget this word": "Zapomenout slovo", "Edit": "Upravit", "Your sound": "Tvůj zvuk", "Yesterday": "Včera",
  "Step 1 of 2": "Krok 1 ze 2", "What should this sound mean?": "Co má ten zvuk znamenat?", "Pick a meaning to continue": "Vyber význam",
  "your way": "po svém", "Tap once. No need to hold.": "Stačí jednou klepnout. Nemusíš držet.", "Listening… it stops by itself.": "Poslouchám… zastaví se to samo.",
  "Saving…": "Ukládám…", "Recording": "Nahrávám", "part of your language": "součástí tvého jazyka",
  "Try it now": "Vyzkoušet", "Teach another word": "Naučit další slovo", "See my language": "Zobrazit můj jazyk", "Or type your own": "Nebo napiš vlastní",
  "things said today": "řečeno dnes", "of them by voice": "z toho hlasem", "words in the language": "slov v jazyce",
  "Nothing said yet. Sentences appear here with the time, and one tap says them again.": "Zatím nic. Věty se tu objeví i s časem a jedním klepnutím je řekneš znovu.",
  "Recording removed": "Nahrávka odebrána", "Settings": "Nastavení", "Back": "Zpět", "Cancel": "Zrušit", "Close": "Zavřít",
};
const CS_RULES = [
  [/^Hi (.+)\.$/, (m) => `Ahoj, ${m[1]}.`],
  [/^(.+) says$/, (m) => `${m[1]} říká`],
  [/^(\d+) words? · (\d+) recordings$/, (m) => `${m[1]} slov · ${m[2]} nahrávek`],
  [/^(\d+) rec$/, (m) => `${m[1]} nahr.`],
  [/^Take (\d+)$/, (m) => `Nahrávka ${m[1]}`],
  [/^Record (\d+) more$/, (m) => `Nahrát další ${m[1]}`],
  [/^Record “(.+)”$/, (m) => `Nahrát „${m[1]}“`],
  [/^Recording (\d+) of (\d+)$/, (m) => `Nahrávka ${m[1]} ze ${m[2]}`],
  [/^All (\d+) done$/, (m) => `Všechny ${m[1]} hotové`],
  [/^Say “(.+)”$/, (m) => `Řekni „${m[1]}“`],
  [/^“(.+)” is now$/, (m) => `„${m[1]}“ je teď`],
  [/^(\d+) recordings saved\. Utter gets better every time you confirm a guess\.$/, (m) => `${m[1]} nahrávky uloženy. Utter se zlepšuje pokaždé, když potvrdíš odhad.`],
  [/^Everything (.+) said with Utter\. Useful for family and carers\.$/, () => "Všechno, co bylo s Utterem řečeno. Hodí se rodině a pečujícím."],
  [/^(by voice|quick reply|by tap) · (.+)$/, (m) => `${{ "by voice": "hlasem", "quick reply": "rychlá odpověď", "by tap": "dotykem" }[m[1]]} · ${CS[m[2]] || m[2]}`],
  [/^learned · (.+)$/, (m) => `naučeno · ${CS[m[1]] || m[1]}`],
  [/^Teach at least (\d+) words first$/, (m) => `Nejdřív nauč aspoň ${m[1]} slova`],
];
function trText(s) {
  const k = s.trim();
  if (!k) return s;
  let out = CS[k];
  if (out == null) for (const [re, fn] of CS_RULES) { const m = k.match(re); if (m) { out = fn(m); break; } }
  return out == null ? s : s.replace(k, out);
}
const tr = (s) => (P.lang === "cs" ? trText(s) : s);
function localize(root) {
  if (P.lang !== "cs" || !root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const t = trText(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; }
  root.querySelectorAll("[aria-label], [placeholder]").forEach((el) => {
    for (const a of ["aria-label", "placeholder"]) if (el.hasAttribute(a)) el.setAttribute(a, trText(el.getAttribute(a)));
  });
}
// Meanings and quick replies in Czech (label, sentence).
const CS_MEANINGS = {
  Water: ["Voda", "Můžu dostat vodu, prosím?"], Pain: ["Bolest", "Něco mě bolí."], Bathroom: ["Záchod", "Potřebuji na záchod."],
  Food: ["Jídlo", "Mám hlad. Můžu se najíst?"], Walk: ["Procházka", "Půjdeme na procházku?"], TV: ["Televize", "Můžeš zapnout televizi?"],
  Hot: ["Horko", "Je mi horko."], Cold: ["Zima", "Je mi zima. Můžu dostat deku?"], Family: ["Rodina", "Chci vidět rodinu."],
  Medicine: ["Léky", "Potřebuji své léky."], Phone: ["Telefon", "Podáš mi telefon?"], Tired: ["Únava", "Jsem unavený. Chci si odpočinout."],
  Yes: ["Ano", "Ano."], No: ["Ne", "Ne."], Help: ["Pomoc", "Potřebuji pomoc, pojďte prosím sem."],
};
// The meaning in the app's language (colour and icon stay).
const loc = (m) => (P.lang === "cs" && CS_MEANINGS[m.label] ? { ...m, label: CS_MEANINGS[m.label][0], phrase: CS_MEANINGS[m.label][1] } : m);

// ---------------- state ----------------
const S = {
  screen: "home", cfg: null, words: [], log: [],
  result: null, sel: null, heard: null, speak: null, flipped: false, detailId: null, editing: false,
  teach: { sel: null, custom: "", wordId: null, addTo: null, count: 0, recording: false },
  proof: null, examples: null, playing: null, sim: null, guide: 0, sleepy: false,
};
let P = { ...DEFAULT_PREFS };
try { P = { ...P, ...JSON.parse(localStorage.getItem("utter.prefs") || "{}") }; } catch (e) { /* no storage */ }
function savePrefs() { try { localStorage.setItem("utter.prefs", JSON.stringify(P)); } catch (e) { /* no storage */ } }
const SYSTEM_STILL = BLUB.still;
function applyPrefs() {
  BLUB.still = SYSTEM_STILL || !P.motion;
  document.documentElement.lang = P.lang;
  document.documentElement.classList.toggle("still", BLUB.still);
}
applyPrefs();
let rec = null, recTimer = null, recDone = null, raf = null;

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x) => (x == null ? "–" : `${Math.round(x * 100)}%`);
const word = (id) => S.words.find((w) => w.id === id);
const readyWords = () => S.words.filter((w) => w.takes > 0);
const simMode = () => S.cfg?.profile?.kind === "sim";

async function api(path, opts) {
  const r = await fetch(path, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.detail || r.statusText);
  return j;
}
function form(obj) { const f = new FormData(); for (const [k, v] of Object.entries(obj)) f.append(k, v); return f; }

function toast(text, icon = "info") {
  $("#toast-slot").innerHTML = `<div class="toast" role="status"><i class="ph-fill ph-${icon}"></i>${esc(tr(text))}</div>`;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => ($("#toast-slot").innerHTML = ""), 2800);
}
function voicesFor(lang) {
  try { return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang)); } catch (e) { return []; }
}
function say(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = P.rate; u.lang = TTS_LANG[P.lang] || "en-US";
    const vs = voicesFor(P.lang), v = vs.find((x) => x.name === P.voice) || vs[0];
    if (v) { u.voice = v; u.lang = v.lang; }
    speechSynthesis.speak(u);
  } catch (e) { /* no voice on this device */ }
}
// Help: a loud two-tone signal so someone in the next room notices, then the sentence.
function alarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.28, 0.56].forEach((t, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "square"; o.frequency.value = i % 2 ? 660 : 880;
      g.gain.setValueAtTime(0.18, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.24);
      o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.25);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch (e) { /* no audio */ }
}
function when(ts) {
  const d = new Date(ts * 1000), now = new Date();
  const days = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / 864e5);
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : d.toLocaleDateString("en", { weekday: "short" });
}
const clock = (ts) => new Date(ts * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

// ---------------- recording ----------------
function bars(amp) {
  return Array.from({ length: BARS }, (_, i) => {
    const d = Math.abs(i - 20) / 20, env = 1 - d * 0.7;
    let h = amp ? Math.max(6, (14 + Math.random() * 80 * amp) * env) : 8 + (1 - d) * 22 * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.3)));
    if (i === 20) h = amp ? Math.max(30, 100 * Math.min(1, amp * 1.4)) : 44;
    return Math.round(h);
  });
}
function waveHTML(scale = 1, h = 110) {
  return `<div class="wave" data-scale="${scale}" aria-hidden="true" style="height:${h}px">${bars(0).map((b, i) =>
    `<div class="${i === 20 ? "mid" : ""}" style="height:${Math.round(b * scale)}px"></div>`).join("")}</div>`;
}
// Moves the wave, the face and the Engine panel with the real loudness of `source` (microphone or a played clip).
function animate(source, onTick) {
  cancelAnimationFrame(raf);
  let last = 0;
  const tick = (t) => {
    if (!source.analyser) { BLUB.level = null; return; }
    if (t - last > 90) {
      last = t;
      const lvl = source.level(), amp = Math.max(0.08, lvl);
      const hs = bars(amp);
      document.querySelectorAll(".wave").forEach((w) => {
        const scale = +w.dataset.scale || 1;
        [...w.children].forEach((d, i) => (d.style.height = `${Math.round(hs[i] * scale)}px`));
      });
      document.querySelectorAll(".hero, .rec").forEach((e) => e.style.setProperty("--pulse", 1 + amp * 0.05));
      BLUB.level = lvl;
      Engine.live(lvl);
      if (onTick) onTick(lvl);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
async function startRecording(seconds, onDone) {
  rec = new WavRecorder();
  try { await rec.start(); } catch (e) {
    rec = null; toast("Microphone is not available: " + e.message, "microphone-slash"); return false;
  }
  recDone = onDone;
  recTimer = setTimeout(stopRecording, seconds * 1000);
  Engine.listening();
  const t0 = performance.now();
  let spoke = 0, quietSince = null;
  animate(rec, (lvl) => {
    const bar = $("#ring"); if (bar) bar.style.width = `${Math.min(100, (performance.now() - t0) / (seconds * 10))}%`;
    // stop by itself: once the person has spoken and then been quiet for a moment
    if (lvl > SPEAK_LEVEL) { spoke += 1; quietSince = null; }
    else if (P.autoStop && lvl < QUIET_LEVEL && spoke >= 2) {
      quietSince = quietSince ?? performance.now();
      if (performance.now() - quietSince > QUIET_MS) stopRecording();
    }
  });
  return true;
}
async function stopRecording(discard = false) {
  clearTimeout(recTimer);
  if (!rec) return;
  const r = rec, done = recDone; rec = null; recDone = null;
  cancelAnimationFrame(raf); BLUB.level = null;
  const blob = await r.stop();
  if (discard) Engine.idle();
  if (!discard && done) done(blob);
}

// ---------------- templates ----------------
function hero({ pale = "#FBEBB0", main = "#FFC93C", face = "idle", icon = null, badge = null, tap = null, tapLabel = "", left = null, right = null, tag = null, brand = false }) {
  // Blub is the hero. "icon" = calm Blub with the word's icon on the badge.
  const mood = face === "icon" ? "idle" : face, live = mood === "listen";
  if (face === "icon") badge = badge || icon;
  const leftHTML = left ? `<button class="circle-btn" data-act="${left.act}" aria-label="${esc(left.label)}">${left.text ? `<span>${esc(left.text)}</span>` : `<i class="ph-bold ph-${left.icon}"></i>`}</button>` : "<span></span>";
  const rightHTML = tag ? `<span class="tag"><span class="dot"></span>${esc(tag)}</span>`
    : right ? `<button class="pill-btn" data-act="${right.act}" ${right.arg ? `data-arg="${right.arg}"` : ""}><i class="ph-bold ph-${right.icon}"></i>${esc(right.label)}</button>` : "<span></span>";
  return `<div class="hero" style="--pale:${pale};--main:${main}">
    <div class="blub">${mascot({ key: "hero", color: main, mood, R: 226, lobes: 9, amp: live ? 0.05 : 0.032, speed: live ? 2.6 : 1, faceY: 112, faceScale: 1.05 })}</div>
    <button class="face" ${tap ? `data-act="${tap}"` : "tabindex=-1"} aria-label="${esc(tapLabel || BRAND.name)}"></button>
    ${badge ? `<div class="badge"><i class="ph-bold ph-${badge}"></i></div>` : ""}
    <div class="bar">${leftHTML}${brand ? `<span class="wm">${BRAND.wordmark}</span>` : ""}${rightHTML}</div>
  </div>`;
}
const loader = '<span class="bars-load" role="status" aria-label="Working"><i></i><i></i><i></i><i></i><i></i></span>';

const SCREENS = {
  home() {
    const ready = readyWords(), enough = ready.length >= (S.cfg?.min_words ?? 2);
    const head = hero({ brand: true, face: S.sleepy ? "sleep" : "idle", tap: enough ? "startListen" : "teachNew", tapLabel: enough ? "Start listening" : "Teach a word",
      left: P.name ? { text: P.name[0].toUpperCase(), label: "Profile and settings", act: "openSettings" } : { icon: "user", label: "Profile and settings", act: "openSettings" },
      right: { icon: "book-open-text", label: "Words", act: "tab", arg: "words" } });
    if (!enough) {
      return head + `<div class="below with-nav">
        <h1 class="h1 c" style="font-size:38px">${ready.length ? "One more word and<br>we can talk." : `Teach ${BRAND.name}<br>your first word.`}</h1>
        <p class="sub c" style="font-size:16px">Say a sound three times and tell ${BRAND.name} what it means.</p>
        <button class="btn xl primary" data-act="teachNew"><i class="ph-bold ph-plus"></i>Teach a word</button>
        <div class="quick">${quickHTML()}</div>
      </div>`;
    }
    const board = ready.map((w) => `<button style="--main:${w.main}" data-act="tapSay" data-arg="${w.id}"><span><i class="ph-bold ph-${w.icon}"></i></span>${esc(w.label)}</button>`).join("");
    return head + `<div class="below with-nav">
      <h1 class="h1 c">${P.name ? `Hi ${esc(P.name)}.` : "Hello."}<br>What do you need?</h1>
      <button class="btn xl primary" data-act="startListen"><i class="ph-fill ph-microphone"></i>Start listening</button>
      <div class="quick">${quickHTML()}</div>
      <div class="board" aria-label="Tap to say">${board}</div>
    </div>`;
  },

  listen() {
    return hero({ pale: "#FFE0F1", main: "#F8A4D2", face: "listen", tap: "finishListen", tapLabel: "Stop listening",
      left: { icon: "x", label: "Cancel", act: "cancelListen" }, tag: "Listening" }) +
    `<div class="below center">
      <h1 class="h1" style="font-size:46px">Listening…</h1>
      <p class="sub c">Take your time. Say it your way.</p>
      ${waveHTML(1, 104)}
      <div class="ring"><div id="ring"></div></div>
      <div class="stack"><button class="btn xl outline" data-act="finishListen"><i class="ph-fill ph-stop-circle" style="color:var(--danger)"></i>I'm done</button></div>
    </div>`;
  },

  result() {
    const r = S.result;
    if (!r) {
      return hero({ pale: "#FFE0F1", main: "#F8A4D2", face: "think" }) +
        `<div class="below center" style="justify-content:center"><p class="sub">Comparing with your words…</p></div>`;
    }
    const g = S.sel != null ? r.guesses[S.sel] : null;
    const heard = S.heard == null ? (S.cfg?.whisper ? "…" : null) : S.heard;
    const heardLine = heard == null ? "" : `A regular assistant heard <b>“${esc(heard)}”</b>`;
    const chips = r.guesses.slice(0, 3).map((x, i) => `<button class="chip" role="radio" aria-checked="${i === S.sel}" data-act="pick" data-arg="${i}">
      <i class="ph-bold ph-${x.icon}"></i>${esc(x.label)} <span>${x.pct}%</span></button>`).join("");
    const top = r.accepted
      ? `<h1 class="h1 c" style="font-size:54px;line-height:1">${esc(r.guesses[S.sel ?? 0].label)}?</h1>`
      : `<h1 class="h1 c" style="font-size:46px;line-height:1">Not sure…</h1>
         <p class="sub c" style="font-size:16px">Say it again, or pick what you meant.</p>`;
    const actions = g
      ? `<button class="btn xl cream" data-act="confirm"><i class="ph-fill ph-speaker-high"></i>Yes, say it</button>
         ${r.accepted ? "" : `<button class="btn outline" data-act="startListen"><i class="ph-bold ph-arrow-counter-clockwise"></i>Say it again</button>`}`
      : `<button class="btn xl primary" data-act="startListen"><i class="ph-fill ph-microphone"></i>Say it again</button>`;
    return hero({ pale: g ? g.pale : "#E9E2D6", main: g ? g.main : "#B5AC9E", face: r.accepted || g ? "happy" : "unsure",
        badge: g ? g.icon : "question", left: { icon: "arrow-left", label: "Back", act: "goHome" },
        right: { icon: "arrow-counter-clockwise", label: "Again", act: "startListen" } }) +
      `<div class="below center" style="gap:12px;padding-top:22px">
        ${top}
        <p class="heard-line" id="heard">${heardLine}</p>
        <div role="radiogroup" aria-label="Guesses" class="chips">${chips}</div>
        <div class="stack">
          ${actions}
          <button class="btn link" data-act="teachNew">None of these, teach it</button>
        </div>
      </div>`;
  },

  speak() {
    const s = S.speak;
    return `<div class="speak ${s.alarm ? "alarm" : ""}" style="--main:${s.main}">
      <div class="row">
        <button class="circle-btn" data-act="goHome" aria-label="Close"><i class="ph-bold ph-x"></i></button>
        <button class="pill-btn" data-act="flip"><i class="ph-bold ph-arrows-clockwise"></i>Flip</button>
      </div>
      <div class="body ${S.flipped ? "flipped" : ""}">
        <div class="who"><div><i class="ph-bold ph-${s.icon}"></i></div><span>${P.name ? esc(P.name) + " says" : "I say"}</span></div>
        <p class="phrase">${esc(s.phrase)}</p>
        <div class="line"></div>
        <span style="font-size:16px">${esc(s.source)}</span>
      </div>
      <div class="stack" style="margin-top:0">
        <button class="btn xl black" data-act="sayAgain"><i class="ph-fill ph-speaker-high"></i>Say it again</button>
        <button class="btn outline-ink" data-act="goHome">Done</button>
      </div>
    </div>`;
  },

  words() {
    const n = S.words.reduce((a, w) => a + w.takes, 0);
    const cards = S.words.map((w, i) => `
      <button class="wcard" style="--main:${w.main}" data-act="openWord" data-arg="${w.id}" aria-label="${esc(w.label)}">
        <div class="top"><div class="ic"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="${blobPath(50, 50, 40, 5 + i % 4, 0.09, 0, 0)}" fill="none" stroke="#141414" stroke-width="3.5"/></svg><i class="ph-bold ph-${w.icon}"></i></div><span>${w.takes} rec</span></div>
        <span class="label">${esc(w.label)}</span>
        <div class="hr"></div>
        <span class="sound" title="What a regular assistant hears">${w.sound ? `“${esc(w.sound)}”` : "&nbsp;"}</span>
        <div class="meter" title="How often ${BRAND.name} recognises your own recordings of this word"><div class="track"><div class="fill" style="width:${w.conf ?? 0}%"></div></div><span>${w.conf == null ? "–" : w.conf + "%"}</span></div>
      </button>`).join("");
    return `<div class="page">
      <div class="page-head">
        <h1 class="h1">My language<span class="star">*</span></h1>
        <span class="sub">${S.words.length} word${S.words.length === 1 ? "" : "s"} · ${n} recordings</span>
      </div>
      <div class="grid2">${cards}
        <button class="add-card" data-act="teachNew"><i class="ph-bold ph-plus"></i>Teach a word</button>
      </div>
      ${S.words.length ? `<p class="note">The quote is what a regular assistant hears in your recording. The bar is how often ${BRAND.name} recognises your own recordings of the word when it is left out and tested.</p>` : ""}
    </div>`;
  },

  detail() {
    const w = word(S.detailId);
    if (!w) return SCREENS.words();
    const latest = w.take_list[0];
    const takes = w.take_list.slice(0, 6).map((t, i) => `
      <div class="take-row">
        <button class="take" data-act="playTake" data-arg="${t.id}" aria-label="Play recording ${w.takes - i}">
          <span class="n">Take ${w.takes - i}</span>
          <div class="mini" aria-hidden="true">${t.peaks.map((p) => `<div style="height:${Math.round(4 + p * 26)}px"></div>`).join("")}</div>
          <em>${t.source === "confirmed" ? "learned · " : ""}${when(t.when)}</em>
        </button>
        <button class="take-x" data-act="archiveTake" data-arg="${t.id}" aria-label="Remove recording ${w.takes - i}"><i class="ph-bold ph-x"></i></button>
      </div>`).join("");
    const says = S.editing
      ? `<div class="says"><span class="kicker">${BRAND.name} says</span>
           <textarea id="phrase-edit" rows="3" maxlength="200" aria-label="Sentence to say">${esc(w.phrase)}</textarea>
           <button class="edit save" data-act="savePhrase" aria-label="Save"><i class="ph-bold ph-check"></i></button></div>`
      : `<div class="says"><span class="kicker">${BRAND.name} says</span>
           <span class="display">${esc(w.phrase)}</span>
           <button class="edit" data-act="editPhrase" aria-label="Edit the sentence"><i class="ph-bold ph-pencil-simple"></i></button></div>`;
    return hero({ pale: w.pale, main: w.main, face: "icon", icon: w.icon, left: { icon: "arrow-left", label: "Back", act: "tabWords" },
        right: S.editing ? null : { icon: "pencil-simple", label: "Edit", act: "editPhrase" } }) +
      `<div class="below detail" style="--main:${w.main}">
        <div class="head">
          <h1 class="h1" style="font-size:48px;line-height:1">${esc(w.label)}</h1>
          ${latest ? `<button class="play" data-act="playTake" data-arg="${latest.id}" aria-label="Play your sound">
            <span class="dot"><i class="ph-fill ph-play"></i></span>
            <span class="italic">${w.sound ? `“${esc(w.sound)}”` : "Your sound"}</span></button>` : ""}
        </div>
        ${says}
        <div class="stats">
          <div><b>${w.conf == null ? "–" : w.conf + "%"}</b><span>Recognised in self-test</span></div>
          <div><b>${w.takes}</b><span>Recordings</span></div>
        </div>
        <div class="takes">${takes}</div>
        <div class="stack" style="margin-top:0;flex:none">
        <button class="btn xl cream" data-act="sayDetail"><i class="ph-fill ph-speaker-high"></i>Say it aloud</button>
        <button class="btn outline" data-act="recordMore"><i class="ph-bold ph-microphone"></i>Record ${S.cfg.takes} more</button>
        <button class="btn link" data-act="archiveWord">Forget this word</button>
        </div>
      </div>`;
  },

  teach1() {
    const t = S.teach;
    const picked = t.sel != null && !t.custom;
    const grid = MEANINGS.map(loc).map((m, i) => `
      <button class="meaning" role="radio" aria-checked="${t.sel === i && !t.custom}" style="--main:${m.main};--pale:${m.pale}" data-act="pickMeaning" data-arg="${i}">
        <span class="ic"><i class="ph-fill ph-${m.icon}"></i></span>${esc(m.label)}</button>`).join("");
    // Blub asks the question and smiles once something is picked (same character as every other screen).
    return `<div class="page teach">
      <div class="teach-head">
        <span class="mini">${mascot({ key: "teach-mini", mood: picked || t.custom ? "happy" : "idle", R: 205, lobes: 7, amp: 0.09, faceY: 232, faceScale: 2.3, wobble: 0.7 })}</span>
        <h1 class="h1">What should this sound mean?</h1>
      </div>
      <div role="radiogroup" aria-label="Meaning" class="meanings">${grid}</div>
      <label class="field"><i class="ph-bold ph-pencil-simple"></i>
        <input id="custom" value="${esc(t.custom)}" placeholder="Or type your own" aria-label="Your own word" maxlength="40"></label>
      <div id="teach-continue">${teachContinueHTML()}</div>
    </div>`;
  },

  teach2() {
    const m = teachMeta(), t = S.teach, N = S.cfg.takes;
    const dots = Array.from({ length: N }, (_, i) => `<div class="${i < t.count ? "done" : ""}">${i < t.count ? '<i class="ph-bold ph-check"></i>' : ""}</div>`).join("");
    return hero({ pale: m.pale, main: m.main, face: t.recording ? "listen" : t.busy ? "think" : "idle", tap: "record", tapLabel: "Record",
        left: { icon: "arrow-left", label: "Back", act: "teachBack" }, tag: t.recording ? "Recording" : null }) +
      `<div class="below center" style="gap:12px;padding-top:22px;padding-bottom:30px;--main:${m.main}">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="dots" aria-hidden="true">${dots}</div>
          <span style="font-size:16px;font-weight:600">${t.count >= N ? `All ${N} done` : `Recording ${t.count + 1} of ${N}`}</span>
        </div>
        <h1 class="h1 c">Say “${esc(m.label)}”<br>your way</h1>
        ${waveHTML(0.62, 64)}
        <button class="rec ${t.recording ? "on" : ""}" data-act="record" aria-label="${t.recording ? "Stop recording" : "Start recording"}" style="--ring:${t.recording ? "var(--danger)" : "rgba(243,235,221,.3)"}">
          <i class="ph-fill ph-${t.recording ? "stop" : "microphone"}"></i></button>
        <span class="sub c" style="font-size:16px">${t.recording ? "Listening… it stops by itself." : t.busy ? "Saving…" : "Tap once. No need to hold."}</span>
      </div>`;
  },

  teach3() {
    const m = teachMeta();
    const enough = readyWords().length >= S.cfg.min_words;
    return hero({ pale: m.pale, main: m.main, face: "happy", badge: m.icon }) +
      `<div class="below center">
        <h1 class="h1 c" style="font-size:42px">“${esc(m.label)}” is now<br>part of your language</h1>
        <p class="sub c" style="max-width:300px">${S.cfg.takes} recordings saved. ${BRAND.name} gets better every time you confirm a guess.</p>
        <div class="stack">
          ${enough ? `<button class="btn xl primary" data-act="startListen"><i class="ph-fill ph-microphone"></i>Try it now</button>` : ""}
          <button class="btn ${enough ? "outline" : "xl primary"}" data-act="teachNew"><i class="ph-bold ph-plus"></i>Teach another word</button>
          <button class="btn link" data-act="tabWords">See my language</button>
        </div>
      </div>`;
  },

  today() {
    const today = S.log.filter((l) => when(l.when) === "Today");
    const byVoice = today.filter((l) => l.source === "voice").length;
    const items = S.log.slice(0, 40).map((l, i) => `
      <button class="log-item" style="--main:${l.main}" data-act="sayLog" data-arg="${i}" aria-label="Say again: ${esc(l.phrase)}">
        <span class="ic"><i class="ph-bold ph-${l.icon}"></i></span>
        <span class="tx"><b>${esc(l.phrase)}</b><span>${l.source === "voice" ? "by voice" : l.source === "quick" ? "quick reply" : "by tap"} · ${when(l.when)}</span></span>
        <time>${clock(l.when)}</time>
      </button>`).join("");
    return `<div class="page">
      <div class="page-head">
        <h1 class="h1">Today<span class="star">*</span></h1>
        <span class="sub">Everything ${esc(P.name || "you")} said with ${BRAND.name}. Useful for family and carers.</span>
      </div>
      <div class="daystats">
        <div><b>${today.length}</b><span>things said today</span></div>
        <div><b>${byVoice}</b><span>of them by voice</span></div>
        <div><b>${S.words.length}</b><span>words in the language</span></div>
      </div>
      ${items ? `<div class="log">${items}</div>` : `<div class="empty"><i class="ph-bold ph-chat-circle-dots"></i>Nothing said yet. Sentences appear here with the time, and one tap says them again.</div>`}
    </div>`;
  },

  proof() {
    const R = S.proof;
    if (!R) return `<div class="page" style="align-items:center;justify-content:center">${loader}</div>`;
    const h = R.headline, k = R.ref_shot;
    const ex = (S.examples || []).slice(0, 8).map((e, i) => `
      <div class="excard">
        <div class="row"><button class="pl" data-act="playExample" data-arg="${i}" aria-label="Play the recording"><i class="ph-fill ph-${S.playing === "ex" + i ? "pause" : "play"}"></i></button>
          <div><b>${esc(e.speaker)}</b> said “${esc(e.word)}”<br><span class="note">dysarthria: ${esc(e.severity)} · ${e.vocab.length} possible words</span></div></div>
        <div class="vs">
          <div><small>Regular assistant <span class="bad">✗</span></small><b class="italic">“${esc(e.whisper_heard)}”</b></div>
          <div><small>${BRAND.name} <span class="ok">✓</span></small><b>${esc(e.our_pred)}</b></div>
        </div>
      </div>`).join("");
    return `<div class="page proof">
      <div class="page-head">
        <h1 class="h1">Proof<span class="star">*</span></h1>
        <span class="sub">Measured on real recordings of ${h.n_speakers} people with dysarthria (TORGO). Same words and recordings for every method.</span>
      </div>
      <div class="bignums">
        <div class="bignum"><b>${pct(h.whisper)}</b><span>A regular assistant (Whisper) understands the word</span></div>
        <div class="bignum hi"><b>${pct(h.combined)}</b><span>${BRAND.name}: ${k} of your recordings per word + other people's</span></div>
        <div class="bignum"><b>${pct(h.personal)}</b><span>Only your ${k} recordings per word. Works for any sound you invent</span></div>
        <div class="bignum"><b>${pct(h.rej_wrong)}</b><span>Wrong actions when ${BRAND.name} may say “not sure”</span></div>
      </div>
      <div class="chart"><h3>Each person, before and after</h3>
        ${legend([["whisper", "Regular assistant"], ["combined", BRAND.name]])}
        ${chartSpeakers(R)}</div>
      <div class="chart"><h3>How many recordings it needs</h3>
        ${legend([["whisper", "Regular assistant"], ["general", "Others only"], ["personal", "Own only"], ["combined", "Own + others"]])}
        ${chartShots(R)}
        <p class="note">Fewer people recorded each word 3 or more times, so the groups differ.</p></div>
      <div class="chart"><h3>It asks instead of guessing</h3>
        ${legend([["ok", "Right"], ["ask", "Asks again"], ["bad", "Wrong action"]])}
        ${chartNotSure(R)}</div>
      <p class="note">Each test picks ${R.vocab_size} words the person recorded several times; random guessing would be ${pct(h.chance)}. Whisper counts as right if the word or a homophone appears anywhere in its transcript. The method was chosen on speakers without dysarthria only. With shuffled labels the same code scores ${pct(h.shuffled)}.</p>
      ${ex ? `<div class="chart" style="padding-bottom:0"><h3>Hear it yourself</h3></div>${ex}` : ""}
      <p class="note">Data: TORGO database of dysarthric speech (Rudzicz, Namasivam &amp; Wolff, 2012), ${R.data.clips} single-word recordings of ${R.data.words} words. Limits: 8 people, English, single words, lab recordings. Full analysis: notebooks/slysim_te.ipynb.</p>
    </div>`;
  },
};

function quickHTML() {
  return `<button class="btn outline" data-act="quick" data-arg="yes"><i class="ph-bold ph-check"></i>Yes</button>
    <button class="btn outline" data-act="quick" data-arg="no"><i class="ph-bold ph-x"></i>No</button>
    <button class="btn danger" data-act="quick" data-arg="help"><i class="ph-bold ph-hand-palm"></i>Help</button>`;
}
function teachMeta() {
  const t = S.teach;
  if (t.addTo) { const w = word(t.addTo); if (w) return w; }
  if (t.custom.trim()) return { label: t.custom.trim(), phrase: t.custom.trim() + ".", icon: "chat-circle-dots", main: "#8FD9B0", pale: "#D5F2E2" };
  if (t.sel != null) return loc(MEANINGS[t.sel]);
  return null;
}
function teachContinueHTML() {
  const m = teachMeta();
  return m ? `<button class="btn xl primary" data-act="teachContinue">Record “${esc(m.label)}”<i class="ph-bold ph-arrow-right"></i></button>`
    : `<div class="disabled-bar">Pick a meaning to continue</div>`;
}
// The guide: five short steps, shown on first start and any time from the profile.
function guideSteps() {
  return [
    { mood: "happy", main: "#FFC93C", pale: "#FBEBB0", h: G("Hi, I'm Blub.", "Ahoj, já jsem Blub."),
      p: G(`${BRAND.name} helps you be understood when speaking is hard. It learns your way of saying things.`, `${BRAND.name} ti pomůže, aby ti ostatní rozuměli, i když je mluvení těžké. Naučí se, jak věci říkáš ty.`) },
    { mood: "listen", main: "#F8A4D2", pale: "#FFE0F1", h: G("First, teach me a sound.", "Nejdřív mě nauč zvuk."),
      p: G("Pick what it means, like Water or Pain, and say it three times. It doesn't have to be a clear word. Any sound you can repeat works.", "Vyber, co znamená, třeba Voda nebo Bolest, a řekni ho třikrát. Nemusí to být zřetelné slovo. Stačí zvuk, který umíš zopakovat.") },
    { mood: "speak", main: "#8FD3FF", pale: "#D9F0FF", h: G("Then just say it.", "Pak ho prostě řekni."),
      p: G("I show my guess. You confirm with one tap, and I say the whole sentence out loud for you.", "Ukážu ti svůj odhad. Jedním klepnutím ho potvrdíš a já za tebe nahlas řeknu celou větu.") },
    { mood: "unsure", main: "#B5AC9E", pale: "#E9E2D6", h: G("If I'm not sure, I ask.", "Když si nejsem jistý, zeptám se."),
      p: G("I never guess when it's close. Saying the wrong thing is worse than asking you again.", "Nikdy nehádám, když je to těsné. Říct něco špatně je horší, než se zeptat znovu.") },
    { mood: "idle", main: "#8FD9B0", pale: "#D5F2E2", h: G("Yours, and only here.", "Tvoje a jen tady."),
      p: G("Your recordings stay on this device. Yes, No and Help are always one tap away.", "Tvoje nahrávky zůstávají v tomto zařízení. Ano, Ne a Pomoc máš vždy na jedno klepnutí."), last: true },
  ];
}
SCREENS.guide = function () {
  const steps = guideSteps(), i = Math.min(S.guide, steps.length - 1), s = steps[i];
  const dots = steps.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("");
  const langs = LANGS.map(([k, name]) => `<button aria-pressed="${P.lang === k}" data-act="setPref" data-arg="lang:${k}">${name}</button>`).join("");
  return hero({ pale: s.pale, main: s.main, face: s.mood, left: i ? { icon: "arrow-left", label: G("Back", "Zpět"), act: "guideBack" } : null,
      right: s.last ? null : { icon: "x", label: G("Skip", "Přeskočit"), act: "guideDone" } }) +
    `<div class="below center guide">
      <div class="guide-dots" aria-label="${G("Step", "Krok")} ${i + 1} / ${steps.length}">${dots}</div>
      <h1 class="h1 c">${s.h}</h1>
      <p class="sub c">${s.p}</p>
      ${i === 0 ? `<div class="seg" role="group" aria-label="Language" style="width:100%">${langs}</div>` : ""}
      ${s.last ? `<label class="field" style="width:100%"><i class="ph-bold ph-user"></i><input id="set-name" maxlength="20" value="${esc(P.name)}" placeholder="${G("Your name (optional)", "Tvoje jméno (nepovinné)")}" aria-label="${G("Your name", "Tvoje jméno")}"></label>` : ""}
      <div class="stack">
        <button class="btn xl primary" data-act="${s.last ? "guideDone" : "guideNext"}">${s.last ? G("Start", "Začít") : G("Next", "Dál")}<i class="ph-bold ph-arrow-right"></i></button>
      </div>
    </div>`;
};

// Profile and settings: one page.
SCREENS.profile = function () {
  const takes = S.words.reduce((a, w) => a + w.takes, 0), voice = S.log.filter((l) => l.source === "voice").length;
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, label]) =>
    `<button aria-pressed="${String(P[key]) === String(v)}" data-act="setPref" data-arg="${key}:${v}">${label}</button>`).join("")}</div>`;
  const sw = (key, title, hint) => `<button class="row-toggle" role="switch" aria-checked="${!!P[key]}" data-act="setPref" data-arg="${key}:${!P[key]}">
      <span><b>${title}</b><small>${hint}</small></span><span class="sw"><i></i></span></button>`;
  const voices = voicesFor(P.lang);
  const hint = { careful: G("Asks again more often. Fewest wrong actions.", "Ptá se častěji. Nejméně špatných akcí."),
    balanced: G("The threshold measured in our tests: about 5% wrong actions at most.", "Práh změřený v našich testech: nejvýš asi 5 % špatných akcí."),
    quick: G("Acts on smaller leads. Fewer repeats, more mistakes.", "Jedná i při menším náskoku. Méně opakování, víc chyb.") }[P.caution];
  return `<div class="page profile" style="bottom:0;padding-bottom:40px">
    <div class="prof-top">
      <button class="circle-btn light" data-act="goHome" aria-label="${G("Back", "Zpět")}"><i class="ph-bold ph-arrow-left"></i></button>
      <span class="wm">${BRAND.wordmark}</span><span style="width:52px"></span>
    </div>
    <div class="prof-id">
      ${logoMark(92, "prof")}
      <div><h1 class="h1" style="font-size:38px">${esc(P.name) || G("Your profile", "Tvůj profil")}</h1>
        <span class="sub" style="font-size:16px">${G(`${S.words.length} words · ${takes} recordings`, `${S.words.length} slov · ${takes} nahrávek`)}</span></div>
    </div>
    <div class="daystats">
      <div><b>${S.words.length}</b><span>${G("words in your language", "slov v tvém jazyce")}</span></div>
      <div><b>${S.log.length}</b><span>${G("sentences said", "řečených vět")}</span></div>
      <div><b>${voice}</b><span>${G("of them by voice", "z toho hlasem")}</span></div>
    </div>

    <div class="group"><h3>${G("You", "Ty")}</h3>
      <div class="set"><label for="set-name">${G("Name", "Jméno")}</label><input id="set-name" type="text" maxlength="20" value="${esc(P.name)}" placeholder="${G("Your name", "Tvoje jméno")}"></div>
      <div class="set"><span class="lbl">${G("Language of the app and the voice", "Jazyk aplikace a hlasu")}</span>
        ${seg("lang", LANGS)}
        <span class="hint">${G("Recognition has no language: it matches your sounds, not words.", "Rozpoznávání žádný jazyk nemá: porovnává tvoje zvuky, ne slova.")}</span></div>
    </div>

    <div class="group"><h3>${G("Voice", "Hlas")}</h3>
      <div class="set"><label for="set-voice">${G("Who speaks for you", "Kdo za tebe mluví")}</label>
        <select id="set-voice"><option value="">${G("Device default", "Výchozí hlas zařízení")}</option>${voices.map((v) => `<option ${v.name === P.voice ? "selected" : ""} value="${esc(v.name)}">${esc(v.name.replace(/Microsoft |Google /, ""))}</option>`).join("")}</select>
        ${voices.length ? "" : `<span class="hint">${G("This device has no voice for this language installed, so the default one is used.", "V tomto zařízení není hlas pro tento jazyk, použije se výchozí.")}</span>`}</div>
      <div class="set"><label for="set-rate">${G("Speaking speed", "Rychlost řeči")}</label><input id="set-rate" type="range" min="0.6" max="1.3" step="0.02" value="${P.rate}"></div>
      <button class="btn outline" data-act="testVoice"><i class="ph-bold ph-speaker-high"></i>${G("Test the voice", "Vyzkoušet hlas")}</button>
    </div>

    <div class="group"><h3>${G("Listening", "Poslech")}</h3>
      <div class="set"><span class="lbl">${G(`How careful should ${BRAND.name} be?`, `Jak opatrný má ${BRAND.name} být?`)}</span>
        ${seg("caution", [["careful", G("Careful", "Opatrný")], ["balanced", G("Balanced", "Vyvážený")], ["quick", G("Quick", "Rychlý")]])}
        <span class="hint">${hint}</span></div>
      ${sw("autoStop", G("Stop by itself", "Zastavit samo"), G("Recording ends when you stop speaking.", "Nahrávání skončí, když domluvíš."))}
      ${sw("confirm", G("Ask before speaking", "Zeptat se před vyslovením"), G("Nothing is said until you tap Yes.", "Nic se neřekne, dokud neklepneš na Ano."))}
      ${sw("learn", G("Learn from confirmed guesses", "Učit se z potvrzených odhadů"), G("Each confirmed recording becomes another example.", "Každá potvrzená nahrávka je další ukázka."))}
    </div>

    <div class="group"><h3>${G("Comfort", "Pohodlí")}</h3>
      ${sw("motion", G("Blub moves", "Blub se hýbe"), G("Turn off for a calm, still screen.", "Vypni pro klidnou obrazovku bez pohybu."))}
    </div>

    <div class="group"><h3>${G("Help", "Nápověda")}</h3>
      <button class="btn outline" data-act="openGuide"><i class="ph-bold ph-compass"></i>${G(`How ${BRAND.name} works`, `Jak ${BRAND.name} funguje`)}</button>
      <button class="btn outline" data-act="tab" data-arg="proof"><i class="ph-bold ph-chart-bar"></i>${G("Does it really work? See the proof", "Opravdu to funguje? Důkazy")}</button>
      <button class="btn link" data-act="forgetAll">${G("Forget all my words", "Zapomenout všechna moje slova")}</button>
      <p class="note c">${G("One switch is enough: the Space key starts and stops listening.", "Stačí jeden spínač: mezerník spouští a zastavuje poslech.")}</p>
    </div>
  </div>`;
};

// ---------------- render ----------------
const TABS = [
  { k: "home", label: "Speak", icon: "waveform" },
  { k: "words", label: "Words", icon: "squares-four" },
  { k: "teach1", label: "Teach", icon: "plus-circle" },
  { k: "today", label: "Today", icon: "clock-counter-clockwise" },
  { k: "proof", label: "Proof", icon: "chart-bar" },
];
const NAV_SCREENS = ["home", "words", "teach1", "today", "proof"];
const LIGHT_TOP = ["home", "listen", "result", "teach2", "teach3", "detail", "speak", "sim", "guide"];   // screens with a pale top
function render() {
  const sc = S.screen;
  // Keyboard: if focus was inside the app, move it to the new screen's heading after redraw.
  const hadFocus = $("#phone").contains(document.activeElement) && document.activeElement !== document.body;
  const sameScreen = render.last === sc; render.last = sc;
  const scroll = sameScreen ? $("#view .page, #view .detail")?.scrollTop : 0;
  $("#view").innerHTML = SCREENS[sc]();
  if (sameScreen) { $("#view").firstElementChild.style.animation = "none"; const p = $("#view .page, #view .detail"); if (p && scroll) p.scrollTop = scroll; }
  const navOn = NAV_SCREENS.includes(sc);
  $("#nav").style.display = navOn ? "" : "none";
  $("#nav").innerHTML = TABS.map((t) => `<button data-act="tab" data-arg="${t.k}" ${sc === t.k ? 'aria-current="page"' : ""}>
    <span class="ic"><i class="ph-${sc === t.k ? "fill" : "bold"} ph-${t.icon}"></i></span>${t.label}</button>`).join("");
  $("#phone").style.setProperty("--status", LIGHT_TOP.includes(sc) ? "#141414" : "#F3EBDD");
  $("#nav").querySelectorAll("button").forEach((b) => { b.lastChild.nodeValue = tr(b.lastChild.nodeValue); });
  localize($("#view"));
  if (hadFocus && !sameScreen) {
    const h = $("#view h1");
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }
  const custom = $("#custom");
  if (custom) custom.addEventListener("input", (e) => { S.teach.custom = e.target.value; $("#teach-continue").innerHTML = teachContinueHTML(); });
  const bind = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
  bind("#set-name", "change", (e) => { P.name = e.target.value.trim(); savePrefs(); if (S.screen === "profile") render(); });
  bind("#set-name", "input", (e) => { P.name = e.target.value.trim(); savePrefs(); });
  bind("#set-voice", "change", (e) => { P.voice = e.target.value; savePrefs(); });
  bind("#set-rate", "change", (e) => { P.rate = +e.target.value; savePrefs(); });
}
function go(screen, extra = {}) {
  if (rec) stopRecording(true);
  Object.assign(S, { screen, flipped: false, editing: false }, extra);
  render();
}
async function loadWords() { S.words = await api("/api/words"); }
async function loadLog() { S.log = await api("/api/log").catch(() => []); }
function logSaid(x, source) {
  api("/api/log", { method: "POST", body: form({ label: x.label, phrase: x.phrase, icon: x.icon, main: x.main, source }) }).then(loadLog).catch(() => {});
}

// ---------------- actions ----------------
const ACT = {
  noop() {},
  async tab(k) {
    k = k || "words";
    if (k === "teach1") return ACT.teachNew();
    if (k === "words") await loadWords().catch(() => {});
    if (k === "today") await loadLog();
    if (k === "proof" && !S.proof) {
      api("/api/results").then((r) => { S.proof = r; if (S.screen === "proof") render(); });
      api("/api/examples").then((e) => { S.examples = e; if (S.screen === "proof") render(); });
    }
    go(k);
  },
  tabWords() { return ACT.tab("words"); },
  goHome() { try { speechSynthesis.cancel(); } catch (e) { /* no voice */ } go("home"); },
  async openSettings() { await loadLog(); go("profile"); },
  closeSettings() { go("home"); },
  setPref(arg) {
    const [k, v] = arg.split(":");
    P[k] = v === "true" ? true : v === "false" ? false : v;
    if (k === "lang") P.voice = "";              // voices belong to a language
    savePrefs(); applyPrefs(); render();
  },
  testVoice() { say(G(`Hello${P.name ? ", I am " + P.name : ""}. This is how I will sound.`, `Ahoj${P.name ? ", jsem " + P.name : ""}. Takhle budu znít.`)); },
  openGuide() { go("guide", { guide: 0 }); },
  guideNext() { S.guide += 1; render(); },
  guideBack() { S.guide = Math.max(0, S.guide - 1); render(); },
  guideDone() { P.onboarded = true; savePrefs(); go("home"); },
  async forgetAll() {
    if (!confirm(G("Forget all taught words? The recordings stay in a backup folder on this computer.", "Zapomenout všechna naučená slova? Nahrávky zůstanou v záložní složce v tomto počítači."))) return;
    try { await api("/api/reset", { method: "POST" }); await loadWords(); await loadLog(); go("home"); toast(G("All words forgotten", "Všechna slova zapomenuta"), "check"); }
    catch (e) { toast(e.message, "warning"); }
  },

  async startListen() {
    await loadWords().catch(() => {});
    if (readyWords().length < S.cfg.min_words) {
      toast(`Teach at least ${S.cfg.min_words} words first`, "plus-circle");
      return ACT.teachNew();
    }
    go("listen");
    if (!(await startRecording(LISTEN_SECONDS, recognize))) go("home");
  },
  finishListen() { stopRecording(); },
  cancelListen() { stopRecording(true); go("home"); },
  pick(i) { S.sel = +i; render(); },
  async confirm() {
    const g = S.result.guesses[S.sel ?? 0];
    const learned = P.learn ? ` · ${BRAND.name} learned from this` : "";
    try {
      const w = await api("/api/confirm", { method: "POST", body: form({ rec_id: S.result.rec_id, word_id: g.id, learn: P.learn ? "1" : "0" }) });
      S.words = S.words.map((x) => (x.id === w.id ? w : x));
      loadLog();
      speakWord(w, "Recognised from your voice" + learned);
    } catch (e) { const w = word(g.id); if (w) speakWord(w, "Recognised from your voice"); }
  },
  quick(k) {
    const q = loc(QUICK[k]);
    S.speak = { ...q, source: "Quick reply" }; go("speak");
    if (q.alarm) { alarm(); setTimeout(() => say(q.phrase), 900); } else say(q.phrase);
    logSaid(q, "quick");
  },
  tapSay(id) { const w = word(id); if (w) { speakWord(w, "Tapped on the board"); logSaid(w, "tap"); } },
  sayLog(i) { const l = S.log[+i]; if (l) { S.speak = { ...l, source: "Said again from Today" }; go("speak"); say(l.phrase); } },
  sayAgain() { if (S.speak) say(S.speak.phrase); },
  flip() { S.flipped = !S.flipped; render(); },

  openWord(id) { S.detailId = id; go("detail"); },
  playTake(id) { playAudio(`/api/takes/${id}/audio`, id); },
  playExample(i) { const e = S.examples[+i]; if (e) playAudio(e.audio_url, "ex" + i); },
  async archiveTake(id) {
    const w = word(S.detailId);
    if (!w || !confirm("Remove this recording? Use it for bad or wrong recordings.")) return;
    try {
      const nw = await api(`/api/takes/${id}/archive`, { method: "POST" });
      S.words = S.words.map((x) => (x.id === nw.id ? nw : x));
      render(); toast("Recording removed", "check");
    } catch (e) { toast(e.message, "warning"); }
  },
  async archiveWord() {
    const w = word(S.detailId);
    if (!w || !confirm(`Forget “${w.label}”? Its recordings are kept in an archive folder on this computer.`)) return;
    try {
      await api(`/api/words/${w.id}/archive`, { method: "POST" });
      await loadWords(); go("words"); toast(`“${w.label}” forgotten`, "check");
    } catch (e) { toast(e.message, "warning"); }
  },
  editPhrase() { S.editing = true; render(); const t = $("#phrase-edit"); if (t) { t.focus(); t.select(); } },
  async savePhrase() {
    const t = $("#phrase-edit"), w = word(S.detailId);
    if (!t || !w) return;
    try {
      const nw = await api(`/api/words/${w.id}/edit`, { method: "POST", body: form({ phrase: t.value }) });
      S.words = S.words.map((x) => (x.id === nw.id ? nw : x));
    } catch (e) { toast(e.message, "warning"); }
    S.editing = false; render();
  },
  sayDetail() { const w = word(S.detailId); if (w) { speakWord(w, "From My language"); logSaid(w, "tap"); } },
  recordMore() { S.teach = { sel: null, custom: "", wordId: S.detailId, addTo: S.detailId, count: 0, recording: false }; go("teach2"); },

  teachNew() { S.teach = { sel: null, custom: "", wordId: null, addTo: null, count: 0, recording: false }; go("teach1"); },
  pickMeaning(i) { S.teach.sel = +i; S.teach.custom = ""; render(); },
  async teachContinue() {
    const m = teachMeta(); if (!m) return;
    try {
      const w = await api("/api/words", { method: "POST", body: form({ label: m.label, phrase: m.phrase, icon: m.icon, main: m.main, pale: m.pale }) });
      S.words = S.words.some((x) => x.id === w.id) ? S.words.map((x) => (x.id === w.id ? w : x)) : [...S.words, w];
      Object.assign(S.teach, { wordId: w.id, addTo: w.id, count: 0 });
      go("teach2");
    } catch (e) { toast(e.message, "warning"); }
  },
  teachBack() { stopRecording(true); S.teach.recording = false; S.teach.addTo && S.teach.count === 0 && S.detailId === S.teach.addTo ? go("detail") : go("teach1"); },
  async record() {
    const t = S.teach;
    if (t.busy) return;
    if (t.recording) return stopRecording();
    t.recording = true; render();
    const ok = await startRecording(TAKE_SECONDS, async (blob) => {
      t.recording = false; t.busy = true; render(); Engine.idle();
      try {
        const w = await api(`/api/words/${t.wordId}/takes`, { method: "POST", body: form({ file: new File([blob], "take.wav", { type: "audio/wav" }) }) });
        S.words = S.words.map((x) => (x.id === w.id ? w : x));
        t.count += 1;
      } catch (e) { toast(e.message, "warning"); }
      t.busy = false;
      if (t.count >= S.cfg.takes) go("teach3"); else render();
    });
    if (!ok) { t.recording = false; render(); }
  },
};

let audioEl = null;
function playAudio(url, key) {
  if (audioEl) { audioEl.pause(); audioEl = null; }
  if (S.playing === key) { S.playing = null; return render(); }
  audioEl = new Audio(url);
  S.playing = key; render();
  audioEl.onended = audioEl.onerror = () => { S.playing = null; render(); };
  audioEl.play().catch(() => { S.playing = null; render(); });
}

async function recognize(blob) {
  S.result = null; S.sel = null; S.heard = null;
  go("result"); Engine.thinking();
  try {
    const r = await api("/api/recognize", { method: "POST", body: form({ file: new File([blob], "rec.wav", { type: "audio/wav" }), strict: CAUTION[P.caution] ?? 1 }) });
    S.result = r; S.sel = r.accepted ? 0 : null;
    render(); Engine.show(r);
    if (r.accepted && !P.confirm) ACT.confirm();     // setting: speak a clear guess without asking
    if (S.cfg.whisper) {
      api(`/api/recent/${r.rec_id}/whisper`).then((x) => {
        Engine.whisper(x);
        S.heard = x.whisper_text;
        if (S.screen === "result" && S.result === r) render();
        else if (S.screen === "speak") toast(G(`A regular assistant heard “${x.whisper_text}”`, `Běžný asistent slyšel „${x.whisper_text}“`), "ear");
      }).catch(() => {});
    }
  } catch (e) { toast(e.message, "warning"); Engine.idle(); go("home"); }
}
function speakWord(w, source) {
  S.speak = { label: w.label, phrase: w.phrase, icon: w.icon, main: w.main, source };
  go("speak");
  say(w.phrase);
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const f = ACT[b.dataset.act];
  if (f) f(b.dataset.arg);
});

// One key (Space) for people who use a single switch (switch access).
const SPACE_ACTION = { home: "startListen", listen: "finishListen", teach2: "record", teach3: "startListen", result: "startListen", sim: "simNext", guide: "guideNext" };
document.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && S.screen === "profile") return ACT.goHome();
  if (e.code !== "Space" || e.repeat || e.target.closest?.("input, textarea, select, button, audio")) return;
  let act = SPACE_ACTION[S.screen];
  if (S.screen === "guide" && S.guide >= guideSteps().length - 1) act = "guideDone";
  if (act && ACT[act]) { e.preventDefault(); ACT[act](); }
});

// Blub dozes off on the home screen when nothing happens, and wakes on any touch or key.
let sleepTimer = null;
function wake() {
  clearTimeout(sleepTimer);
  if (S.sleepy) { S.sleepy = false; if (S.screen === "home") render(); }
  sleepTimer = setTimeout(() => { if (S.screen === "home" && !rec) { S.sleepy = true; render(); } }, SLEEP_AFTER_MS);
}
["pointerdown", "keydown"].forEach((ev) => addEventListener(ev, wake, { passive: true }));

// The stage scales down to fit the window.
function fit() {
  // three panels side by side need about 1380 x 908 px; smaller windows scale the whole stage down
  const z = innerWidth <= 820 ? 1 : Math.max(0.5, Math.min(1, innerHeight / 908, innerWidth / 1380));
  document.documentElement.style.setProperty("--zoom", z.toFixed(3));
}
addEventListener("resize", fit); fit();

(async () => {
  $("#logo").innerHTML = `${logoMark(88)}<span class="wordmark">${BRAND.wordmark}</span>`;
  try {
    S.cfg = await api("/api/config");
    if (S.cfg.profile.kind !== "me") S.cfg.profile = await api("/api/profile", { method: "POST", body: form({ id: "me" }) });
    await loadWords(); loadLog();
    api("/api/results").then((R) => {
      S.proof = R; const h = R.headline;
      $("#facts").innerHTML = `<div class="fact"><b>${pct(h.whisper)}</b><span>of words from people with dysarthria a regular assistant understands</span></div>
        <div class="fact hi"><b>${pct(h.combined)}</b><span>with ${BRAND.name}, from ${R.ref_shot} of their own recordings per word</span></div>`;
    });
    api("/api/examples").then((e) => { S.examples = e; });
  } catch (e) {
    S.cfg = { takes: 3, min_words: 2, whisper: false, profile: { kind: "me" } };
    toast("Server is not running: start app/server.py", "warning");
  }
  Engine.init(S.cfg);
  if (!P.onboarded) S.screen = "guide";
  render(); wake();
  if (typeof Lab !== "undefined") Lab.init();
  try { speechSynthesis.onvoiceschanged = () => { if (S.screen === "profile") render(); }; } catch (e) { /* no voice */ }
})();
