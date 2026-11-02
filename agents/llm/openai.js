// OpenAI-compatible adapter (LM Studio, llama.cpp server, vLLM, ...): SSE streaming.
const { readLines } = require("./stream");

function toWire(messages) {
  return messages.map((m) => {
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args || {}) } })),
      };
    }
    if (m.role === "tool") return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
    return { role: m.role, content: m.content };
  });
}

async function chat(cfg, { messages, tools, signal, onToken }) {
  const body = { model: cfg.model, messages: toWire(messages), stream: true, temperature: cfg.temperature };
  if (tools?.length) {
    body.tools = tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
  }
  const headers = { "Content-Type": "application/json" };
  if (cfg.openaiApiKey) headers.Authorization = `Bearer ${cfg.openaiApiKey}`;
  const res = await fetch(`${cfg.openaiBaseUrl}/chat/completions`, { method: "POST", headers, body: JSON.stringify(body), signal });
  if (!res.ok) throw new Error(`OpenAI-compatible server error ${res.status}: ${(await res.text()).slice(0, 300)}`);

  let content = "";
  const partial = new Map(); // index -> {id,name,args}
  for await (const line of readLines(res.body)) {
    const l = line.trim();
    if (!l.startsWith("data:")) continue;
    const data = l.slice(5).trim();
    if (data === "[DONE]") break;
    let obj;
    try { obj = JSON.parse(data); } catch { continue; }
    if (obj.error) throw new Error(`Server: ${obj.error.message || JSON.stringify(obj.error)}`);
    const delta = obj.choices?.[0]?.delta;
    if (!delta) continue;
    if (delta.content) { content += delta.content; onToken?.(delta.content); }
    for (const tc of delta.tool_calls || []) {
      const i = tc.index ?? 0;
      const cur = partial.get(i) || { id: "", name: "", args: "" };
      if (tc.id) cur.id = tc.id;
      if (tc.function?.name) cur.name += tc.function.name;
      if (tc.function?.arguments) cur.args += tc.function.arguments;
      partial.set(i, cur);
    }
  }
  const toolCalls = [...partial.entries()].sort((a, b) => a[0] - b[0]).map(([i, c]) => {
    let args = {};
    try { args = c.args ? JSON.parse(c.args) : {}; } catch { args = {}; }
    return { id: c.id || `call_${i}_${Date.now().toString(36)}`, name: c.name, args };
  });
  return { content, toolCalls };
}

async function listModels(cfg) {
  const headers = cfg.openaiApiKey ? { Authorization: `Bearer ${cfg.openaiApiKey}` } : {};
  const res = await fetch(`${cfg.openaiBaseUrl}/models`, { headers, signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  return (j.data || []).map((m) => m.id);
}

module.exports = { chat, listModels };
