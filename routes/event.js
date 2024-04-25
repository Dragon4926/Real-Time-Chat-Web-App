const express = require('express');
const mongoose = require('mongoose');
const  Room  = require('../models/roomdetails.js');
const router = express.Router();


const randomNumberGenerator = () => {
    // Generate a random number between 100000 and 999999
    const randomNumber = Math.floor(Math.random() * 900000) + 100000;
    return randomNumber;
};

async function main() {
    await mongoose.connect('Your Connection String/Databasename');
}

main().then(() => {
    // Define the home page route
    router.get('/', async (req, res) => {
        await Room.deleteOne({})
        let x = randomNumberGenerator();
        const newRoomCode = new Room({ roomcode: x });
        await newRoomCode.save();
        res.send(`${x}`);
    });
}).catch(err => {
    console.error('Error connecting to MongoDB:', err);
});

module.exports = router;
