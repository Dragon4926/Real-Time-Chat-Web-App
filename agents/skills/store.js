// Skill library: markdown files with frontmatter, full version history, audit log, retrieval and guardrails.
// Every autonomous change goes through the validators + rate limit here, and can be rolled back.
const fs = require("node:fs");
const path = require("node:path");
const config = require("../config");
const fm = require("../frontmatter");

const dirs = () => {
  const d = config.get().paths.data;
  return { skills: path.join(d, "skills"), versions: path.join(d, "versions"), agents: path.join(d, "agents"), audit: path.join(d, "audit.log") };
};
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const ensure = (p) => fs.mkdirSync(p, { recursive: true });

// Heuristic prompt-injection / escalation filter for text that will be injected into agent prompts.
const FORBIDDEN = /ignore (all |any |the )?(previous|prior|above|earlier) (instructions|rules|prompts?)|disregard (the |your )?(system|safety|core)|(disable|bypass|turn off|circumvent) (the )?(sandbox|safety|guardrails?|workspace|filter)|reveal (the |your )?(system prompt|api key|secret|password)|grant (yourself|me) .*tools?|you (now )?have (unrestricted|full) access|exfiltrat/i;

function assertSafeText(label, text) {
  if (FORBIDDEN.test(text)) throw new Error(`${label} rejected: looks like an instruction-override or privilege-escalation attempt`);
}

function validate(f, { partial = false } = {}) {
  const maxBytes = config.get().evolve.maxSkillBytes;
  const out = {};
  const need = (k) => { if (!partial && (typeof f[k] !== "string" || !f[k].trim())) throw new Error(`skill field "${k}" is required`); };
  for (const k of ["name", "description", "body"]) need(k);
  if (f.name !== undefined) {
    if (typeof f.name !== "string" || f.name.trim().length < 3 || f.name.length > 80) throw new Error("name must be 3-80 characters");
    out.name = f.name.trim();
  }
  if (f.description !== undefined) {
    if (typeof f.description !== "string" || f.description.length > 300) throw new Error("description must be <=300 characters");
    out.description = f.description.trim();
  }
  if (f.when_to_use !== undefined) {
    if (typeof f.when_to_use !== "string" || f.when_to_use.length > 300) throw new Error("when_to_use must be <=300 characters");
    out.when_to_use = f.when_to_use.trim();
  }
  if (f.tags !== undefined) {
    const tags = (Array.isArray(f.tags) ? f.tags : String(f.tags).split(",")).map((t) => String(t).trim().toLowerCase()).filter(Boolean);
    if (tags.length > 8) throw new Error("at most 8 tags");
    out.tags = tags.map((t) => t.slice(0, 30)).join(",");
  }
  if (f.body !== undefined) {
    if (typeof f.body !== "string" || Buffer.byteLength(f.body) > maxBytes) throw new Error(`body must be a string of <=${maxBytes} bytes`);
    out.body = f.body.trim();
  }
  for (const [k, v] of Object.entries(out)) assertSafeText(`skill ${k}`, String(v));
  return out;
}

