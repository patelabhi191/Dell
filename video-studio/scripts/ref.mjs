// Usage: npm run ref -- <video-url> [extra yt-dlp flags]
//
// Downloads a reference video (720p max) with yt-dlp into refs/, which is not committed.
// For studying pacing and style only: do not reuse other people's footage in your videos.
// Needs yt-dlp on your PATH: pip install yt-dlp
import { spawnSync } from "node:child_process";

const [url, ...extra] = process.argv.slice(2);
if (!url) {
  console.error("Usage: npm run ref -- <video-url>");
  process.exit(1);
}
const result = spawnSync(
  "yt-dlp",
  ["--no-playlist", "-f", "bv*[height<=720]+ba/b[height<=720]/b", "--merge-output-format", "mp4",
   "--restrict-filenames", "-o", "refs/%(title).60s-%(id).20s.%(ext)s", ...extra, url],
  { stdio: "inherit" },
);
if (result.error?.code === "ENOENT") {
  console.error("yt-dlp is not installed. Run: pip install yt-dlp");
  process.exit(1);
}
process.exit(result.status ?? 1);
