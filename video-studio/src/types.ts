import { z } from "zod";

const base = {
  /** How long the scene stays on screen, in seconds. `npm run voiceover` sets this for you. */
  seconds: z.number().positive(),
  /** Voiceover line for this scene. Spoken by `npm run voiceover`, never shown as-is. */
  narration: z.string().optional(),
  /** Names this moment so the episode's stage can animate on it (see src/stages). */
  beat: z.string().optional(),
  /** Step tracker at the top, e.g. "STEP 2/4" or "PROPERTY 1/5". */
  progress: z
    .string()
    .regex(/^.+ \d+\/\d+$/, 'progress must look like "STEP 2/4"')
    .optional(),
};

export const iconNames = ["sun", "eye", "bulb", "wave", "globe", "clock", "spark"] as const;
export const tones = ["dark", "accent", "alert"] as const;

/** Display text may wrap words in *asterisks* to colour them with the accent. */
export const sceneSchema = z.discriminatedUnion("type", [
  // Big punchy line, centred. Dims the stage behind it.
  z.object({
    type: z.literal("statement"),
    ...base,
    text: z.string(),
    tag: z.string().optional(),
    tagTone: z.enum(tones).default("dark"),
  }),
  // Lets the stage animation play, with an optional headline and tag above it.
  z.object({
    type: z.literal("show"),
    ...base,
    heading: z.string().optional(),
    tag: z.string().optional(),
    tagTone: z.enum(tones).default("dark"),
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
  // Recap card. `badges` are the characters in the squares; defaults to 1, 2, 3...
  z.object({
    type: z.literal("list"),
    ...base,
    heading: z.string(),
    items: z.array(z.string()).min(2).max(5),
    badges: z.array(z.string().max(2)).optional(),
  }),
  z.object({
    type: z.literal("outro"),
    ...base,
    title: z.string(),
    cta: z.string().default("FOLLOW"),
    ctaNote: z.string().default("for more"),
  }),
]);

export const episodeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  /** "info" = knowledge explainer, "story" = narrative. See PLAYBOOK.md. */
  format: z.enum(["info", "story"]).default("info"),
  /** "light" (white) or "night" (black). Defaults to light for info, night for story. */
  theme: z.enum(["light", "night"]).optional(),
  /** Name of a custom animated stage registered in src/stages/index.ts. */
  stage: z.string().optional(),
  /** Channel handle shown small under the captions, e.g. "@yourchannel". */
  handle: z.string().optional(),
  /** Voice and speed for `npm run voiceover` (defaults depend on format). */
  voice: z.string().optional(),
  voiceSpeed: z.number().min(0.5).max(2).optional(),
  /** Files inside public/audio/ */
  voiceover: z.string().optional(),
  /** Burn in captions when captions/<id>.json exists (made by `npm run captions`). */
  captions: z.boolean().default(true),
  music: z.string().optional(),
  musicVolume: z.number().min(0).max(1).default(0.12),
  scenes: z.array(sceneSchema).min(1),
});

export type Scene = z.infer<typeof sceneSchema>;
export type Episode = z.infer<typeof episodeSchema>;
export type IconName = (typeof iconNames)[number];
export type Tone = (typeof tones)[number];
