// Room codes live in MongoDB when CONSTR is set and connected, otherwise in memory (so the app runs with no database).
const mongoose = require("mongoose");
const Room = require("./roomdetails");

const memory = new Set();
const dbReady = () => mongoose.connection.readyState === 1;
const code = () => Math.floor(Math.random() * 900000) + 100000;

async function create() {
  for (let i = 0; i < 20; i++) {
    const c = code();
    if (await exists(c)) continue;
    if (dbReady()) await new Room({ roomcode: c }).save();
    else { memory.add(c); if (memory.size > 1000) memory.delete(memory.values().next().value); }
    return c;
  }
  throw new Error("could not allocate a room code");
}
async function exists(c) {
  const n = Number(c);
  if (!Number.isInteger(n)) return false;
  if (dbReady()) return !!(await Room.findOne({ roomcode: n }));
  return memory.has(n);
}
module.exports = { create, exists, dbReady };
