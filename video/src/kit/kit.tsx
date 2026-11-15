// The motion kit: every scene is built from these. All values are derived from the frame number.
import React, { createContext, useContext } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Easing, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fontBody, fontDisplay } from "../theme";
import type { Storyboard } from "../schema";

// ---------------------------------------------------------------- storyboard context
export const SB = createContext<Storyboard | null>(null);
export const useSB = () => useContext(SB)!;
/** frames per beat from the storyboard tempo (100 BPM at 30 fps = 18) */
export const useBeat = () => {
  const sb = useSB();
  return Math.round((sb.fps * 60) / sb.bpm);
};
/** 1 unit = 1px on a 1080-tall frame; scales the whole film for other sizes */
export const useU = () => {
  const { width, height } = useVideoConfig();
  return Math.min(width, height) / 1080;
};

// ---------------------------------------------------------------- easing + tweens
export const outExpo = Easing.bezier(0.16, 1, 0.3, 1);
export const inOut = Easing.bezier(0.5, 0, 0.2, 1);           // the app's --ease
export const inExpo = Easing.bezier(0.7, 0, 0.84, 0);
export const tw = (f: number, start: number, dur: number, from = 0, to = 1, easing = outExpo) =>
  interpolate(f, [start, start + dur], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
/** spring settle 0 -> 1 with a controlled overshoot (lower damping = more bounce) */
export const pop = (f: number, fps: number, start: number, damping = 13, stiffness = 170) =>
  spring({ frame: f - start, fps, config: { damping, stiffness, mass: 0.9 } });

// ---------------------------------------------------------------- stage: background, vignette, grain
export const Stage: React.FC<{ children?: React.ReactNode; bg?: string; grain?: boolean }> = ({ children, bg = C.bg, grain = true }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
      {children}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 60%, rgba(0,0,0,.22) 100%)", pointerEvents: "none" }} />
      {grain ? (
        <AbsoluteFill style={{ opacity: 0.07, mixBlendMode: "overlay", pointerEvents: "none" }}>
          <svg width="100%" height="100%">
            <filter id={`g${f % 4}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={f % 4} /></filter>
            <rect width="100%" height="100%" filter={`url(#g${f % 4})`} />
          </svg>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- hairline grid (draws in from its centre)
export const Grid: React.FC<{ start?: number; xs?: number[]; ys?: number[]; color?: string; out?: number }> = ({ start = 0, xs = [0.25, 0.75], ys = [0.3, 0.7], color = C["line-soft"], out }) => {
  const f = useCurrentFrame();
  const p = tw(f, start, 30, 0, 1, inOut);
  const o = out !== undefined ? 1 - tw(f, out, 10) : 1;
  return (
    <AbsoluteFill style={{ opacity: o }}>
      {xs.map((x, i) => (
        <div key={"x" + i} style={{ position: "absolute", left: `${x * 100}%`, top: `${50 - 50 * p}%`, height: `${100 * p}%`, width: 1, background: color }} />
      ))}
      {ys.map((y, i) => (
        <div key={"y" + i} style={{ position: "absolute", top: `${y * 100}%`, left: `${50 - 50 * p}%`, width: `${100 * p}%`, height: 1, background: color }} />
      ))}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- type
type RevealProps = {
  text: string; start: number; size: number; weight?: number; color?: string; font?: "display" | "body";
  stagger?: number; dur?: number; out?: number; align?: "left" | "center" | "right"; style?: React.CSSProperties;
  tracking?: number; lineHeight?: number;
};
/** words rise out of a mask one after another; `out` sends them up and away */
export const Reveal: React.FC<RevealProps> = ({ text, start, size, weight = 600, color = C.text, font = "display", stagger = 2.5, dur = 18, out, align = "left", style, tracking = -0.025, lineHeight = 1.06 }) => {
  const f = useCurrentFrame();
  const words = text.split(" ");
  return (
    <div style={{ fontFamily: font === "display" ? fontDisplay : fontBody, fontSize: size, fontWeight: weight, color, letterSpacing: `${tracking}em`, lineHeight, textAlign: align, ...style }}>
      {words.map((w, i) => {
        const a = tw(f, start + i * stagger, dur);
        const b = out !== undefined ? tw(f, out + i * stagger * 0.5, 12, 0, 1, inExpo) : 0;
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: "0.08em", marginBottom: "-0.08em" }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - a) * 105 - b * 105}%)`, opacity: a < 0.01 ? 0 : 1 }}>
              {w}{i < words.length - 1 ? " " : ""}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/** highlighter swipe (the reference's yellow marker), ink text on the brand yellow */
export const Mark: React.FC<{ children: React.ReactNode; start: number; dur?: number; color?: string; ink?: string; base?: string }> = ({ children, start, dur = 12, color = C.accent, ink = C.ink, base = C.text }) => {
  const f = useCurrentFrame();
  const p = tw(f, start, dur, 0, 1, inOut);
  return (
    <span style={{
      background: `linear-gradient(${color}, ${color}) no-repeat 0 0 / ${p * 100}% 100%`,
      color: p > 0.45 ? ink : base, padding: "0 0.12em", margin: "0 -0.06em", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone",
    }}>{children}</span>
  );
};

export const Kicker: React.FC<{ text: string; start: number; color?: string; out?: number }> = ({ text, start, color = C.muted, out }) => {
  const f = useCurrentFrame();
  const u = useU();
  const o = tw(f, start, 14) * (out !== undefined ? 1 - tw(f, out, 8) : 1);
  return (
    <div style={{ fontFamily: fontBody, fontSize: 22 * u, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color, opacity: o, display: "flex", alignItems: "center", gap: 14 * u }}>
      <span style={{ width: 28 * u * tw(f, start, 20), height: 2 * u, background: C.accent, display: "inline-block" }} />
      {text}
    </div>
  );
};

// ---------------------------------------------------------------- waveform from real peaks
export const Wave: React.FC<{ peaks: number[]; width: number; height: number; progress?: number; grow?: number; color?: string; dim?: string; bar?: number; gap?: number }> = ({ peaks, width, height, progress = 1, grow = 1, color = C.accent, dim = C["line-mid"], bar, gap = 0.45 }) => {
  const n = peaks.length;
  const step = width / n;
  const bw = bar ?? step * (1 - gap);
  return (
    <svg width={width} height={height} style={{ overflow: "visible", display: "block" }}>
      {peaks.map((p, i) => {
        const g = Math.max(0, Math.min(1, grow * n - i * 0.6)) ;
        const h = Math.max(bw, (0.06 + 0.94 * Math.pow(p, 0.7)) * height * Math.min(1, g));
        return <rect key={i} x={i * step + (step - bw) / 2} y={(height - h) / 2} width={bw} height={h} rx={bw / 2} fill={i / n <= progress ? color : dim} />;
      })}
    </svg>
  );
};

// ---------------------------------------------------------------- audio helpers (placed in scene-local frames)
export const Sfx: React.FC<{ name: string; at: number; volume?: number }> = ({ name, at, volume = 0.8 }) => (
  <Sequence from={Math.round(at)} layout="none" name={`sfx ${name}`}>
    <Audio src={staticFile(`audio/sfx_${name}.wav`)} volume={volume} />
  </Sequence>
);
export const Voice: React.FC<{ clip: string; at: number; volume?: number }> = ({ clip, at, volume = 1 }) => (
  <Sequence from={Math.round(at)} layout="none" name={`voice ${clip}`}>
    <Audio src={staticFile(`voices/${clip}.wav`)} volume={volume} />
  </Sequence>
);

export const Num: React.FC<{ value: number; start: number; dur?: number; suffix?: string }> = ({ value, start, dur = 30, suffix = "%" }) => {
  const f = useCurrentFrame();
  return <>{Math.round(tw(f, start, dur, 0, value, Easing.bezier(0.2, 0.7, 0.2, 1)))}{suffix}</>;
};
