const test = require("node:test");
const assert = require("node:assert/strict");
const { mockLlm, tmpEnv } = require("./helpers");
tmpEnv();
const llm = require("../agents/llm");

for (const provider of ["ollama", "openai"]) {
  test(`${provider}: streams tokens and tool calls`, async () => {
    const m = await mockLlm(async () => ({ content: "hello world", toolCalls: [{ name: "calc", args: { expression: "1+1" } }] }));
    Object.assign(process.env, { LLM_PROVIDER: provider, OLLAMA_URL: m.url, OPENAI_BASE_URL: m.url, TOOL_MODE: "auto" });
    let streamed = "";
    const res = await llm.chat({ messages: [{ role: "user", content: "hi" }], tools: [{ name: "calc", description: "d", parameters: { type: "object", properties: {} } }], onToken: (t) => (streamed += t) });
    assert.equal(streamed, "hello world");
    assert.equal(res.toolCalls[0].name, "calc");
    assert.deepEqual(res.toolCalls[0].args, { expression: "1+1" });
    assert.equal((await llm.health()).reachable, true);
    await m.close();
  });
}

test("text tool mode parses JSON tool calls and hides them from the stream", async () => {
  const m = await mockLlm(async () => ({ content: '```json\n{"tool":"calc","args":{"expression":"2+2"}}\n```' }));
  Object.assign(process.env, { LLM_PROVIDER: "ollama", OLLAMA_URL: m.url, TOOL_MODE: "text" });
  let streamed = "";
  const res = await llm.chat({ messages: [{ role: "system", content: "s" }, { role: "user", content: "x" }], tools: [{ name: "calc", description: "d", parameters: { properties: { expression: {} } } }], onToken: (t) => (streamed += t) });
  assert.equal(res.toolCalls[0].name, "calc");
  assert.equal(streamed, "");
  assert.match(m.calls[0].messages[0].content, /Available tools/);
  assert.equal(m.calls[0].tools, undefined);
  await m.close();
});

test("unreachable server gives a friendly error", async () => {
  Object.assign(process.env, { LLM_PROVIDER: "ollama", OLLAMA_URL: "http://127.0.0.1:1" });
  await assert.rejects(() => llm.chat({ messages: [{ role: "user", content: "x" }] }), /Cannot reach the local model server/);
});
