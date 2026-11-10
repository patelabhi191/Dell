// Usage: npm run narration -- <episode-id>
// Prints the voiceover script with timings, ready to record or paste into a TTS tool.
import { readFileSync } from "node:fs";

const id = process.argv[2];
let episode;
try {
  episode = JSON.parse(readFileSync(`episodes/${id}.json`, "utf8"));
} catch {
  console.error("Usage: npm run narration -- <episode-id>");
  process.exit(1);
}
let t = 0;
const stamp = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
console.log(`# ${episode.title}\n`);
for (const scene of episode.scenes) {
  if (scene.narration) {
    const words = scene.narration.split(/\s+/).length;
    const fits = words / scene.seconds <= 2.8 ? "" : "  <-- too many words for this scene";
    console.log(`[${stamp(t)}] ${scene.narration}${fits}`);
  }
  t += scene.seconds;
}
console.log(`\nTotal: ${stamp(t)}`);
