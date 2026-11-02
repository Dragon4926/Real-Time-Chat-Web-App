const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Mock local model server. `script(body, kind)` returns {content, toolCalls:[{name,args}]}.
async function mockLlm(script) {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : {};
    if (req.url === "/api/tags") return res.end(JSON.stringify({ models: [{ name: "mock:latest" }] }));
    if (req.url === "/models") return res.end(JSON.stringify({ data: [{ id: "mock" }] }));
    calls.push(body);
    const out = await script(body, req.url);
    const content = out.content || "";
    const tcs = out.toolCalls || [];
    if (req.url === "/api/chat") {
      res.setHeader("Content-Type", "application/x-ndjson");
      for (const ch of content.match(/.{1,5}/gs) || []) res.write(`${JSON.stringify({ message: { role: "assistant", content: ch }, done: false })}\n`);
      if (tcs.length) res.write(`${JSON.stringify({ message: { role: "assistant", content: "", tool_calls: tcs.map((t) => ({ function: { name: t.name, arguments: t.args } })) }, done: false })}\n`);
      res.end(`${JSON.stringify({ message: { content: "" }, done: true })}\n`);
    } else {
      res.setHeader("Content-Type", "text/event-stream");
      for (const ch of content.match(/.{1,5}/gs) || []) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: ch } }] })}\n\n`);
      tcs.forEach((t, i) => {
        const a = JSON.stringify(t.args);
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: i, id: `c${i}`, function: { name: t.name, arguments: a.slice(0, 4) } }] } }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: i, function: { arguments: a.slice(4) } }] } }] })}\n\n`);
      });
      res.end("data: [DONE]\n\n");
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  return { url: `http://127.0.0.1:${port}`, calls, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) };
}

function tmpEnv(extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grok-test-"));
  Object.assign(process.env, { DATA_DIR: path.join(dir, "data"), WORKSPACE_DIR: path.join(dir, "ws"), SELF_EVOLVE: "true", EVOLVE_MAX_EDITS_PER_HOUR: "20", ...extra });
  return dir;
}

const lastUser = (body) => [...body.messages].reverse().find((m) => m.role === "user")?.content || "";
const systemOf = (body) => body.messages.find((m) => m.role === "system")?.content || "";
const hasToolResult = (body) => body.messages.some((m) => m.role === "tool");
const agentOf = (body) => (systemOf(body).match(/^You are (\w+),/) || [])[1];

module.exports = { mockLlm, tmpEnv, lastUser, systemOf, hasToolResult, agentOf };
