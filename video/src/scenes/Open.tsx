// Scene 1 "wake": the whole screen is Blub. Two small eyes open in the middle, look around,
// and the camera pulls back until the yellow becomes the logo. Then the wordmark lands.
// Scene 2 "problem": who this is for, in kinetic type on the hairline grid.
import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { Blub } from "../kit/Blub";
import { inOut, Reveal, Sfx, Stage, tw, useBeat, useSB, useU, pop } from "../kit/kit";
import { C, fontDisplay } from "../theme";

export const Wordmark: React.FC<{ start: number; size: number; color?: string }> = ({ start, size, color = C.text }) => {
  const f = useCurrentFrame();
  const letters = "utter".split("");
  return (
    <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: size, letterSpacing: "-0.045em", color, lineHeight: 1, display: "flex" }}>
      {letters.map((l, i) => {
        const p = tw(f, start + i * 2.2, 20);
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: "0.1em", marginBottom: "-0.1em" }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 110}%) rotate(${(1 - p) * 8}deg)` }}>{l}</span>
          </span>
        );
      })}
    </div>
  );
};

export const Wake: React.FC = () => {
  const f = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const u = useU();
  const sb = useSB();
  const b = useBeat();                                   // 18 frames
  const wide = W / H > 1.3;

  // camera: huge -> logo size
  const pull = tw(f, 3.5 * b, 2.2 * b, 0, 1, inOut);
  const bigS = Math.hypot(W, H) * 1.5;                   // body covers the frame
  const endS = 560 * u;
  const S = Math.exp(interpolate(pull, [0, 1], [Math.log(bigS), Math.log(endS)]));
  const fsStart = (24 * u * 500) / (13 * bigS);          // eyes ~24px tall at full screen
  const fs = interpolate(pull, [0, 1], [fsStart, sb.blub.faceScale]);
  // eyes open on the first beat, look left, right, blink, then follow the camera
  const open = f < b * 0.5 ? 0.08 : Math.min(1, 0.08 + tw(f, b * 0.5, 5) * 0.92);
  const lx = interpolate(f, [b * 1.0, b * 1.4, b * 2.0, b * 2.4, b * 3.2, b * 3.6], [0, -9, -9, 9, 9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: inOut });
  const ly = interpolate(f, [b * 2.4, b * 2.8, b * 3.2], [0, -4, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lockup = tw(f, 5.8 * b, 0.9 * b, 0, 1, inOut);
  const cx = W / 2 - lockup * (wide ? 320 : 0) * u;
  const cy = H / 2 + (wide ? 0 : -lockup * 110 * u);
  const happy = f > 6.4 * b;
  const hop = happy ? pop(f, fps, 6.4 * b, 8, 220) : 0;
  const mouth = tw(f, 4.6 * b, 10);

  return (
    <Stage bg={C.page}>
      <Blub
        shape={sb.blub}
        size={S}
        face={f < b * 0.5 ? 0 : 1}
        x={cx}
        y={cy - Math.sin(Math.min(1, hop) * Math.PI) * 30 * u}
        faceScale={fs}
        look={[lx, ly]}
        open={f > 2.8 * b && f < 3.1 * b ? 0.1 : open}
        mouth={mouth}
        mood={happy ? "happy" : "idle"}
        squash={1 + (happy ? 0.06 * Math.sin(hop * Math.PI) : 0)}
        wobble={1.2}
      />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: wide ? "flex-start" : "center", paddingLeft: wide ? W / 2 + 10 * u : 0, paddingTop: wide ? 0 : 520 * u }}>
        <Wordmark start={6.1 * b} size={230 * u} />
      </AbsoluteFill>
      <Sfx name="pop" at={b * 0.5} volume={0.7} />
      <Sfx name="whoosh" at={3.4 * b} volume={0.5} />
      <Sfx name="pop" at={6.4 * b} volume={0.5} />
    </Stage>
  );
};

/** letters that will not sit still: a picture of speech the body struggles to shape */
const Unsteady: React.FC<{ text: string; start: number; size: number }> = ({ text, start, size }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  return (
    <span style={{ display: "inline-flex", fontFamily: fontDisplay, fontWeight: 700, fontSize: size, letterSpacing: "-0.03em", color: C.text }}>
      {text.split("").map((ch, i) => {
        const p = tw(f, start + i * 1.6, 16);
        const a = 1 - tw(f, start + 40, 30) * 0.55;  // calms down a little, never fully
        const r = random(`u${i}`);
        const y = Math.sin(t * (5 + r * 4) + i * 1.3) * 0.06 * size * a;
        const rot = Math.sin(t * (3 + r * 3) + i) * 7 * a;
        const sx = 1 + Math.sin(t * (4 + r * 2) + i * 0.7) * 0.08 * a;
        return (
          <span key={i} style={{ display: "inline-block", transform: `translateY(${y + (1 - p) * size * 0.8}px) rotate(${rot}deg) scaleX(${sx})`, opacity: p }}>
            {ch === " " ? " " : ch}
          </span>
        );
      })}
    </span>
  );
};

/** "Millions of people": a field of dots, one per person, rippling out from the centre.
 *  On "speak differently" some of them start to move on their own rhythm (pink, the app's colour for words). */
const People: React.FC<{ start: number; diff: number; out: number }> = ({ start, diff, out }) => {
  const f = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const u = useU();
  const gap = 34 * u;
  const cols = Math.ceil(W / gap) + 1, rows = Math.ceil(H / gap) + 1;
  const cx = W / 2, cy = H / 2;
  const maxD = Math.hypot(cx, cy);
  const fade = 1 - tw(f, out, 16);
  const t = f / fps;
  const dots: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * gap + (r % 2) * gap / 2, y = r * gap;
      const d = Math.hypot(x - cx, y - cy) / maxD;
      const a = tw(f, start + d * 26, 14);
      if (a <= 0) continue;
      const odd = random(`p${r}-${c}`) < 0.16;
      const k = odd ? tw(f, diff + random(`q${r}-${c}`) * 14, 12) : 0;
      const ph = random(`w${r}-${c}`) * 6.28;
      const jx = k * Math.sin(t * (3 + 3 * random(`s${r}-${c}`)) + ph) * 5 * u;
      const jy = k * Math.cos(t * (2.4 + 3 * random(`v${r}-${c}`)) + ph) * 5 * u;
      const rad = (2.6 + k * 1.6 * (0.6 + 0.4 * Math.sin(t * 5 + ph))) * u;
      dots.push(<circle key={r * cols + c} cx={x + jx} cy={y + jy} r={rad * a} fill={k > 0.3 ? C.pink : C.text} opacity={(k > 0.3 ? 0.85 : 0.13) * fade} />);
    }
  }
  return <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>{dots}</svg>;
};

export const Problem: React.FC = () => {
  const f = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = useU();
  const sb = useSB();
  const b = useBeat();
  const x0 = W * (W / H > 1.3 ? 0.12 : 0.08);
  const lift = tw(f, 3.4 * b, 0.8 * b, 0, 1, inOut);
  const conds = sb.copy.problemB;
  const bigAt = 8.3 * b;
  const word = sb.copy.problemC.replace(/\.$/, "").split(" ");
  const last = word.pop() ?? "";
  return (
    <Stage>
      <People start={0} diff={18} out={3.3 * b} />
      <div style={{ position: "absolute", left: x0, top: H * 0.42 - lift * 200 * u, opacity: 1 - lift * 0.62 - tw(f, bigAt - 6, 8) * 0.38 }}>
        <Reveal text={sb.copy.problemA} start={4} size={100 * u} style={{ maxWidth: W - 2 * x0 }} />
      </div>
      <div style={{ position: "absolute", left: x0, top: H * 0.42, display: "flex", flexWrap: "wrap", gap: `${10 * u}px ${44 * u}px`, maxWidth: W - 2 * x0 }}>
        {conds.map((c, i) => (
          <Reveal key={i} text={c} start={(4 + i) * b} size={70 * u} weight={500} color={i % 2 ? C.text : C.muted} out={bigAt - 8} />
        ))}
      </div>
      <div style={{ position: "absolute", left: x0, top: H * 0.36 }}>
        <Reveal text={word.join(" ")} start={bigAt} size={64 * u} weight={500} color={C.muted} />
        <Unsteady text={last + "."} start={bigAt + 6} size={190 * u} />
      </div>
      {conds.map((_, i) => <Sfx key={i} name="tick" at={(4 + i) * b} volume={0.6} />)}
      <Sfx name="whoosh" at={bigAt - 6} volume={0.35} />
    </Stage>
  );
};
