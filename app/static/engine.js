// Engine panel: shows what the model does with each recording, with the real numbers from the server.
//   1 Listen  -> the recording and how many WavLM frames it became
//   2 Compare -> similarity picture + DTW path against the closest stored recording of the best and second-best word
//   3 Decide  -> distance to every word, margin against the threshold: act, or ask again
// Nothing here is decoration: every value comes from the /api/recognize response.
const Engine = {
  el: null, cfg: null, r: null, w: undefined, mode: "idle", hist: [],
  N: 56,

  init(cfg) { this.el = document.getElementById("engine"); this.cfg = cfg; this.render(); },

  head(pill, on) {
    const m = this.cfg?.model;
    const line = m ? `<p class="model-line">${esc(m.name.split("/").pop())} · layer ${m.layer} · ${(m.params / 1e6).toFixed(0)}M parameters · runs on this ${m.device === "cuda" ? "laptop's GPU" : "computer's CPU"}</p>` : "";
    return `<div class="eng-head"><h2>Under the hood</h2><span class="live-pill ${on ? "on" : ""}">${pill}</span></div>${line}`;
  },

  waveHTML(vals) {
    return `<div class="eng-wave" id="eng-wave">${vals.map((v) => `<i style="height:${Math.max(3, Math.round(v * 46))}px"></i>`).join("")}</div>`;
  },

  idle() { this.mode = "idle"; this.r = null; this.render(); },
  listening() { this.mode = "live"; this.hist = Array(this.N).fill(0); this.render(); },
  thinking() { this.mode = "thinking"; this.render(); },
  show(r) { this.mode = "result"; this.r = r; this.w = undefined; this.render(); this.draw(); },
  whisper(x) { this.w = x; const s = document.getElementById("eng-versus"); if (s && this.r) s.innerHTML = this.versusHTML(); },

  // called ~10x per second while the microphone or a clip is playing
  live(level) {
    if (this.mode !== "live") return;
    this.hist.push(level); this.hist.shift();
    const w = document.getElementById("eng-wave");
    if (w) [...w.children].forEach((b, i) => (b.style.height = `${Math.max(3, Math.round(this.hist[i] * 46))}px`));
  },

  versusHTML() {
    const r = this.r, top = r.guesses[0], w = this.w;
    const ours = r.accepted ? esc(top.label) : "Not sure";
    const mark = (ok) => (ok == null ? "" : ok ? '<span class="ok">right</span>' : '<span class="bad">wrong</span>');
    const oursMark = r.truth == null ? "" : !r.accepted ? '<span>asks again</span>' : mark(r.correct);
    const wText = w === undefined ? (this.cfg.whisper ? "…" : "off") : `“${esc(w.whisper_text || "")}”`;
    return `<div><small><span>${BRAND.name}</span>${oursMark}</small><b>${ours}</b></div>
      <div class="w"><small><span>Whisper-small</span>${w ? mark(w.correct) : ""}</small><b>${wText}</b></div>`;
  },

  render() {
    if (!this.el) return;
    const steps = (lit) => [1, 2, 3].map((n) => (n <= lit ? "lit" : ""));
    if (this.mode === "idle" || this.mode === "live" || this.mode === "thinking") {
      const live = this.mode === "live", lit = steps(live ? 1 : this.mode === "thinking" ? 2 : 0);
      this.el.innerHTML = this.head(live ? "listening" : this.mode === "thinking" ? "comparing" : "idle", live) + `
        <div class="eng-sec ${lit[0]}"><div class="t"><span class="step"><b>1</b>Listen</span><span class="v">16 kHz mono</span></div>
          ${this.waveHTML(live ? this.hist : Array(this.N).fill(0))}</div>
        <div class="eng-idle">
          <div class="how"><i class="ph-bold ph-ear"></i><div><strong>Listen</strong>The recording is trimmed and turned into a sequence of WavLM frames, one every 20 ms. No text is involved, so it works for any sound a person can repeat.</div></div>
          <div class="how"><i class="ph-bold ph-arrows-left-right"></i><div><strong>Compare</strong>Dynamic time warping aligns it with every stored recording, so the same sound said slower or with pauses still matches.</div></div>
          <div class="how"><i class="ph-bold ph-check-circle"></i><div><strong>Decide</strong>The closest word wins only if it is clearly ahead of the second. Otherwise ${BRAND.name} asks again, because a wrong action is the worst error.</div></div>
          
        </div>`;
      return;
    }
    const r = this.r, g = r.guesses, top = g[0];
    const d0 = g[0].dist, dN = g[g.length - 1].dist;
    const ranks = g.slice(0, 5).map((x, i) => `<div class="rank ${i === 0 ? "top" : ""}">
        <span class="n">${esc(x.label)}</span>
        <span class="tr"><div style="width:${Math.round(100 - 78 * (x.dist - d0) / (dN - d0 + 1e-6))}%"></div></span>
        <span class="d">${x.dist.toFixed(3)}</span></div>`).join("");
    const max = Math.max(r.threshold * 3, r.margin * 1.15);
    const th = (100 * r.threshold / max).toFixed(1), m = Math.max(2, Math.min(98, 100 * r.margin / max)).toFixed(1);
    const aligns = r.align.map((a, i) => `<div class="align ${i === 0 ? "win" : ""}">
        <canvas id="eng-al${i}" aria-label="Alignment with ${esc(a.label)}"></canvas>
        <div class="cap">${esc(a.label)}<span>${g[i].dist.toFixed(3)}</span></div></div>`).join("");
    const t = r.timing;
    this.el.innerHTML = this.head(`${t.total_ms} ms`, false) + `
      <div class="eng-sec lit"><div class="t"><span class="step"><b>1</b>Listen</span><span class="v">${r.seconds} s · ${r.frames} frames × 768</span></div>
        ${this.waveHTML(r.peaks)}</div>
      <div class="eng-sec lit"><div class="t"><span class="step"><b>2</b>Compare</span><span class="v">${r.compared} stored recordings</span></div>
        <div class="aligns">${aligns}</div>
        <p class="eng-note">Down: this recording. Across: the closest stored one. A clean bright path means the same sound, even at another speed.</p></div>
      <div class="eng-sec lit"><div class="t"><span class="step"><b>3</b>Decide</span><span class="v">distance, lower = closer</span></div>
        <div class="ranks">${ranks}</div>
        <div class="gauge ${r.accepted ? "" : "no"}" style="--th:${th}%;--m:${m}%"><div class="tr"></div><div class="th"></div><div class="mk"></div></div>
        <div class="decision"><span>Lead over the 2nd word ${r.margin.toFixed(3)} · needs ${r.threshold.toFixed(3)}</span>
          <b class="${r.accepted ? "act" : ""}">${r.accepted ? "Act" : "Ask again"}</b></div></div>
      <div class="eng-sec">
        <div class="versus" id="eng-versus">${this.versusHTML()}</div></div>
      <p class="timing">WavLM <b>${t.embed_ms} ms</b> · DTW × ${r.compared} <b>${t.dtw_ms} ms</b> · total <b>${t.total_ms} ms</b></p>`;
  },

  // similarity picture with the DTW path on top
  draw() {
    (this.r?.align || []).forEach((a, k) => {
      const cv = document.getElementById("eng-al" + k);
      if (!cv) return;
      const bin = atob(a.sim), n = a.rows, m = a.cols;
      let lo = 255, hi = 0;
      for (let i = 0; i < bin.length; i++) { const v = bin.charCodeAt(i); if (v < lo) lo = v; if (v > hi) hi = v; }
      const small = document.createElement("canvas"); small.width = m; small.height = n;
      const sx = small.getContext("2d"), img = sx.createImageData(m, n);
      for (let i = 0; i < n * m; i++) {
        const v = Math.pow((bin.charCodeAt(i) - lo) / Math.max(1, hi - lo), 1.6);   // stretch contrast for display
        img.data[i * 4] = 14 + v * 241; img.data[i * 4 + 1] = 12 + v * 189; img.data[i * 4 + 2] = 10 + v * 50; img.data[i * 4 + 3] = 255;
      }
      sx.putImageData(img, 0, 0);
      const Z = 4; cv.width = m * Z; cv.height = n * Z;
      const c = cv.getContext("2d");
      c.imageSmoothingEnabled = false;
      c.drawImage(small, 0, 0, m * Z, n * Z);
      c.lineJoin = c.lineCap = "round";
      const stroke = (color, width) => {
        c.strokeStyle = color; c.lineWidth = width; c.beginPath();
        a.path.forEach(([i, j], q) => { const x = (j + .5) * Z, y = (i + .5) * Z; q ? c.lineTo(x, y) : c.moveTo(x, y); });
        c.stroke();
      };
      stroke("rgba(12,11,10,.85)", Z * 2.2); stroke(k === 0 ? "#F3EBDD" : "#B5AC9E", Z * 0.9);
    });
  },
};
