// Scenes "stat", "flip", "teach", "match", "notSure", "result", "outro".
import React from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import voices from "../generated/voices.json";
import { Blub } from "../kit/Blub";
import { Grid, inExpo, inOut, Mark, Num, pop, Reveal, Sfx, Stage, tw, useBeat, useSB, useU, Voice, Wave } from "../kit/kit";
import { C, fontBody, fontDisplay } from "../theme";
import { MEANINGS } from "../meanings";
import { Wordmark } from "./Open";

type ClipInfo = { dur: number; peaks: number[] };
const CLIPS = voices.clips as Record<string, ClipInfo>;

// ---------------------------------------------------------------- stat: 42 of 100 words
export const Stat: React.FC = () => {
  const f = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = useU();
  const sb = useSB();
  const n = sb.numbers.whisper;
  const wide = W / H > 1.3;
  // a 10x10 field of words; the understood ones light up in random order
  const order = Array.from({ length: 100 }, (_, i) => i).sort((a, b) => random(`o${a}`) - random(`o${b}`));
  const lit = new Set(order.slice(0, n));
  const cell = 46 * u;
  return (
    <Stage>
      <Grid start={0} xs={[wide ? 0.08 : 0.06, 0.94]} ys={[0.2, 0.8]} />
      <div style={{ position: "absolute", left: W * (wide ? 0.08 : 0.06) + 40 * u, top: H * 0.24 }}>
        <Reveal text={sb.copy.statLine} start={2} size={56 * u} weight={500} color={C.muted} />
        <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 330 * u, lineHeight: 0.9, letterSpacing: "-0.05em", color: C.blue, transform: `scale(${1 + 0.04 * Math.sin(Math.PI * tw(f, 34, 10))})`, transformOrigin: "left center", opacity: tw(f, 8, 6) }}>
          <Num value={n} start={8} dur={28} />
        </div>
        <Reveal text={sb.copy.statOf} start={30} size={56 * u} weight={500} />
        <div style={{ marginTop: 40 * u }}>
          <Reveal text={sb.copy.statControl} start={72} size={36 * u} weight={500} font="body" color={C.muted} tracking={0} />
        </div>
      </div>
      {wide ? (
        <div style={{ position: "absolute", right: W * 0.1, top: (H - cell * 10) / 2, display: "grid", gridTemplateColumns: `repeat(10, ${cell}px)`, gap: 0 }}>
          {Array.from({ length: 100 }, (_, i) => {
            const k = order.indexOf(i);
            const on = lit.has(i) && f > 8 + (k / n) * 28;
            const appear = tw(f, 2 + (i % 10) + Math.floor(i / 10), 12);
            return (
              <div key={i} style={{ width: cell, height: cell, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: cell * 0.42, height: cell * 0.42, borderRadius: "50%", background: on ? C.blue : "transparent", border: `${2 * u}px solid ${on ? C.blue : C["line-mid"]}`, transform: `scale(${appear * (on ? 1.08 : 1)})` }} />
              </div>
            );
          })}
          <div style={{ gridColumn: "1 / -1", marginTop: 20 * u, fontFamily: fontBody, fontSize: 22 * u, color: C.muted, opacity: tw(f, 40, 10) }}>
            Each dot is 1 in 100 words · lit = Whisper got it right
          </div>
        </div>
      ) : null}
      <Sfx name="impact" at={34} volume={0.55} />
    </Stage>
  );
};

