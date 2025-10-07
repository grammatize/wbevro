
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const port = 5000;
const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

const users = new Map();

io.on('connection', (socket) => {
  socket.on('join', (username) => {
    users.set(socket.id, username);
    io.emit('user_joined', { username, count: users.size });
  });

  socket.on('public_message', (msg) => {
    const username = users.get(socket.id);
    io.emit('public_message', { username, message: msg, timestamp: Date.now() });
  });

  socket.on('private_message', ({ to, message }) => {
    const fromUsername = users.get(socket.id);
    const toSocketId = Array.from(users.entries()).find(([id, name]) => name === to)?.[0];
    
    if (toSocketId) {
      io.to(toSocketId).emit('private_message', { from: fromUsername, message, timestamp: Date.now() });
      socket.emit('private_message', { to, message, timestamp: Date.now(), sent: true });
    }
  });

  socket.on('disconnect', () => {
    const username = users.get(socket.id);
    users.delete(socket.id);
    if (username) {
      io.emit('user_left', { username, count: users.size });
    }
  });
});

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
});
