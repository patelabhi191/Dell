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

const s = (type, fields) => ({ type, seconds: 4, ...fields, narration: "" });
const scenes =
  format === "info"
    ? [
        s("show", { heading: "The *hook* question?", tag: "and the second question" }),
        s("show", { tag: "What you need first" }),
        s("show", { tag: "How it works" }),
        s("stat", { value: 10, suffix: "x", label: "The one number worth *remembering*" }),
        s("statement", { tag: "Here's the odd part", tagTone: "accent", text: "The *turn*" }),
        s("show", { tag: "The payoff" }),
        s("statement", { text: "One line that ties back to *the hook*" }),
        s("outro", { title: "Now you *know*", cta: "Follow", ctaNote: "for more" }),
      ]
    : [
        s("statement", { tag: "True story", tagTone: "accent", text: "The most *surprising* fact" }),
        s("show", { tag: "Place, year" }),
        s("show", { tag: "The plan" }),
        s("show", { tag: "The stakes" }),
        s("show", { tag: "The move", tagTone: "alert" }),
        s("statement", { text: "The *twist*" }),
        s("outro", { title: "A question to *comment*?", cta: "Follow", ctaNote: "for more true stories" }),
      ];

const episode = { id, title, format, theme: format === "story" ? "night" : "light", keywords: [], scenes };
writeFileSync(file, JSON.stringify(episode, null, 2) + "\n");
console.log(`Created ${file}`);
console.log('Fill in each "narration", then follow PLAYBOOK.md section 6.');
console.log('For custom visuals add a stage in src/stages/ and set "stage" plus per-scene "beat".');
