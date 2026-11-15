// Real voices: a live test on real people with dysarthria from TORGO.
// Pick a person -> the server teaches the app a few of their words from their own recordings ->
// recordings the app has never heard are played and recognised live, through the same path as the microphone.
// A regular assistant (Whisper) gets the same recordings. The score counts what happens here, nothing is precomputed.
// ---------------- Settings ----------------
const AUTO_PAUSE_MS = 1700;     // pause on each result in auto-run
// -------------------------------------------
const SEV_LEVEL = { mild: 1, moderate: 2, "moderate-severe": 3, severe: 4 };

const Lab = {
  el: null, speakers: [], speaker: null, queue: [], i: 0, auto: false, busy: false, player: null,
  rows: [],   // one row per played recording: {truth, top, accepted, correct, whisper, wOk}

  async init() {
    this.el = document.getElementById("lab");
    if (!S.cfg.sim) return this.render();
    try { this.speakers = await api("/api/sim/speakers"); } catch (e) { this.speakers = []; }
    this.render();
  },

  tally() {
    const r = this.rows;
    return { n: r.length, ok: r.filter((x) => x.accepted && x.correct).length, ask: r.filter((x) => !x.accepted).length,
      bad: r.filter((x) => x.accepted && !x.correct).length, wN: r.filter((x) => x.wOk != null).length, wOk: r.filter((x) => x.wOk).length };
  },

  render() {
    if (!this.el) return;
    if (!S.cfg.sim || !this.speakers.length) {
      this.el.innerHTML = `<div class="lab-head"><h2>Real voices</h2><span class="live-pill">TORGO data</span></div>
        <p>This mode replays real recordings of people with dysarthria and recognises them live. It needs the TORGO recordings on this computer:</p>
        <p><b>python experiments/build_demo_pack.py</b></p>
        <p>Without it, everything else works with your own voice, and the Proof tab shows the measured results.</p>`;
      return;
    }
    const sp = this.speakers.find((s) => s.id === this.speaker), run = S.sim, t = this.tally();
    this.el.parentElement.classList.toggle("running", !!sp);
    const spk = this.speakers.map((s) => `<button aria-pressed="${s.id === this.speaker}" data-act="simPick" data-arg="${s.id}" ${s.takes ? "" : "disabled"} title="${esc(s.sex)}, dysarthria: ${esc(s.severity)}">
        <b>${s.id}</b><span>${esc((s.severity || "").replace("moderate-severe", "mod.-severe"))}</span></button>`).join("");
    let body;
    if (!sp) {
      body = `<p>A live test on real people. Pick a person with dysarthria. ${BRAND.name} learns a few of their words from their own recordings, then hears recordings <b>it has never heard</b>. A regular assistant gets the same ones.</p>`;
    } else {
      const done = run && this.i >= this.queue.length && !this.busy;
      const cells = (cls) => this.rows.map(cls).map((c) => `<i class="${c}"></i>`).join("");
      const feed = this.rows.slice().reverse().map((x) => `<div>
          <span><b>${esc(x.truth)}</b></span>
          <span class="${!x.accepted ? "" : x.correct ? "ok" : "bad"}">${!x.accepted ? "asks again" : (x.correct ? "✓ " : "✗ ") + esc(x.top)}</span>
          <span class="${x.wOk == null ? "" : x.wOk ? "ok" : "bad"}">${x.wOk == null ? "…" : (x.wOk ? "✓ " : "✗ ") + "“" + esc(x.whisper) + "”"}</span></div>`).join("");
      body = `
        <div class="lab-actions">
          <button class="btn primary" data-act="simNext" ${!run || this.busy || done ? "disabled" : ""}><i class="ph-fill ph-play"></i>Next</button>
          <button class="btn ${this.auto ? "cream" : "outline"}" data-act="simAuto" ${!run || done ? "disabled" : ""}><i class="ph-bold ph-${this.auto ? "pause" : "fast-forward"}"></i>${this.auto ? "Pause" : "Auto-run"}</button>
          <button class="btn outline ico" data-act="simPick" data-arg="${sp.id}" ${this.busy ? "disabled" : ""} aria-label="Teach other words" title="Teach other words of this person"><i class="ph-bold ph-shuffle"></i></button>
          <button class="btn outline ico" data-act="simExit" aria-label="Back to my voice" title="Back to my voice"><i class="ph-bold ph-x"></i></button>
        </div>
        <div class="score">
          <div class="score-row"><div class="t"><b>${BRAND.name}</b><span><b>${t.ok}</b> right · ${t.ask} asked again · <span style="color:${t.bad ? "var(--danger)" : "inherit"}">${t.bad} wrong</span></span></div>
            <div class="cells">${cells((x) => (!x.accepted ? "ask" : x.correct ? "ok" : "bad")) || "<i></i>"}</div></div>
          <div class="score-row"><div class="t"><b>Regular assistant</b><span><b>${t.wOk}</b> of ${t.wN} understood</span></div>
            <div class="cells">${cells((x) => (x.wOk == null ? "" : x.wOk ? "w-ok" : "bad")) || "<i></i>"}</div></div>
        </div>
        <div class="feed" aria-label="Results so far"><div class="hd"><span>They said</span><span>${BRAND.name}</span><span>Regular assistant</span></div>${feed}</div>`;
    }
    this.el.innerHTML = `
      <div class="lab-head"><h2>Real voices</h2>
        <span class="live-pill ${run ? "on" : ""}">${run ? esc(this.speaker) + " live" : "TORGO data"}</span></div>
      <div class="spk" role="group" aria-label="Person">${spk}</div>
      ${body}`;
  },

  async pick(id) {
    if (this.busy) return;
    this.stopAudio();
    if (id !== this.speaker) this.rows = [];        // the score is per person
    this.speaker = id; this.auto = false; this.busy = true; this.queue = []; this.i = 0;
    S.sim = null; Engine.idle();
    go("sim", { simPhase: "teaching" });
    this.render();
    try {
      const r = await api("/api/sim/start", { method: "POST", body: form({ speaker: id }) });
      S.cfg.profile = r.profile; S.words = r.words; S.sim = r.profile.sim;
      this.queue = r.profile.sim.tests;
      S.simPhase = "ready";
    } catch (e) { toast(e.message, "warning"); await this.exit(); return; }
    this.busy = false;
    render(); this.render();
  },

  async next() {
    if (this.busy || !S.sim || this.i >= this.queue.length) return;
    this.busy = true;
    const clip = this.queue[this.i++];
    S.simRes = null; S.simW = undefined; S.simPhase = "playing";
    render(); this.render();
    try {
      this.player = new ClipPlayer();
      Engine.listening();
      const playing = this.player.play(`/api/sim/audio/${clip.clip}`, () => animate(this.player));
      const recognising = api("/api/sim/recognize", { method: "POST", body: form({ clip: clip.clip, strict: CAUTION[P.caution] ?? 1 }) });
      await playing;                                   // let the judge hear the whole recording first
      if (S.screen !== "sim") return;
      S.simPhase = "thinking"; render(); Engine.thinking();
      const r = await recognising;
      if (S.screen !== "sim") return;
      const row = { truth: r.truth, top: r.guesses[0].label, accepted: r.accepted, correct: r.correct, whisper: null, wOk: null };
      this.rows.push(row);
      S.simRes = r; S.simPhase = "result";
      render(); Engine.show(r); this.busy = false; this.render();
      if (S.cfg.whisper) {
        try {
          const w = await api(`/api/recent/${r.rec_id}/whisper`);
          row.whisper = w.whisper_text; row.wOk = !!w.correct;
          Engine.whisper(w);
          if (S.simRes === r) { S.simW = w; if (S.screen === "sim") render(); }
          this.render();
        } catch (e) { /* comparison is optional */ }
      }
      if (this.auto && S.screen === "sim") {
        await new Promise((ok) => setTimeout(ok, AUTO_PAUSE_MS));
        if (this.auto && S.screen === "sim" && S.simRes === r) {
          if (this.i < this.queue.length) { this.busy = false; return await this.next(); }
          this.auto = false; S.simPhase = "done"; render(); this.render();
        }
      }
    } catch (e) {
      toast(e.message, "warning"); this.auto = false;
    } finally { this.busy = false; this.render(); }
  },

  toggleAuto() {
    this.auto = !this.auto; this.render();
    if (this.auto && !this.busy) this.next();
  },

  stopAudio() { if (this.player) { this.player.stop(); this.player = null; } cancelAnimationFrame(raf); BLUB.level = null; },

  async exit() {
    this.stopAudio();
    this.auto = false; this.busy = false; this.speaker = null; S.sim = null; this.queue = [];
    try { S.cfg.profile = await api("/api/profile", { method: "POST", body: form({ id: "me" }) }); await loadWords(); } catch (e) { /* server gone */ }
    Engine.idle(); go("home"); this.render();
  },
};

