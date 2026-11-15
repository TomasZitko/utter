// Brand in one place: the name and Blub, the mascot. Blub is the logo.
// Taken from the design file (design/Utter App v2.dc.html), rewritten without React.
const BRAND = {
  name: "Utter",
  wordmark: "utter",
  tagline: "Say it your way.",
};

const INK = "#141414", CREAM = "#F3EBDD";
// Live state Blub reacts to: reduced motion, the pointer, and how loud the voice is right now.
const BLUB = {
  still: !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches),
  x: 0, y: 0, moved: 0,     // pointer position and when it last moved
  level: null,              // loudness 0..1 while listening, null otherwise
};
addEventListener("pointermove", (e) => { BLUB.x = e.clientX; BLUB.y = e.clientY; BLUB.moved = performance.now(); }, { passive: true });

// A soft, slightly uneven circle. `t` moves it, `wob` is how much.
function blobPath(cx, cy, R, seed, amp, t, wob) {
  const n = 36, pts = [], k = seed * 1.7;
  for (let i = 0; i < n; i++) {
    const th = i / n * Math.PI * 2;
    const r = R * (1 + 0.045 * Math.sin(2 * th + k) + 0.025 * Math.sin(3 * th + k * 2.3)
      + wob * (0.022 * Math.sin(2 * th + t * 0.9) + 0.016 * Math.sin(3 * th - t * 0.7) + 0.01 * Math.sin(4 * th + t * 1.2)));
    pts.push([cx + r * 1.04 * Math.sin(th), cy - r * 0.96 * Math.cos(th)]);
  }
  const f = (p) => p[0].toFixed(1) + " " + p[1].toFixed(1);
  let d = "M" + f(pts[0]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += "C" + f([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]) + " " + f([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]) + " " + f(p2);
  }
  return d + "Z";
}

