const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { tmpEnv } = require("./helpers");
const dir = tmpEnv({ EXEC_TIMEOUT_MS: "1500" });

const { evaluate } = require("../agents/tools/calc");
const files = require("../agents/tools/files");
const { runCode } = require("../agents/tools/exec");
const web = require("../agents/tools/web");

test("calc evaluates and rejects non-math", () => {
  assert.equal(evaluate("2+3*4"), 14);
  assert.equal(evaluate("2^3^2"), 512);
  assert.equal(evaluate("sqrt(16)+max(1,2)"), 6);
  for (const bad of ["process.exit()", 'require("fs")', "constructor", "toString()", "1+", "1/0"]) assert.throws(() => evaluate(bad), bad);
});

test("files are confined to the workspace", async () => {
  const w = files.tools.find((t) => t.name === "file_write");
  const r = files.tools.find((t) => t.name === "file_read");
  await w.run({ path: "a/b.txt", content: "hi" });
  assert.equal(await r.run({ path: "a/b.txt" }), "hi");
  for (const p of ["../x", "../../etc/passwd", "a/../../x"]) await assert.rejects(() => w.run({ path: p, content: "x" }), /escapes/);
  // absolute paths are re-rooted inside the workspace, never honoured
  await w.run({ path: "/abs.txt", content: "x" });
  assert.ok(fs.existsSync(path.join(dir, "ws", "abs.txt")));
  // symlink escape
  fs.symlinkSync("/etc", path.join(dir, "ws", "link"));
  await assert.rejects(() => r.run({ path: "link/passwd" }), /escapes/);
});

test("exec runs code, caps time", async () => {
  assert.match(await runCode("python", "print(6*7)"), /exit code: 0\n42/);
  assert.match(await runCode("javascript", "console.log(1+1)"), /2/);
  const t = Date.now();
  assert.match(await runCode("bash", "sleep 30"), /killed/);
  assert.ok(Date.now() - t < 6000);
  await assert.rejects(() => runCode("ruby", "puts 1"), /unsupported/);
  process.env.EXEC_ENABLED = "false";
  await assert.rejects(() => runCode("python", "print(1)"), /disabled/);
  process.env.EXEC_ENABLED = "true";
});

test("web blocks private addresses", async () => {
  for (const u of ["http://127.0.0.1/", "http://localhost:3000/", "http://10.0.0.5/", "http://169.254.169.254/", "http://[::1]/", "file:///etc/passwd"]) {
    await assert.rejects(() => web.assertPublicUrl(u), /blocked|only http/, u);
  }
  assert.equal(web.isPrivateIp("8.8.8.8"), false);
});