// ---------------------------------------------------------------- flip
export const Flip: React.FC = () => {
  const f = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const u = useU();
  const sb = useSB();
  const b = useBeat();
  const rot = tw(f, 1.6 * b, 0.9 * b, 0, 180, inOut);
  const gone = tw(f, 3 * b, 8, 0, 1, inExpo);
  const peek = pop(f, fps, 5.6 * b, 11, 120);
  return (
    <Stage>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", perspective: 1400 * u }}>
        <div style={{ transform: `rotateX(${rot}deg) translateY(${-gone * 80 * u}px)`, opacity: 1 - gone, backfaceVisibility: "visible" }}>
          <Reveal text={sb.copy.flipA} start={2} size={120 * u} align="center" />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", paddingBottom: 140 * u }}>
        <Reveal text={sb.copy.flipB} start={3.3 * b} size={110 * u} align="center" weight={600} />
        <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 168 * u, letterSpacing: "-0.035em", lineHeight: 1.1, opacity: tw(f, 4 * b, 6) }}>
          <Mark start={4.3 * b} dur={10}>{sb.copy.flipHighlight}</Mark>
        </div>
      </AbsoluteFill>
      <Blub shape={sb.blub} size={420 * u} x={W / 2} y={H + 150 * u - peek * 290 * u} mood="idle" look={[0, -9]} />
      <Sfx name="whoosh" at={1.5 * b} volume={0.45} />
      <Sfx name="tick" at={4.3 * b} volume={0.7} />
      <Sfx name="pop" at={5.6 * b} volume={0.5} />
    </Stage>
  );
};

// ---------------------------------------------------------------- teach: two takes -> pick a meaning -> its sentence
export const Teach: React.FC = () => {
  const f = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const u = useU();
  const sb = useSB();
  const b = useBeat();
  const wide = W / H > 1.3;
  const takes = sb.teachClips.map((c, i) => ({ c, at: (1 + i * 3) * b, info: CLIPS[c] })).filter((x) => x.info);
  // Blub's mouth follows the real loudness of whichever take is playing
  let level: number | null = null;
  for (const t of takes) {
    const k = (f - t.at - 4) / (t.info.dur * fps);
    if (k >= 0 && k < 1) level = t.info.peaks[Math.floor(k * t.info.peaks.length)];
  }
  const chipAt = 6.8 * b;
  const pickAt = 7.9 * b;
  const typeAt = 8.6 * b;
  const typed = Math.floor(Math.max(0, f - typeAt) * 1.4);
  const sentence = sb.copy.teachSentence;
  const speaking = f > typeAt && typed < sentence.length + 10;
  const colX = wide ? W * 0.43 : W * 0.08;
  const cardW = wide ? Math.min(820 * u, W * 0.5) : W * 0.84;
  return (
    <Stage>
      <div style={{ position: "absolute", left: W * 0.06, top: H * 0.08, maxWidth: W * 0.8 }}>
        <Reveal text={sb.copy.teachTitle} start={0} size={64 * u} />
      </div>
      {wide ? (
        <Blub shape={sb.blub} size={540 * u} x={W * 0.22} y={H * 0.6} mood={speaking ? "speak" : f > pickAt ? "happy" : "idle"}
          talk={level != null ? 0.45 + Math.min(1, level * 1.4) * 0.95 : undefined} look={level != null ? [8, 0] : undefined} />
      ) : null}
      {takes.map((t, i) => {
        const p = pop(f, fps, t.at, 14, 170);
        const k = (f - t.at - 4) / (t.info.dur * fps);
        const rec = k >= 0 && k < 1;
        return (
          <div key={t.c} style={{ position: "absolute", left: colX, top: H * (0.3 + i * 0.17), width: cardW, padding: `${22 * u}px ${30 * u}px`, borderRadius: 28 * u, background: C.surface, border: `1px solid ${C.line}`, transform: `translateY(${(1 - p) * 60 * u}px) scale(${0.96 + 0.04 * p})`, opacity: Math.min(1, p * 1.5), display: "flex", alignItems: "center", gap: 26 * u }}>
            <div style={{ width: 22 * u, height: 22 * u, borderRadius: "50%", background: rec ? C.danger : C["line-mid"], boxShadow: rec ? `0 0 ${24 * u}px ${C.danger}` : "none", flex: "none" }} />
            <div style={{ fontFamily: fontBody, fontSize: 26 * u, fontWeight: 600, color: C.muted, width: 110 * u, flex: "none" }}>Take {i + 1}</div>
            <Wave peaks={t.info.peaks} width={cardW - 260 * u} height={84 * u} progress={k} grow={tw(f, t.at, 14)} color={C.pink} />
          </div>
        );
      })}
      {takes.map((t) => <React.Fragment key={t.c}><Sfx name="rec" at={t.at} volume={0.5} /><Voice clip={t.c} at={t.at + 4} /></React.Fragment>)}
      {/* the app's own step: "What should this sound mean?" -> pick a meaning -> Utter says its sentence */}
      <div style={{ position: "absolute", left: colX, top: H * 0.64, width: wide ? W * 0.52 : W * 0.84 }}>
        <div style={{ fontFamily: fontBody, fontWeight: 600, fontSize: 30 * u, color: C.muted, opacity: tw(f, chipAt - 4, 8), marginBottom: 18 * u }}>{sb.copy.teachQuestion}</div>
        <div style={{ display: "flex", gap: 16 * u }}>
          {[sb.copy.teachMeaning, ...["Pain", "Food", "Help"].filter((m) => m !== sb.copy.teachMeaning)].map((m, i) => (
            <MeaningTile key={m} name={m} size={u} appear={pop(f, fps, chipAt + i * 2, 13, 200)} selected={i === 0 ? tw(f, pickAt, 8) : 0} dim={i === 0 ? 0 : tw(f, pickAt, 8)} />
          ))}
        </div>
        <div style={{ fontFamily: fontBody, fontWeight: 500, fontSize: 46 * u, color: C.text, marginTop: 26 * u, minHeight: 60 * u }}>
          {f > typeAt ? `“${sentence.slice(0, typed)}${typed < sentence.length ? "" : "”"}` : ""}
          <span style={{ opacity: f > typeAt && Math.floor(f / 8) % 2 === 0 ? 1 : 0, color: C.accent }}>▍</span>
        </div>
      </div>
      <Sfx name="pop" at={chipAt} volume={0.45} />
      <Sfx name="tick" at={pickAt} volume={0.7} />
      <Sfx name="type" at={typeAt} volume={0.45} />
    </Stage>
  );
};

