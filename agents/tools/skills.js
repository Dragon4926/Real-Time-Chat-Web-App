// Explicit skill tools. Writes go through the same validated, rate-limited, audited store as autonomous reflection.
const store = require("../skills/store");

module.exports = {
  tools: [
    {
      name: "skill_search", group: "skills", description: "Search the team's skill library for reusable procedures.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      async run({ query }, ctx) {
        const found = store.search(String(query), 4);
        for (const s of found) ctx?.run?.skillsUsed.add(s.id);
        return found.map((s) => `[${s.id}] ${s.name} - ${s.description}\n${s.body}`).join("\n\n") || "no matching skills";
      },
    },
    {
      name: "skill_save", group: "skills",
      description: "Save or improve a reusable skill (a short, general procedure that worked) so the whole team can reuse it. Updates the skill if the name already exists.",
      parameters: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, when_to_use: { type: "string" }, tags: { type: "string" }, body: { type: "string" } }, required: ["name", "description", "body"] },
      async run(args, ctx) {
        const actor = `agent:${ctx.agent.name}`;
        const id = store.slug(args.name);
        const s = store.get(id) ? store.update(id, args, actor, "saved by agent during run") : store.create(args, actor, "saved by agent during run");
        return `saved skill ${s.id} v${s.version}`;
      },
    },
  ],
};
