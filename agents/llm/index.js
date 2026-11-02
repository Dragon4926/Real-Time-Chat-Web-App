// Provider-agnostic chat() with tool-calling fallback and a global concurrency limiter.
const config = require("../config");
const ollama = require("./ollama");
const openai = require("./openai");

const providers = { ollama, openai };

class Semaphore {
  constructor() { this.active = 0; this.queue = []; }
  async acquire(limit, signal) {
    if (this.active >= limit) {
      await new Promise((resolve, reject) => {
        const entry = { resolve };
        this.queue.push(entry);
        signal?.addEventListener("abort", () => {
          const i = this.queue.indexOf(entry);
          if (i >= 0) this.queue.splice(i, 1);
          reject(new Error("aborted"));
        }, { once: true });
      });
    }
    this.active++;
  }
  release() { this.active--; this.queue.shift()?.resolve(); }
}
const sem = new Semaphore();

// Text-mode tool protocol: tools are described in the system prompt and the model answers with a JSON object.
function textToolPrompt(tools) {
  const lines = tools.map((t) => `- ${t.name}: ${t.description} args=${JSON.stringify(t.parameters?.properties || {})}`);
  return [
    "You can use tools. To call a tool, reply with ONLY a JSON object and nothing else:",
    '{"tool":"<name>","args":{...}}',
    "When you have the final answer, reply in plain text (no JSON).",
    "Available tools:",
    ...lines,
  ].join("\n");
}

function toTextMode(messages, tools) {
  const out = messages.map((m) => {
    if (m.role === "assistant" && m.toolCalls?.length) {
      return { role: "assistant", content: JSON.stringify({ tool: m.toolCalls[0].name, args: m.toolCalls[0].args }) };
    }
    if (m.role === "tool") return { role: "user", content: `Tool result for ${m.name}:\n${m.content}` };
    return { role: m.role, content: m.content };
  });
  if (tools.length && out[0]?.role === "system") out[0] = { ...out[0], content: `${out[0].content}\n\n${textToolPrompt(tools)}` };
  return out;
}

// Pull a {"tool":..,"args":..} object out of free text (also handles ```json fences).
function parseTextToolCall(text, tools) {
  if (!text || !tools.length) return null;
  const names = new Set(tools.map((t) => t.name));
  const candidates = [];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidates.push(fence[1]);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1));
  for (const c of candidates) {
    try {
      const o = JSON.parse(c.trim());
      const name = o.tool || o.name;
      if (name && names.has(name)) return { id: `txt_${Date.now().toString(36)}`, name, args: o.args || o.arguments || {} };
    } catch { /* keep trying */ }
  }
  return null;
}

async function chat({ messages, tools = [], signal, onToken, model }) {
  const cfg = { ...config.get().llm };
  if (model) cfg.model = model;
  const provider = providers[cfg.provider];
  if (!provider) throw new Error(`Unknown LLM_PROVIDER "${cfg.provider}" (use ollama or openai)`);

  const textMode = cfg.toolMode === "text";
  const wireMessages = textMode ? toTextMode(messages, tools) : messages;
  const wireTools = textMode ? [] : tools;

  await sem.acquire(cfg.concurrency, signal);
  const timeout = AbortSignal.timeout(cfg.timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    // In text mode, buffer tokens that look like a JSON tool call so they are not shown as chat text.
    let res;
    if (textMode && tools.length) {
      let first = "";
      let decided = false;
      let passthrough = false;
      res = await provider.chat(cfg, {
        messages: wireMessages, tools: wireTools, signal: combined,
        onToken: (t) => {
          if (decided) { if (passthrough) onToken?.(t); return; }
          first += t;
          const trimmed = first.trimStart();
          if (trimmed.length >= 1) {
            decided = true;
            passthrough = !(trimmed.startsWith("{") || trimmed.startsWith("`"));
            if (passthrough) onToken?.(first);
          }
        },
      });
    } else {
      res = await provider.chat(cfg, { messages: wireMessages, tools: wireTools, signal: combined, onToken });
    }
    if (!res.toolCalls.length && tools.length) {
      const parsed = parseTextToolCall(res.content, tools);
      if (parsed) return { content: "", toolCalls: [parsed], parsedFromText: true };
    }
    return res;
  } catch (err) {
    if (timeout.aborted && !signal?.aborted) throw new Error(`LLM request timed out after ${cfg.timeoutMs}ms`);
    if (err.cause?.code === "ECONNREFUSED" || /fetch failed/i.test(err.message)) {
      const url = cfg.provider === "ollama" ? cfg.ollamaUrl : cfg.openaiBaseUrl;
      throw new Error(`Cannot reach the local model server at ${url}. Is ${cfg.provider === "ollama" ? "Ollama" : "your OpenAI-compatible server"} running?`);
    }
    throw err;
  } finally {
    sem.release();
  }
}

async function health() {
  const cfg = config.get().llm;
  const info = { provider: cfg.provider, model: cfg.model, toolMode: cfg.toolMode, reachable: false, models: [], error: null };
  try {
    info.models = await providers[cfg.provider].listModels(cfg);
    info.reachable = true;
    info.modelAvailable = info.models.length === 0 || info.models.some((m) => m === cfg.model || m.startsWith(`${cfg.model}:`));
  } catch (e) {
    info.error = e.message;
  }
  return info;
}

module.exports = { chat, health, parseTextToolCall, toTextMode };
