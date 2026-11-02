// Run lifecycle: parse mentions, start runs, stream events, persist records, learn from outcomes.
const fs = require("node:fs");
const path = require("node:path");
const config = require("./config");
const registry = require("./registry");
const store = require("./skills/store");
const { reflect } = require("./skills/reflect");
const { Run } = require("./bus");
const { runAgent } = require("./loop");

const MAX_ACTIVE_RUNS = Number(process.env.MAX_ACTIVE_RUNS) || 3;

function parseMentions(text) {
  const out = [];
  for (const m of String(text).matchAll(/(^|[\s(])@([a-z0-9_-]{2,30})\b/gi)) {
    const n = registry.resolveName(m[2]);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

function createRuntime({ emitToScope, getRoomHistory = () => [] }) {
  store.init();
  const active = new Map();   // runId -> Run
  const records = new Map();  // runId -> record (recent)
  let reflectChain = Promise.resolve();

  const saveRecord = (rec) => {
    records.set(rec.id, rec);
    if (records.size > 200) records.delete(records.keys().next().value);
    try {
      const dir = path.join(config.get().paths.data, "runs");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${rec.id}.json`), JSON.stringify({ ...rec, log: rec.log.slice(0, 200) }, null, 1));
    } catch { /* non-fatal */ }
  };
  const loadRecord = (id) => {
    if (records.has(id)) return records.get(id);
    try { return JSON.parse(fs.readFileSync(path.join(config.get().paths.data, "runs", `${String(id).replace(/[^a-z0-9]/gi, "")}.json`), "utf8")); } catch { return null; }
  };

  const verdict = (o) => (o === "ok" || o === "up" ? "win" : o === "error" || o === "down" ? "loss" : null);

  function recordOutcome(id, outcome) {
    const rec = loadRecord(id);
    if (!rec) throw new Error("unknown run");
    const prev = verdict(rec.outcome);
    const next = verdict(outcome);
    if (prev !== next) {
      const ids = rec.skillsUsed;
      store.applyOutcome(ids, { wins: (next === "win" ? 1 : 0) - (prev === "win" ? 1 : 0), losses: (next === "loss" ? 1 : 0) - (prev === "loss" ? 1 : 0) });
    }
    rec.outcome = outcome;
    saveRecord(rec);
    return rec;
  }

  function queueReflection(rec, feedback) {
    if (!config.get().evolve.enabled) return;
    reflectChain = reflectChain.then(async () => {
      try {
        const r = await reflect({ record: rec, feedback });
        if (r.applied.length || r.rejected.length) rec.scopeEmit?.({ type: "learned", applied: r.applied, rejected: r.rejected, summary: r.summary });
      } catch (e) { store.audit({ type: "reflect", actor: "reflection", reason: `failed: ${e.message}` }); }
    });
    return reflectChain;
  }

  function startRun({ scope, user, text, target }) {
    if (active.size >= MAX_ACTIVE_RUNS) throw new Error("the team is busy with other tasks - try again in a moment");
    const mentions = parseMentions(text);
    const entry = registry.resolveName(target) || mentions[0] || "grok";
    const run = new Run({ scope, user, emit: (e) => emitToScope(scope, e) });
    active.set(run.id, run);
    const history = getRoomHistory(scope).slice(-10).map((m) => `${m.user}: ${m.text}`).join("\n");
    const others = mentions.filter((m) => m !== entry);
    const task = [
      history ? `Recent chat in this room:\n${history}\n` : "",
      `Request from ${user}:\n${text}`,
      others.length ? `\n(The user also mentioned: ${others.map((o) => `@${o}`).join(", ")} - involve them if useful.)` : "",
    ].join("\n").trim();

    const timer = setTimeout(() => run.controller.abort(), config.get().agents.runTimeoutMs);
    run.emit({ type: "run_start", entry, user, text: String(text).slice(0, 500) });

    (async () => {
      let outcome = "ok"; let final = ""; let error = "";
      try {
        final = await runAgent({ run, name: entry, task, extra: { getRoomHistory: () => getRoomHistory(scope) } });
      } catch (e) {
        error = e.message;
        outcome = run.signal.aborted ? "aborted" : "error";
      } finally {
        clearTimeout(timer);
        // Unjoined spawned tasks are abandoned.
        if ([...run.tasks.values()].some((t) => t.status === "running")) run.controller.abort();
        active.delete(run.id);
      }
      const rec = { id: run.id, ts: Date.now(), scope: undefined, entry, text: String(text).slice(0, 600), outcome, final: final.slice(0, 2000), error, stats: run.stats, skillsUsed: [...run.skillsUsed], agents: run.graph.map((n) => n.agent), log: run.log, scopeEmit: undefined };
      saveRecord(rec);
      const v = verdict(outcome);
      if (v) store.applyOutcome(rec.skillsUsed, { uses: 1, wins: v === "win" ? 1 : 0, losses: v === "loss" ? 1 : 0 });
      else store.applyOutcome(rec.skillsUsed, { uses: 1 });
      run.emit({ type: "run_end", outcome, error, final, stats: run.stats, nodes: run.graph });
      // Reflect when something worth learning from happened (keeps load low on local models).
      if (outcome !== "aborted" && (run.stats.toolCalls > 0 || run.stats.a2a > 0 || outcome === "error")) {
        rec.scopeEmit = (e) => run.emit(e);
        queueReflection(rec);
      }
    })();
    return run.id;
  }

  function stop(runId) { active.get(runId)?.controller.abort(); return active.has(runId); }
  const scopeOf = (runId) => active.get(runId)?.scope;

  function feedback(runId, vote) {
    if (!["up", "down"].includes(vote)) throw new Error("vote must be up or down");
    const rec = recordOutcome(runId, vote);
    if (vote === "down") queueReflection(rec, "the user marked this answer as bad");
    return { ok: true };
  }

  return { startRun, stop, feedback, scopeOf, parseMentions, recordOutcome, flushReflection: () => reflectChain, activeCount: () => active.size };
}

module.exports = { createRuntime, parseMentions };
