// Usage: npm run captions -- <episode-id> [--model base.en]
//
// Runs Whisper (via the HyperFrames CLI) on the episode's voiceover and writes
// captions/<id>.json (word timings, burned into the video) and captions/<id>.srt
// (upload to YouTube as subtitles). Run it after `npm run voiceover`.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

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
const hyperframes = (...a) => execFileSync("npx", ["hyperframes", ...a], { stdio: "inherit", env });

// HyperFrames writes transcript.json into its project dir; use a throwaway one.
const work = mkdtempSync(join(tmpdir(), "captions-"));
mkdirSync("captions", { recursive: true });
try {
  hyperframes("transcribe", audio, "--dir", work, "--model", model, "--engine", "whisper");
  const json = `captions/${id}.json`;
  renameSync(join(work, "transcript.json"), json);
  hyperframes("transcribe", json, "--dir", work, "--to", "srt", "--output", resolve(`captions/${id}.srt`));
  const words = JSON.parse(readFileSync(json, "utf8"));
  console.log(`\nWrote ${json} (${words.length} words) and captions/${id}.srt`);
  console.log("Whisper can mishear names and numbers: skim the text and fix any word in the JSON.");
} finally {
  rmSync(work, { recursive: true, force: true });
}
