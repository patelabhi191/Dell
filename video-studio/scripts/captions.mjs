// Usage: npm run captions -- <episode-id> [--model base.en]
//
// Runs Whisper (via the HyperFrames CLI) on the episode's voiceover and writes
// captions/<id>.json (word timings, burned into the video) and captions/<id>.srt
// (upload to YouTube as subtitles). Run it after `npm run voiceover`.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tempDir } from "./paths.mjs";

const args = process.argv.slice(2);
const id = args[0];
const file = `episodes/${id}.json`;
if (!id || !existsSync(file)) {
  console.error("Usage: npm run captions -- <episode-id> [--model base.en]");
  process.exit(1);
}
const episode = JSON.parse(readFileSync(file, "utf8"));
if (!episode.voiceover) {
  console.error(`${file} has no "voiceover". Run: npm run voiceover -- ${id}`);
  process.exit(1);
}
const m = args.indexOf("--model");
const model = m === -1 ? "base.en" : args[m + 1];
const audio = resolve("public/audio", episode.voiceover);
const env = { ...process.env, DO_NOT_TRACK: "1" };
// On Windows, npx is a .cmd file and must run through the shell.
const hyperframes = (...a) =>
  execFileSync("npx", ["hyperframes", ...a], { stdio: "inherit", env, shell: process.platform === "win32" });

/**
 * Whisper's word times drift across long pauses (scene gaps, "hold"s), early or late by up to a
 * second, so captions can show a line before it is spoken or spill it into the next scene.
 * We know exactly where each scene's speech starts (the voiceover lays each line at its scene
 * start plus the lead), so split the words into scenes by each narration's last word and shift
 * each scene's words so its first word starts when its line really starts. Returns how many
 * scenes were moved; leaves Whisper's times alone if the words can't be matched to scenes.
 */
function alignToScenes(jsonPath) {
  const words = JSON.parse(readFileSync(jsonPath, "utf8"));
  const norm = (s) => s.toLowerCase().replace(/["'’)\]]/g, "");
  const LEAD = 0.2; // defaults as in voiceover.mjs
  const TAIL = 0.35;
  const groups = [];
  let i = 0;
  let sceneStart = 0;
  for (const [k, scene] of episode.scenes.entries()) {
    const text = scene.narration?.trim();
    if (text) {
      const last = norm(text.split(/\s+/).pop());
      const from = i;
      while (i < words.length && norm(words[i].text) !== last) i++;
      if (i >= words.length) return 0; // could not match: keep Whisper's times
      const lead = k === 0 ? 0 : episode.pacing?.lead ?? LEAD;
      const tail = episode.pacing?.tail ?? TAIL;
      // voiceover.mjs: seconds = ceil((lead + spoken + tail + hold) * 10) / 10
      const at = sceneStart + lead + 0.03;
      const end = sceneStart + scene.seconds - tail - (scene.hold ?? 0) - 0.05;
      groups.push({ from, to: i, at, end });
      i++;
    }
    sceneStart += scene.seconds;
  }
  let moved = 0;
  for (const g of groups) {
    // Map Whisper's span for this scene onto the real speech window (start and end).
    const a = words[g.from].start;
    const b = words[g.to].end;
    if (b - a < 0.2 || g.end - g.at < 0.2) continue;
    const k = (g.end - g.at) / (b - a);
    const map = (x) => +(g.at + (x - a) * k).toFixed(3);
    if (Math.abs(g.at - a) < 0.05 && Math.abs(k - 1) < 0.03) continue;
    for (let j = g.from; j <= g.to; j++) {
      words[j].start = map(words[j].start);
      words[j].end = map(words[j].end);
    }
    moved++;
  }
  writeFileSync(jsonPath, JSON.stringify(words, null, 2) + "\n");
  return moved;
}

// HyperFrames writes transcript.json into its project dir; use a throwaway one.
// Temp dir from paths.mjs (Windows temp paths can contain spaces, which break shell calls).
const work = mkdtempSync(join(tempDir, "captions-"));
mkdirSync("captions", { recursive: true });
try {
  hyperframes("transcribe", audio, "--dir", work, "--model", model, "--engine", "whisper");
  const json = `captions/${id}.json`;
  // Copy, not rename: the temp dir may be on another drive.
  copyFileSync(join(work, "transcript.json"), json);
  const moved = alignToScenes(json);
  hyperframes("transcribe", json, "--dir", work, "--to", "srt", "--output", resolve(`captions/${id}.srt`));
  const words = JSON.parse(readFileSync(json, "utf8"));
  console.log(`\nWrote ${json} (${words.length} words) and captions/${id}.srt`);
  if (moved) console.log(`Lined up ${moved} scene(s) with where their speech really starts (Whisper drifts across pauses).`);
  console.log("Whisper can mishear names and numbers: skim the text and fix any word in the JSON.");
} finally {
  rmSync(work, { recursive: true, force: true });
}
