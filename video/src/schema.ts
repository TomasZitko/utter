// The storyboard schema. Remotion Studio turns this into the editing panel on the right:
// every line of copy, every number, the scene lengths (in bars of music) and Blub's shape are
// editable there, and the preview updates live. "Save" in the Studio writes back to defaultProps.
import { z } from "zod";
import { zColor } from "@remotion/zod-types";

export const sceneIds = ["wake", "problem", "heardWrong", "stat", "flip", "teach", "vocab", "match", "payoff", "notSure", "result", "outro", "appTeach", "appListen", "appUnsure", "demoTeach", "demoListen"] as const;

export const storyboardSchema = z.object({
  title: z.string(),
  fps: z.number().int().min(24).max(60),
  bpm: z.number().min(60).max(160).describe("Music tempo. Every cut lands on a beat."),
  beatsPerBar: z.number().int().min(2).max(8),
  scenes: z.array(z.object({ id: z.enum(sceneIds), bars: z.number().multipleOf(0.5).min(0.5).max(12) })).describe("Order and length (in bars) of every scene"),
  copy: z.object({
    problemA: z.string(), problemB: z.array(z.string()), problemC: z.string(),
    heardWrongAssistant: z.string(), heardWrongSaid: z.string(), whisperNote: z.string(),
    statLine: z.string(), statOf: z.string(), statControl: z.string(),
    flipA: z.string(), flipB: z.string(), flipHighlight: z.string(),
    teachTitle: z.string(), teachQuestion: z.string(), teachSound: z.string(), teachMeaning: z.string(), teachSentence: z.string(),
    vocabTitle: z.string(), vocabSub: z.string(),
    matchTitle: z.string(), matchSub: z.string(),
    notSureA: z.string(), notSureB: z.string(), notSureC: z.string(),
    resultTitle: z.string(), resultWrong: z.string(),
    outroTagline: z.string(), outroFoot: z.string(),
    appTeachA: z.string().optional(), appTeachB: z.string().optional(), appTeachC: z.string().optional(), appTeachD: z.string().optional(),
    appListenA: z.string().optional(), appListenB: z.string().optional(), appListenC: z.string().optional(), appNote: z.string().optional(),
  }),
  numbers: z.object({
    whisper: z.number(), whisperControl: z.number(), utter: z.number(), wrongWithNotSure: z.number(),
  }).describe("Only numbers from outputs/results.json"),
  voices: z.array(z.object({ clip: z.string(), speaker: z.string(), said: z.string(), whisper: z.string() }))
    .describe("Real TORGO clips + Whisper's real transcript (experiments/real_voices_results.csv). Rebuild assets after changing."),
  voiceSlots: z.object({ startBeat: z.number(), everyBeats: z.number() }),
  wipes: z.array(z.enum(sceneIds)).describe("Scenes entered through a Blub-shaped yellow wipe"),
  teachClips: z.array(z.string()),
  vocab: z.array(z.object({ meaning: z.string(), clip: z.string() })).describe("Vocabulary tiles: a meaning from the app + a real recording as 'your sound'"),
  matchClips: z.array(z.string()),
  problemStyle: z.enum(["grid", "people"]).optional().describe("Background of the problem scene"),
  demo: z.object({ teachTitle: z.string(), listenTitle: z.string(), teachSpeech: z.array(z.number()), listenScreen: z.number(), listenSpeech: z.number() }).optional()
    .describe("Real-app demo (v3): titles + measured moments in the captured footage"),
  music: z.string().optional().describe("Score file in public/ (built by npm run assets)"),
  appVoices: z.object({ teach: z.array(z.string()), listen: z.string(), unsure: z.string(), tts: z.string() }).optional()
    .describe("Real clips played as the app's microphone in the captured app footage"),
  blub: z.object({
    color: zColor(),
    R: z.number().min(120).max(240),
    lobes: z.number().describe("Seed of the uneven outline"),
    amp: z.number(),
    faceY: z.number().min(180).max(300),
    faceScale: z.number().min(1).max(3.5),
    wobble: z.number().min(0).max(3),
  }).describe("The logo. Same parameters as app/static/brand.js"),
});

export type Storyboard = z.infer<typeof storyboardSchema>;

export const framesPerBeat = (sb: Storyboard) => Math.round((sb.fps * 60) / sb.bpm);
export const timeline = (sb: Storyboard) => {
  const fpb = framesPerBeat(sb);
  let at = 0;
  return sb.scenes.map((s) => {
    const dur = Math.round(s.bars * sb.beatsPerBar * fpb);
    const r = { id: s.id, from: at, dur };
    at += dur;
    return r;
  });
};
export const totalFrames = (sb: Storyboard) => timeline(sb).reduce((a, s) => a + s.dur, 0);
