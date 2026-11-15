// v2: the REAL Utter app, captured by scripts/capture_app.mjs (Chrome with a real TORGO recording as
// its microphone) and cut here into shots: a phone with a moving 3D camera, tap ripples where the real
// taps happened, and one line of type beside it. Source times come from generated/app.json (events
// logged during capture), so a re-capture keeps the cuts on the right moments.
import React from "react";
import { AbsoluteFill, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import app from "../generated/app.json";
import { inOut, Mark, Reveal, Sfx, Stage, tw, useSB, useU, Voice } from "../kit/kit";
import { C, fontBody, fontDisplay } from "../theme";

type ClipMeta = { w: number; h: number; dur: number; events: Record<string, number> };
const APP = app as Record<string, ClipMeta>;

type Seg = { from: number; to: number; rate?: number };   // seconds of the source clip
type Cam = { f: number; s: number; fx?: number; fy?: number; ry?: number; rx?: number; dx?: number; dy?: number };
type Tap = { f: number; x: number; y: number };            // x, y: 0..1 of the screen
type Line = { f: number; text: string };

const SRC_FPS = 30;

/** frames each segment takes in the film */
const segFrames = (s: Seg) => Math.round(((s.to - s.from) / (s.rate ?? 1)) * SRC_FPS);
export const segStarts = (segs: Seg[]) => segs.reduce<number[]>((a, s, i) => [...a, i ? a[i - 1] + segFrames(segs[i - 1]) : 0], []);
/** where a source time lands in the film (frames), given the cut */
const at = (segs: Seg[], t: number) => {
  const st = segStarts(segs);
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (t >= s.from && t <= s.to) return st[i] + ((t - s.from) / (s.rate ?? 1)) * SRC_FPS;
  }
  return 0;
};

