// Proof charts, drawn from outputs/results.json (the notebook's output). No number is typed in here.
const C = { whisper: "#8FD3FF", general: "#B5AC9E", personal: "#F8A4D2", combined: "#FFC93C", ok: "#8FD9B0", ask: "#B5AC9E", bad: "#F4583E" };
const p100 = (x) => Math.round(x * 100);

// One row per person: where a regular assistant is, and where Utter gets them.
function chartSpeakers(R) {
  const order = { severe: 0, "moderate-severe": 1, moderate: 2, mild: 3 };
  const rows = R.per_speaker.filter((s) => s.status === "dysarthria" && s.combined != null)
    .sort((a, b) => order[a.severity] - order[b.severity] || a.whisper - b.whisper);
  const X = (v) => 96 + v * 214, H = 30, top = 18;
  const grid = [0, .25, .5, .75, 1].map((v) => `<line x1="${X(v)}" x2="${X(v)}" y1="${top - 6}" y2="${top + rows.length * H}" stroke="rgba(243,235,221,.08)"/>
    <text x="${X(v)}" y="${top + rows.length * H + 14}" text-anchor="middle">${p100(v)}%</text>`).join("");
  const body = rows.map((s, i) => {
    const y = top + i * H + H / 2, a = X(s.whisper), b = X(s.combined);
    return `<text class="b" x="0" y="${y - 1}">${s.speaker}</text><text x="0" y="${y + 11}" style="font-size:9px">${s.severity}</text>
      <line x1="${a}" x2="${b}" y1="${y}" y2="${y}" stroke="rgba(243,235,221,.3)" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${a}" cy="${y}" r="6" fill="${C.whisper}"/><circle cx="${b}" cy="${y}" r="7" fill="${C.combined}"/>
      <text x="${Math.min(a, b) - 10}" y="${y + 4}" text-anchor="end">${p100(Math.min(s.whisper, s.combined))}</text>
      <text class="b" x="${Math.max(a, b) + 11}" y="${y + 4}">${p100(Math.max(s.whisper, s.combined))}</text>`;
  }).join("");
  return `<svg viewBox="0 0 340 ${top + rows.length * H + 20}" role="img" aria-label="Accuracy for each person: regular assistant and ${BRAND.name}">${grid}${body}</svg>`;
}

// How many of your own recordings per word are needed.
function chartShots(R) {
  const ks = Object.keys(R.by_shot), keys = ["whisper", "general", "personal", "combined"];
  const W = 340, Hh = 150, base = 128, gw = W / ks.length;
  const body = ks.map((k, gi) => {
    const s = R.by_shot[k], x0 = gi * gw + gw / 2 - 46;
    return keys.map((key, i) => {
      const h = s[key] * 104, x = x0 + i * 24;
      return `<rect x="${x}" y="${base - h}" width="18" height="${h}" rx="6" fill="${C[key]}"/>
        <text class="${key === "combined" ? "b" : ""}" x="${x + 9}" y="${base - h - 5}" text-anchor="middle" style="font-size:9.5px">${p100(s[key])}</text>`;
    }).join("") + `<text class="b" x="${gi * gw + gw / 2}" y="${base + 15}" text-anchor="middle">${k} recording${k === "1" ? "" : "s"}</text>
      <text x="${gi * gw + gw / 2}" y="${base + 28}" text-anchor="middle" style="font-size:9px">${s.n_speakers} people</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${Hh + 12}" role="img" aria-label="Accuracy by number of own recordings per word">
    <line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="rgba(243,235,221,.15)"/>${body}</svg>`;
}

// What happens to each attempt when "not sure" is allowed.
function chartNotSure(R) {
  const h = R.headline;
  const rows = [["Own + others' recordings", h.rej_correct, h.rej_repeat, h.rej_wrong], ["Own recordings only", h.prej_correct, h.prej_repeat, h.prej_wrong]];
  const W = 340;
  const body = rows.map(([name, ok, ask, bad], i) => {
    const y = 18 + i * 50, a = ok * W, b = ask * W, c = Math.max(6, bad * W - 2);
    return `<text class="b" x="0" y="${y - 6}">${name}</text>
      <text x="${W}" y="${y - 6}" text-anchor="end" style="fill:${C.bad}">${p100(bad)}% wrong</text>
      <rect x="0" y="${y}" width="${a - 2}" height="22" rx="7" fill="${C.ok}"/>
      <rect x="${a}" y="${y}" width="${b - 2}" height="22" rx="7" fill="${C.ask}"/>
      <rect x="${W - c}" y="${y}" width="${c}" height="22" rx="6" fill="${C.bad}"/>
      <text x="${a / 2}" y="${y + 15}" text-anchor="middle" style="fill:#141414;font-weight:700">${p100(ok)}%</text>
      <text x="${a + b / 2}" y="${y + 15}" text-anchor="middle" style="fill:#141414;font-weight:700">${p100(ask)}%</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} 96" role="img" aria-label="Right, asks again and wrong actions">${body}</svg>`;
}

function legend(items) {
  return `<div class="legend">${items.map(([k, label]) => `<span><i style="background:${C[k]}"></i>${label}</span>`).join("")}</div>`;
}
