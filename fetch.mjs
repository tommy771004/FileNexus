import fs from "fs";

async function run() {
  const res = await fetch("https://lobehub.com/skills/carmandale-agent-config-apple-design-prompts/skill.md");
  const text = await res.text();
  fs.writeFileSync("lobehub-skill.md", text);
}

run();
