// 5-second look test: episode 006's 3D world in the daylight look, starting at the "centers"
// beat (towers rise, then the push-in to two planes five miles apart). Uses 006's real beat
// timings so the camera and HUD match the episode.
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { BeatsContext } from "../beats";
import type { CaptionWord } from "../Captions";
import { buildTimeline } from "../EpisodeVideo";
import { GroundStop3D } from "../stages/groundstop-3d";
import { episodeSchema } from "../types";

const episode = episodeSchema.parse(require("../../episodes/006-one-box-grounded-america-3d.json"));
const words: CaptionWord[] = require("../../captions/006-one-box-grounded-america-3d.json");
const { beats } = buildTimeline(episode, words);

export const DAY_DEMO_FRAMES = 150;

export const GroundStopDayDemo: React.FC<{ from?: string }> = ({ from = "centers" }) => {
  const start = beats[from] ?? 0;
  return (
    <AbsoluteFill>
      <BeatsContext.Provider value={beats}>
        <Sequence from={-start} layout="none">
          <GroundStop3D look="day" />
        </Sequence>
      </BeatsContext.Provider>
    </AbsoluteFill>
  );
};
