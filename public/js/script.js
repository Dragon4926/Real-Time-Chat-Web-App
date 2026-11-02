/* Grok Team client. All user/model text is inserted with textContent (never innerHTML). */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style") el.style.cssText = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "text") el.textContent = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const api = async (url, opts) => {
    const r = await fetch(url, opts && { ...opts, headers: { "Content-Type": "application/json" }, body: opts.body && JSON.stringify(opts.body) });
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch { /* plain text */ }
    if (!r.ok) throw new Error(j?.error || t || `HTTP ${r.status}`);
    return j ?? t;
  };

  // ---------- state ----------
  const socket = io();
  let view = store.get("view", "team");
  let me = store.get("name", "");
  let room = null;
  let rooms = store.get("rooms", []);
  let agents = [];
  let target = "";            // "" = auto (Grok decides)
  const runs = new Map();     // runId -> run card model
  const colors = {};

  const el = { app: $("#app"), side: $("#side"), title: $("#title"), subtitle: $("#subtitle"), actions: $("#headActions"), banner: $("#banner"),
    team: $("#teamThread"), room: $("#roomThread"), form: $("#composer"), input: $("#input"), targets: $("#targets"), send: $("#sendBtn"), health: $("#health") };

  // ---------- safe mini markdown (code fences, inline code, bold, paragraphs) ----------
  function renderMd(target, raw) {
    target.replaceChildren();
    const parts = raw.split(/```/);
    parts.forEach((part, i) => {
      if (i % 2 === 1) {
        const body = part.replace(/^[a-z0-9+-]*\n/i, "");
        target.append(h("pre", {}, h("code", { text: body.replace(/\n$/, "") })));
      } else {
        for (const para of part.split(/\n{2,}/)) {
          if (!para.trim()) continue;
          const p = h("p");
          para.split(/(`[^`]+`|\*\*[^*]+\*\*)/).forEach((tok) => {
            if (/^`[^`]+`$/.test(tok)) p.append(h("code", { text: tok.slice(1, -1) }));
            else if (/^\*\*[^*]+\*\*$/.test(tok)) p.append(h("strong", { text: tok.slice(2, -2) }));
            else {
              tok.split("\n").forEach((line, j) => { if (j) p.append(h("br")); p.append(line); });
            }
          });
          target.append(p);
        }
      }
    });
  }

  const agentColor = (name) => colors[name] || "var(--faint)";
  const agentTitle = (name) => agents.find((a) => a.name === name)?.title || name;
  const thread = () => (view === "team" ? el.team : el.room);
  const stick = (t) => { if (t.scrollHeight - t.scrollTop - t.clientHeight < 140) t.scrollTop = t.scrollHeight; };

  // ---------- chat (rooms) ----------
  function addMessage(msg) {
    const mine = msg.user === me && !msg.agent;
    const isAgent = agents.some((a) => a.name === msg.user);
    const node = h("div", { class: `msg${mine ? " me" : ""}` },
      h("span", { class: "who", style: isAgent ? `color:${agentColor(msg.user)}` : "" }, isAgent ? agentTitle(msg.user) : msg.user),
      h("div", { class: "bubble", text: msg.text }));
    el.room.append(node);
    stick(el.room);
  }

  // ---------- agent runs ----------
  function runCard(ev, container) {
    const card = h("article", { class: "run", "data-state": "working" });
    const stop = h("button", { class: "btn small", onclick: () => socket.emit("agent:stop", { runId: ev.runId }) }, "Stop");
    const state = h("span", { class: "state" }, h("span", { class: "label" }, "working"), stop);
    const head = h("div", { class: "run-head" }, h("span", { class: "dot", style: `--c:${agentColor(ev.entry)}` }), h("strong", {}, agentTitle(ev.entry)), state);
    const body = h("div", { class: "run-body" });
    const foot = h("div", { class: "run-foot", hidden: true });
    card.append(head, body, foot);
    container.append(card);
    const model = { card, body, foot, stop, label: $(".label", state), calls: new Map(), graph: null, entry: ev.entry };
    runs.set(ev.runId, model);
    stick(container);
    return model;
  }

  function callBlock(run, ev) {
    const nested = ev.depth > 0;
    const block = h("div", { class: `call${nested ? " nested" : ""}`, style: `--c:${agentColor(ev.agent)}` });
    if (nested) block.append(h("div", { class: "call-head" }, h("span", { class: "dot", style: `--c:${agentColor(ev.agent)}` }), h("b", {}, agentTitle(ev.agent)), h("span", { class: "task", text: `asked by ${agentTitle(ev.from)}: ${ev.task}` })));
    const c = { block, seg: null, raw: "", tools: new Map() };
    run.calls.set(ev.callId, c);
    run.body.append(block);
    return c;
  }

  function renderGraph(run, nodes) {
    if (nodes.length < 2) return;
    if (!run.graph) {
      run.graph = h("details", { class: "graph" }, h("summary", {}, "Call graph"), h("ul"));
      run.foot.hidden = false;
      run.foot.prepend(run.graph);
    }
    const ul = $("ul", run.graph);
    ul.replaceChildren();
    const walk = (parent, depth) => nodes.filter((n) => n.parent === parent).forEach((n) => {
      ul.append(h("li", { style: `margin-left:${depth * 14}px` }, `${agentTitle(n.agent)} · ${n.status}`, n.parent ? ` · ${n.task.slice(0, 60)}` : ""));
      walk(n.id, depth + 1);
    });
    walk(null, 0);
  }

  function onAgentEvent(ev) {
    const container = ev.view === "team" ? el.team : el.room;
    if (ev.type === "run_error") { container.append(h("div", { class: "sys", text: ev.message })); stick(container); return; }
    if (ev.type === "run_start") { runCard(ev, container); return; }
    const run = runs.get(ev.runId);
    if (!run) return;
    const c = ev.callId ? run.calls.get(ev.callId) : null;
    switch (ev.type) {
      case "start": callBlock(run, ev); break;
      case "token": if (c) { if (!c.seg) { c.seg = h("div", { class: "text" }); c.raw = ""; c.block.append(c.seg); } c.raw += ev.text; renderMd(c.seg, c.raw); } break;
      case "tool_call": if (c) {
        c.seg = null;
        const args = Object.values(ev.args || {}).map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(" ").slice(0, 120);
        const out = h("pre", { text: "…" });
        const d = h("details", { class: "tool", "data-state": "running" }, h("summary", {}, h("span", { class: "tn" }, ev.tool), h("span", { class: "args" }, args)), out);
        c.tools.set(ev.id, { d, out });
        c.block.append(d);
      } break;
      case "tool_result": { const t = c?.tools.get(ev.id); if (t) { t.d.dataset.state = ev.error ? "error" : "done"; t.out.textContent = ev.result; } break; }
      case "a2a": run.body.append(h("div", { class: "a2a" }, h("b", {}, `${agentTitle(ev.from)} → ${agentTitle(ev.to)}`), ` (${ev.kind}) ${ev.text}`)); break;
      case "inbox": if (c) c.block.append(h("div", { class: "a2a" }, h("b", {}, `message from ${agentTitle(ev.from)}`), `: ${ev.text}`)); break;
      case "graph": renderGraph(run, ev.nodes); break;
      case "learned": {
        run.foot.hidden = false;
        run.foot.append(h("span", { class: "learned" }, `Team learned: ${ev.applied.join(", ") || "nothing new"}`));
        if (view === "team") loadSide();
        break;
      }
      case "run_end": finishRun(ev, run); break;
      default: break;
    }
    stick(container);
  }

  function finishRun(ev, run) {
    run.card.dataset.state = ev.outcome === "ok" ? "done" : ev.outcome === "aborted" ? "stopped" : "error";
    run.label.textContent = ev.outcome === "ok" ? `done · ${(ev.stats.toolCalls)} tool calls` : ev.outcome === "aborted" ? "stopped" : "failed";
    run.stop.remove();
    if (ev.error) run.body.append(h("div", { class: "sys", style: "color:var(--bad)", text: ev.error }));
    run.foot.hidden = false;
    if (ev.outcome === "ok" || ev.outcome === "error") {
      const vote = (v) => async (e) => {
        try { await api("/api/feedback", { method: "POST", body: { runId: ev.runId, vote: v } }); } catch { return; }
        e.target.closest(".fb").replaceChildren(h("span", {}, v === "up" ? "Marked helpful" : "Marked not helpful"));
        if (v === "down" && view === "team") setTimeout(loadSide, 4000);
      };
      run.foot.append(h("span", { class: "grow" }), h("span", { class: "fb" }, h("button", { class: "btn small", onclick: vote("up") }, "Helpful"), " ", h("button", { class: "btn small", onclick: vote("down") }, "Not helpful")));
    }
  }
  socket.on("agent:event", onAgentEvent);
  socket.on("chat message", (m) => { if (room) addMessage(m); });

  // ---------- side panels ----------
  async function loadSide() {
    el.side.replaceChildren();
    if (view === "rooms") return renderRoomsSide();
    await renderTeamSide();
  }

  function nameField() {
    const input = h("input", { id: "nameInput", value: me, placeholder: "Your name", maxlength: "24", "aria-label": "Your name" });
    input.addEventListener("change", () => { me = input.value.trim().slice(0, 24); store.set("name", me); if (room) socket.emit("join room", { room, user: me }, () => {}); });
    return h("section", {}, h("h2", {}, "You"), h("div", { class: "field" }, input));
  }

  function renderRoomsSide() {
    const codeInput = h("input", { id: "codeInput", inputmode: "numeric", placeholder: "6-digit code", "aria-label": "Room code" });
    const join = async (e) => { e?.preventDefault(); const c = codeInput.value.trim(); if (c) await joinRoom(c); };
    const list = h("div", { class: "list" }, rooms.length ? rooms.map((c) => h("button", { class: `row${c === room ? " active" : ""}`, onclick: () => joinRoom(c) }, h("span", { class: "name mono" }, c), c === room ? h("span", { class: "meta" }, "current") : null)) : h("div", { class: "empty-note" }, "No rooms yet."));
    el.side.append(
      nameField(),
      h("section", {}, h("h2", {}, "Rooms"), h("button", { class: "btn primary", style: "width:100%", onclick: createRoom }, "New room")),
      h("section", {}, h("h2", {}, "Join with a code"), h("form", { class: "field", onsubmit: join }, codeInput, h("button", { class: "btn", type: "submit" }, "Join"))),
      h("section", {}, h("h2", {}, "Your rooms"), list));
  }

  async function renderTeamSide() {
    const [skills, audit] = await Promise.all([api("/api/skills").catch(() => []), api("/api/audit").catch(() => [])]);
    if (view !== "team") return;
    el.side.replaceChildren(nameField());
    el.side.append(h("section", {}, h("h2", {}, "Agents"), h("div", { class: "list" }, agents.map((a) =>
      h("button", { class: `row${target === a.name ? " active" : ""}`, onclick: () => setTarget(target === a.name ? "" : a.name), title: a.guidelines ? `Learned guidelines:\n${a.guidelines}` : a.role },
        h("span", { class: "dot", style: `--c:${a.color}` }), h("span", {}, h("div", { class: "name" }, a.title), h("div", { class: "sub" }, a.role)))))));

    const skillRows = skills.map((s) => h("details", { class: "skill" },
      h("summary", {}, h("span", { class: "name" }, s.name), s.status === "retired" ? h("span", { class: "pill retired" }, "retired") : null, h("span", { class: "meta mono", style: "margin-left:auto;color:var(--faint)" }, `v${s.version} · ${s.wins}/${s.losses}`)),
      h("div", { class: "body" }, `${s.description}\n\n${s.body}`),
      h("div", { class: "acts" },
        s.versions.length > 1 ? h("button", { class: "btn small", onclick: async () => { try { await api(`/api/skills/${s.id}/rollback`, { method: "POST", body: {} }); } catch (e) { toast(e.message); } loadSide(); } }, "Revert") : null,
        s.status === "active" ? h("button", { class: "btn small danger", onclick: async () => { await api(`/api/skills/${s.id}/retire`, { method: "POST", body: {} }).catch(() => {}); loadSide(); } }, "Retire") : null)));
    el.side.append(h("section", {}, h("h2", {}, `Skills (${skills.filter((s) => s.status === "active").length})`), skillRows.length ? h("div", { class: "list" }, skillRows) : h("div", { class: "empty-note" }, "None yet.")));
    el.side.append(h("section", {}, h("h2", {}, "Activity"), audit.length ? h("div", { class: "audit" }, audit.slice(0, 12).map((a) => h("div", {}, h("b", {}, a.type), ` ${a.id || a.target || ""} · ${a.actor}${a.reason ? ` — ${a.reason}` : ""}`))) : h("div", { class: "empty-note" }, "No changes yet.")));
  }

  // ---------- views ----------
  function setTarget(t) { target = t; renderTargets(); if (view === "team") loadSide(); }
  function renderTargets() {
    el.targets.replaceChildren();
    if (view !== "team") { el.targets.hidden = true; return; }
    el.targets.hidden = false;
    const chip = (name, label, color) => h("button", { type: "button", class: "chip", "aria-pressed": String(target === name), onclick: () => setTarget(name) }, color ? h("span", { class: "dot", style: `--c:${color}` }) : null, label);
    el.targets.append(chip("", "Auto"), ...agents.map((a) => chip(a.name, a.title, a.color)));
  }

  function hello() {
    const ex = ["Compare SQLite and Postgres for a small side project", "Write and run a Python script that finds primes below 100", "Summarise what changed in the latest Node.js release"];
    el.team.replaceChildren(h("div", { class: "hello" },
      h("h2", {}, "A team of agents on your own machine."),
      h("p", {}, "Grok plans, then asks the researcher, coder, writer and critic for help. They can use tools, talk to each other, and keep the skills that work."),
      h("div", { class: "chips" }, ex.map((t) => h("button", { class: "chip", onclick: () => { el.input.value = t; el.input.focus(); } }, t)))));
  }

  function setView(v) {
    view = v; store.set("view", v);
    // On narrow screens the panel is an overlay; open it when it holds the only way forward (no room joined yet).
    el.app.classList.toggle("side-open", v === "rooms" && !room && window.matchMedia("(max-width: 900px)").matches);
    document.querySelectorAll(".rail-btn").forEach((b) => b.setAttribute("aria-current", String(b.dataset.view === v)));
    el.team.hidden = v !== "team";
    el.room.hidden = v !== "rooms";
    el.actions.replaceChildren();
    if (v === "team") {
      el.title.textContent = "Team";
      el.subtitle.textContent = target ? `Talking to ${agentTitle(target)}` : "Grok leads and brings in teammates when needed";
      el.input.placeholder = "Message the team";
      el.form.hidden = false;
    } else {
      el.title.textContent = room ? `Room ${room}` : "Rooms";
      el.subtitle.textContent = room ? "Mention @grok, @researcher, @coder, @writer or @critic to bring the team in" : "Create a room or join one with a code";
      el.input.placeholder = room ? "Message the room" : "Join a room to chat";
      el.form.hidden = !room;
      if (room) el.actions.append(h("button", { class: "btn small", onclick: async (e) => { try { await navigator.clipboard.writeText(room); e.target.textContent = "Copied"; setTimeout(() => (e.target.textContent = "Copy code"), 1200); } catch { /* clipboard blocked */ } } }, "Copy code"));
    }
    renderTargets();
    loadSide();
  }

  // ---------- rooms ----------
  async function createRoom() { try { await joinRoom(await api("/event")); } catch (e) { toast(e.message); } }
  function joinRoom(code) {
    return new Promise((resolve) => {
      socket.emit("join room", { room: String(code), user: me || "guest" }, (res) => {
        if (!res?.ok) { toast(res?.error === "room not found" ? "That room code does not exist." : res?.error || "Could not join"); return resolve(false); }
        room = String(code);
        rooms = [room, ...rooms.filter((c) => c !== room)].slice(0, 8); store.set("rooms", rooms);
        el.room.replaceChildren();
        (res.history || []).forEach(addMessage);
        if (!res.history?.length) el.room.append(h("div", { class: "sys", text: `You joined room ${room}. Share the code to invite others.` }));
        setView("rooms");
        resolve(true);
      });
    });
  }
  function toast(text) { el.banner.hidden = false; el.banner.textContent = text; setTimeout(() => { if (el.banner.textContent === text) refreshHealth(); }, 3500); }

  // ---------- composer ----------
  el.input.addEventListener("input", () => { el.input.style.height = "auto"; el.input.style.height = `${Math.min(el.input.scrollHeight, 160)}px`; });
  el.input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); el.form.requestSubmit(); } });
  el.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = el.input.value.trim();
    if (!text) return;
    if (!me) { me = "guest"; }
    if (view === "team") {
      el.team.querySelector(".hello")?.remove();
      el.team.append(h("div", { class: "msg me" }, h("div", { class: "bubble", text })));
      socket.emit("team message", { text, target, user: me });
    } else if (room) {
      socket.emit("chat message", { text });
    }
    el.input.value = ""; el.input.style.height = "auto";
    stick(thread());
  });

  // ---------- health ----------
  async function refreshHealth() {
    try {
      const j = await api("/api/health");
      el.health.dataset.state = j.reachable ? "ok" : "down";
      el.health.title = j.reachable ? `${j.provider} · ${j.model}` : `Model server unreachable (${j.provider})`;
      el.health.setAttribute("aria-label", el.health.title);
      if (!j.reachable) { el.banner.hidden = false; el.banner.textContent = `Cannot reach the ${j.provider} server. Start it, then check LLM_PROVIDER and the URL in .env. Chat rooms still work.`; }
      else if (j.modelAvailable === false) { el.banner.hidden = false; el.banner.textContent = `Model "${j.model}" is not installed on the server. Available: ${j.models.slice(0, 5).join(", ") || "none"}.`; }
      else el.banner.hidden = true;
    } catch { el.health.dataset.state = "down"; }
  }

  // ---------- boot ----------
  socket.on("connect", () => { if (room) socket.emit("join room", { room, user: me || "guest" }, () => {}); });
  document.querySelectorAll(".rail-btn").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  $("#menuBtn").addEventListener("click", () => el.app.classList.toggle("side-open"));
  (async () => {
    try { agents = await api("/api/agents"); agents.forEach((a) => (colors[a.name] = a.color)); } catch { /* server not ready */ }
    hello();
    if (view === "rooms" && !room) view = "rooms";
    setView(view);
    refreshHealth();
    setInterval(refreshHealth, 30000);
  })();
})();
