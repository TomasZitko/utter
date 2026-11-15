// Scene "heardWrong": real recordings of people with dysarthria, and what Whisper wrote down.
// Scene "payoff": the same recordings again, and what Utter understood.
// Clips, transcripts and Utter's answers are real (experiments/real_voices_results.csv).
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import voices from "../generated/voices.json";
import { Blub } from "../kit/Blub";
import { Grid, inOut, inExpo, outExpo, pop, Reveal, Sfx, Stage, tw, useBeat, useSB, useU, Voice, Wave } from "../kit/kit";
import { C, fontBody, fontDisplay } from "../theme";

type ClipInfo = { dur: number; peaks: number[]; speaker: string; label: string };
const CLIPS = voices.clips as Record<string, ClipInfo>;

const Label: React.FC<{ text: string; color?: string; o: number }> = ({ text, color = C.muted, o }) => {
  const u = useU();
  return <div style={{ fontFamily: fontDisplay, fontSize: 34 * u, fontWeight: 500, letterSpacing: "-0.01em", color, opacity: o, marginBottom: 10 * u }}>{text}</div>;
};

/** one recording: the waveform plays, then the two answers land */
const Slot: React.FC<{ i: number; start: number; end: number; mode: "wrong" | "right" }> = ({ i, start, end, mode }) => {
  const f = useCurrentFrame() - start;
  const { fps, width: W, height: H } = useVideoConfig();
  const u = useU();
  const sb = useSB();
  const v = sb.voices[i];
  const clip = CLIPS[v.clip];
  if (!clip) return null;
  const len = end - start;
  const audioAt = 6;
  const aEnd = audioAt + Math.round(clip.dur * fps);
  const enter = tw(f, 0, 14, 0, 1, inOut);
  const exit = tw(f, len - 10, 10, 0, 1, inExpo);
  const waveW = Math.min(1100 * u, W * 0.7);
  const first = aEnd + 4;
  const second = aEnd + (mode === "wrong" ? 22 : 10);
  const strike = tw(f, aEnd + 14, 7, 0, 1, outExpo);
  const isSentence = mode === "right" && v.said === sb.copy.teachSound;
  const hop = pop(f, fps, second, 9, 200);
  if (f < -2 || f > len + 2) return null;
  return (
    <AbsoluteFill style={{ opacity: enter * (1 - exit), transform: `translateX(${(1 - enter) * 120 * u - exit * 160 * u}px)` }}>
      <div style={{ position: "absolute", left: (W - waveW) / 2, top: H * 0.2, width: waveW }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 22 * u }}>
          <div style={{ fontFamily: fontBody, fontSize: 26 * u, fontWeight: 600, color: C.text }}>
            Speaker {v.speaker}
            <span style={{ color: C.muted, fontWeight: 500 }}>{"  ·  "}dysarthria</span>
          </div>
          <div style={{ fontFamily: fontBody, fontSize: 24 * u, color: C.muted, fontVariantNumeric: "tabular-nums" }}>
            {Math.max(0, Math.min(clip.dur, (f - audioAt) / fps)).toFixed(1)}s
          </div>
        </div>
        <Wave peaks={clip.peaks} width={waveW} height={170 * u} grow={tw(f, 0, 16)} progress={(f - audioAt) / (aEnd - audioAt)} color={mode === "right" ? C.accent : C.text} />
      </div>
      <div style={{ position: "absolute", top: H * 0.52, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 0 }}>
        {/* left: what the regular assistant heard */}
        <div style={{ width: waveW / 2, paddingRight: 40 * u, opacity: mode === "right" ? 0.55 : 1 }}>
          <Label text={sb.copy.heardWrongAssistant} color={C.blue} o={mode === "right" ? 1 : tw(f, first, 8)} />
          <div style={{ position: "relative", display: "inline-block" }}>
            {mode === "right" ? (
              <div style={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: 64 * u, color: C.muted, letterSpacing: "-0.02em" }}>“{v.whisper}”</div>
            ) : (
              <Reveal text={`“${v.whisper}”`} start={first} size={118 * u} color={strike > 0.5 ? C.muted : C.text} />
            )}
            {(mode === "right" ? 1 : strike) > 0 ? (
              <div style={{ position: "absolute", left: -8 * u, top: "52%", height: (mode === "right" ? 5 : 9) * u, width: `calc((100% + ${16 * u}px) * ${mode === "right" ? 1 : strike})`, background: C.danger, borderRadius: 9 * u }} />
            ) : null}
          </div>
        </div>
        {/* right: what was said / what Utter understood */}
        <div style={{ width: waveW / 2, paddingLeft: 40 * u, borderLeft: `1px solid ${C.line}` }}>
          <Label text={mode === "right" ? "Utter" : sb.copy.heardWrongSaid} color={mode === "right" ? C.accent : C.muted} o={tw(f, second, 8)} />
          <div style={{ display: "flex", alignItems: "center", gap: 26 * u }}>
            <Reveal text={v.said} start={second} size={(mode === "right" ? 150 : 118) * u} color={mode === "right" ? C.accent : C.text} weight={mode === "right" ? 700 : 600} />
            {mode === "right" ? (
              <div style={{ position: "relative", width: 120 * u, height: 120 * u, transform: `scale(${hop})` }}>
                <Blub shape={sb.blub} size={130 * u} x={60 * u} y={60 * u} mood="happy" />
              </div>
            ) : null}
          </div>
          {isSentence ? (
            <div style={{ marginTop: 18 * u }}>
              <Reveal text={`${sb.copy.teachMeaning} → “${sb.copy.teachSentence}”`} start={second + 14} size={40 * u} weight={500} font="body" color={C.text} stagger={1.5} tracking={0} style={{ maxWidth: waveW / 2 }} />
            </div>
          ) : null}
        </div>
      </div>
      <Voice clip={v.clip} at={start + audioAt} />
      {mode === "wrong" ? <Sfx name="wrong" at={start + aEnd + 14} volume={0.55} /> : <Sfx name="right" at={start + second} volume={0.6} />}
    </AbsoluteFill>
  );
};

const VoiceScene: React.FC<{ mode: "wrong" | "right" }> = ({ mode }) => {
  const { durationInFrames, height: H, width: W } = useVideoConfig();
  const u = useU();
  const sb = useSB();
  const b = useBeat();
  const starts = sb.voices.map((_, i) => Math.round((sb.voiceSlots.startBeat + i * sb.voiceSlots.everyBeats) * b));
  return (
    <Stage>
      <Grid start={0} xs={[0.5]} ys={[0.14, 0.88]} />
      <div style={{ position: "absolute", left: W * 0.06, right: W * 0.06, bottom: H * 0.05, fontFamily: fontBody, fontSize: 22 * u, color: C.muted, opacity: 0.85, textAlign: "center" }}>
        {mode === "wrong"
          ? `Real recordings from the TORGO database. ${sb.copy.whisperNote}`
          : "Same recordings. Utter was taught with each speaker's own recordings. Selected examples; overall results follow."}
      </div>
      {sb.voices.map((_, i) => (
        <Slot key={i} i={i} mode={mode} start={starts[i]} end={i + 1 < starts.length ? starts[i + 1] : durationInFrames} />
      ))}
    </Stage>
  );
};

export const HeardWrong: React.FC = () => <VoiceScene mode="wrong" />;
export const Payoff: React.FC = () => <VoiceScene mode="right" />;
