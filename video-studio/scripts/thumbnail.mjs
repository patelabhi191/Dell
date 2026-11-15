// Usage: npm run thumbnail -- <episode-id> [cover-name]
// Renders every cover in the episode's "thumbnails" (or just the named one) to
// out/<id>-thumb-<name>.png, 1080x1920.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

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
for (const name of names) {
  const still = `${id}-thumb-${name}`;
  execFileSync("npx", ["remotion", "still", still, `out/${still}.png`, ...browser], { stdio: "inherit" });
}
