// socket.js - Socket.io client setup

import { io } from 'socket.io-client';
import { useEffect, useState } from 'react';

// Socket.io connection URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Create socket instance
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Custom hook for using socket.io
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [lastMessage, setLastMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [rooms, setRooms] = useState(['general', 'random', 'help']);
  const [currentRoom, setCurrentRoom] = useState('general');
  const [privateMessages, setPrivateMessages] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  // Connect to socket server
  const connect = (username) => {
    socket.connect();
    if (username) {
      socket.emit('user_join', username);
    }
  };

  // Disconnect from socket server
  const disconnect = () => {
    socket.disconnect();
  };

  // Send a message
  const sendMessage = (message, room = currentRoom) => {
    const messageId = Date.now();
    const tempMessage = {
      id: messageId,
      message,
      sender: 'You',
      senderId: socket.id,
      timestamp: new Date().toISOString(),
      room,
      status: 'pending'
    };
    
    // Add temporary message to UI
    setMessages(prev => [...prev, tempMessage]);
    
    // Send to server with acknowledgment
    socket.emit('send_message', { message, room, messageId }, (ack) => {
      if (ack.success) {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, status: 'delivered', id: ack.messageId }
              : msg
          )
        );
      } else {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, status: 'failed' }
              : msg
          )
        );
      }
    });
  };

  // Send a private message
  const sendPrivateMessage = (to, message) => {
    const messageId = Date.now();
    const tempMessage = {
      id: messageId,
      message,
      sender: 'You',
      senderId: socket.id,
      timestamp: new Date().toISOString(),
      to,
      isPrivate: true,
      status: 'pending'
    };
    
    // Add temporary message to UI
    setPrivateMessages(prev => ({
      ...prev,
      [to]: [...(prev[to] || []), tempMessage]
    }));
    
    // Send to server with acknowledgment
    socket.emit('private_message', { to, message, messageId }, (ack) => {
      if (ack.success) {
        setPrivateMessages(prev => ({
          ...prev,
          [to]: prev[to].map(msg => 
            msg.id === messageId 
              ? { ...msg, status: 'delivered', id: ack.messageId }
              : msg
          )
        }));
      } else {
        setPrivateMessages(prev => ({
          ...prev,
          [to]: prev[to].map(msg => 
            msg.id === messageId 
              ? { ...msg, status: 'failed' }
              : msg
          )
        }));
      }
    });
  };

  // Join a room
  const joinRoom = (roomName) => {
    socket.emit('join_room', roomName);
    setCurrentRoom(roomName);
    setHasMoreMessages(true);
  };

  // Load more messages
  const loadMoreMessages = (room = currentRoom) => {
    if (loadingMore || !hasMoreMessages) return;
    
    setLoadingMore(true);
    socket.emit('load_messages', { room, limit: 20 }, (response) => {
      if (response.success) {
        setMessages(prev => [...response.messages, ...prev]);
        setHasMoreMessages(response.messages.length === 20);
      }
      setLoadingMore(false);
    });
  };

  // Set typing status
  const setTyping = (isTyping, room = currentRoom) => {
    socket.emit('typing', { isTyping, room });
  };

  // Send file/image
  const sendFile = (file, room = currentRoom) => {
    const reader = new FileReader();
    reader.onload = () => {
      socket.emit('send_file', {
        file: reader.result,
        fileName: file.name,
        fileType: file.type,
        room
      });
    };
    reader.readAsDataURL(file);
  };

  // Add reaction to message
  const addReaction = (messageId, reaction) => {
    socket.emit('add_reaction', { messageId, reaction });
  };

  // Mark message as read
  const markAsRead = (messageId) => {
    socket.emit('mark_read', { messageId });
  };

  // Socket event listeners
  useEffect(() => {
    // Connection events
    const onConnect = () => {
      setIsConnected(true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    // Message events
    const onReceiveMessage = (message) => {
      setLastMessage(message);
      setMessages((prev) => [...prev, message]);
    };

    const onPrivateMessage = (message) => {
      setLastMessage(message);
      const otherUser = message.senderId === socket.id ? message.to : message.senderId;
      setPrivateMessages(prev => ({
        ...prev,
        [otherUser]: [...(prev[otherUser] || []), message]
      }));
    };

    // User events
    const onUserList = (userList) => {
      setUsers(userList);
    };

    const onUserJoined = (user) => {
      // You could add a system message here
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} joined the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    const onUserLeft = (user) => {
      // You could add a system message here
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} left the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    // Typing events
    const onTypingUsers = (data) => {
      setTypingUsers(data.users || data);
    };

    // File events
    const onReceiveFile = (fileData) => {
      const message = {
        id: Date.now(),
        sender: fileData.sender,
        senderId: fileData.senderId,
        message: `File: ${fileData.fileName}`,
        file: fileData.file,
        fileName: fileData.fileName,
        fileType: fileData.fileType,
        timestamp: new Date().toISOString(),
        isFile: true
      };
      setLastMessage(message);
      setMessages((prev) => [...prev, message]);
    };

    // Reaction events
    const onReactionAdded = (data) => {
      setMessages((prev) => 
        prev.map(msg => 
          msg.id === data.messageId 
            ? { ...msg, reactions: { ...msg.reactions, [data.reaction]: (msg.reactions?.[data.reaction] || 0) + 1 } }
            : msg
        )
      );
    };

    // Read receipt events
    const onMessageRead = (data) => {
      setMessages((prev) => 
        prev.map(msg => 
          msg.id === data.messageId 
            ? { ...msg, readBy: [...(msg.readBy || []), data.userId] }
            : msg
        )
      );
    };

    // Register event listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('receive_message', onReceiveMessage);
    socket.on('private_message', onPrivateMessage);
    socket.on('user_list', onUserList);
    socket.on('user_joined', onUserJoined);
    socket.on('user_left', onUserLeft);
    socket.on('typing_users', onTypingUsers);
    socket.on('receive_file', onReceiveFile);
    socket.on('reaction_added', onReactionAdded);
    socket.on('message_read', onMessageRead);
    socket.on('room_messages', (messages) => {
      setMessages(messages);
    });

    // Clean up event listeners
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('receive_message', onReceiveMessage);
      socket.off('private_message', onPrivateMessage);
      socket.off('user_list', onUserList);
      socket.off('user_joined', onUserJoined);
      socket.off('user_left', onUserLeft);
      socket.off('typing_users', onTypingUsers);
      socket.off('receive_file', onReceiveFile);
      socket.off('reaction_added', onReactionAdded);
      socket.off('message_read', onMessageRead);
    };
  }, []);

  return {
    socket,
    isConnected,
    lastMessage,
    messages,
    users,
    typingUsers,
    rooms,
    currentRoom,
    privateMessages,
    selectedUser,
    loadingMore,
    hasMoreMessages,
    connect,
    disconnect,
    sendMessage,
    sendPrivateMessage,
    joinRoom,
    loadMoreMessages,
    setTyping,
    sendFile,
    addReaction,
    markAsRead,
    setSelectedUser,
  };
};

export default socket; 