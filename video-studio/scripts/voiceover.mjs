// Usage: npm run voiceover -- <episode-id> [--voice am_liam] [--speed 1] [--provider kokoro]
//
// Speaks every scene's "narration", stretches each scene's "seconds" to fit its line,
// writes one audio track to public/audio/<id>.mp3 and points the episode at it.
// `npm run voiceover -- --voices` lists the available voices.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const LEAD = 0.2; // silence before a line, lets the scene animate in
const TAIL = 0.35; // silence after a line, before the next scene
const SENTENCE_GAP = 0.22;
const MIN_SCENE = 2.5;

/**
 * Text-to-speech providers. Each returns `{ voices, speak(text) }` where `speak` resolves to
 * mono PCM: `{ samples: Float32Array, sampleRate }`. To try another service (ElevenLabs,
 * OpenAI, ...), add an entry here that calls its API and decodes the result to PCM, then
 * run with `--provider <name>` and compare.
 */
const providers = {
  /** Kokoro: free, open-source, runs locally. Downloads a ~90 MB model on first use. */
  async kokoro({ voice = "am_liam", speed }) {
    const { KokoroTTS } = await import("kokoro-js");
    const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: "q8",
      device: "cpu",
    });
    return {
      voices: Object.keys(tts.voices),
      async speak(text) {
        const out = await tts.generate(text, { voice, speed });
        return { samples: out.audio, sampleRate: out.sampling_rate };
      },
    };
  },
};

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const id = args[0]?.startsWith("--") ? undefined : args[0];
const file = `episodes/${id}.json`;
const listVoices = args.includes("--voices");

if (!listVoices && (!id || !existsSync(file))) {
  console.error("Usage: npm run voiceover -- <episode-id> [--voice name] [--speed 1]");
  console.error("       npm run voiceover -- --voices");
  process.exit(1);
}

const episode = listVoices ? {} : JSON.parse(readFileSync(file, "utf8"));
const providerName = flag("provider", "kokoro");
if (!providers[providerName]) {
  console.error(`Unknown provider "${providerName}". Available: ${Object.keys(providers).join(", ")}`);
  process.exit(1);
}
// House voices (see PLAYBOOK.md): am_liam for info videos, am_puck (slower) for stories.
const voice = flag("voice", episode.voice ?? (episode.format === "story" ? "am_puck" : "am_liam"));
const defaultSpeed = episode.voiceSpeed ?? (episode.format === "story" ? 0.88 : 1.0);
const speed = Number(flag("speed", defaultSpeed));
const tts = await providers[providerName]({ voice, speed });

if (listVoices) {
  console.log(tts.voices.join("\n"));
  process.exit(0);
}
if (voice && !tts.voices.includes(voice)) {
  console.error(`Unknown voice "${voice}". Run: npm run voiceover -- --voices`);
  process.exit(1);
}

// Engines pad each clip with silence; cut it so pauses come only from the gaps set above.
const trimSilence = (samples, sampleRate) => {
  const keep = Math.round(0.03 * sampleRate);
  let a = 0;
  let b = samples.length - 1;
  while (a < b && Math.abs(samples[a]) < 0.012) a++;
  while (b > a && Math.abs(samples[b]) < 0.012) b--;
  return samples.subarray(Math.max(0, a - keep), Math.min(samples.length, b + keep));
};

// Speak sentence by sentence: keeps each request short and gives natural pauses.
const speakLine = async (text) => {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g).map((s) => s.trim());
  const parts = [];
  let sampleRate;
  for (const sentence of sentences.filter(Boolean)) {
    const out = await tts.speak(sentence);
    sampleRate = out.sampleRate;
    parts.push(trimSilence(out.samples, sampleRate));
  }
  const gap = Math.round(SENTENCE_GAP * sampleRate);
  const total = parts.reduce((n, p) => n + p.length, 0) + gap * (parts.length - 1);
  const samples = new Float32Array(total);
  let at = 0;
  for (const p of parts) {
    samples.set(p, at);
    at += p.length + gap;
  }
  return { samples, sampleRate };
};

const clips = [];
let sampleRate = 24000;
let start = 0;
for (const [i, scene] of episode.scenes.entries()) {
  const text = scene.narration?.trim();
  if (text) {
    const clip = await speakLine(text);
    sampleRate = clip.sampleRate;
    const spoken = clip.samples.length / sampleRate;
    scene.seconds = Math.max(MIN_SCENE, Math.ceil((LEAD + spoken + TAIL) * 10) / 10);
    clips.push({ at: start + LEAD, samples: clip.samples });
    console.log(`scene ${i + 1}: ${spoken.toFixed(1)}s spoken -> ${scene.seconds}s on screen`);
  } else {
    console.log(`scene ${i + 1}: no narration, keeping ${scene.seconds}s`);
  }
  start += scene.seconds;
}
if (clips.length === 0) {
  console.error('Nothing to say: no scene has "narration" text.');
  process.exit(1);
}

// Lay every clip onto one track at its scene's start time.
const track = new Float32Array(Math.ceil(start * sampleRate));
for (const clip of clips) track.set(clip.samples, Math.round(clip.at * sampleRate));

const wav = Buffer.alloc(44 + track.length * 2);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + track.length * 2, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); // PCM
wav.writeUInt16LE(1, 22); // mono
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(track.length * 2, 40);
for (let i = 0; i < track.length; i++) {
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, track[i])) * 32767), 44 + i * 2);
}

mkdirSync("public/audio", { recursive: true });
const wavPath = `public/audio/${id}.wav`;
const mp3Path = `public/audio/${id}.mp3`;
writeFileSync(wavPath, wav);

// Prefer a small MP3 when ffmpeg is installed; otherwise the WAV works as-is.
let output = wavPath;
if (spawnSync("ffmpeg", ["-version"]).status === 0) {
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", wavPath,
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", "-b:a", "96k", mp3Path,
  ]);
  rmSync(wavPath);
  output = mp3Path;
} else {
  rmSync(mp3Path, { force: true });
}

episode.voiceover = output.replace("public/audio/", "");
writeFileSync(file, JSON.stringify(episode, null, 2) + "\n");
const wordCount = episode.scenes.reduce((n, s) => n + (s.narration?.trim().split(/\s+/).length ?? 0), 0);
console.log(`\nWrote ${output} (${start.toFixed(1)}s, ${Math.round((wordCount / start) * 60)} words/min) and updated ${file}`);
