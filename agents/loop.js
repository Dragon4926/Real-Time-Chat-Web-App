// The agent loop: LLM -> tool calls -> LLM ... until a plain-text answer. Also the entry point for agent-to-agent invocation.
const config = require("./config");
const llm = require("./llm");
const registry = require("./registry");
const store = require("./skills/store");
const tools = require("./tools");
const { Run } = require("./bus");

const clip = (s, n) => { s = String(s); return s.length > n ? `${s.slice(0, n)}...[truncated]` : s; };

function toolsFor(def) {
  const groups = [...new Set([...def.tools, "team"])];
  return tools.forGroups(groups);
}

async function runAgent({ run, name, task, parentId = null, chain = [], depth = 0, from = "user", extra = {} }) {
  const def = registry.get(name);
  if (!def) throw new Error(`unknown agent "${name}"`);
  const cfg = config.get();
  if (run.signal.aborted) throw new Error("run was stopped");

  run.calls++;
  const node = run.startCall({ agent: name, parentId, task, from, depth });
  const myChain = [...chain, { agent: name, key: Run.key(name, task) }];
  const callId = node.id;
  const emit = (e) => run.emit({ callId, agent: name, ...e });
  emit({ type: "start", from, task: clip(task, 300), depth });

  const skills = store.search(task, cfg.evolve.topK);
  for (const s of skills) run.skillsUsed.add(s.id);
  if (skills.length) emit({ type: "skills", skills: skills.map((s) => ({ id: s.id, name: s.name })) });

  const available = toolsFor(def);
  const messages = [
    { role: "system", content: registry.buildSystemPrompt(def, { skills }) },
    { role: "user", content: task },
  ];
  const ctx = {
    run, agent: def, callId, signal: run.signal, chain: myChain, depth, getRoomHistory: extra.getRoomHistory,
    invoke: (to, q, opts = {}) => {
      const reason = run.refuse({ from: name, to, question: q, chain: myChain, depth });
      if (reason) throw new Error(reason);
      return runAgent({ run, name: to, task: q, parentId: callId, chain: myChain, depth: depth + 1, from: name, extra });
    },
  };

  try {
    let final = "";
    for (let step = 0; step < cfg.agents.maxSteps; step++) {
      for (const m of run.drain(name)) {
        messages.push({ role: "user", content: `[message from teammate ${m.from}]: ${m.text}` });
        emit({ type: "inbox", from: m.from, text: clip(m.text, 300) });
      }
      const lastStep = step === cfg.agents.maxSteps - 1;
      const res = await llm.chat({
        messages: lastStep ? [...messages, { role: "user", content: "Step limit reached. Give your best final answer now in plain text, without calling tools." }] : messages,
        tools: lastStep ? [] : available,
        signal: run.signal, model: def.model || undefined,
        onToken: (t) => emit({ type: "token", text: t }),
      });
      if (res.toolCalls.length) {
        messages.push({ role: "assistant", content: res.content, toolCalls: res.toolCalls });
        for (const call of res.toolCalls) {
          const tool = tools.get(call.name);
          const allowed = tool && available.some((t) => t.name === call.name);
          emit({ type: "tool_call", id: call.id, tool: call.name, args: call.args });
          run.stats.toolCalls++;
          let out;
          let isError = false;
          try {
            if (!allowed) throw new Error(`tool "${call.name}" is not available to you. Available: ${available.map((t) => t.name).join(", ")}`);
            out = await tool.run(call.args && typeof call.args === "object" ? call.args : {}, ctx);
          } catch (err) {
            if (run.signal.aborted) throw new Error("run was stopped");
            isError = true;
            run.stats.toolErrors++;
            out = `ERROR: ${err.message}`;
          }
          out = clip(typeof out === "string" ? out : JSON.stringify(out), cfg.tools.outputCap);
          emit({ type: "tool_result", id: call.id, tool: call.name, error: isError, result: clip(out, 1500) });
          run.note(`[${name}] ${call.name}(${clip(JSON.stringify(call.args), 160)}) -> ${clip(out, 240)}`);
          messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: out });
        }
        continue;
      }
      final = (res.content || "").trim();
      if (final) break;
      messages.push({ role: "assistant", content: "" }, { role: "user", content: "Please give your final answer in plain text." });
    }
    if (!final) final = "(no answer produced)";
    run.note(`[${name}] FINAL: ${clip(final, 400)}`);
    emit({ type: "done", text: final });
    run.endCall(node, "done");
    return final;
  } catch (err) {
    emit({ type: "error", message: err.message });
    run.endCall(node, run.signal.aborted ? "stopped" : "failed");
    throw err;
  }
}

module.exports = { runAgent };
