const express = require("express");
const rooms = require("../models/roomStore");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    if (await rooms.exists(req.query.roomcode)) res.status(200).send("Room exists");
    else res.status(404).send("Room not found");
  } catch (error) {
    console.error("Error joining room:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
