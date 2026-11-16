// Usage: npm run setup
//
// One-time setup on a new computer: checks the tools, downloads the Kokoro voice model
// (the house voices am_liam and am_puck) and the Whisper speech-to-text runtime + model used
// for captions, so later runs work offline. Safe to run again: cached files are reused.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

const shell = process.platform === "win32";
const ok = (msg) => console.log(`  ok  ${msg}`);
const fail = (msg) => {
  console.error(`  !!  ${msg}`);
  process.exitCode = 1;
};

console.log("\n1. Tools");
const [major] = process.versions.node.split(".").map(Number);
major >= 22 ? ok(`Node.js ${process.versions.node}`) : fail(`Node.js ${process.versions.node}: version 22 or newer is needed`);
spawnSync("ffmpeg", ["-version"]).status === 0 ? ok("ffmpeg") : fail("ffmpeg not found on PATH (Windows: winget install Gyan.FFmpeg, then reopen the terminal)");
spawnSync("git", ["--version"]).status === 0 ? ok("git") : fail("git not found (Windows: winget install Git.Git)");

console.log("\n2. Voice model (Kokoro, about 90 MB on first run)");
const { KokoroTTS } = await import("kokoro-js");
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
// Temp files live inside the project: Windows temp paths can contain spaces (user names),
// which break commands run through the shell.
mkdirSync(".tmp", { recursive: true });
const work = mkdtempSync(join(".tmp", "setup-"));
for (const voice of ["am_liam", "am_puck"]) {
  if (!tts.voices[voice]) fail(`voice ${voice} missing from the model`);
}
const sample = await tts.generate("Frontier in sixty. Setup check: the voice and the captions both work.", { voice: "am_liam", speed: 1.2 });
const wav = join(work, "check.wav");
await sample.save(wav);
ok(`am_liam and am_puck ready (${Object.keys(tts.voices).length} voices in the model)`);

console.log("\n3. Whisper (captions): runtime + base.en model on first run");
try {
  execFileSync("npx", ["hyperframes", "transcribe", wav, "--dir", work, "--model", "base.en", "--engine", "whisper"], {
    stdio: "inherit",
    shell,
    env: { ...process.env, DO_NOT_TRACK: "1" },
  });
  ok("Whisper ready");
} catch {
  fail("Whisper download or run failed (see the output above)");
}
rmSync(work, { recursive: true, force: true });

console.log(process.exitCode ? "\nSetup finished with problems (marked !!).\n" : "\nAll set. Models are cached; next runs work offline.\n");
