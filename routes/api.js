// REST API for the agent team: status, skills (with rollback), audit log, feedback.
const express = require("express");
const llm = require("../agents/llm");
const registry = require("../agents/registry");
const store = require("../agents/skills/store");
const config = require("../agents/config");

module.exports = function apiRouter(runtime) {
  const r = express.Router();
  r.get("/health", async (req, res) => res.json(await llm.health()));
  r.get("/agents", (req, res) => res.json(registry.list().map(({ name, title, role, color, tools, source }) => ({ name, title, role, color, tools, source, guidelines: store.getGuidelines(name) }))));
  r.get("/skills", (req, res) => res.json(store.list().map((s) => ({ ...s, versions: store.versions(s.id) }))));
  r.get("/audit", (req, res) => res.json(store.readAudit(60)));
  r.get("/config", (req, res) => { const c = config.get(); res.json({ botName: c.agents.botName, selfEvolve: c.evolve.enabled, exec: c.tools.execEnabled, web: c.tools.webEnabled }); });
  r.post("/skills/:id/rollback", (req, res) => {
    try { res.json(store.rollback(req.params.id, req.body?.version ? Number(req.body.version) : undefined, "user")); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.post("/skills/:id/retire", (req, res) => {
    try { res.json(store.retire(req.params.id, "user", "retired by user")); } catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.post("/agents/:name/guidelines/rollback", (req, res) => {
    try { res.json({ guidelines: store.rollbackGuidelines(req.params.name, "user") }); } catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.post("/feedback", (req, res) => {
    try { res.json(runtime.feedback(String(req.body?.runId || ""), req.body?.vote)); } catch (e) { res.status(400).json({ error: e.message }); }
  });
  return r;
};
