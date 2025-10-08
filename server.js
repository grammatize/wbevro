import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const port = 5000;
const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(join(__dirname, 'index.html'));
});

const users = new Map();
const userMessageCount = new Map();

const validateMessage = (msg) => {
  return typeof msg === 'string' && msg.trim().length > 0 && msg.length <= 500;
};

const validateUsername = (username) => {
  return typeof username === 'string' && username.trim().length > 0 && username.length <= 20;
};

const rateLimit = (socketId) => {
  const now = Date.now();
  const lastMessages = userMessageCount.get(socketId) || [];
  const recentMessages = lastMessages.filter(time => now - time < 1000);
  
  if (recentMessages.length >= 3) {
    return false;
  }
  
  recentMessages.push(now);
  userMessageCount.set(socketId, recentMessages);
  return true;
};

io.on('connection', (socket) => {
  let isAuthenticated = false;

  socket.on('join', (username) => {
    if (isAuthenticated) {
      return;
    }
    if (!validateUsername(username)) {
      socket.emit('error_message', { error: 'invalid username' });
      socket.disconnect();
      return;
    }
    const cleanUsername = username.trim();
    users.set(socket.id, cleanUsername);
    isAuthenticated = true;
    socket.emit('join_success', { username: cleanUsername });
    io.emit('user_joined', { username: cleanUsername, count: users.size });
  });

  socket.on('public_message', (msg) => {
    if (!isAuthenticated) {
      socket.disconnect();
      return;
    }
    if (!validateMessage(msg)) {
      socket.emit('error_message', { error: 'invalid message' });
      return;
    }
    if (!rateLimit(socket.id)) {
      socket.emit('error_message', { error: 'rate limit exceeded' });
      return;
    }
    const username = users.get(socket.id);
    io.emit('public_message', { username, message: msg.trim(), timestamp: Date.now() });
  });

  socket.on('private_message', (data) => {
    if (!isAuthenticated) {
      socket.disconnect();
      return;
    }
    if (typeof data !== 'object' || !data.to || !data.message) {
      socket.emit('error_message', { error: 'invalid request' });
      return;
    }
    const { to, message } = data;
    if (!validateMessage(message) || !validateUsername(to)) {
      socket.emit('error_message', { error: 'invalid message or recipient' });
      return;
    }
    if (!rateLimit(socket.id)) {
      socket.emit('error_message', { error: 'rate limit exceeded' });
      return;
    }
    const fromUsername = users.get(socket.id);
    const toSocketId = Array.from(users.entries()).find(([id, name]) => name === to.trim())?.[0];
    
    if (toSocketId) {
      const timestamp = Date.now();
      io.to(toSocketId).emit('private_message', { from: fromUsername, message: message.trim(), timestamp });
      socket.emit('private_message', { to: to.trim(), message: message.trim(), timestamp, sent: true });
    } else {
      socket.emit('error_message', { error: 'user not found' });
    }
  });

  socket.on('disconnect', () => {
    const username = users.get(socket.id);
    users.delete(socket.id);
    userMessageCount.delete(socket.id);
    if (username) {
      io.emit('user_left', { username, count: users.size });
    }
  });
});

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
});