// Blub's face in each mood. idle, listen, happy and speak are from the design;
// unsure, sad, think and sleep follow the same hand.
function blubEye(m) {
  if (m === "sleep") return `<path d="M-13 -2 Q0 9 13 -2" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  if (m === "listen") return `<circle r="16" fill="${CREAM}" stroke="${INK}" stroke-width="4"/><circle cx="2" cy="-4" r="8" fill="${INK}"/>`;
  if (m === "happy") return `<path d="M-15 5 Q0 -14 15 5" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  return `<ellipse rx="10" ry="13" fill="${INK}"/><circle cx="3" cy="-5" r="3.5" fill="${CREAM}"/>`;
}
function blubMouth(m) {
  if (m === "think") return `<circle class="m-dot" cx="-16" cy="2" r="5" fill="${INK}"/><circle class="m-dot" cx="0" cy="2" r="5" fill="${INK}"/><circle class="m-dot" cx="16" cy="2" r="5" fill="${INK}"/>`;
  if (m === "sleep") return `<ellipse cx="0" cy="2" rx="6" ry="5" fill="${INK}"/><text class="m-z" x="34" y="-34" font-size="22" font-weight="700" fill="${INK}">z</text><text class="m-z m-z2" x="50" y="-52" font-size="16" font-weight="700" fill="${INK}">z</text>`;
  if (m === "listen") return `<ellipse cx="0" cy="2" rx="8" ry="10" fill="${INK}"/>`;
  if (m === "speak") return `<ellipse cx="0" cy="2" rx="13" ry="11" fill="${INK}"/>`;
  if (m === "happy") return `<path d="M-30 -8 L30 -8 Q26 22 0 22 Q-26 22 -30 -8Z" fill="${INK}"/>`;
  if (m === "unsure") return `<path d="M-22 4 Q-11 -5 0 4 Q11 13 22 2" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  if (m === "sad") return `<path d="M-18 10 Q0 -6 18 10" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  return `<path d="M-18 -4 Q0 12 18 -4" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
}

// Returns Blub as an SVG string. One animation loop (below) moves every Blub on the page.
//   key: blink timing is remembered per key, so a redraw does not restart it
function mascot(o) {
  o = { key: "blub", color: "#FFC93C", mood: "idle", R: 220, lobes: 7, amp: 0.06, faceY: 250, faceScale: 1, wobble: 1, speed: 1, still: false, ...o };
  const s = o.faceScale, g = 34 * s, fy = o.faceY;
  return `<svg class="mascot" viewBox="0 0 500 500" width="100%" height="100%" aria-hidden="true" data-m="${encodeURIComponent(JSON.stringify(o))}" style="overflow:visible;display:block">
    <path class="m-body" d="${blobPath(250, 250, o.R, o.lobes, o.amp, 0, 0)}" fill="${o.color}"/>
    <g class="m-eye-l" transform="translate(${250 - g},${fy}) scale(${s})">${blubEye(o.mood)}</g>
    <g class="m-eye-r" transform="translate(${250 + g},${fy}) scale(${s})">${blubEye(o.mood)}</g>
    <g class="m-mouth" transform="translate(250,${fy + 30 * s}) scale(${s})">${blubMouth(o.mood)}</g></svg>`;
}
// The logo: Blub, calm, yellow.
function logoMark(size = 88, key = "logo", still = false) {
  return `<span class="logo-mark" style="width:${size}px;height:${size}px">${mascot({ key, R: 205, lobes: 7, amp: 0.09, faceY: 232, faceScale: 2.3, wobble: 0.7, still })}</span>`;
}

const BLINK = {};   // key -> {next, start, dbl, seed, mood}
function animateMascots(now) {
  document.querySelectorAll("svg.mascot").forEach((el) => {
    const q = el._o || (el._o = JSON.parse(decodeURIComponent(el.dataset.m)));
    const still = BLUB.still || q.still;
    const b = BLINK[q.key] || (BLINK[q.key] = { next: now + 800 + Math.random() * 2500, start: -1, dbl: false, seed: Math.random() * 10, mood: q.mood });
    if (!el._seen) {
      el._seen = true;
      // a small squash-and-stretch when the mood changes
      if (b.mood !== q.mood && !still) el.classList.add("pop");
      b.mood = q.mood;
    } else if (still) return;
    const sleepy = q.mood === "sleep", think = q.mood === "think";
    const t = now / 1000 + b.seed;
    el.children[0].setAttribute("d", blobPath(250, 250, q.R, q.lobes, q.amp, still ? 0 : t * q.speed * (sleepy ? 0.45 : think ? 1.8 : 1), still ? 0 : q.wobble));
    let bl = 1;
    if (!still && q.mood !== "happy" && !sleepy) {
      if (now > b.next && b.start < 0) b.start = now;
      if (b.start >= 0) {
        const k = (now - b.start) / 170;
        if (k >= 1) {
          b.start = -1;
          if (!b.dbl && Math.random() < 0.3) { b.dbl = true; b.next = now + 110; }
          else { b.dbl = false; b.next = now + 2400 + Math.random() * 3400; }
        } else bl = Math.max(0.08, Math.abs(1 - 2 * k));
      }
    }
    // where Blub looks: drifting by itself, up and around when thinking, at the pointer when it moves
    let lx = still ? 0 : Math.sin(t * 0.7) * 4 + Math.sin(t * 0.23) * 4, ly = still ? 0 : Math.sin(t * 0.5) * 2.5;
    if (think && !still) { lx = Math.sin(t * 2.2) * 9; ly = -7 + Math.cos(t * 2.2) * 2; }
    else if (!still && !sleepy && now - BLUB.moved < 3500) {
      const r = el.getBoundingClientRect();
      if (r.width) {
        const dx = BLUB.x - (r.left + r.width / 2), dy = BLUB.y - (r.top + r.height * q.faceY / 500), d = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1, d / 260) * 9;
        lx = lx * 0.3 + dx / d * reach; ly = ly * 0.3 + dy / d * reach * 0.7;
      }
    }
    const fy = q.faceY, s = q.faceScale, g = 34 * s;
    const lvl = q.mood === "listen" && BLUB.level != null ? BLUB.level : null;
    const es = lvl != null ? 1 + lvl * 0.14 : 1;                       // eyes widen with the voice
    el.children[1].setAttribute("transform", `translate(${250 - g + lx},${fy + ly}) scale(${s * es},${s * es * bl})`);
    el.children[2].setAttribute("transform", `translate(${250 + g + lx},${fy + ly}) scale(${s * es},${s * es * bl})`);
    let talk = 1;
    if (!still) {
      if (lvl != null) talk = 0.45 + Math.min(1, lvl * 1.6) * 0.95;      // mouth follows the real loudness
      else if (q.mood === "listen" || q.mood === "speak") talk = 0.55 + 0.45 * Math.abs(Math.sin(t * (q.mood === "speak" ? 6 : 3.5)));
      else if (sleepy) talk = 0.8 + 0.3 * Math.sin(t * 1.3);
    }
    el.children[3].setAttribute("transform", `translate(${250 + lx * 0.6},${fy + ly + 30 * s}) scale(${s},${s * talk})`);
  });
  requestAnimationFrame(animateMascots);
}
requestAnimationFrame(animateMascots);

// Browser tab icon: Blub, still.
(function favicon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 20 460 460"><path d="${blobPath(250, 250, 205, 7, 0.09, 0, 0)}" fill="#FFC93C"/>
    <g transform="translate(171.8,232) scale(2.3)">${blubEye("idle")}</g><g transform="translate(328.2,232) scale(2.3)">${blubEye("idle")}</g>
    <g transform="translate(250,301) scale(2.3)">${blubMouth("idle")}</g></svg>`;
  const link = document.querySelector('link[rel="icon"]') || document.head.appendChild(Object.assign(document.createElement("link"), { rel: "icon" }));
  link.type = "image/svg+xml";
  link.href = "data:image/svg+xml," + encodeURIComponent(svg);
})();