function readFile(file) {
  const { meta, body } = fm.parse(fs.readFileSync(file, "utf8"));
  return {
    id: meta.id || path.basename(file, ".md"),
    name: meta.name || "", description: meta.description || "", when_to_use: meta.when_to_use || "",
    tags: (meta.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
    version: Number(meta.version) || 1, status: meta.status || "active",
    uses: Number(meta.uses) || 0, wins: Number(meta.wins) || 0, losses: Number(meta.losses) || 0,
    source: meta.source || "seed", updated: Number(meta.updated) || 0, merged_into: meta.merged_into || "",
    body,
  };
}
function render(s) {
  return fm.serialize({
    id: s.id, name: s.name, description: s.description, when_to_use: s.when_to_use, tags: s.tags.join(","),
    version: s.version, status: s.status, uses: s.uses, wins: s.wins, losses: s.losses,
    source: s.source, updated: s.updated, ...(s.merged_into ? { merged_into: s.merged_into } : {}),
  }, s.body);
}

// ---------- audit + rate limit ----------
function audit(entry) {
  const { audit: file } = dirs();
  ensure(path.dirname(file));
  fs.appendFileSync(file, `${JSON.stringify({ ts: Date.now(), ...entry })}\n`);
}
function readAudit(limit = 50) {
  try {
    return fs.readFileSync(dirs().audit, "utf8").trim().split("\n").filter(Boolean).slice(-limit).map((l) => JSON.parse(l)).reverse();
  } catch { return []; }
}
function checkRate(actor) {
  const cfg = config.get().evolve;
  if (!cfg.enabled && actor !== "user") throw new Error("self-evolution is disabled (SELF_EVOLVE=false)");
  if (actor === "user") return;
  const since = Date.now() - 3600_000;
  const EDITS = new Set(["create", "update", "retire", "merge-retire", "guidelines"]);
  const n = readAudit(500).filter((e) => e.ts >= since && EDITS.has(e.type) && e.actor !== "user" && e.actor !== "system").length;
  if (n >= cfg.maxEditsPerHour) throw new Error(`edit rate limit reached (${cfg.maxEditsPerHour}/hour)`);
}

// ---------- CRUD ----------
function save(s, actor, type, reason) {
  const d = dirs();
  ensure(d.skills); ensure(path.join(d.versions, s.id));
  s.updated = Date.now();
  const text = render(s);
  fs.writeFileSync(path.join(d.skills, `${s.id}.md`), text);
  fs.writeFileSync(path.join(d.versions, s.id, `v${s.version}.md`), text);
  audit({ type, target: "skill", id: s.id, version: s.version, actor, reason: reason || "" });
  return s;
}

function init() {
  const d = dirs();
  ensure(d.skills); ensure(d.versions); ensure(d.agents); ensure(config.get().paths.workspace);
  const seedDir = config.get().paths.seedSkills;
  if (!fs.existsSync(seedDir)) return;
  for (const f of fs.readdirSync(seedDir).filter((x) => x.endsWith(".md"))) {
    const id = path.basename(f, ".md");
    if (fs.existsSync(path.join(d.skills, `${id}.md`))) continue;
    const raw = fm.parse(fs.readFileSync(path.join(seedDir, f), "utf8"));
    const tags = (raw.meta.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
    save({ id, name: raw.meta.name || id, description: raw.meta.description || "", when_to_use: raw.meta.when_to_use || "", tags, version: 1, status: "active", uses: 0, wins: 0, losses: 0, source: "seed", body: raw.body }, "system", "seed");
  }
}

function list({ includeRetired = true } = {}) {
  const d = dirs().skills;
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith(".md")).map((f) => readFile(path.join(d, f)))
    .filter((s) => includeRetired || s.status === "active").sort((a, b) => a.name.localeCompare(b.name));
}
function get(id) {
  const file = path.join(dirs().skills, `${slug(id)}.md`);
  return fs.existsSync(file) ? readFile(file) : null;
}

function create(fields, actor = "system", reason) {
  checkRate(actor);
  const v = validate(fields);
  const id = slug(v.name);
  if (!id) throw new Error("invalid name");
  if (get(id)) throw new Error(`skill "${id}" already exists - update it instead`);
  return save({ id, name: v.name, description: v.description, when_to_use: v.when_to_use || "", tags: (v.tags || "").split(",").filter(Boolean), version: 1, status: "active", uses: 0, wins: 0, losses: 0, source: actor, body: v.body }, actor, "create", reason);
}

function update(id, fields, actor = "system", reason) {
  checkRate(actor);
  const cur = get(id);
  if (!cur) throw new Error(`no such skill "${id}"`);
  const v = validate(fields, { partial: true });
  const next = { ...cur, ...v, tags: v.tags !== undefined ? v.tags.split(",").filter(Boolean) : cur.tags, version: cur.version + 1, status: "active", source: actor };
  return save(next, actor, "update", reason);
}

function retire(id, actor = "system", reason, mergedInto = "") {
  checkRate(actor);
  const cur = get(id);
  if (!cur) throw new Error(`no such skill "${id}"`);
  if (cur.status === "retired") return cur;
  return save({ ...cur, status: "retired", merged_into: mergedInto, version: cur.version + 1 }, actor, mergedInto ? "merge-retire" : "retire", reason);
}

function merge(ids, into, actor = "system", reason) {
  checkRate(actor);
  if (!Array.isArray(ids) || ids.length < 2) throw new Error("merge needs at least 2 skill ids");
  const sources = ids.map((i) => { const s = get(i); if (!s) throw new Error(`no such skill "${i}"`); return s; });
  const targetId = slug(into?.name || "");
  const merged = targetId && get(targetId) ? update(targetId, into, actor, reason) : create(into, actor, reason);
  for (const s of sources) if (s.id !== merged.id) retire(s.id, actor, `merged into ${merged.id}`, merged.id);
  return merged;
}

function versions(id) {
  const d = path.join(dirs().versions, slug(id));
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).map((f) => Number(f.match(/^v(\d+)\.md$/)?.[1])).filter(Boolean).sort((a, b) => a - b);
}

// Restore an older version as a NEW version (history is never rewritten).
function rollback(id, to, actor = "user") {
  const cur = get(id);
  if (!cur) throw new Error(`no such skill "${id}"`);
  const vs = versions(cur.id);
  const target = to ?? [...vs].reverse().find((v) => v < cur.version);
  if (!target) throw new Error("no earlier version to roll back to");
  const file = path.join(dirs().versions, cur.id, `v${target}.md`);
  if (!fs.existsSync(file)) throw new Error(`version ${target} not found`);
  const old = readFile(file);
  return save({ ...old, id: cur.id, version: cur.version + 1, uses: cur.uses, wins: cur.wins, losses: cur.losses, status: "active", merged_into: "", source: actor }, actor, "rollback", `restored v${target}`);
}

