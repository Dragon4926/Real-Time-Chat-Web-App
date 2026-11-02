const express = require("express");
const rooms = require("../models/roomStore");
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    if (await rooms.exists(req.body.number)) res.status(200).send("ok");
    else res.status(400).send("wrong code");
  } catch (error) {
    console.error("Error checking room code:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
