// Usage: npm run render -- <episode-id> [short|long]
// Renders <outDir>/<episode-id>-short.mp4 (1080x1920) and <outDir>/<episode-id>-long.mp4
// (1920x1080). outDir is out/ unless studio.local.json or STUDIO_OUT_DIR says otherwise.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { outDir } from "./paths.mjs";

const [id, only] = process.argv.slice(2);
if (!id || !existsSync(`episodes/${id}.json`)) {
  console.error("Usage: npm run render -- <episode-id> [short|long]   (id = file name in episodes/)");
  process.exit(1);
}
// On Windows, npx is a .cmd file and must run through the shell.
const shell = process.platform === "win32";
// REMOTION_GL picks the graphics backend, e.g. "angle" to render on an NVIDIA GPU on Windows,
// "angle-egl" or "vulkan" on Linux. Unset = Remotion's default (CPU-friendly).
const gl = process.env.REMOTION_GL ? [`--gl=${process.env.REMOTION_GL}`] : [];
const formats = only ? [only] : ["short", "long"];
// Set REMOTION_BROWSER to reuse an installed Chrome instead of Remotion's own download.
const browser = process.env.REMOTION_BROWSER
  ? ["--browser-executable", process.env.REMOTION_BROWSER, "--chrome-mode", "chrome-for-testing"]
  : [];

for (const format of formats) {
  const name = `${id}-${format}`;
  const file = join(outDir, `${name}.mp4`);
  execFileSync("npx", ["remotion", "render", name, file, ...browser, ...gl], {
    shell,
    stdio: "inherit",
  });
  console.log(`Saved ${file}`);
}
