# Utter launch film

A storyboard-driven launch film system built on [Remotion](https://remotion.dev). One JSON file holds
the strategy (scene order, length in bars of music, every line of copy, the numbers, the real voice
clips, Blub's shape). Code turns it into picture, and a Python script turns it into sound.

```
src/storyboard.json ─┬─> Remotion scenes (picture, SFX on events)  ─┐
                     ├─> Studio props panel (live editing)          ├─> out/*.mp4
                     └─> scripts/build_assets.py (music, voices) ───┘
app/static/tokens.css ──> build_assets.py ──> src/generated/brand.json (colours)
```

## Use it

```powershell
cd C:\ACTIVE\slysim-te\video
npm install                 # once
npm run assets              # brand colours, real voice clips, waveforms, DTW path, SFX, music
npm run dev                 # Studio: the control panel
npm run render              # out/utter-launch-16x9.mp4 (1920x1080, 30 fps)
npm run render:square       # out/utter-launch-1x1.mp4  (1080x1080, for social)
```

`data/sim` (the real-voices demo pack) must exist for `npm run assets`. It's rebuilt by
`python experiments/build_demo_pack.py` in the main repo.

## The control panel (Studio)

- **Launch** / **Launch-Square**: the whole film. The props panel on the right edits the storyboard
  live: copy, numbers, scene order and length, which cuts get the Blub wipe, Blub's colour and shape.
  "Save" writes the change back as default props.
- **Scenes/scene-…**: each scene alone, for working on one shot.

## Changing things

| You want to | Change | Then |
|---|---|---|
| Reword a line | `copy` in the storyboard (or Studio) | nothing |
| Make a scene longer | its `bars` (1 bar = 4 beats = 2.4 s at 100 BPM) | `npm run assets` (music follows) |
| Tweak the logo | `blub` (same parameters as `app/static/brand.js`) | nothing |
| Change brand colours | `app/static/tokens.css` (the app) | `npm run assets` |
| Use other real recordings | `voices` / `teachClips` / `matchClips` / `vocab`, with transcripts from `experiments/real_voices_results.csv` | `npm run assets` |
| Change a number | `numbers`. **Only values from `outputs/results.json`.** | nothing |

## How it's built

- **Every cut is on the beat.** Scenes are measured in bars of a 100 BPM score, so picture, SFX and
  music share one grid. All timing is in beats inside scenes (`useBeat()`), not hard-coded frames.
- **Everything is frame-driven** (`useCurrentFrame`), with no CSS transitions, so any frame renders identically.
- **Blub** (`src/kit/Blub.tsx`) is the app's mascot code ported to frame time: same blob path, eyes,
  mouths, deterministic blinks. It's also the transition (`BlubWipe`) and the opening and closing shot.
- **Kit** (`src/kit/kit.tsx`): word-mask reveals, the yellow highlighter, hairline grid, waveform from
  real peaks, counters, SFX/voice placement in scene-local frames.
- **Sound** (`scripts/build_assets.py`): original score (warm D major, pad, bells, plucks, drums by
  scene), SFX library, all synthesised with fixed seeds. The music ducks automatically under every real voice clip.

## Honesty rules (the film is part of a hackathon entry)

- Voices are real TORGO recordings. Teach and vocabulary scenes follow the app's real flow: record a sound, pick a meaning (labels, colours, icons and sentences copied from `app/static/app.js` into `src/meanings.ts`), Utter says that sentence. "Whisper heard" lines are Whisper-small's real outputs.
- The payoff scene shows **selected** correct examples from the app test (taught with the speaker's
  own recordings). The overall numbers (42% vs 84%, 5% wrong actions) come from `outputs/results.json`.
- The match scene draws a real DTW alignment of two recordings, computed on simple spectral features
  for the picture. Utter itself aligns WavLM features. The caption says so.

## Review loop

```powershell
npm run draft                                                                    # half-size, fast
..\.venv\Scripts\python scripts\contact_sheet.py out\draft.mp4 out\sheet.png 10 140 400 ...
npx remotion still Launch out\f.png --frame=864                                  # one frame
```
