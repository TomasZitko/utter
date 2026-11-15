// Blub, the Utter logo, driven by the frame number instead of requestAnimationFrame.
// Geometry is the same as app/static/brand.js (blobPath, eyes, mouths), so the film and the app
// stay one character. Change the shape in the storyboard's "blub" block (or in the Studio props).
import React from "react";
import { random, useCurrentFrame, useVideoConfig } from "remotion";

const INK = "#141414";
const CREAM = "#F3EBDD";

export type Mood = "idle" | "listen" | "happy" | "speak" | "unsure" | "sad" | "think";
export type BlubShape = { color: string; R: number; lobes: number; amp: number; faceY: number; faceScale: number; wobble: number };

export function blobPath(cx: number, cy: number, R: number, seed: number, t: number, wob: number) {
  const n = 36;
  const pts: [number, number][] = [];
  const k = seed * 1.7;
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const r = R * (1 + 0.045 * Math.sin(2 * th + k) + 0.025 * Math.sin(3 * th + k * 2.3)
      + wob * (0.022 * Math.sin(2 * th + t * 0.9) + 0.016 * Math.sin(3 * th - t * 0.7) + 0.01 * Math.sin(4 * th + t * 1.2)));
    pts.push([cx + r * 1.04 * Math.sin(th), cy - r * 0.96 * Math.cos(th)]);
  }
  const f = (p: [number, number]) => p[0].toFixed(2) + " " + p[1].toFixed(2);
  let d = "M" + f(pts[0]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += "C" + f([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]) + " " + f([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]) + " " + f(p2);
  }
  return d + "Z";
}

const Eye: React.FC<{ mood: Mood }> = ({ mood }) => {
  if (mood === "listen") return (<><circle r={16} fill={CREAM} stroke={INK} strokeWidth={4} /><circle cx={2} cy={-4} r={8} fill={INK} /></>);
  if (mood === "happy") return <path d="M-15 5 Q0 -14 15 5" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />;
  return (<><ellipse rx={10} ry={13} fill={INK} /><circle cx={3} cy={-5} r={3.5} fill={CREAM} /></>);
};

const Mouth: React.FC<{ mood: Mood; t: number }> = ({ mood, t }) => {
  if (mood === "think") return (<>{[-16, 0, 16].map((x, i) => <circle key={x} cx={x} cy={2} r={5} fill={INK} opacity={0.35 + 0.65 * Math.max(0, Math.sin(t * 5 - i * 0.9))} />)}</>);
  if (mood === "listen") return <ellipse cx={0} cy={2} rx={8} ry={10} fill={INK} />;
  if (mood === "speak") return <ellipse cx={0} cy={2} rx={13} ry={11} fill={INK} />;
  if (mood === "happy") return <path d="M-30 -8 L30 -8 Q26 22 0 22 Q-26 22 -30 -8Z" fill={INK} />;
  if (mood === "unsure") return <path d="M-22 4 Q-11 -5 0 4 Q11 13 22 2" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />;
  if (mood === "sad") return <path d="M-18 10 Q0 -6 18 10" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />;
  return <path d="M-18 -4 Q0 12 18 -4" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />;
};

/** Deterministic blink: returns eye openness 0.08..1 at time t (seconds). */
export function autoBlink(t: number, seed: string) {
  const period = 3.1;
  const cycle = Math.floor(t / period);
  for (const c of [cycle, cycle - 1]) {
    const start = c * period + 0.6 + random(`${seed}-${c}`) * 1.6;
    for (const s of random(`${seed}-d-${c}`) < 0.3 ? [start, start + 0.28] : [start]) {
      const k = (t - s) / 0.17;
      if (k >= 0 && k < 1) return Math.max(0.08, Math.abs(1 - 2 * k));
    }
  }
  return 1;
}

export type BlubProps = {
  shape: BlubShape;
  size: number;                 // px of the 500-unit box
  mood?: Mood;
  x?: number; y?: number;       // centre, px (absolute in parent)
  t?: number;                   // seconds; defaults to the frame clock
  look?: [number, number];      // pupil offset in face units (about -10..10)
  open?: number;                // eye openness override 0..1 (otherwise auto blink)
  talk?: number;                // mouth vertical scale override
  face?: number;                // face opacity 0..1
  mouth?: number;               // mouth opacity 0..1
  faceScale?: number;           // override the shape's face scale
  squash?: number;              // 1 = none, >1 wider/shorter
  wobble?: number;              // override wobble
  rotate?: number;
  seed?: string;
  style?: React.CSSProperties;
};

export const Blub: React.FC<BlubProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = p.t ?? frame / fps;
  const mood = p.mood ?? "idle";
  const s = p.faceScale ?? p.shape.faceScale;
  const g = 34 * s;
  const fy = p.shape.faceY;
  const open = p.open ?? (mood === "happy" ? 1 : autoBlink(t, p.seed ?? "blub"));
  const lx = p.look ? p.look[0] : Math.sin(t * 0.7) * 4 + Math.sin(t * 0.23) * 4;
  const ly = p.look ? p.look[1] : Math.sin(t * 0.5) * 2.5;
  const talk = p.talk ?? (mood === "listen" || mood === "speak" ? 0.55 + 0.45 * Math.abs(Math.sin(t * (mood === "speak" ? 6 : 3.5))) : 1);
  const sq = p.squash ?? 1;
  const box = p.size;
  return (
    <svg
      viewBox="0 0 500 500"
      width={box}
      height={box}
      style={{
        position: "absolute", left: (p.x ?? 0) - box / 2, top: (p.y ?? 0) - box / 2, overflow: "visible",
        transform: `rotate(${p.rotate ?? 0}deg) scale(${sq}, ${1 / sq})`, transformOrigin: "50% 80%", ...p.style,
      }}
    >
      <path d={blobPath(250, 250, p.shape.R, p.shape.lobes, t, p.wobble ?? p.shape.wobble)} fill={p.shape.color} />
      <g opacity={p.face ?? 1}>
        <g transform={`translate(${250 - g + lx},${fy + ly}) scale(${s},${s * open})`}><Eye mood={mood} /></g>
        <g transform={`translate(${250 + g + lx},${fy + ly}) scale(${s},${s * open})`}><Eye mood={mood} /></g>
        <g opacity={p.mouth ?? 1} transform={`translate(${250 + lx * 0.6},${fy + ly + 30 * s}) scale(${s},${s * talk})`}><Mouth mood={mood} t={t} /></g>
      </g>
    </svg>
  );
};
