const express = require("express");
const rooms = require("../models/roomStore");
const router = express.Router();

// Create a room and return its 6-digit code.
router.get("/", async (req, res) => {
  try { res.send(`${await rooms.create()}`); }
  catch (err) { console.error("Error creating room:", err); res.status(500).send("Internal Server Error"); }
});

module.exports = router;
