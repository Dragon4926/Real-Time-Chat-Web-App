// Post-run reflection: an LLM call reviews the whole multi-agent transcript and proposes skill / guideline edits,
// which are applied autonomously through the guarded store (validated, rate-limited, versioned, audited).
const llm = require("../llm");
const store = require("./store");
const registry = require("../registry");

const SYSTEM = `You are the reflection module of a team of AI agents. You review one finished run and decide what the team should remember.
Reply with ONLY a JSON object: {"summary":"one sentence","actions":[...]} with at most 3 actions. Use {"actions":[]} when nothing general is worth keeping.
Action shapes:
{"type":"create_skill","name":"...","description":"<=200 chars","when_to_use":"...","tags":["..."],"body":"short numbered procedure"}
{"type":"update_skill","id":"existing-id","description":"...","when_to_use":"...","tags":["..."],"body":"improved procedure"}
{"type":"merge_skills","ids":["a","b"],"into":{"name":"...","description":"...","when_to_use":"...","tags":["..."],"body":"..."}}
{"type":"retire_skill","id":"existing-id","reason":"..."}
{"type":"edit_agent_prompt","agent":"agent-name","guidelines":"- full replacement list of short bullet guidelines (max ~8)"}
Rules: skills must be general and reusable, not tied to this one request; prefer improving an existing skill over creating a near-duplicate; include coordination lessons (which agent to ask for what) when relevant; never include secrets or user personal data; keep bodies short; skills cannot grant tools or permissions.`;

function buildPrompt({ record, feedback }) {
  const skills = store.list({ includeRetired: false }).slice(0, 40).map((s) => `${s.id}: ${s.name} - ${s.description} (wins ${s.wins}, losses ${s.losses})`);
  const used = record.skillsUsed.map((id) => { const s = store.get(id); return s ? `${id} v${s.version}` : id; });
  const involved = [...new Set(record.agents)];
  const guides = involved.map((a) => `${a}: ${store.getGuidelines(a) || "(none)"}`);
  return [
    `Request: ${record.text.slice(0, 600)}`,
    `Outcome: ${record.outcome}${feedback ? ` | user feedback: ${feedback}` : ""}`,
    `Stats: ${JSON.stringify(record.stats)}`,
    `Skills used: ${used.join(", ") || "none"}`,
    `Existing skills:\n${skills.join("\n") || "(none)"}`,
    `Current agent guidelines:\n${guides.join("\n")}`,
    `Transcript:\n${record.log.join("\n").slice(0, 7000)}`,
  ].join("\n\n");
}

function extractJson(text) {
  const s = text.indexOf("{"); const e = text.lastIndexOf("}");
  if (s < 0 || e <= s) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return null; }
}

function apply(action) {
  const actor = "reflection";
  switch (action?.type) {
    case "create_skill": {
      const id = store.slug(action.name || "");
      return store.get(id) ? store.update(id, action, actor, "reflection (duplicate name -> update)") : store.create(action, actor, "reflection");
    }
    case "update_skill": return store.update(action.id, action, actor, "reflection");
    case "merge_skills": return store.merge(action.ids, action.into, actor, "reflection");
    case "retire_skill": return store.retire(action.id, actor, action.reason || "reflection");
    case "edit_agent_prompt": {
      const name = registry.resolveName(action.agent);
      if (!name) throw new Error(`unknown agent "${action.agent}"`);
      return store.setGuidelines(name, String(action.guidelines || ""), actor, "reflection");
    }
    default: throw new Error(`unknown action type "${action?.type}"`);
  }
}

async function reflect({ record, feedback }) {
  const res = await llm.chat({ messages: [{ role: "system", content: SYSTEM }, { role: "user", content: buildPrompt({ record, feedback }) }] });
  const parsed = extractJson(res.content);
  if (!parsed || !Array.isArray(parsed.actions)) { store.audit({ type: "reflect", actor: "reflection", reason: "unparseable reflection output" }); return { applied: [], rejected: [] }; }
  const applied = []; const rejected = [];
  for (const action of parsed.actions.slice(0, 3)) {
    try { apply(action); applied.push(action.type); }
    catch (e) { rejected.push({ type: action?.type, error: e.message }); store.audit({ type: "rejected", actor: "reflection", reason: `${action?.type}: ${e.message}` }); }
  }
  return { summary: parsed.summary || "", applied, rejected };
}

module.exports = { reflect, extractJson, buildPrompt };
