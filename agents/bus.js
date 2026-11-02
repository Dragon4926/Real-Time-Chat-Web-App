// Per-run coordination state shared by all agents in one run: call graph, mailboxes, blackboard, budgets.
const crypto = require("node:crypto");
const config = require("./config");

class Run {
  constructor({ scope, user, emit }) {
    this.id = crypto.randomBytes(5).toString("hex");
    this.scope = scope;
    this.user = user;
    this.controller = new AbortController();
    this.signal = this.controller.signal;
    this.emitRaw = emit;
    this.calls = 0;
    this.seq = 0;
    this.active = new Map();     // agent -> running invocations
    this.blackboard = new Map();
    this.mailboxes = new Map();  // agent -> [{from,text}]
    this.tasks = new Map();      // taskId -> {promise, agent, status}
    this.graph = [];             // call nodes
    this.skillsUsed = new Set();
    this.log = [];               // compact transcript for reflection
    this.stats = { toolCalls: 0, toolErrors: 0, a2a: 0 };
    this.startedAt = Date.now();
  }
  emit(event) { this.emitRaw({ runId: this.id, ts: Date.now(), ...event }); }
  note(line) { if (this.log.length < 400) this.log.push(line); }

  startCall({ agent, parentId, task, from, depth }) {
    const node = { id: `c${++this.seq}`, parent: parentId, agent, from, depth, task: String(task).slice(0, 160), status: "running" };
    this.graph.push(node);
    this.active.set(agent, (this.active.get(agent) || 0) + 1);
    this.emit({ type: "graph", nodes: this.graph });
    return node;
  }
  endCall(node, status) {
    node.status = status;
    this.active.set(node.agent, Math.max(0, (this.active.get(node.agent) || 1) - 1));
    this.emit({ type: "graph", nodes: this.graph });
  }

  // Guard rails for agent->agent calls. Returns null if allowed, otherwise a human-readable refusal.
  refuse({ from, to, question, chain, depth }) {
    const cfg = config.get().agents;
    if (this.signal.aborted) return "run was stopped";
    if (depth + 1 > cfg.maxDepth) return `call depth limit (${cfg.maxDepth}) reached - answer yourself or use the blackboard`;
    if (this.calls >= cfg.maxCallsPerRun) return `call budget for this run (${cfg.maxCallsPerRun}) is used up - finish with what you have`;
    if ((this.active.get(to) || 0) >= cfg.maxActivePerAgent) return `${to} is busy (too many parallel tasks)`;
    const key = (a, q) => `${a}:${String(q).toLowerCase().replace(/\s+/g, " ").trim().slice(0, 200)}`;
    if (chain.some((c) => c.agent === to && c.key === key(to, question))) return `cycle detected: ${to} was already asked this in the current call chain`;
    if (to === from) return "you cannot ask yourself";
    return null;
  }
  static key(agent, q) { return `${agent}:${String(q).toLowerCase().replace(/\s+/g, " ").trim().slice(0, 200)}`; }

  send(from, to, text) {
    const box = this.mailboxes.get(to) || [];
    if (box.length >= 20) throw new Error(`${to}'s mailbox is full`);
    box.push({ from, text: String(text).slice(0, 2000) });
    this.mailboxes.set(to, box);
  }
  drain(agent) { const box = this.mailboxes.get(agent) || []; this.mailboxes.set(agent, []); return box; }
}

module.exports = { Run };
