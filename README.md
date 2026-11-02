# Grok Team

A real-time chat app that fronts a **team of coworker LLM agents running on your own local models**. Grok leads; a researcher, coder, writer and critic help. They use tools, call each other, and keep a library of skills that they improve on their own.

Nothing leaves your machine except what the web tools fetch.

## What it does

- **Team view**: talk to Grok (or pick any agent). Watch answers stream, tool calls expand, and agents hand work to each other.
- **Rooms**: the original real-time rooms (6-digit codes), now properly room-scoped. Mention `@grok`, `@researcher`, `@coder`, `@writer` or `@critic` in a room to bring the team in. Everyone in the room sees the run.
- **Agents talk to each other** (peer to peer, not only top-down): `ask_agent`, `send_message`, `spawn_task` + `await_tasks` for parallel work, and a shared `blackboard`. A per-run call graph, depth limit, call budget and cycle detection stop runaway loops. **Stop** aborts the whole tree.
- **Tools**: web search and fetch, sandboxed workspace files, code execution (Python, JavaScript, bash), a safe calculator, notes and room-history lookup.
- **Self-evolving skills**: after a run that used tools or teammates, a reflection pass reads the whole transcript and can create, update, merge or retire skills, and edit each agent's *learned guidelines*. Changes apply automatically (no approval step). Guardrails: every version is stored, every change is audited, bad skills are demoted by win/loss record, edits are rate limited, skills cannot grant tools, and injection-like text is rejected. **Revert** any skill in the UI.
- **Works without MongoDB**: rooms are kept in memory unless `CONSTR` is set.

## Quick start

You need Node 20+ and a local model server.

```sh
npm install
cp .env.example .env      # then edit
npm start                 # http://localhost:3000
```

### Ollama (default)

```sh
ollama pull llama3.2      # any tool-capable model: llama3.1+, qwen2.5, mistral-nemo ...
```

### LM Studio, llama.cpp server, vLLM (OpenAI-compatible)

```
LLM_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:1234/v1
LLM_MODEL=<model name shown by the server>
```

If your model has no native tool calling, set `TOOL_MODE=text`; tools are then described in the prompt and called with JSON.

The dot at the bottom of the left rail is green when the model server is reachable. Larger models make a much better team; small ones will struggle with delegation.

## Configuration

See `.env.example`. Notable settings: `LLM_PROVIDER`, `LLM_MODEL`, `TOOL_MODE`, `EXEC_ENABLED`, `WEB_ENABLED`, `SEARX_URL`, `SELF_EVOLVE`, `AGENT_MAX_DEPTH`, `AGENT_MAX_CALLS`, `AGENT_RUN_TIMEOUT_MS`.

Add your own agents by dropping a markdown file in `data/agents/` (same format as `agents/defs/*.md`: frontmatter with `name`, `title`, `role`, `color`, `tools`, then the prompt). Tool groups: `web`, `files`, `exec`, `calc`, `memory`, `skills`. Every agent also gets the team tools.

## Safety notes

- **Code execution is not a hardened sandbox.** It runs scripts as your user, with the working directory, a minimal environment, a timeout and an output cap. Anyone who can message the team can trigger it. Set `EXEC_ENABLED=false` if the server is reachable by people you do not trust. Do not expose this app to the internet as is.
- The file tools are confined to `workspace/` (path escapes and symlinks are rejected). Web fetch refuses private and loopback addresses unless `WEB_ALLOW_PRIVATE=true`.
- Autonomous learning is guarded but not infallible: a model can still learn a bad habit. Skills live in `data/skills/`, history in `data/versions/`, the audit log in `data/audit.log`. Set `SELF_EVOLVE=false` to freeze learning.
- Text from tools, web pages and other agents is treated as data in the core prompt, which reduces but does not eliminate prompt injection.

## Layout

```
agents/   llm providers, agent loop, bus (peer coordination), registry + defs, tools, skills store + reflection
routes/   rooms + REST API        public/   the UI (no build step)
data/     skills, versions, audit, runs, notes (gitignored)      workspace/  agent sandbox (gitignored)
test/     node --test, using a scripted mock model server
```

```sh
npm test
```

## License

ISC (see `package.json`).
