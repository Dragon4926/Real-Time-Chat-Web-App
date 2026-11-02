/* Grok Team client. Every piece of user, agent or tool text is inserted with textContent, never innerHTML. */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style") el.style.cssText = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(3)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const SVGNS = "http://www.w3.org/2000/svg";
  function sv(tag, attrs = {}, ...kids) {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
    for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }

  // ---------- icons (24px grid, stroked) ----------
  const P = {
    people: "M16 19c0-2.2-1.8-4-4-4H7c-2.2 0-4 1.8-4 4M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 19c0-1.9-1.3-3.4-3-3.9M15.5 4.3a3.5 3.5 0 0 1 0 6.4",
    bubble: "M20 11.5a8 8 0 0 1-11.6 7.1L4 19.8l1.2-4A8 8 0 1 1 20 11.5Z",
    search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-3.6-3.6",
    sidebar: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM9.5 4v16",
    inspector: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM14.5 4v16",
    sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2.5v2M12 19.5v2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M2.5 12h2M19.5 12h2M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
    moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z",
    auto: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 3v18M12 7h5M12 11h7M12 15h6",
    globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.5 12h17M12 3c2.4 2.6 3.7 5.6 3.7 9s-1.3 6.4-3.7 9c-2.4-2.6-3.7-5.6-3.7-9S9.6 5.6 12 3Z",
    terminal: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM8 9.5l3 2.5-3 2.5M13 15h3",
    doc: "M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4ZM14 3v4h4M9 13h6M9 17h4",
    calc: "M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01",
    note: "M6 3.5h12v17l-6-4-6 4z",
    handoff: "M7 17 17 7M9 7h8v8",
    sparkle: "M12 3.5l1.9 5.2 5.1 1.8-5.1 1.8L12 17.5l-1.9-5.2L5 10.5l5.1-1.8L12 3.5ZM18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z",
    up: "M12 19V5.5M5.5 11.5 12 5l6.5 6.5",
    down: "M12 5v13.5M5.5 12.5 12 19l6.5-6.5",
    at: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm0 0v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.6 7.2",
    stop: "M7.5 7.5h9v9h-9z",
    thumbUp: "M7.5 11v9h-3v-9h3Zm0 0 3.8-7a2 2 0 0 1 2.2 2v4h5a2 2 0 0 1 2 2.3l-1.1 6A2 2 0 0 1 17.4 20H7.5",
    thumbDown: "M16.5 13V4h3v9h-3Zm0 0-3.8 7a2 2 0 0 1-2.2-2v-4h-5a2 2 0 0 1-2-2.3l1.1-6A2 2 0 0 1 6.6 4h9.9",
    plus: "M12 5v14M5 12h14",
    compose: "M12 20h8M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
    hash: "M5 9h14M5 15h14M10 4 8 20M16 4l-2 16",
    check: "M5 12.5 10 17l9-10",
    copy: "M9 9h10v10H9zM5 15V5h10",
    chevron: "m9.5 6 6 6-6 6",
    enter: "M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4M6 12h10",
    layers: "m12 3.5 9 5-9 5-9-5 9-5ZM3 13.5l9 5 9-5",
    clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l3 2",
    x: "M6.5 6.5l11 11M17.5 6.5l-11 11",
    alert: "M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
    bolt: "M13 2.5 4.5 14H11l-1 7.5L18.5 10H12l1-7.5Z",
    undo: "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
    leaf: "M5 19c0-8 5-13 14-14-1 9-6 14-14 14ZM5 19l7-7",
    shield: "M12 3 5 6v5.5c0 4.3 3 8 7 9.5 4-1.5 7-5.2 7-9.5V6l-7-3Z",
  };
  function icon(name, size = 16, sw = 1.7) {
    return sv("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", "stroke-width": sw, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", class: "ic" }, sv("path", { d: P[name] || P.sparkle }));
  }

  // ---------- state ----------
  const socket = io();
  let view = ["team", "rooms"].includes(store.get("view")) ? store.get("view") : "team";
  let me = String(store.get("name", "") || "");
  let room = null;
  let rooms = (store.get("rooms", []) || []).filter((c) => /^\d{6}$/.test(String(c)));
  let agents = [];
  let skills = [];
  let audit = [];
  let health = null;
  let target = "";
  let theme = ["auto", "light", "dark"].includes(store.get("theme")) ? store.get("theme") : "auto";
  const layout = Object.assign({ sidebar: true, inspector: innerWidth > 1240 }, store.get("layout", {}));
  const runs = new Map();
  let focusRun = null;
  let lastRoomMsg = null;

  const el = {
    app: $("#app"), side: $("#side"), title: $("#title"), subtitle: $("#subtitle"), actions: $("#headActions"), banner: $("#banner"),
    team: $("#teamThread"), room: $("#roomThread"), form: $("#composer"), input: $("#input"), targets: $("#targets"), send: $("#sendBtn"),
    health: $("#health"), healthText: $("#healthText"), seg: $("#segmented"), nameInput: $("#nameInput"), meAvatar: $("#meAvatar"),
    sidebarBtn: $("#sidebarBtn"), inspectorBtn: $("#inspectorBtn"), themeBtn: $("#themeBtn"), insBody: $("#insBody"), insStatus: $("#insStatus"),
    toasts: $("#toasts"), palette: $("#palette"), pInput: $("#paletteInput"), pList: $("#paletteList"), mentionPop: $("#mentionPop"),
    mentionBtn: $("#mentionBtn"), jump: $("#jumpBtn"), scrim: $("#scrim"), searchBtn: $("#searchBtn"),
  };

  // ---------- helpers ----------
  const safeColor = (c) => (/^#[0-9a-f]{3,8}$/i.test(String(c || "")) ? c : "#8e8e93");
  const agentDef = (name) => agents.find((a) => a.name === name);
  const agentTitle = (name) => agentDef(name)?.title || name || "";
  const colorOf = (name) => (agentDef(name) ? safeColor(agentDef(name).color) : `hsl(${hue(name)} 58% 52%)`);
  function hue(str) { let x = 7; for (const ch of String(str)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x % 360; }
  function avatar(name, { size = 28, agent = false, presence = false } = {}) {
    const isAgent = agent && !!agentDef(name);
    const label = isAgent ? agentTitle(name) : String(name || "?");
    if (isAgent && name === "grok") return h("span", { class: "orb", style: `--s:${size}px`, "data-agent": presence ? name : null, title: label, "aria-hidden": "true" });
    return h("span", { class: `avatar${isAgent ? " agent" : ""}`, style: `--c:${colorOf(name)};--s:${size}px`, "data-agent": isAgent && presence ? name : null, title: label, "aria-hidden": "true" }, (label.trim()[0] || "?").toUpperCase());
  }
  const fmtDur = (ms) => (ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.floor(ms / 60000)}m ${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}s`);
  function ago(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 45) return "now"; if (s < 3600) return `${Math.round(s / 60)}m`; if (s < 86400) return `${Math.round(s / 3600)}h`; return `${Math.round(s / 86400)}d`;
  }
  const clock = (ts) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const fmtCode = (c) => `${String(c).slice(0, 3)} ${String(c).slice(3)}`;
  const isNarrow = () => matchMedia("(max-width: 760px)").matches;
  const isMid = () => matchMedia("(max-width: 1100px)").matches;
  function withTransition(fn) { if (document.startViewTransition && !reduceMotion()) document.startViewTransition(fn); else fn(); }
  const api = async (url, opts) => {
    const r = await fetch(url, opts && { ...opts, headers: { "Content-Type": "application/json" }, body: opts.body && JSON.stringify(opts.body) });
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch { /* text */ }
    if (!r.ok) throw new Error(j?.error || t || `HTTP ${r.status}`);
    return j ?? t;
  };
  async function copyText(text, btn) {
    try { await navigator.clipboard.writeText(text); if (btn) { const old = [...btn.childNodes]; btn.replaceChildren(icon("check", 13), " Copied"); setTimeout(() => btn.replaceChildren(...old), 1300); } }
    catch { notify({ title: "Copy blocked", body: "Your browser did not allow clipboard access. Select the text and copy it instead.", icon: "alert", tone: "warn" }); }
  }

  // ---------- markdown (safe subset) ----------
  function inline(node, text) {
    for (const tok of String(text).split(/(`[^`]+`|\*\*[^*]+\*\*|https?:\/\/[^\s)<>"]+)/)) {
      if (!tok) continue;
      if (/^`[^`]+`$/.test(tok)) node.append(h("code", { text: tok.slice(1, -1) }));
      else if (/^\*\*[^*]+\*\*$/.test(tok)) node.append(h("strong", { text: tok.slice(2, -2) }));
      else if (/^https?:\/\//.test(tok)) node.append(h("a", { href: tok, target: "_blank", rel: "noopener noreferrer", text: tok }));
      else node.append(tok);
    }
    return node;
  }
  function renderMd(target, raw) {
    const out = [];
    raw.split(/```/).forEach((part, i) => {
      if (i % 2) {
        const lang = (part.match(/^([a-z0-9+#-]*)\n/i) || [])[1] || "";
        const body = part.replace(/^[a-z0-9+#-]*\n/i, "").replace(/\n$/, "");
        const btn = h("button", { type: "button", class: "btn tiny", onclick: (e) => copyText(body, e.currentTarget) }, icon("copy", 12), " Copy");
        out.push(h("div", { class: "code" }, h("div", { class: "code-head" }, h("span", {}, lang || "code"), btn), h("pre", {}, h("code", { text: body }))));
        return;
      }
      for (const block of part.split(/\n{2,}/)) {
        const lines = block.split("\n").filter((l) => l.trim());
        if (!lines.length) continue;
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) out.push(h("ul", {}, lines.map((l) => inline(h("li"), l.replace(/^\s*[-*•]\s+/, "")))));
        else if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) out.push(h("ol", {}, lines.map((l) => inline(h("li"), l.replace(/^\s*\d+[.)]\s+/, "")))));
        else if (lines.length === 1 && /^#{1,4}\s/.test(lines[0])) out.push(inline(h("h4"), lines[0].replace(/^#+\s/, "")));
        else { const p = h("p"); lines.forEach((l, j) => { if (j) p.append(h("br")); inline(p, l); }); out.push(p); }
      }
    });
    target.replaceChildren(...out);
  }

  // ---------- toasts ----------
  function notify({ title, body, icon: ic = "sparkle", tone = "info" }) {
    const t = h("div", { class: `toast ${tone}`, role: "status" }, h("span", { class: "toast-icon" }, icon(ic, 17, 1.9)), h("div", { class: "toast-text" }, h("strong", {}, title), body ? h("p", {}, body) : null), h("span", { class: "toast-time" }, "now"));
    const close = () => { if (t.classList.contains("leaving")) return; t.classList.add("leaving"); setTimeout(() => t.remove(), 320); };
    t.addEventListener("click", close);
    el.toasts.append(t);
    while (el.toasts.children.length > 3) el.toasts.firstElementChild.remove();
    setTimeout(close, 5600);
  }

  // ---------- scrolling ----------
  const thread = () => (view === "team" ? el.team : el.room);
  const nearBottom = (t) => t.scrollHeight - t.scrollTop - t.clientHeight < 160;
  function stick(t, force = false) { if (force || nearBottom(t)) t.scrollTop = t.scrollHeight; updateJump(); }
  function updateJump() { const t = thread(); el.jump.hidden = nearBottom(t) || el.form.hidden; }
  [el.team, el.room].forEach((t) => t.addEventListener("scroll", updateJump, { passive: true }));
  el.jump.append(icon("down", 16, 2));
  el.jump.addEventListener("click", () => thread().scrollTo({ top: thread().scrollHeight, behavior: reduceMotion() ? "auto" : "smooth" }));

  // ---------- tools: friendly labels ----------
  const TOOL = {
    web_search: ["globe", "Searched the web", (a) => a.query], web_fetch: ["globe", "Opened", (a) => a.url],
    run_code: ["terminal", "Ran", (a) => a.language || "code"],
    file_write: ["doc", "Wrote", (a) => a.path], file_read: ["doc", "Read", (a) => a.path], file_list: ["doc", "Listed", (a) => a.path || "workspace"], file_delete: ["doc", "Deleted", (a) => a.path],
    calc: ["calc", "Calculated", (a) => a.expression],
    note_save: ["note", "Saved a note", (a) => a.text], note_search: ["note", "Searched notes", (a) => a.query], room_history: ["note", "Read the chat", () => ""],
    ask_agent: ["handoff", "Asked", (a) => agentTitle(a.name)], send_message: ["handoff", "Messaged", (a) => agentTitle(a.name)],
    spawn_task: ["handoff", "Handed off to", (a) => agentTitle(a.name)], await_tasks: ["handoff", "Collected results", () => ""], list_agents: ["people", "Checked the team", () => ""],
    blackboard_write: ["layers", "Pinned to the blackboard", (a) => a.key], blackboard_read: ["layers", "Read the blackboard", (a) => a.key || ""],
    skill_search: ["sparkle", "Looked up skills", (a) => a.query], skill_save: ["sparkle", "Saved a skill", (a) => a.name],
  };
  function toolInfo(name, args) {
    const t = TOOL[name] || ["bolt", name, (a) => Object.values(a)[0]];
    let arg = ""; try { arg = String(t[2](args || {}) ?? ""); } catch { /* ignore */ }
    return { icon: t[0], label: t[1], arg: arg.replace(/\s+/g, " ").slice(0, 140) };
  }
  function inputPreview(name, args = {}) {
    if (name === "run_code") return args.code;
    if (name === "file_write") return String(args.content || "").slice(0, 1200);
    if (["ask_agent", "spawn_task", "send_message"].includes(name)) return args.question || args.task || args.text;
    if (name === "blackboard_write") return args.value;
    return null;
  }

  // ---------- agent runs ----------
  const dirty = new Map(); // text segment -> latest raw markdown (segments can be closed before the frame runs)
  let rafPending = false;
  function scheduleRender(c) {
    dirty.set(c.seg, { raw: c.raw, c });
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      for (const [seg, { raw, c }] of dirty) {
        renderMd(seg, raw);
        if (!c.done && c.seg === seg) {
          let host = seg.lastElementChild;
          while (host && /^(UL|OL)$/.test(host.tagName)) host = host.lastElementChild;
          (host && /^(P|LI|H4)$/.test(host.tagName) ? host : seg).append(h("span", { class: "caret", "aria-hidden": "true" }));
        }
      }
      dirty.clear();
      stick(thread());
    });
  }

  function createRun(ev, container) {
    const timeEl = h("span", { class: "elapsed" }, "0.0s");
    const label = h("span", { class: "status-label" }, "Working");
    const metaEl = h("span", { class: "run-meta" });
    const stop = h("button", { type: "button", class: "icon-btn small stop", title: "Stop", "aria-label": "Stop", onclick: (e) => { e.stopPropagation(); socket.emit("agent:stop", { runId: ev.runId }); } }, icon("stop", 13, 2));
    const head = h("header", { class: "run-head" }, avatar(ev.entry, { size: 30, agent: true, presence: true }), h("div", { class: "run-title" }, h("strong", {}, agentTitle(ev.entry)), h("span", { class: "run-status" }, label, h("span", {}, "·"), timeEl, metaEl)), stop);
    const body = h("div", { class: "run-body" });
    const foot = h("footer", { class: "run-foot", hidden: true });
    const card = h("article", { class: "run", "data-state": "working", tabindex: "0", "aria-label": `${agentTitle(ev.entry)} run` }, head, body, foot);
    const model = { id: ev.runId, view: ev.view, entry: ev.entry, text: ev.text, card, body, foot, stop, timeEl, label, metaEl, calls: new Map(), nodes: [], blackboard: new Map(), skills: new Map(), stats: { tools: 0, errors: 0, handoffs: 0 }, started: Date.now(), ended: null, state: "working", learned: [] };
    card.addEventListener("click", (e) => { if (!e.target.closest("button, summary, a")) setFocus(model, true); });
    runs.set(ev.runId, model);
    container.append(card);
    stick(container, true);
    return model;
  }

  function startCall(run, ev) {
    const node = run.nodes.find((n) => n.id === ev.callId);
    const parent = node?.parent ? run.calls.get(node.parent) : null;
    const nested = ev.depth > 0;
    const block = h("div", { class: `call${nested ? " nested" : ""}`, style: `--c:${colorOf(ev.agent)}`, "data-state": "working" });
    if (nested) {
      block.append(
        h("div", { class: "call-head" }, avatar(ev.agent, { size: 20, agent: true, presence: true }), h("b", {}, agentTitle(ev.agent)), h("span", {}, `for ${agentTitle(ev.from)}`), h("span", { class: "done-mark" }, icon("check", 14, 2.2))),
        h("div", { class: "call-task", text: ev.task }));
    }
    const typing = h("span", { class: "thinking", role: "status" }, icon("sparkle", 13, 2), h("span", {}, `${agentTitle(ev.agent)} is thinking`));
    block.append(typing);
    const c = { block, seg: null, raw: "", tools: new Map(), typing, agent: ev.agent, done: false };
    run.calls.set(ev.callId, c);
    if (parent) { parent.block.append(block); parent.seg = null; } else run.body.append(block);
  }

  function onAgentEvent(ev) {
    ev.view = ev.view === "team" ? "team" : "rooms"; // server says "room", the client view is "rooms"
    const container = ev.view === "team" ? el.team : el.room;
    if (ev.type === "run_error") { notify({ title: "The team is busy", body: ev.message, icon: "clock", tone: "warn" }); return; }
    if (ev.type === "run_start") {
      if (ev.view === "team") el.team.querySelector(".hello")?.remove();
      const r = createRun(ev, container);
      if (ev.view === view) setFocus(r);
      return;
    }
    const run = runs.get(ev.runId);
    if (!run) return;
    const c = ev.callId ? run.calls.get(ev.callId) : null;
    switch (ev.type) {
      case "graph": run.nodes = ev.nodes; break;
      case "start": startCall(run, ev); break;
      case "skills": for (const sk of ev.skills || []) run.skills.set(sk.id, sk.name); break;
      case "token":
        if (!c) break;
        c.typing.remove();
        if (!c.seg) { c.seg = h("div", { class: "text" }); c.raw = ""; c.block.append(c.seg); }
        c.raw += ev.text;
        scheduleRender(c);
        return;
      case "tool_call": {
        if (!c) break;
        c.typing.remove(); c.seg?.querySelector(".caret")?.remove(); c.seg = null;
        const info = toolInfo(ev.tool, ev.args);
        const time = h("span", { class: "step-time" });
        const out = h("pre", { class: "step-out" }, "Running…");
        const prev = inputPreview(ev.tool, ev.args);
        const d = h("details", { class: "step", "data-state": "running" },
          h("summary", {}, h("span", { class: "step-icon" }, icon(info.icon, 13, 1.9)), h("span", { class: "step-label" }, h("b", {}, info.label), info.arg ? h("span", { class: "step-arg" }, info.arg) : null), time, h("span", { class: "chev" }, icon("chevron", 12, 2))),
          prev ? h("pre", { class: "step-in", text: prev }) : null, out);
        c.tools.set(ev.id, { d, out, time, t0: Date.now() });
        c.block.append(d);
        run.stats.tools++;
        break;
      }
      case "tool_result": {
        const t = c?.tools.get(ev.id);
        if (t) { t.d.dataset.state = ev.error ? "error" : "done"; t.out.textContent = ev.result || "(no output)"; const took = Date.now() - t.t0; t.time.textContent = took >= 150 ? fmtDur(took) : ""; if (ev.error) run.stats.errors++; }
        if (c && !c.done) { c.typing.lastChild.textContent = `${agentTitle(c.agent)} is working`; c.block.append(c.typing); }
        break;
      }
      case "a2a": if (["ask", "spawn", "message"].includes(ev.kind)) run.stats.handoffs++; break;
      case "inbox": if (c) c.block.append(h("div", { class: "inbox" }, icon("bubble", 13), h("span", {}, `${agentTitle(ev.from)}: ${ev.text}`))); break;
      case "blackboard": run.blackboard.set(ev.key, ev.by); break;
      case "done": if (c) { c.done = true; c.typing.remove(); c.seg?.querySelector(".caret")?.remove(); c.block.dataset.state = "done"; } break;
      case "error": if (c) { c.done = true; c.typing.remove(); c.block.dataset.state = "error"; } break;
      case "learned": onLearned(run, ev); break;
      case "run_end": finishRun(run, ev); break;
      default: break;
    }
    updatePresence();
    if (run === focusRun) scheduleInspector();
    stick(container);
  }

  const LEARN_WORDS = { create_skill: "a new skill", update_skill: "an improved skill", merge_skills: "merged skills", retire_skill: "retired a skill", edit_agent_prompt: "new guidelines" };
  function onLearned(run, ev) {
    if (!ev.applied?.length) return;
    const words = [...new Set(ev.applied.map((a) => LEARN_WORDS[a] || a))];
    run.learned = words;
    run.foot.hidden = false;
    const chip = h("span", { class: "learned" }, icon("sparkle", 13, 1.9), `Learned ${words.join(", ")}`);
    const fb = $(".fb", run.foot);
    if (fb) fb.after(chip); else run.foot.prepend(chip);
    const list = words.join(", ");
    notify({ title: "The team learned something", body: `${list[0].toUpperCase()}${list.slice(1)}.${ev.summary ? ` ${ev.summary}` : ""}`, icon: "sparkle", tone: "ai" });
    refreshTeamData();
  }

  function finishRun(run, ev) {
    run.state = ev.outcome === "ok" ? "done" : ev.outcome === "aborted" ? "stopped" : "error";
    run.ended = Date.now();
    run.nodes = ev.nodes || run.nodes;
    run.card.dataset.state = run.state;
    run.card.querySelectorAll(".thinking, .caret").forEach((n) => n.remove());
    run.stop.remove();
    run.label.textContent = { done: "Done", stopped: "Stopped", error: "Failed" }[run.state];
    run.timeEl.textContent = fmtDur(run.ended - run.started);
    const bits = [];
    if (run.stats.tools) bits.push(`${run.stats.tools} ${run.stats.tools === 1 ? "tool" : "tools"}`);
    const helpers = new Set(run.nodes.map((n) => n.agent)).size - 1;
    if (helpers > 0) bits.push(`${helpers} ${helpers === 1 ? "teammate" : "teammates"}`);
    run.metaEl.textContent = bits.length ? ` · ${bits.join(" · ")}` : "";
    if (ev.error && run.state === "error") run.body.append(h("div", { class: "run-error" }, icon("alert", 15), h("span", {}, ev.error)));
    run.foot.hidden = false;
    if (run.state !== "stopped") {
      const vote = (v) => async (e) => {
        const btn = e.currentTarget;
        try { await api("/api/feedback", { method: "POST", body: { runId: run.id, vote: v } }); } catch (err) { notify({ title: "Feedback not saved", body: err.message, icon: "alert", tone: "warn" }); return; }
        $$(".fb .icon-btn", run.foot).forEach((b) => b.classList.remove("voted"));
        btn.classList.add("voted");
        if (v === "down") notify({ title: "Thanks, noted", body: "The team will review this run and adjust its skills.", icon: "undo" });
        setTimeout(refreshTeamData, v === "down" ? 4000 : 300);
      };
      run.foot.prepend(h("span", { class: "fb" },
        h("button", { type: "button", class: "icon-btn small", title: "Helpful", "aria-label": "Helpful", onclick: vote("up") }, icon("thumbUp", 14)),
        h("button", { type: "button", class: "icon-btn small", title: "Not helpful", "aria-label": "Not helpful", onclick: vote("down") }, icon("thumbDown", 14))));
    }
    run.foot.append(h("span", { class: "foot-grow" }), h("button", { type: "button", class: "link-btn", onclick: () => { setFocus(run, true); openInspector(); } }, "Details"));
    updatePresence();
  }

  function updatePresence() {
    const working = new Set();
    for (const r of runs.values()) if (r.state === "working") for (const n of r.nodes) if (n.status === "running") working.add(n.agent);
    $$("[data-agent]").forEach((n) => n.classList.toggle("working", working.has(n.dataset.agent)));
    const busy = [...runs.values()].some((r) => r.state === "working");
    document.body.classList.toggle("ai-busy", busy);
    $("#titleOrb").title = busy ? "The team is working" : "The team is ready";
  }

  // ---------- inspector ----------
  function setFocus(run, userInitiated = false) {
    if (focusRun?.card) focusRun.card.classList.remove("focused");
    focusRun = run;
    if (run?.card && userInitiated) run.card.classList.add("focused");
    scheduleInspector();
  }
  let insPending = false;
  function scheduleInspector() { if (insPending) return; insPending = true; requestAnimationFrame(() => { insPending = false; renderInspector(); }); }

  function renderInspector() {
    const run = focusRun;
    el.insStatus.replaceChildren();
    if (!run) {
      el.insBody.replaceChildren(h("div", { class: "ins-empty" }, h("span", { class: "tile" }, icon("layers", 22)), h("strong", {}, "No runs yet"), h("span", {}, "When the team works on something, you will see who is involved, every tool they use and what they share here.")));
      return;
    }
    const stateWord = { working: "Working", done: "Done", stopped: "Stopped", error: "Failed" }[run.state];
    el.insStatus.append(h("span", { class: `pill ${run.state}` }, stateWord));
    const team = new Set(run.nodes.map((n) => n.agent));
    const elapsed = (run.ended || Date.now()) - run.started;
    const stat = (n, label, key) => h("div", { class: "stat" }, h("b", { "data-stat": key }, n), h("span", {}, label));
    const secs = [
      h("section", { class: "ins-sec" }, h("h3", {}, "Request"), h("p", { class: "call-task", style: "-webkit-line-clamp:4", text: run.text || "" })),
      h("section", { class: "ins-sec" }, h("div", { class: "stats" }, stat(team.size, team.size === 1 ? "agent" : "agents"), stat(run.stats.tools, "tool calls"), stat(run.stats.handoffs, "handoffs"), stat(fmtDur(elapsed), "elapsed", "time"))),
    ];
    if (run.nodes.length) secs.push(h("section", { class: "ins-sec" }, h("h3", {}, "Who is working on it"), h("div", { class: "graph-card" }, graphSvg(run.nodes))));
    if (run.blackboard.size) secs.push(h("section", { class: "ins-sec" }, h("h3", {}, "Shared blackboard"), h("div", { class: "kv" }, [...run.blackboard].map(([k, by]) => h("div", { class: "row" }, h("span", { class: "tile", style: "width:20px;height:20px" }, icon("layers", 12)), h("span", { class: "name" }, k), h("span", { class: "meta" }, agentTitle(by)))))));
    if (run.skills.size) secs.push(h("section", { class: "ins-sec" }, h("h3", {}, "Skills in use"), h("div", { class: "chips" }, [...run.skills].map(([id, name]) => h("button", { type: "button", class: "pill", onclick: () => openSkill(id) }, icon("sparkle", 11), name)))));
    if (run.learned.length) secs.push(h("section", { class: "ins-sec" }, h("h3", {}, "Learned"), h("div", { class: "chips" }, run.learned.map((w) => h("span", { class: "pill ai" }, icon("sparkle", 11), w)))));
    el.insBody.replaceChildren(...secs);
  }

  function graphSvg(nodes) {
    const order = [];
    const walk = (pid, depth) => nodes.filter((n) => (n.parent || null) === pid).forEach((n) => { order.push({ n, depth }); walk(n.id, depth + 1); });
    walk(null, 0);
    const rowH = 50, colW = 30, padX = 24, padY = 26, W = 272;
    const H = padY * 2 + Math.max(0, order.length - 1) * rowH;
    const pos = new Map(order.map(({ n, depth }, i) => [n.id, { x: padX + depth * colW, y: padY + i * rowH }]));
    const root = sv("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Call graph with ${order.length} steps` },
      sv("defs", {}, sv("linearGradient", { id: "g-ai", x1: "0", y1: "0", x2: "1", y2: "1" }, sv("stop", { offset: "0", class: "st1" }), sv("stop", { offset: ".4", class: "st2" }), sv("stop", { offset: ".75", class: "st3" }), sv("stop", { offset: "1", class: "st4" }))));
    for (const { n } of order) {
      if (!n.parent || !pos.has(n.parent)) continue;
      const p = pos.get(n.parent); const q = pos.get(n.id);
      root.append(sv("path", { class: `g-edge${n.status === "running" ? " live" : ""}`, d: `M${p.x} ${p.y + 15} L${p.x} ${q.y - 8} Q${p.x} ${q.y} ${p.x + 8} ${q.y} L${q.x - 15} ${q.y}` }));
    }
    order.forEach(({ n, depth }, i) => {
      const { x, y } = pos.get(n.id);
      const color = colorOf(n.agent);
      const g = sv("g", { class: "g-node", style: `animation-delay:${i * 40}ms` });
      const isGrok = n.agent === "grok";
      if (n.status === "running") g.append(isGrok ? sv("circle", { class: "g-ring", cx: x, cy: y, r: 17, stroke: "url(#g-ai)" }) : sv("rect", { class: "g-ring", x: x - 17, y: y - 17, width: 34, height: 34, rx: 11, stroke: color }));
      if (isGrok) g.append(sv("circle", { cx: x, cy: y, r: 14, fill: "url(#g-ai)" }), sv("circle", { cx: x - 4, cy: y - 5, r: 5, class: "g-shine" }));
      else g.append(sv("rect", { x: x - 14, y: y - 14, width: 28, height: 28, rx: 9, fill: color }), sv("text", { class: "g-initial", x, y }, (agentTitle(n.agent)[0] || "?").toUpperCase()));
      const maxChars = Math.max(10, 30 - depth * 4);
      const status = { running: "working", done: "done", failed: "failed", stopped: "stopped" }[n.status] || n.status;
      const task = n.parent ? ` · ${n.task.length > maxChars ? `${n.task.slice(0, maxChars - 1)}…` : n.task}` : "";
      g.append(sv("text", { class: "g-name", x: x + 22, y: y - 3 }, agentTitle(n.agent)));
      g.append(sv("text", { class: `g-sub ${n.status}`, x: x + 22, y: y + 12 }, `${status}${task}`));
      root.append(g);
    });
    return root;
  }

  // ---------- sidebar ----------
  function section(title, extra, ...content) {
    return h("section", { class: "sb-section" }, h("div", { class: "sb-head" }, h("h2", {}, title), extra), ...content);
  }
  function renderSide({ animate = false } = {}) {
    const open = new Set($$("details.skill[open]", el.side).map((d) => d.dataset.skill));
    const scroll = el.side.scrollTop;
    const parts = view === "team" ? teamSide(open) : roomsSide();
    el.side.replaceChildren(...parts);
    el.side.scrollTop = scroll;
    if (animate) { el.side.classList.remove("enter"); void el.side.offsetWidth; el.side.classList.add("enter"); }
    updatePresence();
  }

  function teamSide(open) {
    const agentRows = agents.map((a) => h("button", { type: "button", class: `row agent-row${target === a.name ? " active" : ""}`, "data-agent": a.name, onclick: () => setTarget(target === a.name ? "" : a.name), title: a.guidelines ? `Learned guidelines:\n${a.guidelines}` : a.role },
      avatar(a.name, { size: 28, agent: true, presence: true }),
      h("span", { class: "txt" }, h("span", { class: "name" }, a.title), h("span", { class: "sub" }, a.role), h("span", { class: "working-label" }, "Working…")),
      h("span", { class: "check" }, icon("check", 14, 2.2))));

    const sorted = [...skills].sort((a, b) => (a.status === "retired") - (b.status === "retired") || a.name.localeCompare(b.name));
    const skillRows = sorted.map((s) => {
      const decided = s.wins + s.losses;
      const pct = decided ? Math.round((s.wins / decided) * 100) : 0;
      const acts = [];
      if (s.versions?.length > 1) acts.push(h("button", { type: "button", class: "btn tiny", onclick: () => skillAction(s, "rollback") }, icon("undo", 12), " Revert"));
      if (s.status === "active") acts.push(h("button", { type: "button", class: "btn tiny danger", onclick: () => skillAction(s, "retire") }, "Retire"));
      return h("details", { class: `skill${s.status === "retired" ? " retired" : ""}`, "data-skill": s.id, open: open.has(s.id) },
        h("summary", {}, h("span", { class: `skill-icon${s.source === "seed" ? "" : " ai"}` }, icon(s.source === "seed" ? "leaf" : "sparkle", 12, 1.9)), h("span", { class: "skill-name" }, s.name), h("span", { class: "ver" }, `v${s.version}`)),
        h("div", { class: "skill-detail" },
          h("p", { class: "skill-desc" }, s.description),
          h("div", { class: "winbar", title: decided ? `${pct}% helpful` : "No ratings yet" }, h("div", { class: "bar" }, h("span", { style: `--w:${pct}%` })), h("small", {}, `${s.uses} uses · ${s.wins} helpful · ${s.losses} not`)),
          h("pre", { class: "skill-body" }, s.body),
          acts.length ? h("div", { class: "skill-acts" }, acts) : null));
    });

    const feed = audit.filter((a) => a.type !== "seed").slice(0, 12).map(feedItem);
    return [
      section("Agents", h("span", { class: "count" }, target ? "Click again for auto" : ""), h("div", { class: "list" }, agentRows)),
      section("Skills", h("span", { class: "count" }, `${skills.filter((s) => s.status === "active").length} active`), skillRows.length ? h("div", { class: "list" }, skillRows) : h("p", { class: "empty-note" }, "No skills yet.")),
      section("Recent learning", null, feed.length ? h("div", { class: "feed" }, feed) : h("p", { class: "empty-note" }, "Nothing learned yet. Skills the team creates or improves show up here.")),
    ];
  }
  const FEED = {
    create: ["sparkle", "Learned", "good"], update: ["sparkle", "Improved", "good"], "merge-retire": ["layers", "Merged", "accent"], retire: ["x", "Retired", "bad"],
    demote: ["down", "Demoted", "bad"], rollback: ["undo", "Reverted", "accent"], guidelines: ["doc", "New guidelines for", "accent"], rejected: ["shield", "Blocked an unsafe change", "bad"], reflect: ["clock", "Reflection", ""],
  };
  function feedItem(a) {
    const [ic, verb, tone] = FEED[a.type] || ["bolt", a.type, ""];
    const name = a.target === "agent" ? agentTitle(a.id) : skills.find((s) => s.id === a.id)?.name || a.id || "";
    const who = a.actor === "user" ? "by you" : a.actor === "reflection" ? "after reflection" : String(a.actor || "").startsWith("agent:") ? `by ${agentTitle(a.actor.slice(6))}` : "";
    return h("div", { class: `item${tone ? ` tone-${tone}` : ""}`, title: a.reason || "" }, h("span", { class: "tile" }, icon(ic, 11, 2)), h("span", {}, `${verb} `, name ? h("b", {}, name) : null, who ? ` ${who}` : ""), h("time", {}, ago(a.ts)));
  }
  async function skillAction(s, action) {
    try {
      await api(`/api/skills/${encodeURIComponent(s.id)}/${action}`, { method: "POST", body: {} });
      notify(action === "rollback" ? { title: "Skill reverted", body: `${s.name} is back to its previous version.`, icon: "undo" } : { title: "Skill retired", body: `${s.name} will no longer be used.`, icon: "x" });
    } catch (e) { notify({ title: "That did not work", body: e.message, icon: "alert", tone: "warn" }); }
    refreshTeamData();
  }

  function roomsSide() {
    const codeInput = h("input", { id: "codeInput", class: "code-input", inputmode: "numeric", maxlength: "6", placeholder: "000000", "aria-label": "Room code", autocomplete: "off" });
    codeInput.addEventListener("input", () => { codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6); });
    const join = (e) => { e.preventDefault(); const c = codeInput.value.trim(); if (/^\d{6}$/.test(c)) joinRoom(c); else notify({ title: "Check the code", body: "Room codes have 6 digits.", icon: "hash", tone: "warn" }); };
    const recent = rooms.map((c) => h("button", { type: "button", class: `row${c === room ? " active" : ""}`, onclick: () => joinRoom(c) }, h("span", { class: "tile" }, icon("hash", 14)), h("span", { class: "txt" }, h("span", { class: "name", style: "font-family:var(--mono);letter-spacing:.04em" }, fmtCode(c)), h("span", { class: "sub" }, c === room ? "You are here" : "Rejoin")), h("span", { class: "check" }, icon("check", 14, 2.2))));
    return [
      section("Rooms", null, h("button", { type: "button", class: "btn primary block", onclick: createRoom }, icon("plus", 14, 2), "New room")),
      section("Join with a code", null, h("form", { class: "field", onsubmit: join }, codeInput, h("button", { class: "btn", type: "submit" }, "Join"))),
      section("Recent", null, recent.length ? h("div", { class: "list" }, recent) : h("p", { class: "empty-note" }, "Rooms you join appear here.")),
    ];
  }

  async function refreshTeamData() {
    const [s, a] = await Promise.all([api("/api/skills").catch(() => skills), api("/api/audit").catch(() => audit)]);
    skills = s; audit = a;
    try { agents = await api("/api/agents"); } catch { /* keep */ }
    if (view === "team") renderSide();
  }

  // ---------- views ----------
  function setTarget(t) {
    target = t;
    renderTargets();
    if (view === "team") { renderSide(); renderToolbar(); el.input.placeholder = target ? `Message ${agentTitle(target)}` : "Message the team"; }
  }
  function renderTargets() {
    el.targets.hidden = view !== "team";
    if (el.targets.hidden) return;
    const token = (name, label) => h("button", { type: "button", class: "token", "aria-pressed": String(target === name), onclick: () => setTarget(name) },
      name ? avatar(name, { size: 16, agent: true, presence: true }) : h("span", { class: "token-auto" }, icon("sparkle", 10, 2.2)), label);
    el.targets.replaceChildren(h("span", { class: "to-label" }, "To"), token("", "Auto"), ...agents.map((a) => token(a.name, a.title)));
    updatePresence();
  }
  function renderToolbar() {
    el.actions.replaceChildren();
    if (view === "team") {
      el.title.textContent = target ? agentTitle(target) : "Team";
      el.subtitle.textContent = target ? agentDef(target)?.role || "" : "Grok leads and brings in teammates when needed";
      el.actions.append(h("button", { type: "button", class: "icon-btn", title: "New chat", "aria-label": "New chat", onclick: newChat }, icon("compose", 16)));
    } else {
      el.title.textContent = room ? `Room ${room}` : "Rooms";
      el.subtitle.textContent = room ? "Mention @grok or any teammate to bring them in" : "Chat in real time with people and agents";
      if (room) el.actions.append(h("button", { type: "button", class: "btn tiny", onclick: (e) => copyText(room, e.currentTarget) }, icon("copy", 12), " Copy code"));
    }
  }

  function setView(v, { animate = true } = {}) {
    const apply = () => {
      view = v; store.set("view", v);
      el.seg.dataset.active = v;
      $$("[role=tab]", el.seg).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === v)));
      el.team.hidden = v !== "team";
      el.room.hidden = v !== "rooms";
      el.form.hidden = v === "rooms" && !room;
      el.input.placeholder = v === "team" ? (target ? `Message ${agentTitle(target)}` : "Message the team") : "Message the room";
      if (v === "rooms" && !room) roomEmpty();
      renderToolbar();
      renderTargets();
      renderSide({ animate });
      const latest = [...runs.values()].filter((r) => r.view === v).pop() || null;
      setFocus(latest);
      if (isNarrow()) closeDrawers();
      const t = thread();
      if (animate) { t.classList.remove("enter"); void t.offsetWidth; t.classList.add("enter"); }
      updateJump();
    };
    if (animate && v !== view) withTransition(apply); else apply();
  }

  function hello() {
    const hr = new Date().getHours();
    const greet = hr < 5 ? "Working late" : hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
    const named = me && me !== "guest" ? `, ${me}` : "";
    const ideas = [
      { agent: "researcher", icon: "globe", title: "Research", text: "Compare SQLite and Postgres for a small side project" },
      { agent: "coder", icon: "terminal", title: "Build", text: "Write and run a Python script that finds the primes below 100" },
      { agent: "writer", icon: "doc", title: "Write", text: "Draft a short launch note, then have the critic review it" },
      { agent: "grok", icon: "layers", title: "Plan", text: "Plan a weekend in Lisbon and split the research across the team" },
    ];
    el.team.replaceChildren(h("div", { class: "hello" },
      h("div", { class: "hero-orb" }, h("span", { class: "orb live", style: "--s:76px", "aria-hidden": "true" })),
      h("p", { class: "eyebrow" }, `${greet}${named}`),
      h("h2", {}, "What should ", h("span", { class: "ai-text" }, "the team"), " work on?"),
      h("p", { class: "lede" }, "Grok plans the work and brings in the researcher, coder, writer and critic. They use tools, check each other's work, and keep the skills that help."),
      h("div", { class: "ready" }, h("span", { class: "avatar-stack" }, agents.map((a) => avatar(a.name, { size: 22, agent: true, presence: true }))),
        h("span", {}, `${agents.length} agents ready`, health?.model ? ` · running on ${health.model}` : "", " · learns as it goes")),
      h("div", { class: "suggest-grid" }, ideas.map((c) => h("button", { type: "button", class: "suggest", style: `--c:${colorOf(c.agent)}`, onclick: () => { el.input.value = c.text; syncInput(); el.input.focus(); } },
        h("span", { class: "suggest-icon" }, icon(c.icon, 17)), h("span", { class: "suggest-title" }, c.title), h("span", { class: "suggest-text" }, c.text))))));
  }
  function newChat() { hello(); setFocus(null); el.input.focus(); }

  function roomEmpty() {
    el.room.replaceChildren(h("div", { class: "room-empty" },
      h("span", { class: "big-ic" }, icon("bubble", 30, 1.8)),
      h("h2", {}, "Chat rooms"),
      h("p", {}, "Talk with other people in real time. Mention @grok or any teammate and the whole room watches them work."),
      h("div", { class: "acts" },
        h("button", { type: "button", class: "btn primary", onclick: createRoom }, icon("plus", 14, 2), "New room"),
        h("button", { type: "button", class: "btn", id: "joinCodeBtn", onclick: focusCode }, icon("enter", 14), "Join with a code"))));
  }
  function focusCode() {
    if (view !== "rooms") setView("rooms", { animate: false });
    if (isNarrow()) openSidebar(); else if (!layout.sidebar) toggleSidebar();
    setTimeout(() => $("#codeInput")?.focus(), 120);
  }

  // ---------- rooms ----------
  async function createRoom() {
    try { await joinRoom(String(await api("/event"))); }
    catch (e) { notify({ title: "Could not create a room", body: e.message, icon: "alert", tone: "warn" }); }
  }
  function joinRoom(code) {
    return new Promise((resolve) => {
      socket.emit("join room", { room: String(code), user: me || "guest" }, (res) => {
        if (!res?.ok) {
          notify({ title: "Could not join", body: res?.error === "room not found" ? "There is no room with that code. Check the digits and try again." : res?.error || "The server did not answer.", icon: "hash", tone: "warn" });
          return resolve(false);
        }
        room = String(code);
        rooms = [room, ...rooms.filter((c) => c !== room)].slice(0, 8); store.set("rooms", rooms);
        lastRoomMsg = null;
        el.room.replaceChildren(h("div", { class: "room-intro" },
          h("div", { class: "digits", "aria-label": `Room code ${room}` }, [...room].map((d) => h("span", {}, d))),
          h("p", {}, "Share this code to invite people. Bring in the team with a mention:"),
          h("div", { class: "agents-inline" }, agents.map((a) => h("button", { type: "button", class: "token", onclick: () => insertMention(a.name) }, avatar(a.name, { size: 16, agent: true, presence: true }), `@${a.name}`)))));
        (res.history || []).forEach(addMessage);
        setView("rooms", { animate: false });
        stick(el.room, true);
        resolve(true);
      });
    });
  }
  function addMessage(msg) {
    const isAgent = !!agentDef(msg.user);
    const mine = !isAgent && msg.user === (me || "guest");
    if (!lastRoomMsg || msg.ts - lastRoomMsg.ts > 10 * 60 * 1000) el.room.append(h("div", { class: "time-sep" }, `Today ${clock(msg.ts)}`));
    const cont = lastRoomMsg && lastRoomMsg.user === msg.user && msg.ts - lastRoomMsg.ts < 2 * 60 * 1000;
    lastRoomMsg = msg;
    el.room.append(h("div", { class: `msg${mine ? " me" : ""}${cont ? " cont" : ""}${isAgent ? " bot" : ""}`, title: clock(msg.ts), style: isAgent ? `--c:${colorOf(msg.user)}` : null },
      mine ? null : avatar(msg.user, { size: 28, agent: isAgent, presence: isAgent }),
      h("div", { class: "msg-col" }, !mine && !cont ? h("span", { class: "who" }, isAgent ? agentTitle(msg.user) : msg.user) : null, h("div", { class: "bubble", text: msg.text }))));
    stick(el.room, mine);
  }

  // ---------- composer ----------
  function syncInput() {
    el.send.disabled = !el.input.value.trim();
    el.input.style.height = "auto";
    el.input.style.height = `${Math.min(el.input.scrollHeight, 180)}px`;
  }
  let mention = { open: false, items: [], idx: 0 };
  function mentionQuery() {
    const m = el.input.value.slice(0, el.input.selectionStart).match(/(^|\s)@([a-z0-9_-]*)$/i);
    return m ? m[2].toLowerCase() : null;
  }
  function updateMention() {
    const q = mentionQuery();
    if (q === null) return closeMention();
    const items = agents.filter((a) => a.name.startsWith(q) || a.title.toLowerCase().startsWith(q));
    if (!items.length) return closeMention();
    mention = { open: true, items, idx: Math.min(mention.open ? mention.idx : 0, items.length - 1) };
    el.mentionPop.hidden = false;
    el.mentionPop.replaceChildren(...items.map((a, i) => h("button", { type: "button", role: "option", class: `row${i === mention.idx ? " sel" : ""}`, "aria-selected": String(i === mention.idx), onmousedown: (e) => { e.preventDefault(); applyMention(a); } },
      avatar(a.name, { size: 22, agent: true }), h("span", { class: "txt" }, h("span", { class: "name" }, a.title), h("span", { class: "sub" }, a.role)))));
  }
  function closeMention() { mention.open = false; el.mentionPop.hidden = true; }
  function applyMention(a) {
    const pos = el.input.selectionStart;
    const before = el.input.value.slice(0, pos).replace(/@([a-z0-9_-]*)$/i, `@${a.name} `);
    el.input.value = before + el.input.value.slice(pos);
    el.input.setSelectionRange(before.length, before.length);
    closeMention(); syncInput(); el.input.focus();
  }
  function insertMention(name) {
    const v = el.input.value;
    el.input.value = `${v}${v && !/\s$/.test(v) ? " " : ""}@${name} `;
    syncInput(); el.input.focus();
    el.input.setSelectionRange(el.input.value.length, el.input.value.length);
  }
  el.mentionBtn.append(icon("at", 16));
  el.mentionBtn.addEventListener("click", () => {
    const pos = el.input.selectionStart ?? el.input.value.length;
    const v = el.input.value;
    const ins = `${pos && !/\s/.test(v[pos - 1]) ? " " : ""}@`;
    el.input.value = v.slice(0, pos) + ins + v.slice(pos);
    el.input.focus(); el.input.setSelectionRange(pos + ins.length, pos + ins.length);
    syncInput(); updateMention();
  });
  el.input.addEventListener("input", () => { syncInput(); updateMention(); });
  el.input.addEventListener("click", updateMention);
  el.input.addEventListener("blur", () => setTimeout(closeMention, 120));
  el.input.addEventListener("keydown", (e) => {
    if (mention.open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); mention.idx = (mention.idx + (e.key === "ArrowDown" ? 1 : -1) + mention.items.length) % mention.items.length; updateMention(); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); applyMention(mention.items[mention.idx]); return; }
      if (e.key === "Escape") { e.preventDefault(); closeMention(); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); el.form.requestSubmit(); }
  });
  el.send.append(icon("up", 15, 2.4));
  el.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = el.input.value.trim();
    if (!text) return;
    if (view === "team") {
      el.team.querySelector(".hello")?.remove();
      el.team.append(h("div", { class: "msg me" }, h("div", { class: "msg-col" }, h("div", { class: "bubble", text }))));
      socket.emit("team message", { text, target, user: me || "guest" });
      stick(el.team, true);
    } else if (room) {
      socket.emit("chat message", { text });
    }
    el.input.value = ""; syncInput(); closeMention();
  });

  // ---------- drawers / layout / theme ----------
  function applyLayout() {
    el.app.classList.toggle("no-sidebar", !layout.sidebar && !isNarrow());
    el.app.classList.toggle("no-inspector", !layout.inspector || isMid());
    el.inspectorBtn.setAttribute("aria-pressed", String(isMid() ? el.app.classList.contains("inspector-open") : layout.inspector));
  }
  function toggleSidebar() {
    if (isNarrow()) { el.app.classList.contains("sidebar-open") ? closeDrawers() : openSidebar(); return; }
    layout.sidebar = !layout.sidebar; store.set("layout", layout); applyLayout();
  }
  function openSidebar() { el.app.classList.remove("inspector-open"); el.app.classList.add("sidebar-open"); }
  function openInspector() {
    if (isMid()) { el.app.classList.remove("sidebar-open"); el.app.classList.add("inspector-open"); }
    else if (!layout.inspector) { layout.inspector = true; store.set("layout", layout); }
    applyLayout();
  }
  function toggleInspector() {
    if (isMid()) { el.app.classList.contains("inspector-open") ? closeDrawers() : openInspector(); return; }
    layout.inspector = !layout.inspector; store.set("layout", layout); applyLayout();
  }
  function closeDrawers() { el.app.classList.remove("sidebar-open", "inspector-open"); applyLayout(); }
  function applyTheme() {
    if (theme === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = theme;
    el.themeBtn.replaceChildren(icon(theme === "dark" ? "moon" : theme === "light" ? "sun" : "auto", 16));
    el.themeBtn.title = `Appearance: ${{ auto: "System", light: "Light", dark: "Dark" }[theme]}`;
  }
  function cycleTheme() { theme = { auto: "light", light: "dark", dark: "auto" }[theme]; store.set("theme", theme); withTransition(applyTheme); }

  el.sidebarBtn.append(icon("sidebar", 17));
  el.inspectorBtn.append(icon("inspector", 17));
  el.sidebarBtn.addEventListener("click", toggleSidebar);
  el.inspectorBtn.addEventListener("click", toggleInspector);
  el.themeBtn.addEventListener("click", cycleTheme);
  el.scrim.addEventListener("click", closeDrawers);
  addEventListener("resize", applyLayout);
  $$("[role=tab]", el.seg).forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  $$(".search-ic").forEach((n) => n.append(icon("search", 14, 2)));

  // ---------- command palette ----------
  let pIdx = 0, pItems = [];
  function paletteItems() {
    return [
      { group: "Actions", icon: "compose", label: "New team chat", run: () => { setView("team"); newChat(); } },
      { group: "Actions", icon: "plus", label: "Create a room", run: createRoom },
      { group: "Actions", icon: "enter", label: "Join a room with a code", run: focusCode },
      { group: "Actions", icon: theme === "dark" ? "moon" : theme === "light" ? "sun" : "auto", label: "Change appearance", hint: { auto: "Now: System", light: "Now: Light", dark: "Now: Dark" }[theme], run: cycleTheme },
      { group: "Actions", icon: "inspector", label: "Toggle activity panel", run: toggleInspector },
      { group: "Actions", icon: "sidebar", label: "Toggle sidebar", run: toggleSidebar },
      ...agents.map((a) => ({ group: "Agents", agent: a.name, label: `Message ${a.title}`, hint: a.role, run: () => { setView("team"); setTarget(a.name); el.input.focus(); } })),
      ...skills.filter((s) => s.status === "active").map((s) => ({ group: "Skills", icon: "sparkle", label: s.name, hint: s.description, run: () => openSkill(s.id) })),
      ...rooms.map((c) => ({ group: "Rooms", icon: "hash", label: `Room ${fmtCode(c)}`, hint: c === room ? "Current room" : "", run: () => joinRoom(c) })),
    ];
  }
  function renderPalette() {
    const q = el.pInput.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    pItems = paletteItems().filter((it) => q.every((w) => `${it.label} ${it.hint || ""} ${it.group}`.toLowerCase().includes(w)));
    pIdx = Math.min(pIdx, Math.max(0, pItems.length - 1));
    const nodes = [];
    let group = "";
    pItems.forEach((it, i) => {
      if (it.group !== group) { group = it.group; nodes.push(h("div", { class: "p-group" }, group)); }
      nodes.push(h("button", { type: "button", role: "option", class: `p-item${i === pIdx ? " sel" : ""}`, "aria-selected": String(i === pIdx), onmousemove: () => { if (pIdx !== i) { pIdx = i; renderPalette(); } }, onclick: () => runPalette(i) },
        it.agent ? avatar(it.agent, { size: 26, agent: true }) : h("span", { class: "tile" }, icon(it.icon, 14)), h("span", { class: "label" }, it.label), it.hint ? h("span", { class: "hint" }, it.hint) : null));
    });
    el.pList.replaceChildren(...(nodes.length ? nodes : [h("div", { class: "p-none" }, "No matches")]));
    el.pList.querySelector(".sel")?.scrollIntoView({ block: "nearest" });
  }
  function openPalette() { el.palette.hidden = false; el.pInput.value = ""; pIdx = 0; renderPalette(); setTimeout(() => el.pInput.focus(), 10); }
  function closePalette() { if (el.palette.hidden) return; el.palette.classList.add("closing"); setTimeout(() => { el.palette.hidden = true; el.palette.classList.remove("closing"); }, 150); }
  function runPalette(i) { const it = pItems[i]; closePalette(); if (it) setTimeout(it.run, 60); }
  el.pInput.addEventListener("input", () => { pIdx = 0; renderPalette(); });
  el.pInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (pItems.length) { pIdx = (pIdx + (e.key === "ArrowDown" ? 1 : -1) + pItems.length) % pItems.length; renderPalette(); } }
    else if (e.key === "Enter") { e.preventDefault(); runPalette(pIdx); }
    else if (e.key === "Escape") { e.preventDefault(); closePalette(); }
  });
  el.palette.addEventListener("mousedown", (e) => { if (e.target === el.palette) closePalette(); });
  el.searchBtn.addEventListener("click", openPalette);
  if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) $("#kbd").textContent = "Ctrl K";
  addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); el.palette.hidden ? openPalette() : closePalette(); }
    else if (e.key === "Escape" && !el.palette.hidden) closePalette();
    else if (e.key === "Escape") closeDrawers();
    else if (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName) && el.palette.hidden) { e.preventDefault(); el.input.focus(); }
  });

  function openSkill(id) {
    const go = () => {
      const d = $(`details.skill[data-skill="${CSS.escape(id)}"]`, el.side);
      if (!d) return;
      d.open = true;
      d.classList.remove("flash"); void d.offsetWidth; d.classList.add("flash");
      d.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" });
    };
    if (view !== "team") setView("team", { animate: false });
    if (isNarrow()) openSidebar(); else if (!layout.sidebar) toggleSidebar();
    setTimeout(go, 60);
  }

  // ---------- identity ----------
  function renderMe() { el.meAvatar.replaceChildren(avatar(me || "guest", { size: 26 })); el.nameInput.value = me; }
  el.nameInput.addEventListener("change", () => {
    me = el.nameInput.value.trim().slice(0, 24);
    store.set("name", me); renderMe();
    if (room) socket.emit("join room", { room, user: me || "guest" }, () => {});
  });

  // ---------- health ----------
  let warnedOffline = false;
  async function refreshHealth() {
    try {
      health = await api("/api/health");
      const prov = health.provider === "ollama" ? "Ollama" : "OpenAI-compatible";
      el.health.dataset.state = health.reachable ? "ok" : "down";
      el.healthText.textContent = health.reachable ? `${prov} · ${health.model}` : `${prov} is offline`;
      el.health.title = health.reachable ? `Connected to ${prov}, model ${health.model}` : health.error || "Model server unreachable";
      let msg = "";
      if (!health.reachable) msg = `Cannot reach the ${prov} server. Start it, then check LLM_PROVIDER and the URL in .env. Rooms still work.`;
      else if (health.modelAvailable === false) msg = `The model "${health.model}" is not installed. Available: ${health.models.slice(0, 4).join(", ") || "none"}.`;
      el.banner.hidden = !msg;
      el.banner.replaceChildren(icon("alert", 15), h("span", {}, msg));
      if (!health.reachable && !warnedOffline) { warnedOffline = true; notify({ title: "Model server offline", body: `Start ${prov} to talk to the team.`, icon: "alert", tone: "warn" }); }
    } catch { el.health.dataset.state = "down"; el.healthText.textContent = "Server unreachable"; }
  }

  // ---------- socket ----------
  socket.on("agent:event", onAgentEvent);
  socket.on("chat message", (m) => { if (room && m.room === room) addMessage(m); });
  socket.on("connect", () => { if (room) socket.emit("join room", { room, user: me || "guest" }, () => {}); });
  socket.on("disconnect", () => notify({ title: "Connection lost", body: "Reconnecting to the server…", icon: "clock", tone: "warn" }));

  setInterval(() => {
    for (const r of runs.values()) if (r.state === "working") r.timeEl.textContent = fmtDur(Date.now() - r.started);
    if (focusRun?.state === "working") { const t = el.insBody.querySelector('[data-stat="time"]'); if (t) t.textContent = fmtDur(Date.now() - focusRun.started); }
  }, 100);
  setInterval(() => { if (view === "team" && !document.hidden) $$(".feed time", el.side).forEach((t, i) => { const a = audit.filter((x) => x.type !== "seed")[i]; if (a) t.textContent = ago(a.ts); }); }, 30000);

  // ---------- boot ----------
  applyTheme();
  applyLayout();
  renderMe();
  syncInput();
  (async () => {
    try { agents = await api("/api/agents"); } catch { /* server not ready */ }
    try { [skills, audit] = await Promise.all([api("/api/skills"), api("/api/audit")]); } catch { /* ignore */ }
    hello();
    setView(view, { animate: false });
    el.side.classList.add("enter");
    renderInspector();
    refreshHealth();
    setInterval(refreshHealth, 30000);
  })();
})();
