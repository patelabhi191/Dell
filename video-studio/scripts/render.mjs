// Usage: npm run render -- <episode-id> [short|long]
// Renders out/<episode-id>-short.mp4 (1080x1920) and out/<episode-id>-long.mp4 (1920x1080).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const [id, only] = process.argv.slice(2);
if (!id || !existsSync(`episodes/${id}.json`)) {
  console.error("Usage: npm run render -- <episode-id> [short|long]   (id = file name in episodes/)");
  process.exit(1);
}
const formats = only ? [only] : ["short", "long"];
// Set REMOTION_BROWSER to reuse an installed Chrome instead of Remotion's own download.
const browser = process.env.REMOTION_BROWSER
  ? ["--browser-executable", process.env.REMOTION_BROWSER, "--chrome-mode", "chrome-for-testing"]
  : [];

for (const format of formats) {
  const name = `${id}-${format}`;
  execFileSync("npx", ["remotion", "render", name, `out/${name}.mp4`, ...browser], {
    stdio: "inherit",
  });
}
