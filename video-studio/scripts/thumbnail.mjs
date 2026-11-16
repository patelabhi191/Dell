// Usage: npm run thumbnail -- <episode-id> [cover-name]
// Renders every cover in the episode's "thumbnails" (or just the named one) to
// <outDir>/<id>-thumb-<name>.png, 1080x1920 (outDir: see paths.mjs).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { outDir } from "./paths.mjs";

const [id, only] = process.argv.slice(2);
let episode;
try {
  episode = JSON.parse(readFileSync(`episodes/${id}.json`, "utf8"));
} catch {
  console.error("Usage: npm run thumbnail -- <episode-id> [cover-name]");
  process.exit(1);
}
const names = (episode.thumbnails ?? []).map((t) => t.name).filter((n) => !only || n === only);
if (names.length === 0) {
  console.error(`No matching covers in episodes/${id}.json ("thumbnails")`);
  process.exit(1);
}
const browser = process.env.REMOTION_BROWSER
  ? ["--browser-executable", process.env.REMOTION_BROWSER, "--chrome-mode", "chrome-for-testing"]
  : [];
// On Windows, npx is a .cmd file and must run through the shell.
const shell = process.platform === "win32";
// REMOTION_GL picks the graphics backend, e.g. "angle" to render on an NVIDIA GPU on Windows,
// "angle-egl" or "vulkan" on Linux. Unset = Remotion's default (CPU-friendly).
const gl = process.env.REMOTION_GL ? [`--gl=${process.env.REMOTION_GL}`] : [];
for (const name of names) {
  const still = `${id}-thumb-${name}`;
  execFileSync("npx", ["remotion", "still", still, join(outDir, `${still}.png`), ...browser, ...gl], { stdio: "inherit", shell });
}
