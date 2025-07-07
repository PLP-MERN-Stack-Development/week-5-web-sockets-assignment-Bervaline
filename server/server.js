// server.js - Main server file for Socket.io chat application

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store connected users and messages
const users = {};
const messages = {};
const typingUsers = {};
const rooms = ['general', 'random', 'help'];

// Initialize messages for each room
rooms.forEach(room => {
  messages[room] = [];
});

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle user joining
  socket.on('user_join', (username) => {
    users[socket.id] = { username, id: socket.id, currentRoom: 'general' };
    socket.join('general');
    io.emit('user_list', Object.values(users));
    io.emit('user_joined', { username, id: socket.id });
    console.log(`${username} joined the chat`);
  });

  // Handle chat messages
  socket.on('send_message', (messageData, callback) => {
    const room = messageData.room || 'general';
    const messageId = Date.now();
    const message = {
      ...messageData,
      id: messageId,
      sender: users[socket.id]?.username || 'Anonymous',
      senderId: socket.id,
      timestamp: new Date().toISOString(),
      room,
      reactions: {},
      readBy: []
    };
    
    messages[room].push(message);
    
    // Limit stored messages to prevent memory issues
    if (messages[room].length > 100) {
      messages[room].shift();
    }
    
    // Send acknowledgment to sender
    if (callback) {
      callback({ success: true, messageId });
    }
    
    // Broadcast to other users in room
    socket.to(room).emit('receive_message', message);
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    if (users[socket.id]) {
      const username = users[socket.id].username;
      const room = data.room || 'general';
      
      if (data.isTyping) {
        typingUsers[socket.id] = { username, room };
      } else {
        delete typingUsers[socket.id];
      }
      
      const roomTypingUsers = Object.values(typingUsers)
        .filter(user => user.room === room)
        .map(user => user.username);
      
      socket.to(room).emit('typing_users', { users: roomTypingUsers, room });
    }
  });

  // Handle private messages
  socket.on('private_message', ({ to, message, messageId }, callback) => {
    const finalMessageId = Date.now();
    const messageData = {
      id: finalMessageId,
      sender: users[socket.id]?.username || 'Anonymous',
      senderId: socket.id,
      message,
      timestamp: new Date().toISOString(),
      isPrivate: true,
      to,
    };
    
    // Send acknowledgment to sender
    if (callback) {
      callback({ success: true, messageId: finalMessageId });
    }
    
    // Send to recipient
    socket.to(to).emit('private_message', messageData);
  });

  // Handle room joining
  socket.on('join_room', (roomName) => {
    if (users[socket.id]) {
      const previousRoom = users[socket.id].currentRoom;
      socket.leave(previousRoom);
      socket.join(roomName);
      users[socket.id].currentRoom = roomName;
      
      // Send room messages to the user
      socket.emit('room_messages', messages[roomName] || []);
      
      console.log(`${users[socket.id].username} joined room: ${roomName}`);
    }
  });

  // Handle file sharing
  socket.on('send_file', (fileData) => {
    const room = fileData.room || 'general';
    const messageData = {
      id: Date.now(),
      sender: users[socket.id]?.username || 'Anonymous',
      senderId: socket.id,
      file: fileData.file,
      fileName: fileData.fileName,
      fileType: fileData.fileType,
      timestamp: new Date().toISOString(),
      room,
      isFile: true,
    };
    
    messages[room].push(messageData);
    
    if (messages[room].length > 100) {
      messages[room].shift();
    }
    
    socket.to(room).emit('receive_file', messageData);
    socket.emit('receive_file', messageData);
  });

  // Handle message reactions
  socket.on('add_reaction', ({ messageId, reaction }) => {
    const user = users[socket.id];
    if (!user) return;
    
    // Find message in all rooms
    for (const room in messages) {
      const messageIndex = messages[room].findIndex(msg => msg.id === messageId);
      if (messageIndex !== -1) {
        const message = messages[room][messageIndex];
        if (!message.reactions) message.reactions = {};
        if (!message.reactions[reaction]) message.reactions[reaction] = 0;
        message.reactions[reaction]++;
        
        io.emit('reaction_added', { messageId, reaction, count: message.reactions[reaction] });
        break;
      }
    }
  });

  // Handle read receipts
  socket.on('mark_read', ({ messageId }) => {
    const user = users[socket.id];
    if (!user) return;
    
    // Find message in all rooms
    for (const room in messages) {
      const messageIndex = messages[room].findIndex(msg => msg.id === messageId);
      if (messageIndex !== -1) {
        const message = messages[room][messageIndex];
        if (!message.readBy) message.readBy = [];
        if (!message.readBy.includes(user.username)) {
          message.readBy.push(user.username);
          io.emit('message_read', { messageId, userId: user.username });
        }
        break;
      }
    }
  });

  // Handle message pagination
  socket.on('load_messages', ({ room, limit = 20, offset = 0 }, callback) => {
    const roomMessages = messages[room] || [];
    const startIndex = Math.max(0, roomMessages.length - limit - offset);
    const endIndex = roomMessages.length - offset;
    const requestedMessages = roomMessages.slice(startIndex, endIndex);
    
    callback({
      success: true,
      messages: requestedMessages,
      hasMore: startIndex > 0
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (users[socket.id]) {
      const { username } = users[socket.id];
      io.emit('user_left', { username, id: socket.id });
      console.log(`${username} left the chat`);
    }
    
    delete users[socket.id];
    delete typingUsers[socket.id];
    
    io.emit('user_list', Object.values(users));
    const roomTypingUsers = Object.values(typingUsers)
      .filter(user => user.room === 'general')
      .map(user => user.username);
    io.emit('typing_users', { users: roomTypingUsers, room: 'general' });
  });
});

// API routes
app.get('/api/messages/:room', (req, res) => {
  const room = req.params.room || 'general';
  res.json(messages[room] || []);
});

app.get('/api/users', (req, res) => {
  res.json(Object.values(users));
});

app.get('/api/rooms', (req, res) => {
  res.json(rooms);
});

// Root route
app.get('/', (req, res) => {
  res.send('Socket.io Chat Server is running');
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server, io }; 