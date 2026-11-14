// Utter: frontend (čisté JS). Design: design/Utter App.dc.html
// ---------------- Nastavení ----------------
const USER_NAME = "Marek";      // jméno na úvodní obrazovce
const LISTEN_SECONDS = 3.5;     // jak dlouho se poslouchá, než se nahrávání samo zastaví
const TAKE_SECONDS = 2.5;       // délka jedné ukázky při učení
const SPEECH_RATE = 0.92;       // rychlost hlasu (Web Speech API)
const BARS = 41;                // počet sloupců ve vlnce
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
  help: { label: "Help", phrase: "I need help, please come here.", icon: "hand-palm", main: "#F4583E" },
};
const FACES = {
  idle: '<svg width="168" height="84" viewBox="0 0 160 80" aria-hidden="true"><ellipse cx="48" cy="30" rx="10" ry="13" fill="#141414"/><ellipse cx="112" cy="30" rx="10" ry="13" fill="#141414"/><circle cx="51" cy="25" r="3.5" fill="#F3EBDD"/><circle cx="115" cy="25" r="3.5" fill="#F3EBDD"/><path d="M60 54 Q80 70 100 54" stroke="#141414" stroke-width="6" fill="none" stroke-linecap="round"/></svg>',
  listen: '<svg width="168" height="84" viewBox="0 0 160 80" aria-hidden="true"><circle cx="48" cy="30" r="17" fill="#F3EBDD" stroke="#141414" stroke-width="4"/><circle cx="112" cy="30" r="17" fill="#F3EBDD" stroke="#141414" stroke-width="4"/><circle cx="50" cy="24" r="8" fill="#141414"/><circle cx="114" cy="24" r="8" fill="#141414"/><ellipse cx="80" cy="64" rx="8" ry="10" fill="#141414"/></svg>',
  happy: '<svg width="168" height="84" viewBox="0 0 160 80" aria-hidden="true"><path d="M32 34 Q48 16 64 34" stroke="#141414" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M96 34 Q112 16 128 34" stroke="#141414" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M48 46 L112 46 Q108 78 80 78 Q52 78 48 46 Z" fill="#141414"/><path d="M54 49 L106 49 L104 57 L56 57 Z" fill="#F3EBDD"/></svg>',
  unsure: '<svg width="168" height="84" viewBox="0 0 160 80" aria-hidden="true"><ellipse cx="48" cy="30" rx="10" ry="13" fill="#141414"/><ellipse cx="112" cy="30" rx="10" ry="13" fill="#141414"/><path d="M58 60 Q70 52 82 60 Q94 68 104 58" stroke="#141414" stroke-width="6" fill="none" stroke-linecap="round"/></svg>',
};

// ---------------- stav ----------------
const S = {
  screen: "home", cfg: null, words: [], loadingWords: false,
  result: null, sel: null, heard: null, speak: null, flipped: false, detailId: null,
  teach: { sel: null, custom: "", wordId: null, addTo: null, count: 0, recording: false },
  proof: null, examples: null, playing: null,
};
let rec = null, recTimer = null, recDone = null, raf = null;

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x) => (x == null ? "–" : `${Math.round(x * 100)}%`);
const word = (id) => S.words.find((w) => w.id === id);
const readyWords = () => S.words.filter((w) => w.takes > 0);

async function api(path, opts) {
  const r = await fetch(path, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.detail || r.statusText);
  return j;
}
function form(obj) { const f = new FormData(); for (const [k, v] of Object.entries(obj)) f.append(k, v); return f; }

function toast(text, icon = "info") {
  $("#toast-slot").innerHTML = `<div class="toast" role="status"><i class="ph-fill ph-${icon}"></i>${esc(text)}</div>`;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => ($("#toast-slot").innerHTML = ""), 2600);
}
function say(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = SPEECH_RATE; u.lang = "en-US";
    speechSynthesis.speak(u);
  } catch (e) { /* bez hlasu */ }
}
function when(ts) {
  const d = new Date(ts * 1000), now = new Date();
  const days = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / 864e5);
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : d.toLocaleDateString("en", { weekday: "short" });
}

