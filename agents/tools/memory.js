// Persistent notes + room history lookup.
const fs = require("node:fs");
const path = require("node:path");
const config = require("../config");

const file = () => path.join(config.get().paths.data, "memory.json");
function load() { try { return JSON.parse(fs.readFileSync(file(), "utf8")); } catch { return []; } }
function save(notes) {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(notes, null, 2));
}
const tok = (s) => String(s).toLowerCase().match(/[a-z0-9]{2,}/g) || [];

module.exports = {
  tools: [
    {
      name: "note_save", group: "memory",
      description: "Save a durable note (fact, preference, result) that any agent can find later.",
      parameters: { type: "object", properties: { text: { type: "string" }, tags: { type: "string", description: "comma separated" } }, required: ["text"] },
      async run({ text, tags = "" }, ctx) {
        if (typeof text !== "string" || !text.trim() || text.length > 2000) throw new Error("text must be 1-2000 chars");
        const notes = load();
        const note = { id: `n${Date.now().toString(36)}`, text: text.trim(), tags: String(tags).split(",").map((t) => t.trim()).filter(Boolean), by: ctx?.agent?.name || "?", ts: Date.now() };
        notes.push(note);
        save(notes.slice(-500));
        return `saved note ${note.id}`;
      },
    },
    {
      name: "note_search", group: "memory",
      description: "Search saved notes by keywords.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      async run({ query }) {
        const q = new Set(tok(query));
        const scored = load().map((n) => ({ n, s: tok(`${n.text} ${n.tags.join(" ")}`).filter((t) => q.has(t)).length })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 5);
        return scored.map(({ n }) => `[${n.id}] ${n.text}`).join("\n") || "no matching notes";
      },
    },
    {
      name: "room_history", group: "memory",
      description: "Read the most recent chat messages from the room this conversation is happening in.",
      parameters: { type: "object", properties: { limit: { type: "number" } } },
      async run({ limit = 20 }, ctx) {
        const rows = (ctx?.getRoomHistory?.() || []).slice(-Math.min(Number(limit) || 20, 50));
        return rows.map((m) => `${m.user}: ${m.text}`).join("\n") || "(no messages)";
      },
    },
  ],
};
