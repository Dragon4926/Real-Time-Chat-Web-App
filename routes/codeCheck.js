const express = require("express");
const router = express.Router();
const Room = require("../models/roomdetails");

// POST request handler for '/codeCheck'
router.post("/", async (req, res) => {
  try {
    // Extract the number from the request body
    const { number } = req.body;

    // Check if a room with the provided number exists in the database
    const room = await Room.findOne({ roomcode: number });

    if (room) {
      // Send "ok" response if the number is found in the database
      res.status(200).send("ok");
      console.log('Room available')
    } else {
      // Send "wrong code" response if the number is not found in the database
      console.log("Wrong code");
      res.status(400).send("wrong code");
    }
  } catch (error) {
    console.error("Error fetching number from database:", error);
    // Send error response if there's an error
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;