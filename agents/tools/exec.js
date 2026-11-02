// Code execution in a restricted subprocess: cwd locked to the workspace, wall-clock timeout, output cap,
// minimal environment. NOTE: this limits accidents, it is not a hardened sandbox - see README.
const { spawn } = require("node:child_process");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const config = require("../config");
const { resolveSafe } = require("./files");

const LANGS = {
  python: { cmd: process.env.PYTHON_BIN || "python3", ext: ".py" },
  javascript: { cmd: process.execPath, ext: ".js" },
  bash: { cmd: "bash", ext: ".sh" },
};

async function runCode(language, code, { signal } = {}) {
  const cfg = config.get();
  if (!cfg.tools.execEnabled) throw new Error("code execution is disabled (EXEC_ENABLED=false)");
  const lang = LANGS[String(language).toLowerCase()] || LANGS[{ js: "javascript", node: "javascript", py: "python", sh: "bash", shell: "bash" }[String(language).toLowerCase()]];
  if (!lang) throw new Error(`unsupported language "${language}" (use python, javascript or bash)`);
  if (typeof code !== "string" || !code.trim()) throw new Error("code is empty");
  if (code.length > 100000) throw new Error("code too large");

  const { abs: runDir, realRoot } = resolveSafe(".run");
  await fsp.mkdir(runDir, { recursive: true });
  const file = path.join(runDir, `${crypto.randomBytes(6).toString("hex")}${lang.ext}`);
  await fsp.writeFile(file, code, "utf8");

  const cap = cfg.tools.outputCap;
  return new Promise((resolve) => {
    let out = "";
    let truncated = false;
    let timedOut = false;
    const child = spawn(lang.cmd, [file], {
      cwd: realRoot,
      env: { PATH: process.env.PATH, HOME: realRoot, LANG: "C.UTF-8", PYTHONDONTWRITEBYTECODE: "1" },
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const killTree = () => { try { process.platform !== "win32" ? process.kill(-child.pid, "SIGKILL") : child.kill("SIGKILL"); } catch { /* gone */ } };
    const timer = setTimeout(() => { timedOut = true; killTree(); }, cfg.tools.execTimeoutMs);
    const onAbort = () => killTree();
    signal?.addEventListener("abort", onAbort, { once: true });
    const collect = (d) => {
      if (out.length < cap) out += d.toString();
      else truncated = true;
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const done = async (code, err) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      fsp.unlink(file).catch(() => {});
      let text = out.slice(0, cap);
      if (truncated) text += "\n...[output truncated]";
      if (timedOut) text += `\n[killed: exceeded ${cfg.tools.execTimeoutMs}ms timeout]`;
      if (err) text += `\n[failed to start: ${err.message}]`;
      resolve(`exit code: ${code ?? "none"}\n${text}`.trimEnd());
    };
    child.on("error", (e) => done(null, e));
    child.on("close", (c) => done(c));
  });
}

module.exports = {
  runCode,
  tools: [{
    name: "run_code", group: "exec",
    description: "Run a short script (python, javascript or bash) inside the workspace and return its output. Has a time limit; no network guarantees.",
    parameters: { type: "object", properties: { language: { type: "string", enum: ["python", "javascript", "bash"] }, code: { type: "string" } }, required: ["language", "code"] },
    async run({ language, code }, ctx) { return runCode(language, code, { signal: ctx?.signal }); },
  }],
};
