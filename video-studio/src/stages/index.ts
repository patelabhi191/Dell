import type React from "react";
import { EiffelStage } from "./eiffel";
import { SkyStage } from "./sky";

/**
 * Custom animated stages, one per episode that needs bespoke visuals.
 * An episode picks one with `"stage": "<name>"`; scenes of type "show" put it centre-frame.
 * Each stage is SVG drawn on a 1000x900 canvas with the floor at y=830 (see props.tsx).
 */
export const stages: Record<string, React.FC> = {
  sky: SkyStage,
  eiffel: EiffelStage,
};
