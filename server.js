const path = require("node:path");
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const config = require("./agents/config");
const event = require("./routes/event");
const joinroom = require("./routes/joinroom");
const codeCheckRouter = require("./routes/codeCheck");
const apiRouter = require("./routes/api");
const rooms = require("./models/roomStore");
const { createRuntime } = require("./agents/runtime");

const app = express();
const server = createServer(app);
const io = new Server(server);

// Optional MongoDB: without CONSTR (or if it is unreachable) rooms are kept in memory.
if (process.env.CONSTR) {
  mongoose.connect(process.env.CONSTR).then(() => console.log("MongoDB connected"))
    .catch((err) => console.error("MongoDB unavailable, using in-memory rooms:", err.message));
}

// Recent messages per room (in memory) give agents conversational context.
const history = new Map();
const pushHistory = (room, msg) => {
  const arr = history.get(room) || [];
  arr.push(msg);
  if (arr.length > 60) arr.shift();
  history.set(room, arr);
};
const getHistory = (scope) => history.get(scope) || [];

const runtime = createRuntime({
  emitToScope: (scope, e) => {
    const view = scope.startsWith("team:") ? "team" : "room";
    // Agent answers become part of the room's context for later requests.
    if (view === "room" && e.type === "run_end" && e.final) pushHistory(scope, { user: e.nodes?.[0]?.agent || "grok", text: e.final.slice(0, 800), ts: Date.now() });
    io.to(scope).emit("agent:event", { ...e, view });
  },
  getRoomHistory: getHistory,
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/event", event);
app.use("/joinroom", joinroom);
app.use("/codeCheck", codeCheckRouter);
app.use("/api", apiRouter(runtime));
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.sendFile("public/html/index.html", { root: __dirname }));

const ROOM_RE = /^[A-Za-z0-9_-]{1,32}$/;
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, n);

io.on("connection", (socket) => {
  const teamScope = `team:${socket.id}`;
  socket.join(teamScope);                   // private scope for the Team view
  socket.data.user = "guest";

  socket.on("join room", async ({ room, user } = {}, ack) => {
    room = String(room ?? "");
    if (!ROOM_RE.test(room)) return ack?.({ ok: false, error: "invalid room" });
    if (!(await rooms.exists(room))) return ack?.({ ok: false, error: "room not found" });
    for (const r of socket.rooms) if (r !== socket.id && r !== teamScope) socket.leave(r);
    socket.join(room);
    socket.data.room = room;
    socket.data.user = clean(user, 24) || "guest";
    ack?.({ ok: true, history: getHistory(room).slice(-50) });
  });

  socket.on("chat message", (payload) => {
    const room = socket.data.room;
    const text = clean(payload?.text ?? payload, 4000).trim();
    if (!room || !text) return;
    const msg = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, room, user: socket.data.user, text, ts: Date.now() };
    pushHistory(room, msg);
    io.to(room).emit("chat message", msg);
    if (runtime.parseMentions(text).length) {
      try { runtime.startRun({ scope: room, user: msg.user, text }); }
      catch (e) { socket.emit("agent:event", { type: "run_error", view: "room", message: e.message }); }
    }
  });

  // Team view: every message goes to the agents (optionally to a specific one).
  socket.on("team message", ({ text, target, user } = {}) => {
    text = clean(text, 4000).trim();
    if (!text) return;
    if (user) socket.data.user = clean(user, 24) || socket.data.user;
    try { runtime.startRun({ scope: teamScope, user: socket.data.user, text, target }); }
    catch (e) { socket.emit("agent:event", { type: "run_error", view: "team", message: e.message }); }
  });

  socket.on("agent:stop", ({ runId } = {}) => {
    const scope = runtime.scopeOf(String(runId));
    if (scope && socket.rooms.has(scope)) runtime.stop(String(runId));
  });
});

const port = config.get().port;
if (require.main === module) {
  server.listen(port, () => console.log(`server running at http://localhost:${port}`));
}
module.exports = { app, server, io, runtime };
