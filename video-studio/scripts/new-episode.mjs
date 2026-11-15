// Usage: npm run new -- <info|story> <number> "Episode title"
// Scaffolds episodes/<number>-<slug>.json with the beats from PLAYBOOK.md for that format.
import { existsSync, writeFileSync } from "node:fs";

const [format, num, title] = process.argv.slice(2);
if (!["info", "story"].includes(format) || !num || !title) {
  console.error('Usage: npm run new -- info 003 "How do magnets work?"');
  console.error('       npm run new -- story 004 "The heist that fooled Paris"');
  process.exit(1);
}
const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const id = `${num}-${slug}`;
const file = `episodes/${id}.json`;
if (existsSync(file)) {
  console.error(`${file} already exists`);
  process.exit(1);
}

const s = (beat, narration) => ({ type: "show", seconds: 3, beat, narration });
const scenes =
  format === "info"
    ? [
        s("hook", "SURPRISING FACT about something the viewer uses."),
        s("question", "So how does that work?"),
        s("imagine", "Imagine... (put the viewer in a scene, or an everyday analogy)."),
        s("happens", "Here's what happens."),
        s("step1", "First, ..."),
        s("step2", "But ... So ..."),
        s("twist", "But here's the twist: ..."),
        s("callback", "So, that ___? (one-line answer)"),
        s("comment", "Question answerable in one word?"),
        s("share", "Send this to the friend who ..."),
      ]
    : [
        s("cold", "The most surprising fact, stated flat."),
        s("place", "Where, when, who."),
        s("plan", "What they set out to do."),
        s("stakes", "A number, a risk, a secret."),
        s("move", "It happens."),
        s("twist", "What nobody expected."),
        s("comment", "One-word question? Send this to the friend who ..."),
      ];

// New videos use the reference look (PLAYBOOK.md, section 2): full-screen world, boxed captions.
const episode = {
  id,
  title,
  format,
  theme: "cinema",
  canvas: "full",
  captionStyle: "box",
  stage: `${slug}`,
  keywords: [],
  pacing: { lead: 0.08, tail: 0.18, sentenceGap: 0.12, minScene: 1.8 },
  scenes,
};
writeFileSync(file, JSON.stringify(episode, null, 2) + "\n");
console.log(`Created ${file}`);
console.log('Fill in each "narration", then follow PLAYBOOK.md section 7 (9 beats, one world).');
console.log(`Next: build src/stages/${slug}.tsx from src/kit and register it in fullStages (PLAYBOOK.md section 7).`);
