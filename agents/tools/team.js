// Peer-to-peer coordination tools, granted to every agent. They rely on ctx.invoke (set by loop.js).
const { Run } = require("../bus");
const registry = require("../registry");

const need = (name) => {
  const n = registry.resolveName(name);
  if (!n) throw new Error(`unknown agent "${name}". Known: ${registry.list().map((a) => a.name).join(", ")}`);
  return n;
};

module.exports = {
  tools: [
    {
      name: "list_agents", group: "team", description: "List the teammates you can contact and what each is good at.",
      parameters: { type: "object", properties: {} },
      async run() { return registry.list().map((a) => `${a.name}: ${a.role}`).join("\n"); },
    },
    {
      name: "ask_agent", group: "team",
      description: "Ask a teammate a question or hand them a sub-task and wait for their answer. Include all context they need.",
      parameters: { type: "object", properties: { name: { type: "string" }, question: { type: "string" } }, required: ["name", "question"] },
      async run({ name, question }, ctx) {
        const to = need(name);
        ctx.run.stats.a2a++;
        ctx.run.emit({ type: "a2a", kind: "ask", from: ctx.agent.name, to, text: String(question).slice(0, 600) });
        ctx.run.note(`${ctx.agent.name} -> ${to} (ask): ${String(question).slice(0, 200)}`);
        const answer = await ctx.invoke(to, String(question), { kind: "ask" });
        ctx.run.emit({ type: "a2a", kind: "answer", from: to, to: ctx.agent.name, text: String(answer).slice(0, 600) });
        return answer;
      },
    },
    {
      name: "send_message", group: "team",
      description: "Send a non-blocking note to a teammate. They read it the next time they run in this task.",
      parameters: { type: "object", properties: { name: { type: "string" }, text: { type: "string" } }, required: ["name", "text"] },
      async run({ name, text }, ctx) {
        const to = need(name);
        ctx.run.send(ctx.agent.name, to, text);
        ctx.run.stats.a2a++;
        ctx.run.emit({ type: "a2a", kind: "message", from: ctx.agent.name, to, text: String(text).slice(0, 600) });
        ctx.run.note(`${ctx.agent.name} -> ${to} (message): ${String(text).slice(0, 200)}`);
        return `message queued for ${to}`;
      },
    },
    {
      name: "spawn_task", group: "team",
      description: "Start a sub-task on a teammate in parallel and return a task id immediately. Collect results later with await_tasks.",
      parameters: { type: "object", properties: { name: { type: "string" }, task: { type: "string" } }, required: ["name", "task"] },
      async run({ name, task }, ctx) {
        const to = need(name);
        const reason = ctx.run.refuse({ from: ctx.agent.name, to, question: task, chain: ctx.chain, depth: ctx.depth });
        if (reason) throw new Error(reason);
        const id = `t${ctx.run.tasks.size + 1}`;
        ctx.run.stats.a2a++;
        ctx.run.emit({ type: "a2a", kind: "spawn", from: ctx.agent.name, to, text: String(task).slice(0, 600) });
        ctx.run.note(`${ctx.agent.name} -> ${to} (spawn ${id}): ${String(task).slice(0, 200)}`);
        const entry = { agent: to, status: "running", result: "" };
        entry.promise = ctx.invoke(to, String(task), { kind: "spawn" })
          .then((r) => { entry.status = "done"; entry.result = r; })
          .catch((e) => { entry.status = "failed"; entry.result = e.message; });
        ctx.run.tasks.set(id, entry);
        return `started ${id} on ${to}`;
      },
    },
    {
      name: "await_tasks", group: "team",
      description: "Wait for spawned tasks (all of them, or the ids given as comma separated text) and return their results.",
      parameters: { type: "object", properties: { ids: { type: "string" } } },
      async run({ ids }, ctx) {
        const want = ids ? String(ids).split(",").map((s) => s.trim()).filter(Boolean) : [...ctx.run.tasks.keys()];
        const entries = want.map((id) => [id, ctx.run.tasks.get(id)]);
        const missing = entries.filter(([, e]) => !e).map(([id]) => id);
        if (missing.length) throw new Error(`unknown task id(s): ${missing.join(", ")}`);
        await Promise.all(entries.map(([, e]) => e.promise));
        return entries.map(([id, e]) => `## ${id} (${e.agent}, ${e.status})\n${e.result}`).join("\n\n") || "no tasks";
      },
    },
    {
      name: "blackboard_write", group: "team",
      description: "Write a value on the shared scratchpad for this task so all teammates can read it (plans, partial results, decisions).",
      parameters: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } }, required: ["key", "value"] },
      async run({ key, value }, ctx) {
        if (ctx.run.blackboard.size >= 50 && !ctx.run.blackboard.has(key)) throw new Error("blackboard is full");
        ctx.run.blackboard.set(String(key).slice(0, 60), { value: String(value).slice(0, 4000), by: ctx.agent.name });
        ctx.run.emit({ type: "blackboard", key, by: ctx.agent.name, size: ctx.run.blackboard.size });
        return `stored "${key}"`;
      },
    },
    {
      name: "blackboard_read", group: "team",
      description: "Read one key from the shared scratchpad, or list all keys when no key is given.",
      parameters: { type: "object", properties: { key: { type: "string" } } },
      async run({ key }, ctx) {
        if (!key) return [...ctx.run.blackboard.entries()].map(([k, v]) => `${k} (by ${v.by})`).join("\n") || "(empty)";
        const v = ctx.run.blackboard.get(key);
        return v ? v.value : `no key "${key}"`;
      },
    },
  ],
};
void Run;
