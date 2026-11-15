// v3: the real Utter app, presented calmly. One centred phone on the plain stage, real-time footage
// joined by short dissolves (never sped up), the app's own recordings as sound, and a camera that only
// makes slow, deliberate moves. A short title opens each shot and makes way for the phone.
// Footage: scripts/capture_app.mjs (Chrome with real TORGO takes as the microphone).
import React from "react";
import { Audio } from "@remotion/media";
import { interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import app from "../generated/app.json";
import { Grid, inOut, Reveal, Sfx, Stage, tw, useSB, useU } from "../kit/kit";
import { C } from "../theme";

type ClipMeta = { w: number; h: number; dur: number; events: Record<string, number>; audio?: string[] };
const APP = app as Record<string, ClipMeta>;
const FPS = 30;
const XF = 5;                     // dissolve between cuts, frames
const INTRO = 40;                 // title, then the phone rises

type Seg = { from: number; to: number };                       // seconds of the source clip
type Key = { at: number; s?: number; fy?: number };            // at: seconds of the source clip
type Tap = { t: number; x: number; y: number };                // t: seconds of the source clip
type Snd = { t: number; src: string; volume?: number };        // t: source seconds; src: path in public/

const len = (s: Seg) => Math.round((s.to - s.from) * FPS);
const starts = (segs: Seg[]) => segs.reduce<number[]>((a, s, i) => [...a, i ? a[i - 1] + len(segs[i - 1]) : INTRO], []);
/** film frame (scene-local) of a source time */
const frameOf = (segs: Seg[], t: number) => {
  const st = starts(segs);
  let best = st[0];
  segs.forEach((s, i) => { if (t >= s.from - 0.01 && t <= s.to + 0.01) best = st[i] + (t - s.from) * FPS; });
  return best;
};

const Phone: React.FC<{ clip: string; segs: Seg[]; keys: Key[]; taps: Tap[] }> = ({ clip, segs, keys, taps }) => {
  const f = useCurrentFrame();
  const { width: W, height: H, durationInFrames: D } = useVideoConfig();
  const u = useU();
  const meta = APP[clip];
  const ph = 820 * u;
  const pw = (ph * meta.w) / meta.h;
  const st = starts(segs);
  // rise in, then a camera that eases between a few held positions
  const rise = tw(f, INTRO - 34, 40, 0, 1, inOut);
  const kf = keys.map((k) => ({ f: frameOf(segs, k.at), s: k.s ?? 1, fy: k.fy ?? 0.5 }));
  const s = kf.length > 1 ? interpolate(f, kf.map((k) => k.f), kf.map((k) => k.s), { easing: inOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const fy = kf.length > 1 ? interpolate(f, kf.map((k) => k.f), kf.map((k) => k.fy), { easing: inOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0.5;
  const drift = interpolate(f, [0, D], [5, -3]);          // a slow turn over the whole shot, nothing sudden
  // keep the focused part of the screen in view as the camera pushes in (continuous in s and fy)
  const ty = (1 - rise) * (H * 0.75) - (fy - 0.5) * ph * s * 0.6 * Math.min(1, Math.max(0, (s - 1) / 0.12));
  const bez = 14 * u;
  return (
    <div style={{ position: "absolute", left: W / 2, top: H / 2, perspective: 3000 * u }}>
      <div style={{
        position: "absolute", left: -pw / 2 - bez, top: -ph / 2 - bez, width: pw + bez * 2, height: ph + bez * 2,
        transform: `translateY(${ty}px) rotateY(${drift}deg) rotateX(${(1 - rise) * 14}deg) scale(${s})`,
        borderRadius: 70 * u, background: "#0A0A09",
        boxShadow: `0 ${50 * u}px ${120 * u}px rgba(0,0,0,.6), 0 0 0 ${1.5 * u}px rgba(243,235,221,.13) inset`,
      }}>
        <div style={{ position: "absolute", left: bez, top: bez, width: pw, height: ph, borderRadius: 57 * u, overflow: "hidden", background: C.bg }}>
          {segs.map((sg, i) => {
            const from = st[i] - (i ? XF : 0);
            return (
              <Sequence key={i} from={from} durationInFrames={len(sg) + (i ? XF : 0) + (i === segs.length - 1 ? 600 : 0)} layout="none">
                <Fade first={i === 0}>
                  <OffthreadVideo src={staticFile(`app/${clip}.mp4`)} muted trimBefore={Math.max(0, Math.round(sg.from * FPS) - (i ? XF : 0))}
                    style={{ width: pw, height: ph, display: "block" }} />
                </Fade>
              </Sequence>
            );
          })}
          {taps.map((t, i) => {
            const tf = frameOf(segs, t.t);
            const k = f - tf;
            if (k < -6 || k > 20) return null;
            const press = k < 0 ? tw(f, tf - 6, 6) : 1 - tw(f, tf + 2, 12);
            const ring = tw(f, tf, 18);
            return (
              <React.Fragment key={i}>
                <div style={{ position: "absolute", left: t.x * pw, top: t.y * ph, width: 58 * u, height: 58 * u, marginLeft: -29 * u, marginTop: -29 * u, borderRadius: "50%", background: "rgba(243,235,221,.32)", transform: `scale(${0.75 + 0.25 * press})`, opacity: press }} />
                {k >= 0 ? <div style={{ position: "absolute", left: t.x * pw, top: t.y * ph, width: 58 * u, height: 58 * u, marginLeft: -29 * u, marginTop: -29 * u, borderRadius: "50%", border: `${2 * u}px solid rgba(243,235,221,.7)`, transform: `scale(${1 + ring * 1.3})`, opacity: 1 - ring }} /> : null}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** each later cut dissolves in over XF frames (local frame 0..XF of its Sequence) */
const Fade: React.FC<{ first: boolean; children: React.ReactNode }> = ({ first, children }) => {
  const f = useCurrentFrame();
  return <div style={{ position: "absolute", inset: 0, opacity: first ? 1 : tw(f, 0, XF, 0, 1, inOut) }}>{children}</div>;
};

const Demo: React.FC<{ clip: string; title: string; segs: Seg[]; keys: Key[]; taps: Tap[]; sounds: Snd[] }> = ({ clip, title, segs, keys, taps, sounds }) => {
  const f = useCurrentFrame();
  const { height: H } = useVideoConfig();
  const u = useU();
  const away = tw(f, INTRO - 14, 24, 0, 1, inOut);
  return (
    <Stage>
      <Grid start={0} xs={[0.22, 0.78]} ys={[]} />
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.43 - away * 140 * u, opacity: 1 - away, display: "flex", justifyContent: "center" }}>
        <Reveal text={title} start={2} size={110 * u} align="center" />
      </div>
      <Phone clip={clip} segs={segs} keys={keys} taps={taps} />
      {taps.map((t, i) => <Sfx key={"t" + i} name="tick" at={frameOf(segs, t.t)} volume={0.35} />)}
      {sounds.map((s, i) => (
        <Sequence key={"s" + i} from={Math.round(frameOf(segs, s.t))} layout="none">
          <Audio src={staticFile(s.src)} volume={s.volume ?? 1} />
        </Sequence>
      ))}
    </Stage>
  );
};

// ---------------------------------------------------------------- teach "Tired": three real takes, real time
export const DemoTeach: React.FC = () => {
  const sb = useSB();
  const e = APP.teach.events;
  const takes = APP.teach.audio ?? [];
  const speech = sb.demo?.teachSpeech ?? [9.82, 14.03, 18.84];   // measured from the app's live waveform
  const segs: Seg[] = [
    { from: e.home + 0.5, to: e.teach2 + 0.23 },                   // tap Teach, pick Tired, tap Record
    { from: e.record1 - 0.27, to: speech[0] + 1.2 },               // take 1
    { from: speech[1] - 0.2, to: speech[1] + 0.95 },               // take 2
    { from: speech[2] - 0.25, to: speech[2] + 1.15 },              // take 3
    { from: e.teach3, to: e.teach3 + 3.65 },                       // "Tired" is now part of your language
  ];
  const keys: Key[] = [
    { at: e.home + 0.5 }, { at: e.teach1 + 0.3 },
    { at: e.teach1 + 1.2, s: 1.1, fy: 0.42 }, { at: e.picked + 0.6, s: 1.1, fy: 0.42 },
    { at: e.teach2 }, { at: e.teach3 }, { at: e.teach3 + 3.6, s: 1.05, fy: 0.55 },
  ];
  const taps: Tap[] = [
    { t: e.teach1 - 0.05, x: 0.497, y: 0.93 },
    { t: e.picked - 0.05, x: 0.797, y: 0.576 },
    { t: e.teach2 - 0.05, x: 0.497, y: 0.777 },
    { t: e.record1 - 0.03, x: 0.497, y: 0.762 },
  ];
  const sounds: Snd[] = takes.map((src, i) => ({ t: speech[i] - 0.02, src: `voices/${src}.wav` }));
  return <Demo clip="teach" title={sb.demo?.teachTitle ?? "Teach it a sound."} segs={segs} keys={keys} taps={taps} sounds={[...sounds, { t: e.teach3, src: "audio/sfx_right.wav", volume: 0.4 }]} />;
};

// ---------------------------------------------------------------- a new recording -> "Tired?" -> it speaks
export const DemoListen: React.FC = () => {
  const sb = useSB();
  const e = APP.listen.events;
  const rec = (APP.listen.audio ?? [])[0];
  const d = sb.demo ?? { listenScreen: 7.25, listenSpeech: 8.51 };
  const segs: Seg[] = [
    { from: e.home + 0.5, to: e.listen + 0.25 },                   // tap Start listening
    { from: d.listenScreen ?? 7.25, to: e.result + 0.55 },         // listening, the voice, "Comparing…"
    { from: e.answer - 0.5, to: e.speak + 0.23 },                  // "Tired? 96%", what Whisper heard, tap Yes
    { from: e.speak + 0.23, to: e.speak + 3.5 },                   // "I'm tired. I'd like to rest."
  ];
  const keys: Key[] = [
    { at: e.home + 0.5 }, { at: e.answer - 0.4 },
    { at: e.answer + 0.6, s: 1.12, fy: 0.6 }, { at: e.speak - 0.6, s: 1.12, fy: 0.6 },
    { at: e.speak + 0.4 }, { at: e.speak + 3.5, s: 1.04, fy: 0.45 },
  ];
  const taps: Tap[] = [
    { t: e.listen - 0.05, x: 0.5, y: 0.629 },
    { t: e.speak - 0.05, x: 0.49, y: 0.848 },
  ];
  const sounds: Snd[] = [
    ...(rec ? [{ t: (d.listenSpeech ?? 8.51) - 0.04, src: `voices/${rec}.wav` }] : []),
    { t: e.speak + 0.35, src: `voices/${sb.appVoices?.tts ?? "tts_tired"}.wav`, volume: 0.9 },
  ];
  return <Demo clip="listen" title={sb.demo?.listenTitle ?? "Then just say it."} segs={segs} keys={keys} taps={taps} sounds={sounds} />;
};
