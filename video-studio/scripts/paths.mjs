// Where finished files and temp files go on this machine.
//
// Reads studio.local.json (git-ignored, one per machine) if present:
//   { "outDir": "D:\\Claude\\output", "tempDir": "D:\\Claude\\output\\temp",
//     "whisperPath": "D:\\Claude\\tools\\whisper\\Release\\whisper-cli.exe" }
// Env vars STUDIO_OUT_DIR / STUDIO_TEMP_DIR override it. Defaults: out/ and .tmp/ in the project.
// Avoid spaces in these paths: some helper commands run through the shell on Windows.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let local = {};
if (existsSync("studio.local.json")) {
  try {
    local = JSON.parse(readFileSync("studio.local.json", "utf8"));
  } catch (e) {
    console.warn(`studio.local.json is not valid JSON, ignoring it (${e.message})`);
  }
}

export const outDir = resolve(process.env.STUDIO_OUT_DIR || local.outDir || "out");
export const tempDir = resolve(process.env.STUDIO_TEMP_DIR || local.tempDir || ".tmp");
mkdirSync(outDir, { recursive: true });
mkdirSync(tempDir, { recursive: true });

// Prebuilt whisper-cli for captions, if this machine cannot build whisper.cpp itself.
if (local.whisperPath && !process.env.HYPERFRAMES_WHISPER_PATH) {
  process.env.HYPERFRAMES_WHISPER_PATH = local.whisperPath;
}
