const mongoose = require("mongoose");
const roomSchema = new mongoose.Schema({
  roomcode:Number
});
const Room = mongoose.model("Room", roomSchema);
module.exports=Room;