// ---------- outcome statistics + auto-demotion ----------
function applyOutcome(ids, delta) {
  for (const id of ids) {
    const s = get(id);
    if (!s) continue;
    s.uses += delta.uses || 0;
    s.wins = Math.max(0, s.wins + (delta.wins || 0));
    s.losses = Math.max(0, s.losses + (delta.losses || 0));
    const decided = s.wins + s.losses;
    let demote = false;
    if (s.status === "active" && decided >= 5 && s.losses / decided > 0.6 && s.source !== "seed-protected") demote = true;
    if (demote) { s.status = "retired"; s.version += 1; audit({ type: "demote", target: "skill", id: s.id, version: s.version, actor: "system", reason: `win rate ${s.wins}/${decided}` }); }
    const d = dirs();
    s.updated = Date.now();
    const text = render(s);
    fs.writeFileSync(path.join(d.skills, `${s.id}.md`), text);
    if (demote) fs.writeFileSync(path.join(d.versions, s.id, `v${s.version}.md`), text);
  }
}

// ---------- retrieval (BM25-style) ----------
const stem = (w) => w.replace(/(ing|ed|es|s)$/, "");
const tokens = (s) => (String(s).toLowerCase().match(/[a-z0-9]{2,}/g) || []).map(stem);
const STOP = new Set(["the", "and", "for", "with", "that", "this", "you", "are", "can", "how", "what", "please", "use", "is", "to", "of", "in", "it", "on", "me", "my"]);

function search(query, k = config.get().evolve.topK) {
  const docs = list({ includeRetired: false }).map((s) => {
    const toks = [...tokens(s.name), ...tokens(s.name), ...tokens(s.name), ...tokens(s.tags.join(" ")), ...tokens(s.tags.join(" ")), ...tokens(s.description), ...tokens(s.description), ...tokens(s.when_to_use), ...tokens(s.when_to_use), ...tokens(s.body)];
    const tf = new Map();
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    return { s, tf, len: toks.length };
  });
  if (!docs.length) return [];
  const q = [...new Set(tokens(query))].filter((t) => !STOP.has(t));
  const N = docs.length;
  const avg = docs.reduce((a, d) => a + d.len, 0) / N || 1;
  const scored = docs.map((d) => {
    let score = 0;
    for (const t of q) {
      const f = d.tf.get(t) || 0;
      if (!f) continue;
      const df = docs.filter((x) => x.tf.has(t)).length;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      score += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (d.len / avg))));
    }
    const decided = d.s.wins + d.s.losses;
    return { s: d.s, score: score * (0.6 + 0.4 * ((d.s.wins + 1) / (decided + 2))) };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((x) => x.s);
}

// ---------- per-agent learned guidelines ----------
const gfile = (agent) => path.join(dirs().agents, `${slug(agent)}.guidelines.md`);
function getGuidelines(agent) { try { return fs.readFileSync(gfile(agent), "utf8").trim(); } catch { return ""; } }
function setGuidelines(agent, text, actor = "system", reason) {
  checkRate(actor);
  const max = config.get().evolve.maxGuidelineChars;
  if (typeof text !== "string" || text.length > max) throw new Error(`guidelines must be a string of <=${max} chars`);
  assertSafeText("guidelines", text);
  const d = dirs();
  ensure(d.agents);
  const vdir = path.join(d.versions, `agent-${slug(agent)}`);
  ensure(vdir);
  const n = (fs.readdirSync(vdir).length || 0) + 1;
  fs.writeFileSync(gfile(agent), `${text.trim()}\n`);
  fs.writeFileSync(path.join(vdir, `v${n}.md`), `${text.trim()}\n`);
  audit({ type: "guidelines", target: "agent", id: slug(agent), version: n, actor, reason: reason || "" });
  return { agent: slug(agent), version: n };
}
function rollbackGuidelines(agent, actor = "user") {
  const vdir = path.join(dirs().versions, `agent-${slug(agent)}`);
  const files = fs.existsSync(vdir) ? fs.readdirSync(vdir).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1))) : [];
  if (files.length < 2) { fs.rmSync(gfile(agent), { force: true }); audit({ type: "rollback", target: "agent", id: slug(agent), actor, reason: "cleared" }); return ""; }
  const prev = fs.readFileSync(path.join(vdir, files[files.length - 2]), "utf8");
  setGuidelines(agent, prev, actor, "rollback");
  return prev;
}

module.exports = { init, list, get, create, update, retire, merge, rollback, versions, search, applyOutcome, audit, readAudit, getGuidelines, setGuidelines, rollbackGuidelines, slug, assertSafeText };
