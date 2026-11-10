import { z } from "zod";

const base = {
  /** How long the scene stays on screen, in seconds. */
  seconds: z.number().positive(),
  /** Voiceover line for this scene. Not rendered; exported by `npm run narration`. */
  narration: z.string().optional(),
};

export const iconNames = ["sun", "eye", "bulb", "wave", "globe", "clock", "spark"] as const;

export const sceneSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("title"),
    ...base,
    kicker: z.string().optional(),
    title: z.string(),
  }),
  z.object({
    type: z.literal("text"),
    ...base,
    icon: z.enum(iconNames).optional(),
    heading: z.string(),
    body: z.string().optional(),
  }),
  z.object({
    type: z.literal("stat"),
    ...base,
    value: z.number(),
    decimals: z.number().int().min(0).default(0),
    prefix: z.string().default(""),
    suffix: z.string().default(""),
    label: z.string(),
  }),
  z.object({
    type: z.literal("bars"),
    ...base,
    heading: z.string(),
    unit: z.string().default(""),
    bars: z
      .array(z.object({ label: z.string(), value: z.number(), color: z.string().optional() }))
      .min(2)
      .max(5),
  }),
  z.object({
    type: z.literal("list"),
    ...base,
    heading: z.string(),
    items: z.array(z.string()).min(2).max(5),
  }),
  z.object({
    type: z.literal("outro"),
    ...base,
    title: z.string(),
    cta: z.string(),
  }),
]);

export const episodeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  /** Theme name from src/theme.ts */
  theme: z.string().default("midnight"),
  /** Optional files inside public/audio/ */
  voiceover: z.string().optional(),
  /** Voice used by `npm run voiceover` (see `npm run voiceover -- --voices`). */
  voice: z.string().optional(),
  music: z.string().optional(),
  musicVolume: z.number().min(0).max(1).default(0.15),
  scenes: z.array(sceneSchema).min(1),
});

export type Scene = z.infer<typeof sceneSchema>;
export type Episode = z.infer<typeof episodeSchema>;
export type IconName = (typeof iconNames)[number];
