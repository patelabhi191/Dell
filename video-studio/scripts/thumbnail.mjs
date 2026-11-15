// Usage: npm run thumbnail -- <episode-id>
// Renders out/<id>-thumb.png (1080x1920 Reel cover) from the episode's "thumbnail" settings.
import { execFileSync } from "node:child_process";

const id = process.argv[2];
if (!id) {
  console.error("Usage: npm run thumbnail -- <episode-id>");
  process.exit(1);
}
const browser = process.env.REMOTION_BROWSER
  ? ["--browser-executable", process.env.REMOTION_BROWSER, "--chrome-mode", "chrome-for-testing"]
  : [];
execFileSync("npx", ["remotion", "still", `${id}-thumb`, `out/${id}-thumb.png`, ...browser], { stdio: "inherit" });