// ---------------- nahrávání ----------------
function bars(amp) {
  return Array.from({ length: BARS }, (_, i) => {
    const d = Math.abs(i - 20) / 20, env = 1 - d * 0.7;
    let h = amp ? Math.max(6, (14 + Math.random() * 80 * amp) * env) : 8 + (1 - d) * 22 * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.3)));
    if (i === 20) h = amp ? Math.max(30, 100 * Math.min(1, amp * 1.4)) : 44;
    return Math.round(h);
  });
}
function waveHTML(scale = 1, h = 110) {
  return `<div class="wave" aria-hidden="true" style="height:${h}px">${bars(0).map((b, i) =>
    `<div class="${i === 20 ? "mid" : ""}" style="height:${Math.round(b * scale)}px"></div>`).join("")}</div>`;
}
function animate() {
  cancelAnimationFrame(raf);
  let last = 0;
  const tick = (t) => {
    if (!rec) return;
    if (t - last > 90) {
      last = t;
      const amp = Math.max(0.08, rec.level());
      const hs = bars(amp);
      document.querySelectorAll(".wave").forEach((w) => {
        const scale = +w.dataset.scale || 1;
        [...w.children].forEach((d, i) => (d.style.height = `${Math.round(hs[i] * scale)}px`));
      });
      const p = 1 + amp * 0.05;
      document.querySelectorAll(".hero, .rec").forEach((e) => e.style.setProperty("--pulse", p));
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
  animate();
  return true;
}
async function stopRecording(discard = false) {
  clearTimeout(recTimer);
  if (!rec) return;
  const r = rec, done = recDone; rec = null; recDone = null;
  cancelAnimationFrame(raf);
  const blob = await r.stop();
  if (!discard && done) done(blob);
}

// ---------------- šablony ----------------
function hero({ pale = "#FBEBB0", main = "#FFC93C", face = "idle", icon = null, badge = null, tap = null, tapLabel = "", left = null, right = null }) {
  const faceHTML = face === "icon" ? `<i class="ph-bold ph-${icon} big-icon"></i>` : FACES[face];
  const leftHTML = left ? `<button class="circle-btn" data-act="${left.act}" aria-label="${esc(left.label)}">${left.text ? `<span>${esc(left.text)}</span>` : `<i class="ph-bold ph-${left.icon}"></i>`}</button>` : "<span></span>";
  const rightHTML = right ? `<button class="pill-btn ink" data-act="${right.act}"><i class="ph-bold ph-${right.icon}"></i>${esc(right.label)}</button>` : "<span></span>";
  return `<div class="hero" style="--pale:${pale};--main:${main}">
    <div class="blob"></div>
    <button class="face" ${tap ? `data-act="${tap}"` : "tabindex=-1"} aria-label="${esc(tapLabel || "Utter")}">${faceHTML}</button>
    ${badge ? `<div class="badge"><i class="ph-bold ph-${badge}"></i></div>` : ""}
    <div class="bar">${leftHTML}${rightHTML}</div>
  </div>`;
}

const SCREENS = {
  home() {
    return hero({ face: "idle", tap: "startListen", tapLabel: "Start listening",
      left: { text: USER_NAME[0], label: "Profile", act: "noop" }, right: { icon: "book-open-text", label: "Words", act: "tab", } }) +
    `<div class="below with-nav" style="gap:18px">
      <h1 class="h1 c" style="font-size:40px">Hi ${esc(USER_NAME)}.<br>What do you need?</h1>
      <button class="btn xl yellow" data-act="startListen"><i class="ph-fill ph-microphone"></i>Start listening</button>
      <div class="quick">
        <button class="btn outline" data-act="quick" data-arg="yes"><i class="ph-bold ph-check"></i>Yes</button>
        <button class="btn outline" data-act="quick" data-arg="no"><i class="ph-bold ph-x"></i>No</button>
        <button class="btn help" data-act="quick" data-arg="help"><i class="ph-bold ph-hand-palm"></i>Help</button>
      </div>
    </div>`;
  },

  listen() {
    return hero({ pale: "#FFE0F1", main: "#F8A4D2", face: "listen", tap: "finishListen", tapLabel: "Stop listening",
      left: { icon: "x", label: "Cancel", act: "cancelListen" } }) +
    `<div class="below center" style="padding-top:30px;padding-bottom:40px">
      <h1 class="h1" style="font-size:46px">Listening…</h1>
      <p class="sub">Take your time. Say it your way.</p>
      <div style="margin-top:6px">${waveHTML(1, 110).replace('class="wave"', 'class="wave" data-scale="1"')}</div>
      <button class="btn xl outline" style="margin-top:auto" data-act="finishListen"><i class="ph-fill ph-stop-circle" style="color:var(--danger)"></i>I'm done</button>
    </div>`;
  },

  result() {
    const r = S.result;
    if (!r) {
      return hero({ pale: "#FFE0F1", main: "#F8A4D2", face: "listen" }) +
        `<div class="below center" style="justify-content:center"><div class="spinner"></div><p class="sub">Thinking…</p></div>`;
    }
    const g = S.sel != null ? r.guesses[S.sel] : null;
    const w = g ? word(g.id) : null;
    const heard = S.heard == null ? (S.cfg?.whisper ? "…" : null) : S.heard;
    const heardLine = heard == null ? "" : `A regular assistant heard <span class="italic" style="font-size:19px">“${esc(heard)}”</span>`;
    const chips = r.guesses.map((x, i) => `<button class="chip" role="radio" aria-checked="${i === S.sel}" data-act="pick" data-arg="${i}">
      <i class="ph-bold ph-${x.icon}"></i>${esc(x.label)} <span>${x.pct}%</span></button>`).join("");
    const top = r.accepted
      ? `<h1 class="h1" style="font-size:54px;text-align:center">${esc(r.guesses[S.sel ?? 0].label)}?</h1>
         <p class="sub" style="font-size:16px;text-align:center" id="heard">${heardLine}${heardLine ? " · " : ""}${r.guesses[0].pct}% match</p>`
      : `<h1 class="h1" style="font-size:46px;text-align:center">Not sure…</h1>
         <p class="sub" style="font-size:16px;text-align:center">Say it again, or pick what you meant.</p>
         <p class="sub" style="font-size:15px;text-align:center" id="heard">${heardLine}</p>`;
    const actions = r.accepted || g
      ? `<button class="btn xl cream" data-act="confirm"><i class="ph-fill ph-speaker-high"></i>Yes, say it</button>
         ${r.accepted ? "" : `<button class="btn l outline" data-act="startListen"><i class="ph-bold ph-arrow-counter-clockwise"></i>Say it again</button>`}`
      : `<button class="btn xl yellow" data-act="startListen"><i class="ph-fill ph-microphone"></i>Say it again</button>`;
    return hero({ pale: w ? w.pale : "#E9E2D6", main: w ? w.main : "#B5AC9E", face: r.accepted ? "happy" : "unsure",
        badge: w ? w.icon : "question", left: { icon: "arrow-left", label: "Back", act: "goHome" },
        right: { icon: "arrow-counter-clockwise", label: "Again", act: "startListen" } }) +
      `<div class="below center" style="padding:22px 0 34px;gap:12px">
        ${top}
        <div role="radiogroup" aria-label="Guesses" class="chips">${chips}</div>
        <div class="stack" style="padding:0 var(--gutter)">
          ${actions}
          <button class="btn link" data-act="teachNew"><i class="ph-bold ph-plus-circle"></i>None of these, teach it</button>
        </div>
      </div>`;
  },

  speak() {
    const s = S.speak;
    return `<div class="speak" style="--main:${s.main}">
      <div class="row">
        <button class="circle-btn" data-act="goHome" aria-label="Close"><i class="ph-bold ph-x"></i></button>
        <button class="pill-btn ink" data-act="flip"><i class="ph-bold ph-arrows-clockwise"></i>Flip</button>
      </div>
      <div class="body ${S.flipped ? "flipped" : ""}">
        <div class="who"><div><i class="ph-bold ph-${s.icon}"></i></div><span>${esc(USER_NAME)} says</span></div>
        <p class="phrase">${esc(s.phrase)}</p>
        <div class="line"></div>
        <span style="font-size:16px">${esc(s.source)}</span>
      </div>
      <div class="stack" style="margin-top:0">
        <button class="btn xl black" data-act="sayAgain"><i class="ph-fill ph-speaker-high"></i>Say it again</button>
        <button class="btn l outline-ink" data-act="goHome">Done</button>
      </div>
    </div>`;
  },

  words() {
    const n = S.words.reduce((a, w) => a + w.takes, 0);
    const cards = S.words.map((w) => `
      <button class="wcard" style="--main:${w.main}" data-act="openWord" data-arg="${w.id}" aria-label="${esc(w.label)}">
        <div class="top"><div class="ic"><i class="ph-bold ph-${w.icon}"></i></div><span>${w.takes} rec</span></div>
        <span class="label">${esc(w.label)}</span>
        <div class="hr"></div>
        <span class="sound" title="What a regular assistant hears">${w.sound ? `“${esc(w.sound)}”` : "&nbsp;"}</span>
        <div class="meter"><div class="track"><div class="fill" style="width:${w.conf ?? 0}%"></div></div><span>${w.conf == null ? "–" : w.conf + "%"}</span></div>
      </button>`).join("");
    return `<div class="page">
      <div style="padding:0 4px 20px;display:flex;flex-direction:column;gap:6px">
        <h1 class="h1" style="font-size:44px;line-height:1">My language<span style="font-family:var(--font-body);font-size:24px;color:var(--accent);vertical-align:top">*</span></h1>
        <span class="sub" style="font-size:16px">${S.words.length} words · ${n} recordings</span>
        ${S.words.length ? `<span class="note">Quote = what a regular assistant hears. Bar = how often Utter recognises your own recordings of the word.</span>` : ""}
      </div>
      <div class="grid2">${cards}
        <button class="add-card" data-act="teachNew"><i class="ph-bold ph-plus"></i>Teach a word</button>
      </div>
    </div>`;
  },

  detail() {
    const w = word(S.detailId);
    if (!w) return SCREENS.words();
    const latest = w.take_list[0];
    const takes = w.take_list.slice(0, 5).map((t, i) => `
      <div class="take-row">
        <button class="take" data-act="playTake" data-arg="${t.id}" aria-label="Play take ${w.takes - i}">
          <span>Take ${w.takes - i}</span>
          <div class="mini" aria-hidden="true">${t.peaks.map((p) => `<div style="height:${Math.round(5 + p * 26)}px"></div>`).join("")}</div>
          <em>${when(t.when)}</em>
        </button>
        <button class="take-x" data-act="archiveTake" data-arg="${t.id}" aria-label="Remove take ${w.takes - i}"><i class="ph-bold ph-x"></i></button>
      </div>`).join("");
    return hero({ pale: w.pale, main: w.main, face: "icon", icon: w.icon, left: { icon: "arrow-left", label: "Back", act: "tabWords" } }) +
      `<div class="below detail" style="--main:${w.main}">
        <div class="head">
          <h1 class="h1" style="font-size:44px">${esc(w.label)}</h1>
          ${latest ? `<button class="play" data-act="playTake" data-arg="${latest.id}" aria-label="Play your sound">
            <span class="dot"><i class="ph-fill ph-${S.playing ? "pause" : "play"}"></i></span>
            <span class="italic">${w.sound ? `“${esc(w.sound)}”` : "Your sound"}</span></button>` : ""}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <span class="kicker">Utter says</span>
          <span class="display" style="font-size:26px;line-height:1.15">${esc(w.phrase)}</span>
        </div>
        <div class="stats">
          <div><b>${w.conf == null ? "–" : w.conf + "%"}</b><span>Recognition</span></div>
          <div><b>${w.takes}</b><span>Recordings</span></div>
        </div>
        <div class="takes">${takes}</div>
        <div class="stack" style="margin-top:0">
          <button class="btn xl cream" data-act="sayDetail"><i class="ph-fill ph-speaker-high"></i>Say it aloud</button>
          <button class="btn l outline" data-act="recordMore"><i class="ph-bold ph-microphone"></i>Record ${S.cfg.takes} more</button>
        </div>
      </div>`;
  },

  teach1() {
    const t = S.teach;
    const grid = MEANINGS.map((m, i) => `
      <button class="meaning" role="radio" aria-checked="${t.sel === i && !t.custom}" style="--main:${m.main}" data-act="pickMeaning" data-arg="${i}">
        <i class="ph-${t.sel === i && !t.custom ? "fill" : "bold"} ph-${m.icon}"></i>${esc(m.label)}</button>`).join("");
    return `<div class="page" style="display:flex;flex-direction:column;gap:18px;padding-left:24px;padding-right:24px">
      <div style="display:flex;flex-direction:column;gap:8px">
        <span class="kicker accent">Step 1 of 2</span>
        <h1 class="h1" style="font-size:42px">What should this sound mean?</h1>
      </div>
      <div role="radiogroup" aria-label="Meaning" class="meanings">${grid}</div>
      <label class="field"><i class="ph-bold ph-pencil-simple"></i>
        <input id="custom" value="${esc(t.custom)}" placeholder="Or type your own word" aria-label="Your own word" maxlength="40"></label>
      <div id="teach-continue">${teachContinueHTML()}</div>
    </div>`;
  },

  teach2() {
    const m = teachMeta(), t = S.teach, N = S.cfg.takes;
    const dots = Array.from({ length: N }, (_, i) => `<div class="${i < t.count ? "done" : ""}">${i < t.count ? '<i class="ph-bold ph-check"></i>' : ""}</div>`).join("");
    return hero({ pale: m.pale, main: m.main, face: t.recording ? "listen" : "idle", tap: "record", tapLabel: "Record",
        left: { icon: "arrow-left", label: "Back", act: "teachBack" } }) +
      `<div class="below center" style="padding-top:22px;padding-bottom:30px;gap:12px;--main:${m.main}">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="dots" aria-hidden="true">${dots}</div>
          <span style="font-size:16px;font-weight:600">${t.count >= N ? `All ${N} done` : `Recording ${t.count + 1} of ${N}`}</span>
        </div>
        <h1 class="h1 c" style="font-size:38px">Say “${esc(m.label)}”<br>your way</h1>
        ${waveHTML(0.62, 64).replace('class="wave"', 'class="wave" data-scale="0.62"')}
        <button class="rec" data-act="record" aria-label="${t.recording ? "Stop recording" : "Start recording"}" style="--ring:${t.recording ? "var(--danger)" : "rgba(243,235,221,.3)"}">
          <i class="ph-fill ph-${t.recording ? "stop" : "microphone"}"></i></button>
        <span class="sub" style="font-size:16px;text-align:center">${t.recording ? "Listening… it stops by itself." : t.busy ? "Saving…" : "Tap once. No need to hold."}</span>
      </div>`;
  },

  teach3() {
    const m = teachMeta();
    return hero({ pale: m.pale, main: m.main, face: "happy", badge: m.icon, tap: "startListen", tapLabel: "Try it now" }) +
      `<div class="below center" style="padding-top:28px;padding-bottom:40px">
        <h1 class="h1 c" style="font-size:40px">“${esc(m.label)}” is now<br>part of your language</h1>
        <p class="sub" style="text-align:center;max-width:300px">${S.cfg.takes} recordings saved. Utter gets better every time you confirm a guess.</p>
        <div class="stack">
          <button class="btn xl yellow" data-act="startListen"><i class="ph-fill ph-microphone"></i>Try it now</button>
          <button class="btn l outline" data-act="teachNew"><i class="ph-bold ph-plus"></i>Teach another word</button>
          <button class="btn link" data-act="tabWords">See my language</button>
        </div>
      </div>`;
  },

  proof() {
    const R = S.proof;
    if (!R) return `<div class="page"><div class="spinner"></div></div>`;
    const h = R.headline, k = R.ref_shot;
    const ex = (S.examples || []).map((e) => `
      <div class="excard">
        <div><b>${esc(e.speaker)}</b> <span class="note">· dysarthria: ${esc(e.severity)}</span> · said <b>${esc(e.word.toUpperCase())}</b></div>
        <audio controls preload="none" src="${esc(e.audio_url)}"></audio>
        <div>Regular assistant heard: <span class="italic">“${esc(e.whisper_heard)}”</span> <span class="bad">✗</span></div>
        <div>Utter: <b>${esc(e.our_pred.toUpperCase())}</b> <span class="ok">✓</span></div>
        <div class="note">Chose from: ${e.vocab.map(esc).join(", ")}</div>
      </div>`).join("");
    return `<div class="page proof">
      <div style="display:flex;flex-direction:column;gap:6px;padding:0 4px">
        <h1 class="h1" style="font-size:44px;line-height:1">Proof<span style="font-family:var(--font-body);font-size:24px;color:var(--accent);vertical-align:top">*</span></h1>
        <span class="sub" style="font-size:16px">Tested on real recordings of ${h.n_speakers} people with dysarthria from the TORGO database. Same words, same recordings for every method.</span>
      </div>
      <div class="bignums">
        <div class="bignum"><b>${pct(h.whisper)}</b><span>Regular speech recognition (Whisper) understands the word</span></div>
        <div class="bignum hi"><b>${pct(h.combined)}</b><span>Utter: ${k} of your recordings per word + other people's recordings of the same word</span></div>
        <div class="bignum"><b>${pct(h.personal)}</b><span>Only your ${k} recordings per word (works for any sound you invent)</span></div>
        <div class="bignum"><b>${pct(h.general)}</b><span>Only other people's recordings, no personalisation</span></div>
        <div class="bignum" style="grid-column:1/-1"><b>${pct(h.rej_wrong)}</b><span>Wrong actions when Utter is allowed to say “not sure”. It asks to repeat ${pct(h.rej_repeat)} of the time instead of guessing.</span></div>
      </div>
      <p class="note">Average over ${h.n_speakers} people with dysarthria. Each test picks ${R.vocab_size} words the person recorded several times; random guessing would be ${pct(h.chance)}. Whisper counts as correct if the word (or a homophone) appears anywhere in its transcript. The method was chosen on speakers without dysarthria only.</p>
      <h2 class="h1" style="font-size:28px">Hear it yourself</h2>
      ${ex || '<p class="note">No examples in results.json.</p>'}
      <h2 class="h1" style="font-size:28px">Results</h2>
      <img class="plot" src="/api/plots/1_per_speaker.png" alt="Accuracy for each person with dysarthria">
      <img class="plot" src="/api/plots/2_recordings_needed.png" alt="Accuracy by number of recordings per word">
      <img class="plot" src="/api/plots/3_not_sure.png" alt="Correct, ask again, and wrong actions">
      <p class="note">Data: TORGO database of dysarthric speech (Rudzicz, Namasivam &amp; Wolff, 2012). Limits: 8 people, English, single words, lab recordings. Full analysis: notebooks/slysim_te.ipynb.</p>
    </div>`;
  },
};

function teachMeta() {
  const t = S.teach;
  if (t.addTo) { const w = word(t.addTo); if (w) return w; }
  if (t.custom.trim()) return { label: t.custom.trim(), phrase: t.custom.trim() + ".", icon: "chat-circle-dots", main: "#8FD9B0", pale: "#D5F2E2" };
  if (t.sel != null) return MEANINGS[t.sel];
  return null;
}
function teachContinueHTML() {
  const m = teachMeta();
  return m ? `<button class="btn xl yellow" data-act="teachContinue">Record “${esc(m.label)}”<i class="ph-bold ph-arrow-right"></i></button>`
    : `<div class="disabled-bar">Pick a meaning to continue</div>`;
}

// ---------------- vykreslení ----------------
const TABS = [
  { k: "home", label: "Speak", icon: "waveform" },
  { k: "words", label: "My words", icon: "squares-four" },
  { k: "teach1", label: "Teach", icon: "plus-circle" },
  { k: "proof", label: "Proof", icon: "chart-bar" },
];
function render() {
  const sc = S.screen;
  $("#view").innerHTML = SCREENS[sc]();
  const navOn = ["home", "words", "teach1", "proof"].includes(sc);
  $("#nav").style.display = navOn ? "" : "none";
  $("#nav").innerHTML = TABS.map((t) => `<button data-act="tab" data-arg="${t.k}" ${sc === t.k ? 'aria-current="page"' : ""}>
    <span class="ic"><i class="ph-${sc === t.k ? "fill" : "bold"} ph-${t.icon}"></i></span>${t.label}</button>`).join("");
  const dark = ["home", "listen", "result", "teach2", "teach3", "detail", "speak"].includes(sc);
  $("#phone").style.setProperty("--status", dark ? "#141414" : "#F3EBDD");
  const custom = $("#custom");
  if (custom) custom.addEventListener("input", (e) => { S.teach.custom = e.target.value; $("#teach-continue").innerHTML = teachContinueHTML(); });
}
function go(screen, extra = {}) {
  if (rec) stopRecording(true);
  Object.assign(S, { screen, flipped: false }, extra);
  render();
}
async function loadWords() { S.words = await api("/api/words"); }

// ---------------- akce ----------------
const ACT = {
  noop() {},
  async tab(k) {
    k = k || "words";
    if (k === "teach1") return ACT.teachNew();
    if (k === "words") { await loadWords().catch(() => {}); }
    if (k === "proof" && !S.proof) {
      api("/api/results").then((r) => { S.proof = r; if (S.screen === "proof") render(); });
      api("/api/examples").then((e) => { S.examples = e; if (S.screen === "proof") render(); });
    }
    go(k);
  },
  tabWords() { return ACT.tab("words"); },
  goHome() { try { speechSynthesis.cancel(); } catch (e) {} go("home"); },

  async startListen() {
    await loadWords().catch(() => {});
    if (readyWords().length < S.cfg.min_words) {
      toast(`Teach at least ${S.cfg.min_words} words first`, "plus-circle");
      return ACT.teachNew();
    }
    go("listen");
    await startRecording(LISTEN_SECONDS, recognize);
  },
  finishListen() { stopRecording(); },
  cancelListen() { stopRecording(true); go("home"); },
  pick(i) { S.sel = +i; render(); },
  async confirm() {
    const g = S.result.guesses[S.sel ?? 0];
    try {
      const w = await api("/api/confirm", { method: "POST", body: form({ rec_id: S.result.rec_id, word_id: g.id }) });
      S.words = S.words.map((x) => (x.id === w.id ? w : x));
      speakWord(w, "Recognised from your voice · Utter learned from this");
    } catch (e) { const w = word(g.id); if (w) speakWord(w, "Recognised from your voice"); }
  },
  quick(k) { const q = QUICK[k]; S.speak = { ...q, source: "Quick reply" }; go("speak"); say(q.phrase); },
  sayAgain() { if (S.speak) say(S.speak.phrase); },
  flip() { S.flipped = !S.flipped; render(); },

  openWord(id) { S.detailId = id; go("detail"); },
  playTake(id) {
    const a = new Audio(`/api/takes/${id}/audio`);
    S.playing = id; render();
    a.onended = a.onerror = () => { S.playing = null; if (S.screen === "detail") render(); };
    a.play().catch(() => { S.playing = null; render(); });
  },
  async archiveTake(id) {
    const w = word(S.detailId);
    if (!w || !confirm("Remove this recording? Use it for bad or wrong recordings.")) return;
    try {
      const nw = await api(`/api/takes/${id}/archive`, { method: "POST" });
      S.words = S.words.map((x) => (x.id === nw.id ? nw : x));
      render(); toast("Recording removed", "check");
    } catch (e) { toast(e.message, "warning"); }
  },
  sayDetail() { const w = word(S.detailId); if (w) speakWord(w, "From My words"); },
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
      t.recording = false; t.busy = true; render();
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

async function recognize(blob) {
  S.result = null; S.sel = null; S.heard = null;
  go("result");
  try {
    const r = await api("/api/recognize", { method: "POST", body: form({ file: new File([blob], "rec.wav", { type: "audio/wav" }) }) });
    S.result = r; S.sel = r.accepted ? 0 : null;
    render();
    if (S.cfg.whisper) {
      api(`/api/recent/${r.rec_id}/whisper`).then((x) => {
        S.heard = x.whisper_text;
        if (S.screen === "result" && S.result === r) render();
      }).catch(() => {});
    }
  } catch (e) { toast(e.message, "warning"); go("home"); }
}
function speakWord(w, source) {
  S.speak = { label: w.label, phrase: w.phrase, icon: w.icon, main: w.main, source };
  go("speak");
  say(w.phrase);
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b || !$("#phone").contains(b)) return;
  const f = ACT[b.dataset.act];
  if (f) f(b.dataset.arg);
});

// Jedna klávesa (mezerník) pro lidi, kteří ovládají počítač spínačem (switch access).
const SPACE_ACTION = { home: "startListen", listen: "finishListen", teach2: "record", teach3: "startListen", result: "startListen" };
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || e.repeat || e.target.closest("input, textarea, button, audio")) return;
  const act = SPACE_ACTION[S.screen];
  if (act) { e.preventDefault(); ACT[act](); }
});

(async () => {
  try {
    S.cfg = await api("/api/config");
    await loadWords();
  } catch (e) {
    S.cfg = { takes: 3, min_words: 2, whisper: false };
    toast("Server is not running: start app/server.py", "warning");
  }
  render();
})();