SCREENS.sim = function () {
  const sim = S.sim, ph = S.simPhase, who = Lab.speaker;
  const exit = { icon: "x", label: "Back to my voice", act: "simExit" };
  if (ph === "teaching" || !sim) {
    return hero({ pale: "#E9E2D6", main: "#B5AC9E", face: "think", left: exit, tag: `Real voice · ${who}` }) +
      `<div class="below center" style="justify-content:center">
        <h1 class="h1 c" style="font-size:38px">Learning ${esc(who)}'s<br>way of speaking…</h1>
        <p class="sub c" style="font-size:16px">Real recordings from the TORGO database.</p></div>`;
  }
  const left = Lab.queue.length - Lab.i;
  if (ph === "ready" || ph === "done") {
    const t = Lab.tally();
    const chips = S.words.map((w) => `<span class="chip static">${esc(w.label)}</span>`).join("");
    return hero({ face: "happy", left: exit, tag: `Real voice · ${who}` }) +
      `<div class="below center" style="gap:12px">
        <h1 class="h1 c" style="font-size:38px">${ph === "done" ? "All unheard<br>recordings played." : `Learned ${sim.words} of ${esc(who)}'s words.`}</h1>
        <p class="sub c" style="font-size:16px">${ph === "done"
          ? `${BRAND.name}: ${t.ok} right, ${t.ask} asked again, ${t.bad} wrong. Regular assistant: ${t.wOk} of ${t.wN}.`
          : `${sim.takes} recording${sim.takes === 1 ? "" : "s"} per word · ${sim.taught} in total · learned in ${(sim.teach_ms / 1000).toFixed(1)} s. ${left} recordings it has never heard are waiting.`}</p>
        <div class="chips">${chips}</div>
        <div class="stack">
          ${ph === "done"
            ? `<button class="btn xl primary" data-act="simPick" data-arg="${who}"><i class="ph-bold ph-shuffle"></i>Try other words</button>`
            : `<button class="btn xl primary" data-act="simNext"><i class="ph-fill ph-play"></i>Play an unheard recording</button>
               <button class="btn outline" data-act="simAuto"><i class="ph-bold ph-fast-forward"></i>Auto-run all ${left}</button>`}
          <button class="btn link" data-act="simExit">Back to my voice</button>
        </div>
      </div>`;
  }
  if (ph === "playing" || ph === "thinking") {
    return hero({ pale: "#FFE0F1", main: "#F8A4D2", face: ph === "playing" ? "listen" : "think", left: exit, tag: ph === "playing" ? `${who} is speaking` : `Real voice · ${who}` }) +
      `<div class="below center">
        <h1 class="h1" style="font-size:46px">${ph === "playing" ? "Listening…" : "Comparing…"}</h1>
        <p class="sub c">A real recording of ${esc(who)}.<br>${BRAND.name} has never heard this one.</p>
        ${ph === "playing" ? waveHTML(1, 104) : `<div style="height:104px"></div>`}
        <span class="kicker" style="margin-top:auto">Recording ${Lab.i} of ${Lab.queue.length}</span>
      </div>`;
  }
  // result
  const r = S.simRes, g = r.guesses[0], w = S.simW;
  const kind = !r.accepted ? "ask" : r.correct ? "ok" : "bad";
  const verdict = { ok: '<span class="verdict ok"><i class="ph-bold ph-check"></i>Right</span>',
    ask: '<span class="verdict ask"><i class="ph-bold ph-question"></i>Asks again</span>',
    bad: '<span class="verdict bad"><i class="ph-bold ph-x"></i>Wrong</span>' }[kind];
  const wLine = w === undefined ? (S.cfg.whisper ? "A regular assistant is still transcribing…" : "")
    : `A regular assistant heard <b>“${esc(w.whisper_text || "")}”</b> <i class="ph-bold ph-${w.correct ? "check ok" : "x bad"}"></i>`;
  return hero({ pale: kind === "ask" ? "#E9E2D6" : g.pale, main: kind === "ask" ? "#B5AC9E" : g.main,
      face: kind === "ok" ? "happy" : kind === "ask" ? "unsure" : "sad", badge: kind === "ok" ? "check" : kind === "ask" ? "question" : "x",
      left: exit, tag: `Real voice · ${who}` }) +
    `<div class="below center" style="gap:12px;padding-top:22px">
      ${verdict}
      <h1 class="h1 c" style="font-size:${kind === "ask" ? 46 : 54}px;line-height:1">${kind === "ask" ? "Not sure…" : esc(g.label)}</h1>
      <p class="sub c" style="font-size:16px">${esc(who)} said <b>“${esc(r.truth)}”</b>${kind === "ask" ? `. Best guess was “${esc(g.label)}”, but not clearly enough to act.` : `. ${g.pct}% match.`}</p>
      <p class="heard-line">${wLine}</p>
      <div class="stack">
        ${left > 0
          ? (Lab.auto ? `<button class="btn xl outline" data-act="simAuto"><i class="ph-bold ph-pause"></i>Pause auto-run</button>`
            : `<button class="btn xl primary" data-act="simNext"><i class="ph-fill ph-play"></i>Next recording</button>`)
          : `<button class="btn xl primary" data-act="simPick" data-arg="${who}"><i class="ph-bold ph-shuffle"></i>Try other words</button>`}
        <button class="btn link" data-act="simReplay">Hear the recording again</button>
      </div>
    </div>`;
};

Object.assign(ACT, {
  simPick(id) { Lab.pick(id); },
  simNext() { Lab.next(); },
  simAuto() { Lab.toggleAuto(); render(); },
  simExit() { Lab.exit(); },
  simReplay() { if (S.simRes) new Audio(`/api/sim/audio/${S.simRes.clip}`).play().catch(() => {}); },
});
