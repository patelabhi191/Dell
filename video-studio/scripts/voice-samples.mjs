// Usage: npm run voice-samples -- "Text to read" [voice ...]
// Reads one line in several Kokoro voices so you can compare them by ear. Writes
// <outDir>/voice-samples/<voice>.mp3 (outDir: see paths.mjs).
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { outDir } from "./paths.mjs";

const [text = "Ram prices nearly quadrupled in three months. So who's buying it all?", ...picked] = process.argv.slice(2);
const voices = picked.length ? picked : ["am_michael", "am_fenrir", "am_puck", "am_liam", "af_heart", "af_bella"];
const { KokoroTTS } = await import("kokoro-js");
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
const dir = join(outDir, "voice-samples");
mkdirSync(dir, { recursive: true });
for (const voice of voices) {
  const out = await tts.generate(text, { voice, speed: 1.15 });
  const wav = join(dir, `${voice}.wav`);
  await out.save(wav);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wav, "-af", "loudnorm=I=-16:TP=-1.5", "-b:a", "128k", join(dir, `${voice}.mp3`)]);
  rmSync(wav);
  console.log(`wrote ${join(dir, `${voice}.mp3`)}`);
}
writeFileSync(join(dir, "README.txt"), `Line: ${text}\nVoices: ${voices.join(", ")}\n`);
