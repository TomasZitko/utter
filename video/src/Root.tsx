// The control panel. Open with `npm run dev`:
//  - "Launch" (16:9) and "Launch-Square" (1:1): the whole film; edit copy, numbers, scene lengths
//    and Blub's shape in the props panel on the right.
//  - "Scenes/*": every scene alone at its storyboard length, for working on one shot.
import React from "react";
import { Composition, Folder } from "remotion";
import { Launch, SceneSolo } from "./Launch";
import { framesPerBeat, sceneIds, Storyboard, storyboardSchema, totalFrames } from "./schema";
import storyboard from "./storyboard.json";
import storyboardV2 from "./storyboard.v2.json";

const defaults = storyboard as Storyboard;
const v2 = storyboardV2 as Storyboard;

export const RemotionRoot: React.FC = () => {
  const fpb = framesPerBeat(defaults);
  return (
    <>
      <Composition
        id="Launch-v2"
        component={Launch}
        schema={storyboardSchema}
        defaultProps={v2}
        width={1920}
        height={1080}
        fps={v2.fps}
        durationInFrames={totalFrames(v2)}
        calculateMetadata={({ props }) => ({ durationInFrames: totalFrames(props), fps: props.fps })}
      />
      <Composition
        id="Launch"
        component={Launch}
        schema={storyboardSchema}
        defaultProps={defaults}
        width={1920}
        height={1080}
        fps={defaults.fps}
        durationInFrames={totalFrames(defaults)}
        calculateMetadata={({ props }) => ({ durationInFrames: totalFrames(props), fps: props.fps })}
      />
      <Composition
        id="Launch-Square"
        component={Launch}
        schema={storyboardSchema}
        defaultProps={defaults}
        width={1080}
        height={1080}
        fps={defaults.fps}
        durationInFrames={totalFrames(defaults)}
        calculateMetadata={({ props }) => ({ durationInFrames: totalFrames(props), fps: props.fps })}
      />
      <Folder name="Scenes">
        {sceneIds.map((id) => {
          const sb = defaults.scenes.some((s) => s.id === id) ? defaults : v2;
          const bars = sb.scenes.find((s) => s.id === id)?.bars ?? 2;
          return (
            <Composition
              key={id}
              id={`scene-${id}`}
              component={SceneSolo}
              defaultProps={{ ...sb, scene: id }}
              width={1920}
              height={1080}
              fps={defaults.fps}
              durationInFrames={Math.round(bars * sb.beatsPerBar * fpb)}
            />
          );
        })}
      </Folder>
    </>
  );
};
