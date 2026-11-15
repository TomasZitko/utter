// The film: scenes laid end to end on the music grid, score underneath.
import React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Blub } from "./kit/Blub";
import { inOut, SB, Sfx, tw } from "./kit/kit";
import { Storyboard, timeline } from "./schema";
import { Problem, Wake } from "./scenes/Open";
import { Flip, Match, NotSure, Outro, Result, Stat, Teach, Vocab } from "./scenes/Story";
import { HeardWrong, Payoff } from "./scenes/Voices";
import { AppListen, AppTeach, AppUnsure } from "./scenes/AppScenes";

export const SCENES: Record<Storyboard["scenes"][number]["id"], React.FC> = {
  wake: Wake, problem: Problem, heardWrong: HeardWrong, stat: Stat, flip: Flip, teach: Teach,
  vocab: Vocab, match: Match, payoff: Payoff, notSure: NotSure, result: Result, outro: Outro,
  appTeach: AppTeach, appListen: AppListen, appUnsure: AppUnsure,
};

export const Launch: React.FC<Storyboard> = (sb) => {
  const { durationInFrames } = useVideoConfig();
  return (
    <SB.Provider value={sb}>
      <AbsoluteFill style={{ background: "#0E0D0C" }}>
        {timeline(sb).map((s) => {
          const Scene = SCENES[s.id];
          return (
            <Sequence key={s.id + s.from} from={s.from} durationInFrames={s.dur} name={s.id}>
              <Scene />
            </Sequence>
          );
        })}
        {timeline(sb).filter((s) => sb.wipes.includes(s.id)).map((s) => (
          <React.Fragment key={"w" + s.id}>
            <BlubWipe at={s.from} />
            <Sfx name="whoosh" at={s.from - 12} volume={0.45} />
          </React.Fragment>
        ))}
        <Audio
          src={staticFile(sb.music ?? "audio/music.wav")}
          volume={(f) => 0.6 * interpolate(f, [durationInFrames - 20, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      </AbsoluteFill>
    </SB.Provider>
  );
};

/** Blub's body (no face) swells over the cut and drains away after it: the logo is the transition */
const BlubWipe: React.FC<{ at: number; half?: number }> = ({ at, half = 12 }) => {
  const f = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const sb = React.useContext(SB)!;
  if (f < at - half || f > at + half) return null;
  const big = Math.hypot(W, H) * 1.6;
  const k = f < at ? tw(f, at - half, half, 0.04, 1, inOut) : 1 - tw(f, at, half, 0, 1, inOut);
  const cx = f < at ? W * 0.5 : W * (0.5 + 0.35 * tw(f, at, half));
  const cy = f < at ? H * 0.5 : H * (0.5 - 0.25 * tw(f, at, half));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Blub shape={sb.blub} size={Math.max(1, big * k)} x={cx} y={cy} face={0} wobble={2.5} />
    </AbsoluteFill>
  );
};

/** one scene alone, for working on it in the Studio */
export const SceneSolo: React.FC<Storyboard & { scene: Storyboard["scenes"][number]["id"] }> = ({ scene, ...sb }) => {
  const Scene = SCENES[scene];
  return (
    <SB.Provider value={sb}>
      <Scene />
    </SB.Provider>
  );
};