const camAt = (f: number, cams: Cam[]) => {
  const k = cams.findIndex((c) => c.f > f);
  if (k === 0) return cams[0];
  if (k === -1) return cams[cams.length - 1];
  const a = cams[k - 1], b = cams[k];
  const p = interpolate(f, [a.f, b.f], [0, 1], { easing: inOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const m = (x?: number, y?: number, d = 0) => (x ?? d) + ((y ?? d) - (x ?? d)) * p;
  return { f, s: m(a.s, b.s, 1), fx: m(a.fx, b.fx, 0.5), fy: m(a.fy, b.fy, 0.5), ry: m(a.ry, b.ry), rx: m(a.rx, b.rx), dx: m(a.dx, b.dx), dy: m(a.dy, b.dy) };
};

const Phone: React.FC<{ clip: string; segs: Seg[]; cams: Cam[]; taps: Tap[]; anchorX: number }> = ({ clip, segs, cams, taps, anchorX }) => {
  const f = useCurrentFrame();
  const { height: H } = useVideoConfig();
  const u = useU();
  const meta = APP[clip];
  const ph = 860 * u;
  const pw = (ph * meta.w) / meta.h;
  const c = camAt(f, cams);
  const st = segStarts(segs);
  // focus point (fx, fy of the screen) is pulled toward the anchor as the camera pushes in
  const pull = Math.min(1, Math.max(0, (c.s - 1) * 2.2));
  const ox = -(c.fx! - 0.5) * pw * c.s * pull;
  const oy = -(c.fy! - 0.5) * ph * c.s * pull;
  const bez = 13 * u;
  return (
    <div style={{ position: "absolute", left: anchorX, top: H / 2, perspective: 2600 * u }}>
      <div style={{
        position: "absolute", left: -pw / 2 - bez, top: -ph / 2 - bez, width: pw + bez * 2, height: ph + bez * 2,
        transform: `translate(${ox + (c.dx ?? 0) * u}px, ${oy + (c.dy ?? 0) * u}px) rotateY(${c.ry}deg) rotateX(${c.rx}deg) scale(${c.s})`,
        transformStyle: "preserve-3d", borderRadius: 66 * u, background: "#0A0A09",
        boxShadow: `0 ${60 * u}px ${140 * u}px rgba(0,0,0,.55), 0 0 0 ${1.5 * u}px rgba(243,235,221,.14) inset`,
      }}>
        <div style={{ position: "absolute", left: bez, top: bez, width: pw, height: ph, borderRadius: 54 * u, overflow: "hidden", background: C.bg }}>
          {segs.map((s, i) => (
            <Sequence key={i} from={st[i]} durationInFrames={segFrames(s)} layout="none">
              <OffthreadVideo src={staticFile(`app/${clip}.mp4`)} muted trimBefore={Math.round(s.from * SRC_FPS)} playbackRate={s.rate ?? 1}
                style={{ width: pw, height: ph, display: "block" }} />
            </Sequence>
          ))}
          {taps.map((t, i) => {
            const k = f - t.f;
            if (k < -8 || k > 22) return null;
            const press = k < 0 ? tw(f, t.f - 8, 8) : 1 - tw(f, t.f, 14);
            const ring = tw(f, t.f, 18);
            return (
              <React.Fragment key={i}>
                <div style={{ position: "absolute", left: t.x * pw, top: t.y * ph, width: 64 * u, height: 64 * u, marginLeft: -32 * u, marginTop: -32 * u, borderRadius: "50%", background: "rgba(20,20,20,.28)", border: `${3 * u}px solid rgba(243,235,221,.9)`, transform: `scale(${0.6 + 0.4 * press - (k > 0 ? 0.15 * Math.sin(Math.min(1, k / 5) * Math.PI) : 0)})`, opacity: press }} />
                {k >= 0 ? <div style={{ position: "absolute", left: t.x * pw, top: t.y * ph, width: 64 * u, height: 64 * u, marginLeft: -32 * u, marginTop: -32 * u, borderRadius: "50%", border: `${2 * u}px solid rgba(243,235,221,.8)`, transform: `scale(${1 + ring * 1.6})`, opacity: 1 - ring }} /> : null}
              </React.Fragment>
            );
          })}
        </div>
        {/* glass: a soft sheen that drifts with the camera */}
        <div style={{ position: "absolute", inset: bez, borderRadius: 54 * u, pointerEvents: "none", background: `linear-gradient(${115 + (c.ry ?? 0) * 2}deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,0) 38%)` }} />
      </div>
    </div>
  );
};

/** one line at a time; *stars* mark the words for the yellow highlighter (always the end of the line) */
const Lines: React.FC<{ lines: Line[]; x: number; maxW: number; end: number; stack?: boolean }> = ({ lines, x, maxW, end, stack }) => {
  const f = useCurrentFrame();
  const { height: H } = useVideoConfig();
  const u = useU();
  return (
    <>
      {lines.map((l, i) => {
        const next = stack ? end : (lines[i + 1]?.f ?? end);
        if (f < l.f - 1 || (!stack && f > next + 2)) return null;
        const parts = l.text.split("*");
        const plain = parts.filter((_, k) => k % 2 === 0).join("").trim();
        const marked = parts.filter((_, k) => k % 2 === 1).join(" ");
        const top = stack ? H * 0.34 + i * 128 * u : H / 2 - 110 * u;
        return (
          <div key={i} style={{ position: "absolute", left: x, top, width: maxW }}>
            {plain ? <Reveal text={plain} start={l.f} size={(stack && i === 2 ? 64 : 96) * u} out={stack ? undefined : next - 10} color={stack && i === 2 ? C.muted : C.text} weight={stack && i === 2 ? 500 : 600} /> : null}
            {marked ? (
              <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 104 * u, letterSpacing: "-0.035em", lineHeight: 1.12, opacity: tw(f, l.f + 6, 4) * (stack ? 1 : 1 - tw(f, next - 8, 6)), marginTop: 4 * u }}>
                <Mark start={l.f + 8} dur={10}>{marked}</Mark>
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
};

const Note: React.FC = () => {
  const sb = useSB();
  const { width: W, height: H } = useVideoConfig();
  const u = useU();
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: W * 0.06, bottom: H * 0.05, maxWidth: W * 0.4, fontFamily: fontBody, fontSize: 21 * u, color: C.muted, opacity: 0.85 * tw(f, 10, 12) }}>
      {sb.copy.appNote}
    </div>
  );
};

const Shot: React.FC<{ clip: string; segs: Seg[]; cams: Cam[]; taps: Tap[]; lines: Line[]; stack?: boolean; children?: React.ReactNode }> = ({ clip, segs, cams, taps, lines, stack, children }) => {
  const { width: W, height: H, durationInFrames } = useVideoConfig();
  const wide = W / H > 1.3;
  const u = useU();
  return (
    <Stage>
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${wide ? 68 : 50}% 50%, ${C.accent}1c 0%, transparent 46%)` }} />
      <Phone clip={clip} segs={segs} cams={cams} taps={taps} anchorX={wide ? W * 0.68 : W / 2} />
      {wide ? <Lines lines={lines} x={W * 0.06} maxW={W * 0.42 - 20 * u} end={durationInFrames} stack={stack} /> : null}
      <Note />
      {children}
    </Stage>
  );
};

// ---------------------------------------------------------------- teach "Tired" with three real takes
export const AppTeach: React.FC = () => {
  const sb = useSB();
  const e = APP.teach.events;
  const segs: Seg[] = [
    { from: e.home + 0.4, to: e.teach1 + 0.43 },          // home, tap Teach
    { from: e.teach1 + 0.43, to: e.teach2 + 0.1 },        // "What should this sound mean?" -> Tired -> Record
    { from: e.record1 - 0.38, to: e.record1 + 1.82 },     // first take, real time
    { from: e.record1 + 1.82, to: e.teach3, rate: 4 },    // the other takes, fast
    { from: e.teach3, to: e.teach3 + 1.8 },               // "Tired is now part of your language"
  ];
  const T = (t: number) => at(segs, t);
  const taps: Tap[] = [
    { f: T(e.teach1) - 2, x: 0.49, y: 0.925 },
    { f: T(e.picked) - 2, x: 0.8, y: 0.594 },
    { f: T(e.teach2) - 2, x: 0.5, y: 0.8 },
    { f: T(e.record1) - 1, x: 0.5, y: 0.762 },
  ];
  const cams: Cam[] = [
    { f: 0, s: 0.82, ry: -24, rx: 6, dx: 160, dy: 40 },
    { f: 34, s: 1, ry: -8, rx: 2 },
    { f: T(e.teach1) + 14, s: 1.38, fx: 0.62, fy: 0.37, ry: -4 },
    { f: T(e.picked) + 18, s: 1.42, fx: 0.55, fy: 0.62, ry: -4 },
    { f: T(e.teach2) + 14, s: 1.3, fx: 0.5, fy: 0.66, ry: 2 },
    { f: T(e.record1 + 1.8), s: 1.02, ry: 9, rx: -2 },
    { f: T(e.teach3) - 4, s: 1.05, ry: 4 },
    { f: T(e.teach3) + 18, s: 1.3, fx: 0.5, fy: 0.56, ry: -3 },
  ];
  const c = sb.copy;
  const lines: Line[] = [
    { f: 4, text: c.appTeachA ?? "" },
    { f: Math.round(T(e.teach1) + 4), text: c.appTeachB ?? "" },
    { f: Math.round(T(e.teach2) + 6), text: (c.appTeachC ?? "").replace("Three times.", "*Three times.*") },
    { f: Math.round(T(e.teach3) + 4), text: (c.appTeachD ?? "").replace("your language.", "*your language.*") },
  ];
  const v = sb.appVoices;
  return (
    <Shot clip="teach" segs={segs} cams={cams} taps={taps} lines={lines}>
      {taps.map((t, i) => <Sfx key={i} name="tick" at={t.f} volume={0.5} />)}
      {v ? <Voice clip={v.teach[0]} at={T(e.record1) + 12} /> : null}
      <Sfx name="right" at={T(e.teach3)} volume={0.45} />
    </Shot>
  );
};

// ---------------------------------------------------------------- a NEW recording -> "Tired?" -> it speaks
export const AppListen: React.FC = () => {
  const sb = useSB();
  const e = APP.listen.events;
  const segs: Seg[] = [
    { from: e.home + 0.4, to: e.listen + 0.2 },           // home, tap Start listening
    { from: e.listen + 0.2, to: e.answer + 0.75, rate: 1.4 },  // listening, comparing, the guess
    { from: e.answer + 0.75, to: e.speak + 0.2 },         // "Tired? 94%" + what Whisper heard, tap Yes
    { from: e.speak + 0.2, to: e.speak + 3.0 },           // "I'm tired. I'd like to rest."
  ];
  const T = (t: number) => at(segs, t);
  const taps: Tap[] = [
    { f: T(e.listen) - 2, x: 0.5, y: 0.63 },
    { f: T(e.speak) - 2, x: 0.49, y: 0.848 },
  ];
  const cams: Cam[] = [
    { f: 0, s: 0.84, ry: 22, rx: 5, dx: 220, dy: 30 },
    { f: 26, s: 1, ry: 6 },
    { f: T(e.listen) + 16, s: 1.3, fx: 0.5, fy: 0.52, ry: -4 },
    { f: T(e.answer) - 8, s: 1.3, fx: 0.5, fy: 0.52, ry: -2 },
    { f: T(e.answer) + 14, s: 1.5, fx: 0.5, fy: 0.62, ry: -3 },
    { f: T(e.speak) - 6, s: 1.35, fx: 0.5, fy: 0.74 },
    { f: T(e.speak) + 16, s: 1.12, fx: 0.5, fy: 0.5, ry: -6 },
  ];
  const c = sb.copy;
  const lines: Line[] = [
    { f: 4, text: c.appListenA ?? "" },
    { f: Math.round(T(e.answer)), text: (c.appListenB ?? "").replace("guess.", "*guess.*") },
    { f: Math.round(T(e.speak) + 2), text: (c.appListenC ?? "").replace("for you.", "*for you.*") },
  ];
  const v = sb.appVoices;
  return (
    <Shot clip="listen" segs={segs} cams={cams} taps={taps} lines={lines}>
      {taps.map((t, i) => <Sfx key={i} name="tick" at={t.f} volume={0.5} />)}
      {v ? <Voice clip={v.listen} at={T(e.listen) + 10} /> : null}
      <Sfx name="pop" at={T(e.answer)} volume={0.45} />
      {v ? <Voice clip={v.tts} at={T(e.speak) + 6} volume={0.9} /> : null}
    </Shot>
  );
};

// ---------------------------------------------------------------- a sound it was never taught: "Not sure..."
export const AppUnsure: React.FC = () => {
  const sb = useSB();
  const e = APP.unsure.events;
  const segs: Seg[] = [
    { from: e.listen - 0.25, to: e.result - 0.05, rate: 4 },
    { from: e.result - 0.05, to: e.result + 3.25 },
  ];
  const T = (t: number) => at(segs, t);
  const cams: Cam[] = [
    { f: 0, s: 1.02, ry: -10, rx: 2 },
    { f: T(e.answer), s: 1.04, ry: -6 },
    { f: T(e.answer) + 20, s: 1.38, fx: 0.5, fy: 0.62, ry: -3 },
  ];
  const c = sb.copy;
  const lines: Line[] = [
    { f: 4, text: c.notSureA },
    { f: Math.round(T(e.answer)) + 6, text: `*${c.notSureB}*` },
    { f: Math.round(T(e.answer)) + 30, text: c.notSureC },
  ];
  const v = sb.appVoices;
  return (
    <Shot clip="unsure" segs={segs} cams={cams} taps={[]} lines={lines} stack>
      {v ? <Voice clip={v.unsure} at={3} volume={0.9} /> : null}
      <Sfx name="ask" at={T(e.answer)} volume={0.55} />
    </Shot>
  );
};
