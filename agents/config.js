// Central configuration. Everything is overridable through environment variables (.env supported).
const path = require("node:path");
try { require("dotenv").config(); } catch { /* dotenv optional */ }

const root = path.resolve(__dirname, "..");
const env = process.env;
const num = (v, d) => (v !== undefined && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : d);
const bool = (v, d) => (v === undefined || v === "" ? d : !/^(0|false|no|off)$/i.test(v));

// Read lazily so tests can change process.env between runs.
function load() {
  const e = process.env;
  return {
    port: num(e.PORT, 3000),
    llm: {
      provider: (e.LLM_PROVIDER || "ollama").toLowerCase(), // ollama | openai
      model: e.LLM_MODEL || "llama3.2",
      ollamaUrl: (e.OLLAMA_URL || "http://localhost:11434").replace(/\/+$/, ""),
      openaiBaseUrl: (e.OPENAI_BASE_URL || "http://localhost:1234/v1").replace(/\/+$/, ""),
      openaiApiKey: e.OPENAI_API_KEY || "",
      toolMode: (e.TOOL_MODE || "auto").toLowerCase(), // auto | native | text
      temperature: num(e.LLM_TEMPERATURE, 0.4),
      concurrency: num(e.LLM_CONCURRENCY, 2),
      timeoutMs: num(e.LLM_TIMEOUT_MS, 120000),
    },
    agents: {
      maxSteps: num(e.AGENT_MAX_STEPS, 8),
      maxDepth: num(e.AGENT_MAX_DEPTH, 3),
      maxCallsPerRun: num(e.AGENT_MAX_CALLS, 12),
      maxActivePerAgent: num(e.AGENT_MAX_ACTIVE, 4),
      runTimeoutMs: num(e.AGENT_RUN_TIMEOUT_MS, 300000),
      botName: e.BOT_NAME || "Grok",
    },
    paths: {
      root,
      data: path.resolve(e.DATA_DIR || path.join(root, "data")),
      workspace: path.resolve(e.WORKSPACE_DIR || path.join(root, "workspace")),
      defs: path.join(root, "agents", "defs"),
      seedSkills: path.join(root, "agents", "skills", "seed"),
    },
    tools: {
      execEnabled: bool(e.EXEC_ENABLED, true),
      execTimeoutMs: num(e.EXEC_TIMEOUT_MS, 20000),
      outputCap: num(e.TOOL_OUTPUT_CAP, 20000),
      searxUrl: (e.SEARX_URL || "").replace(/\/+$/, ""),
      webAllowPrivate: bool(e.WEB_ALLOW_PRIVATE, false),
      webEnabled: bool(e.WEB_ENABLED, true),
      fetchMaxBytes: num(e.FETCH_MAX_BYTES, 1000000),
      fileMaxBytes: num(e.FILE_MAX_BYTES, 1000000),
    },
    evolve: {
      enabled: bool(e.SELF_EVOLVE, true),
      maxEditsPerHour: num(e.EVOLVE_MAX_EDITS_PER_HOUR, 20),
      topK: num(e.SKILL_TOP_K, 3),
      maxSkillBytes: num(e.SKILL_MAX_BYTES, 6000),
      maxGuidelineChars: num(e.GUIDELINE_MAX_CHARS, 1500),
    },
  };
}

module.exports = { get: load, bool, num, root };
