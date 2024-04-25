const express = require('express')
const bodyParser = require('body-parser');
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const event = require('./routes/event')
const joinroom = require('./routes/joinroom')
const codeCheckRouter = require('./routes/codeCheck');


const app = express()
const server = createServer(app);
const io = new Server(server);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


app.use('/event', event)
app.use('/joinroom', joinroom)
app.use('/codeCheck', codeCheckRouter); 

app.use(express.static('public'))

app.get('/', (req, res) => {
  res.sendFile('public/html/index.html',{root:__dirname})
})


io.on('connection', (socket) => {
  console.log('A user connected');
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

io.on('connection', (socket) => {
  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
    console.log('message: ' + msg);
  });
});
server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});