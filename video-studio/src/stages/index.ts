import type React from "react";
import { EiffelStage } from "./eiffel";
import { GroundStopStage } from "./groundstop";
import { GroundStopCinema } from "./groundstop-cinema";
import { GroundStop3D } from "./groundstop-3d";
import { OutageCity } from "./outage-city";
import { RamDemo } from "./ram-demo";
import { SkyStage } from "./sky";

/**
 * Custom animated stages, one per episode that needs bespoke visuals.
 * An episode picks one with `"stage": "<name>"`; scenes of type "show" put it centre-frame.
 * Each stage is SVG drawn on a 1000x900 canvas with the floor at y=830 (see props.tsx).
 */
export const stages: Record<string, React.FC> = {
  sky: SkyStage,
  eiffel: EiffelStage,
  groundstop: GroundStopStage,
};

/**
 * Full-screen stages (episode `"canvas": "full"`): they draw the whole frame themselves,
 * including the background and any text, on a 1080x1920 canvas.
 */
export const fullStages: Record<string, React.FC> = {
  "groundstop-cinema": GroundStopCinema,
  "groundstop-3d": GroundStop3D,
  "outage-city": OutageCity,
  "ram-demo": RamDemo,
};
