import { z } from "zod";

const base = {
  /** How long the scene stays on screen, in seconds. `npm run voiceover` sets this for you. */
  seconds: z.number().positive(),
  /** Voiceover line for this scene. Spoken by `npm run voiceover`, never shown as-is. */
  narration: z.string().optional(),
  /** Names this moment so the episode's stage can animate on it (see src/stages). */
  beat: z.string().optional(),
  /**
   * Extra beats that start on a spoken word inside this scene, e.g. {"fail": "started"}
   * fires "fail" when the voice says "started". Needs captions; falls back to scene start.
   */
  cues: z.record(z.string(), z.string()).optional(),
  /** Voice speed for this scene only (e.g. a punchier hook). */
  speed: z.number().min(0.5).max(2).optional(),
  /** Extra silent seconds after the narration, set by `npm run voiceover`. */
  hold: z.number().min(0).max(3).optional(),
  /** "top" puts the text in the upper part of the frame so the stage stays visible below. */
  layout: z.enum(["center", "top"]).default("center"),
  /** "full" keeps the stage at full strength behind this scene; "dim" fades it back. */
  stage: z.enum(["dim", "full"]).optional(),
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
  theme: z.enum(["light", "night", "cinema"]).optional(),
  /**
   * "stage" (default): text slides over a 1000x900 stage. "full": a full-screen stage from
   * src/stages/index.ts `fullStages` draws everything; no slide text, captions only.
   */
  canvas: z.enum(["stage", "full"]).default("stage"),
  /** "pill": dark pill under the stage. "top": small, near the top. "box": cyan-bordered box low in the frame (reference style). */
  captionStyle: z.enum(["pill", "top", "box"]).default("pill"),
  /** Name of a custom animated stage registered in src/stages/index.ts. */
  stage: z.string().optional(),
  /** Channel handle, shown on the outro. */
  handle: z.string().default("@frontierin60"),
  /** Words to pick out in cyan in the captions (case-insensitive), e.g. ["blue", "sunset"]. */
  keywords: z.array(z.string()).default([]),
  /** Voice and speed for `npm run voiceover` (defaults depend on format). */
  voice: z.string().optional(),
  voiceSpeed: z.number().min(0.5).max(2).optional(),
  /** Silence around lines for `npm run voiceover`, in seconds. Tighter = faster video. */
  pacing: z
    .object({
      lead: z.number().min(0).optional(),
      tail: z.number().min(0).optional(),
      sentenceGap: z.number().min(0).optional(),
      minScene: z.number().min(0.5).optional(),
    })
    .optional(),
  /** Files inside public/audio/ */
  voiceover: z.string().optional(),
  /**
   * Reel covers. Each is a still of the stage frozen `offset` seconds after beat `at`, with
   * `title` on top. A stage may also draw a cover-only picture for the beat "cover".
   * Rendered with `npm run thumbnail -- <id>` to out/<id>-thumb-<name>.png.
   */
  thumbnails: z
    .array(
      z.object({
        name: z.string().regex(/^[a-z0-9-]+$/),
        title: z.string(),
        tag: z.string().optional(),
        at: z.string(),
        offset: z.number().default(0),
      }),
    )
    .default([]),
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
