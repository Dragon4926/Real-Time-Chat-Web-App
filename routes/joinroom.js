const express = require('express');
const router = express.Router();
const Room = require('../models/roomdetails.js');

// Define the route to handle joining a room
router.get('/', async (req, res) => {
  // Get the room code from the request query parameters
  const roomCode = req.query.roomcode; // Use req.query.roomcode (camelCase)

  try {
    // Check if the room with the provided room code exists in the database
    const existingRoom = await Room.findOne({ roomcode: roomCode });

    if (existingRoom) {
      // If the room exists, respond with a success status
      res.status(200).send('Room exists');
    } else {
      // If the room doesn't exist, respond with a not found status
      res.status(404).send('Room not found');
    }
  } catch (error) {
    // If there's an error, respond with a server error status
    console.error('Error joining room:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;