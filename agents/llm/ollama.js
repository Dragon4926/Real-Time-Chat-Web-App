// Ollama adapter: POST /api/chat with NDJSON streaming.
const { readLines } = require("./stream");

function toWire(messages) {
  return messages.map((m) => {
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content || "",
        tool_calls: m.toolCalls.map((c) => ({ function: { name: c.name, arguments: c.args || {} } })),
      };
    }
    if (m.role === "tool") return { role: "tool", content: m.content, tool_name: m.name };
    return { role: m.role, content: m.content };
  });
}

async function chat(cfg, { messages, tools, signal, onToken }) {
  const body = {
    model: cfg.model,
    messages: toWire(messages),
    stream: true,
    options: { temperature: cfg.temperature },
  };
  if (tools?.length) {
    body.tools = tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
  }
  const res = await fetch(`${cfg.ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${(await res.text()).slice(0, 300)}`);

  let content = "";
  const toolCalls = [];
  for await (const line of readLines(res.body)) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    if (obj.error) throw new Error(`Ollama: ${obj.error}`);
    const msg = obj.message || {};
    if (msg.content) { content += msg.content; onToken?.(msg.content); }
    for (const tc of msg.tool_calls || []) {
      let args = tc.function?.arguments ?? {};
      if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }
      toolCalls.push({ id: `call_${toolCalls.length}_${Date.now().toString(36)}`, name: tc.function?.name, args });
    }
  }
  return { content, toolCalls };
}

async function listModels(cfg) {
  const res = await fetch(`${cfg.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  return (j.models || []).map((m) => m.name);
}

module.exports = { chat, listModels };