// ---------------------------------------------------------------- a meaning, drawn like the app's meaning buttons
export const MeaningTile: React.FC<{ name: string; size: number; appear: number; selected?: number; dim?: number }> = ({ name, size: u, appear, selected = 0, dim = 0 }) => {
  const m = MEANINGS[name];
  if (!m) return null;
  const Icon = m.icon;
  return (
    <div style={{ width: 176 * u, padding: `${20 * u}px ${16 * u}px`, borderRadius: 22 * u, background: C.surface, border: `${2 * u}px solid ${selected > 0.5 ? m.main : C.line}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 * u, transform: `scale(${appear * (1 + 0.06 * selected)})`, opacity: 1 - 0.6 * dim, boxShadow: selected > 0.5 ? `0 0 ${40 * u}px ${m.main}55` : "none" }}>
      <div style={{ width: 66 * u, height: 66 * u, borderRadius: "50%", background: m.main, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={36 * u} weight="fill" color={C.ink} />
      </div>
      <div style={{ fontFamily: fontBody, fontWeight: 600, fontSize: 28 * u, color: C.text }}>{name}</div>
    </div>
  );
};

// ---------------------------------------------------------------- vocab: sound by sound, a personal vocabulary
export const Vocab: React.FC = () => {
  const f = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const u = useU();
  const sb = useSB();
  const b = useBeat();
  const wide = W / H > 1.3;
  const cols = wide ? 4 : 2;
  const gap = 22 * u;
  const gridW = W * 0.88;
  const cardW = (gridW - gap * (cols - 1)) / cols;
  const items = sb.vocab.filter((v) => MEANINGS[v.meaning] && CLIPS[v.clip]);
  const at = (i: number) => (i === 0 ? 0.6 * b : (1.6 + (i - 1) * 0.9) * b);
  const count = items.filter((_, i) => f >= at(i)).length;
  return (
    <Stage>
      <div style={{ position: "absolute", left: W * 0.06, top: H * 0.08, maxWidth: W * 0.62 }}>
        <Reveal text={sb.copy.vocabTitle} start={0} size={64 * u} />
        <div style={{ marginTop: 10 * u }}><Reveal text={sb.copy.vocabSub} start={12} size={40 * u} weight={500} font="body" color={C.muted} tracking={0} /></div>
      </div>
      <div style={{ position: "absolute", right: W * 0.06, top: H * 0.07, textAlign: "right", opacity: tw(f, 0.6 * b, 8) }}>
        <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 150 * u, lineHeight: 1, letterSpacing: "-0.04em", color: C.accent, fontVariantNumeric: "tabular-nums" }}>{count}</div>
        <div style={{ fontFamily: fontBody, fontWeight: 600, fontSize: 26 * u, color: C.muted }}>{count === 1 ? "sound" : "sounds"} learned</div>
      </div>
      <div style={{ position: "absolute", left: W * 0.06, top: H * (wide ? 0.36 : 0.3), width: gridW, display: "grid", gridTemplateColumns: `repeat(${cols}, ${cardW}px)`, gap }}>
        {items.map((v, i) => {
          const m = MEANINGS[v.meaning];
          const Icon = m.icon;
          const p = pop(f, fps, at(i), 13, 190);
          return (
            <div key={v.meaning} style={{ height: 250 * u, borderRadius: 26 * u, background: C.surface, border: `1px solid ${i === 0 ? m.main : C.line}`, padding: `${24 * u}px ${26 * u}px`, display: "flex", flexDirection: "column", justifyContent: "space-between", transform: `translateY(${(1 - p) * 40 * u}px) scale(${0.9 + 0.1 * p})`, opacity: Math.min(1, p * 1.4) }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 * u }}>
                <div style={{ width: 58 * u, height: 58 * u, borderRadius: "50%", background: m.main, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                  <Icon size={32 * u} weight="fill" color={C.ink} />
                </div>
                <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 40 * u, color: C.text, letterSpacing: "-0.02em" }}>{v.meaning}</div>
              </div>
              <Wave peaks={CLIPS[v.clip].peaks.filter((_, k) => k % 2 === 0)} width={cardW - 52 * u} height={50 * u} grow={tw(f, at(i) + 2, 12)} color={m.pale} />
              <div style={{ fontFamily: fontBody, fontWeight: 500, fontSize: 24 * u, color: C.muted, lineHeight: 1.25 }}>“{m.phrase}”</div>
            </div>
          );
        })}
      </div>
      {items.map((_, i) => <Sfx key={i} name={i === 0 ? "pop" : "rec"} at={at(i)} volume={0.4} />)}
    </Stage>
  );
};

// ---------------------------------------------------------------- match: the real DTW alignment of two takes
export const Match: React.FC = () => {
  const f = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = useU();
  const sb = useSB();
  const m = (voices as { match?: { a: string; b: string; links: number[][] } }).match;
  if (!m) return <Stage />;
  const A = CLIPS[m.a], B = CLIPS[m.b];
  const x0 = W * 0.17, wd = W * 0.75;
  const yA = H * 0.4, yB = H * 0.7, h = 120 * u;
  return (
    <Stage>
      <div style={{ position: "absolute", left: W * 0.06, top: H * 0.08 }}>
        <Reveal text={sb.copy.matchTitle} start={0} size={64 * u} />
        <Reveal text={sb.copy.matchSub} start={14} size={64 * u} color={C.muted} />
      </div>
      {[["Taught", yA, A, C.pink], ["New", yB, B, C.text]].map(([label, y, c, col], i) => (
        <React.Fragment key={i}>
          <div style={{ position: "absolute", left: W * 0.06, top: (y as number) - 16 * u, fontFamily: fontBody, fontSize: 26 * u, fontWeight: 600, color: C.muted, opacity: tw(f, 8 + i * 6, 10) }}>{label as string}</div>
          <div style={{ position: "absolute", left: x0, top: (y as number) - h / 2 }}>
            <Wave peaks={(c as ClipInfo).peaks} width={wd} height={h} grow={tw(f, 8 + i * 6, 18)} color={col as string} />
          </div>
        </React.Fragment>
      ))}
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        {m.links.map(([a, b2], k) => {
          const xa = x0 + a * wd, xb = x0 + b2 * wd;
          const y1 = yA + h / 2 + 8 * u, y2 = yB - h / 2 - 8 * u;
          const p = tw(f, 34 + k * 1.3, 16, 0, 1, inOut);
          const d = `M${xa},${y1} C${xa},${(y1 + y2) / 2} ${xb},${(y1 + y2) / 2} ${xb},${y2}`;
          return <path key={k} d={d} stroke={C.accent} strokeOpacity={0.75} strokeWidth={2.2 * u} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />;
        })}
      </svg>
      <div style={{ position: "absolute", left: W * 0.06, bottom: H * 0.06, fontFamily: fontBody, fontSize: 20 * u, color: C.muted, opacity: tw(f, 60, 12) }}>
        Real alignment of two recordings of “{sb.copy.teachSound}” by speaker {sb.voices.find((v) => v.clip === m.b)?.speaker ?? ""}, drawn on simple spectral features. Utter aligns WavLM features the same way.
      </div>
      <Sfx name="whoosh" at={32} volume={0.3} />
    </Stage>
  );
};

// ---------------------------------------------------------------- not sure
export const NotSure: React.FC = () => {
  const f = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const u = useU();
  const sb = useSB();
  const b = useBeat();
  const wide = W / H > 1.3;
  const tilt = Math.sin(Math.min(1, tw(f, 1.6 * b, 14)) * Math.PI) * 6;
  const qp = pop(f, fps, 1.7 * b, 8, 200);
  return (
    <Stage>
      <Blub shape={sb.blub} size={560 * u} x={wide ? W * 0.27 : W / 2} y={wide ? H * 0.52 : H * 0.3} mood={f < 1.6 * b ? "think" : "unsure"} rotate={tilt} look={f < 1.6 * b ? undefined : [6, -4]} />
      <div style={{ position: "absolute", left: wide ? W * 0.27 + 210 * u : W / 2 + 160 * u, top: wide ? H * 0.2 : H * 0.06, fontFamily: fontDisplay, fontWeight: 700, fontSize: 150 * u, color: C.text, transform: `scale(${qp}) rotate(${12 - 12 * qp}deg)` }}>?</div>
      <div style={{ position: "absolute", left: wide ? W * 0.5 : W * 0.08, top: wide ? H * 0.3 : H * 0.58 }}>
        <Reveal text={sb.copy.notSureA} start={4} size={96 * u} />
        <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 132 * u, letterSpacing: "-0.035em", lineHeight: 1.15, opacity: tw(f, 1.6 * b, 6) }}>
          <Mark start={1.7 * b} dur={10}>{sb.copy.notSureB}</Mark>
        </div>
        <Reveal text={sb.copy.notSureC} start={3.4 * b} size={64 * u} weight={500} color={C.muted} />
      </div>
      <Sfx name="ask" at={1.7 * b} volume={0.6} />
    </Stage>
  );
};

// ---------------------------------------------------------------- result
export const Result: React.FC = () => {
  const f = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const u = useU();
  const sb = useSB();
  const b = useBeat();
  const maxH = H * (W / H > 1.3 ? 0.6 : 0.4);
  const base = H * 0.8;
  const wide = W / H > 1.3;
  const colW = (wide ? 300 : 260) * u;
  const gap = 70 * u;
  const cols = [
    { label: "OpenAI Whisper", v: sb.numbers.whisper, col: C.blue, at: 0.6 * b },
    { label: "Utter", v: sb.numbers.utter, col: C.accent, at: 3 * b },
  ];
  const cx = W * (wide ? 0.7 : 0.5);
  const grown = tw(f, cols[1].at, 30, 0, 1, inOut);
  const utterTop = base - maxH * (sb.numbers.utter / 100) * grown;
  const land = pop(f, fps, cols[1].at + 26, 9, 200);
  const appear = pop(f, fps, cols[1].at + 2, 12, 180);
  return (
    <Stage>
      <Grid start={0} xs={[]} ys={[0.8]} color={C.line} />
      <div style={{ position: "absolute", left: W * 0.06, top: wide ? H * 0.3 : H * 0.06, maxWidth: wide ? W * 0.44 : W * 0.88 }}>
        <div>
          {sb.copy.resultTitle.split(/(?<=\.)\s+/).map((line, i) => (
            <Reveal key={i} text={line} start={4 + i * 8} size={(wide ? 68 : 52) * u} weight={600} color={i ? C.muted : C.text} />
          ))}
        </div>
        <div style={{ marginTop: 40 * u }}><Reveal text={sb.copy.resultWrong} start={7 * b} size={40 * u} weight={500} font="body" color={C.muted} tracking={0} /></div>
      </div>
      {cols.map((c, i) => {
        const p = tw(f, c.at, 30, 0, 1, inOut);
        const x = cx + (i - 0.5) * (colW + gap) - colW / 2;
        const hgt = maxH * (c.v / 100) * p;
        return (
          <React.Fragment key={c.label}>
            <div style={{ position: "absolute", left: x, top: base - hgt, width: colW, height: hgt, background: c.col, borderRadius: `${28 * u}px ${28 * u}px 0 0`, overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 22 * u, textAlign: "center", fontFamily: fontDisplay, fontWeight: 700, fontSize: 110 * u, letterSpacing: "-0.04em", color: C.ink, opacity: tw(f, c.at + 6, 6) }}>
                <Num value={c.v} start={c.at} dur={30} />
              </div>
            </div>
            <div style={{ position: "absolute", left: x, width: colW, textAlign: "center", top: base + 24 * u, fontFamily: fontBody, fontWeight: 600, fontSize: 34 * u, color: C.text, opacity: tw(f, c.at, 10) }}>{c.label}</div>
          </React.Fragment>
        );
      })}
      {/* Blub rides the Utter bar up and lands on top of it */}
      <div style={{ transform: `scale(${appear})`, transformOrigin: `${cx + 0.5 * (colW + gap)}px ${utterTop}px`, position: "absolute", inset: 0 }}>
        <Blub shape={sb.blub} size={230 * u} x={cx + 0.5 * (colW + gap)} y={utterTop - 84 * u - Math.sin(Math.min(1, land) * Math.PI) * 30 * u} mood={f > cols[1].at + 26 ? "happy" : "idle"} look={[0, -6]} />
      </div>
      <Sfx name="tick" at={cols[0].at} volume={0.5} />
      <Sfx name="impact" at={cols[1].at + 26} volume={0.6} />
    </Stage>
  );
};

// ---------------------------------------------------------------- outro: the lockup, held to the end
export const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const u = useU();
  const sb = useSB();
  const b = useBeat();
  const wide = W / H > 1.3;
  const land = pop(f, fps, 0, 12, 160);
  return (
    <Stage bg={C.page}>
      <Blub shape={sb.blub} size={420 * u * land} x={wide ? W / 2 - 330 * u : W / 2} y={wide ? H * 0.44 : H * 0.34} mood={f < 1.2 * b ? "happy" : "idle"} />
      <div style={{ position: "absolute", left: wide ? W / 2 - 110 * u : 0, right: wide ? undefined : 0, top: wide ? H * 0.44 - 130 * u : H * 0.55, display: "flex", flexDirection: "column", alignItems: wide ? "flex-start" : "center" }}>
        <Wordmark start={4} size={250 * u} />
        <div style={{ marginTop: 6 * u }}><Reveal text={sb.copy.outroTagline} start={0.9 * b} size={64 * u} weight={500} color={C.accent} /></div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: H * 0.09, textAlign: "center", fontFamily: fontBody, fontWeight: 500, fontSize: 30 * u, color: C.muted, opacity: tw(f, 1.5 * b, 12) }}>
        {sb.copy.outroFoot}
      </div>
      <Sfx name="pop" at={2} volume={0.5} />
    </Stage>
  );
};
