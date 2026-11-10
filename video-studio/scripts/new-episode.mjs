// Usage: npm run new -- <number> "Episode title"
import { existsSync, writeFileSync } from "node:fs";

const [num, title] = process.argv.slice(2);
if (!num || !title) {
  console.error('Usage: npm run new -- 002 "How do magnets work?"');
  process.exit(1);
}
const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const id = `${num}-${slug}`;
const file = `episodes/${id}.json`;
if (existsSync(file)) {
  console.error(`${file} already exists`);
  process.exit(1);
}
const episode = {
  id,
  title,
  theme: "midnight",
  scenes: [
    { type: "title", seconds: 3.5, kicker: "60-second science", title, narration: "" },
    { type: "text", seconds: 5, icon: "bulb", heading: "The hook", body: "One surprising sentence.", narration: "" },
    { type: "outro", seconds: 3.5, title: "Now you know.", cta: "Follow for more", narration: "" },
  ],
};
writeFileSync(file, JSON.stringify(episode, null, 2) + "\n");
console.log(`Created ${file}`);
