import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from './socket/socket';

// Notification sound
const notificationSound = new Audio('https://cdn.pixabay.com/audio/2022/07/26/audio_124bfa1c82.mp3');

const AdvancedChat = () => {
  const [username, setUsername] = useState('');
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [showPrivateChat, setShowPrivateChat] = useState(false);
  const [fileInput, setFileInput] = useState(null);
  const [toast, setToast] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const windowFocused = useRef(true);

  const {
    isConnected,
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
  } = useSocket();

  // Window focus tracking for notifications
  useEffect(() => {
    const onFocus = () => (windowFocused.current = true);
    const onBlur = () => (windowFocused.current = false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Request browser notification permission
  useEffect(() => {
    if (Notification && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Toast auto-hide
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, privateMessages, currentRoom, selectedUser]);

  // Infinite scroll handler
  const handleScroll = (e) => {
    const { scrollTop } = e.target;
    if (scrollTop === 0 && hasMoreMessages && !loadingMore && !showPrivateChat) {
      loadMoreMessages();
    }
  };

  // Notification logic for new messages
  useEffect(() => {
    if (!connected || !username) return;
    const lastMsg = getCurrentMessages().slice(-1)[0];
    if (!lastMsg) return;
    if (lastMsg.sender === username) return; // Don't notify for own messages
    // Sound notification
    notificationSound.play();
    // Browser notification
    if (windowFocused.current === false && Notification && Notification.permission === 'granted') {
      new Notification(`New message from ${lastMsg.sender}`, {
        body: lastMsg.message ? lastMsg.message : (lastMsg.fileName ? `File: ${lastMsg.fileName}` : ''),
        icon: '/vite.svg',
      });
    }
    // Toast notification
    setToast({
      type: 'message',
      text: `New message from ${lastMsg.sender}${lastMsg.room ? ' in #' + lastMsg.room : ''}`
    });
    // Unread count
    if (showPrivateChat && selectedUser && lastMsg.senderId === selectedUser.id) {
      setUnreadCounts((prev) => ({ ...prev, [selectedUser.id]: 0 }));
    } else if (!showPrivateChat && lastMsg.room && lastMsg.room !== currentRoom) {
      setUnreadCounts((prev) => ({ ...prev, [lastMsg.room]: (prev[lastMsg.room] || 0) + 1 }));
    }
  }, [messages, privateMessages, currentRoom, selectedUser, connected, username]);

  // Notification for user join/leave
  useEffect(() => {
    if (!connected) return;
    const lastMsg = messages.slice(-1)[0];
    if (lastMsg && lastMsg.system) {
      setToast({ type: 'system', text: lastMsg.message });
    }
  }, [messages, connected]);

  useEffect(() => {
    setConnected(isConnected);
  }, [isConnected]);

  // Handle typing indicator
  useEffect(() => {
    if (isTyping) {
      setTyping(true, currentRoom);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        setIsTyping(false);
        setTyping(false, currentRoom);
      }, 1500);
    } else {
      setTyping(false, currentRoom);
    }
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, [isTyping, currentRoom, setTyping]);

  const handleConnect = () => {
    const trimmedUsername = username.trim();
    setUsernameError('');
    
    if (!trimmedUsername) {
      setUsernameError('Username is required');
      return;
    }
    
    if (trimmedUsername.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return;
    }
    
    const isUsernameTaken = users.some(user => 
      user.username.toLowerCase() === trimmedUsername.toLowerCase()
    );
    
    if (isUsernameTaken) {
      setUsernameError('Username is already taken');
      return;
    }
    
    connect(trimmedUsername);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (input.trim()) {
      if (showPrivateChat && selectedUser) {
        sendPrivateMessage(selectedUser.id, input.trim());
        setUnreadCounts((prev) => ({ ...prev, [selectedUser.id]: 0 }));
      } else {
        sendMessage(input.trim(), currentRoom);
        setUnreadCounts((prev) => ({ ...prev, [currentRoom]: 0 }));
      }
      setInput('');
      setIsTyping(false);
      setTyping(false, currentRoom);
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    setIsTyping(true);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (showPrivateChat && selectedUser) {
        alert('File sharing in private messages coming soon!');
      } else {
        sendFile(file, currentRoom);
        setUnreadCounts((prev) => ({ ...prev, [currentRoom]: 0 }));
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReaction = (messageId, reaction) => {
    addReaction(messageId, reaction);
  };

  const handlePrivateChat = (user) => {
    setSelectedUser(user);
    setShowPrivateChat(true);
    setUnreadCounts((prev) => ({ ...prev, [user.id]: 0 }));
  };

  const handleRoomChange = (room) => {
    joinRoom(room);
    setShowPrivateChat(false);
    setSelectedUser(null);
    setUnreadCounts((prev) => ({ ...prev, [room]: 0 }));
  };

  const getCurrentMessages = () => {
    let currentMessages = [];
    if (showPrivateChat && selectedUser) {
      currentMessages = privateMessages[selectedUser.id] || [];
    } else {
      currentMessages = messages;
    }
    
    // Filter by search query if active
    if (searchQuery.trim()) {
      return currentMessages.filter(msg => 
        msg.message && msg.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.sender && msg.sender.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return currentMessages;
  };

  const renderMessage = (msg) => {
    const isOwnMessage = msg.sender === username || msg.sender === 'You';
    const isFile = msg.isFile;
    
    return (
      <div 
        key={msg.id} 
        style={{ 
          marginBottom: 12,
          padding: '8px 12px',
          borderRadius: 8,
          backgroundColor: isOwnMessage ? '#e3f2fd' : '#f5f5f5',
          border: isOwnMessage ? '1px solid #2196f3' : '1px solid #e0e0e0',
          position: 'relative'
        }}
        onMouseEnter={() => markAsRead(msg.id)}
      >
        {msg.system ? (
          <em style={{ color: '#888', fontSize: 12 }}>{msg.message}</em>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ 
                fontWeight: 'bold', 
                color: isOwnMessage ? '#1976d2' : '#333',
                fontSize: 14
              }}>
                {msg.sender}
              </span>
              <span style={{ fontSize: 11, color: '#aaa' }}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div style={{ color: '#333', wordBreak: 'break-word' }}>
              {isFile ? (
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                    📎 {msg.fileName}
                  </div>
                  {msg.fileType.startsWith('image/') ? (
                    <img 
                      src={msg.file} 
                      alt={msg.fileName}
                      style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 4 }}
                    />
                  ) : (
                    <a 
                      href={msg.file} 
                      download={msg.fileName}
                      style={{ color: '#2196f3', textDecoration: 'none' }}
                    >
                      📄 Download {msg.fileName}
                    </a>
                  )}
                </div>
              ) : (
                msg.message
              )}
            </div>
            
            {/* Reactions */}
            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {Object.entries(msg.reactions).map(([reaction, count]) => (
                  <span 
                    key={reaction}
                    style={{
                      background: '#e0e0e0',
                      padding: '2px 6px',
                      borderRadius: 12,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                    onClick={() => handleReaction(msg.id, reaction)}
                  >
                    {reaction} {count}
                  </span>
                ))}
              </div>
            )}
            
            {/* Message status and read receipts */}
            <div style={{ fontSize: 10, color: '#666', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
              {isOwnMessage && (
                <span style={{ 
                  color: msg.status === 'pending' ? '#ff9800' : 
                         msg.status === 'delivered' ? '#4caf50' : 
                         msg.status === 'failed' ? '#f44336' : '#666'
                }}>
                  {msg.status === 'pending' ? '⏳ Sending...' : 
                   msg.status === 'delivered' ? '✓ Delivered' : 
                   msg.status === 'failed' ? '✗ Failed' : ''}
                </span>
              )}
              {isOwnMessage && msg.readBy && msg.readBy.length > 0 && (
                <span>Read by: {msg.readBy.join(', ')}</span>
              )}
            </div>
            
            {/* Reaction buttons */}
            {!msg.system && (
              <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                {['👍', '❤️', '😂', '😮', '😢', '😡'].map(reaction => (
                  <button
                    key={reaction}
                    onClick={() => handleReaction(msg.id, reaction)}
                    style={{
                      background: 'none',
                      border: '1px solid #ddd',
                      borderRadius: 4,
                      padding: '2px 6px',
                      cursor: 'pointer',
                      fontSize: 12
                    }}
                  >
                    {reaction}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // Responsive design helper
  const isMobile = window.innerWidth <= 768;
  
  return (
    <div style={{ 
      maxWidth: isMobile ? '100%' : 1200, 
      margin: isMobile ? '20px 10px' : '40px auto', 
      padding: isMobile ? 16 : 24, 
      border: '1px solid #ccc', 
      borderRadius: 8, 
      background: '#fafafa' 
    }}>
      <h2 style={{ fontSize: isMobile ? '20px' : '24px', marginBottom: isMobile ? 16 : 24 }}>
        Advanced Socket.io Chat
      </h2>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.type === 'system' ? '#1976d2' : '#333',
          color: 'white',
          padding: '12px 32px',
          borderRadius: 8,
          zIndex: 9999,
          fontSize: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          {toast.text}
        </div>
      )}
      
      {!connected ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <input
              type="text"
              placeholder="Enter your username (min 3 characters)"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              style={{ 
                padding: 8, 
                width: '70%', 
                marginRight: 8,
                border: usernameError ? '1px solid #f44336' : '1px solid #ccc',
                borderRadius: 4
              }}
            />
            <button 
              onClick={handleConnect} 
              style={{ padding: 8 }}
              disabled={!username.trim()}
            >
              Join Chat
            </button>
          </div>
          {usernameError && (
            <div style={{ color: '#f44336', fontSize: 14, marginTop: 4 }}>
              {usernameError}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: isMobile ? 8 : 16, flexDirection: isMobile ? 'column' : 'row' }}>
          {/* Sidebar */}
          <div style={{ width: isMobile ? '100%' : 250, order: isMobile ? 2 : 1 }}>
            {/* Rooms */}
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 4, padding: 12, marginBottom: 16 }}>
              <strong style={{ color: '#333', marginBottom: 8, display: 'block' }}>Chat Rooms</strong>
              {rooms.map(room => (
                <div
                  key={room}
                  onClick={() => handleRoomChange(room)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderRadius: 4,
                    marginBottom: 4,
                    backgroundColor: currentRoom === room ? '#e3f2fd' : 'transparent',
                    color: currentRoom === room ? '#1976d2' : '#333',
                    fontWeight: currentRoom === room ? 'bold' : 'normal',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>#{room}</span>
                  {unreadCounts[room] > 0 && (
                    <span style={{
                      background: '#f44336',
                      color: 'white',
                      borderRadius: 12,
                      padding: '2px 8px',
                      fontSize: 12,
                      marginLeft: 8
                    }}>{unreadCounts[room]}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Users */}
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 4, padding: 12 }}>
              <strong style={{ color: '#333', marginBottom: 8, display: 'block' }}>
                Online Users ({users.length})
              </strong>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {users.map(user => (
                  <li key={user.id} style={{ 
                    padding: '4px 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#4CAF50',
                        marginRight: 8,
                        display: 'inline-block'
                      }}></span>
                      <span style={{ 
                        color: user.username === username ? '#007bff' : '#333',
                        fontSize: 14
                      }}>
                        {user.username} {user.username === username && '(You)'}
                      </span>
                    </div>
                    {user.username !== username && (
                      <button
                        onClick={() => handlePrivateChat(user)}
                        style={{
                          background: '#2196f3',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          padding: '2px 8px',
                          fontSize: 12,
                          cursor: 'pointer',
                          position: 'relative'
                        }}
                      >
                        PM
                        {unreadCounts[user.id] > 0 && (
                          <span style={{
                            background: '#f44336',
                            color: 'white',
                            borderRadius: 12,
                            padding: '2px 6px',
                            fontSize: 11,
                            marginLeft: 4,
                            position: 'absolute',
                            top: -8,
                            right: -16
                          }}>{unreadCounts[user.id]}</span>
                        )}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Main Chat Area */}
          <div style={{ flex: 1, order: isMobile ? 1 : 2 }}>
            {/* Chat Header */}
            <div style={{ 
              background: '#fff', 
              border: '1px solid #eee', 
              borderRadius: 4, 
              padding: 12, 
              marginBottom: 16
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showSearch ? 12 : 0 }}>
                <div>
                  <strong style={{ color: '#333' }}>
                    {showPrivateChat ? `Private Chat with ${selectedUser?.username}` : `#${currentRoom}`}
                  </strong>
                  {showPrivateChat && (
                    <button
                      onClick={() => setShowPrivateChat(false)}
                      style={{
                        background: '#666',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 8px',
                        fontSize: 12,
                        marginLeft: 8,
                        cursor: 'pointer'
                      }}
                    >
                      Back to #{currentRoom}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => setShowSearch(!showSearch)}
                    style={{
                      background: showSearch ? '#2196f3' : '#666',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      padding: '6px 12px',
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    🔍 Search
                  </button>
                  <div style={{ fontSize: 14, color: '#666' }}>
                    Connected as: <strong>{username}</strong>
                  </div>
                </div>
              </div>
              
              {/* Search Bar */}
              {showSearch && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Search messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: 4,
                      fontSize: 14
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{
                        background: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        padding: '8px 12px',
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Messages */}
            <div 
              style={{ 
                height: isMobile ? 300 : 400, 
                overflowY: 'auto', 
                background: '#fff', 
                border: '1px solid #eee', 
                borderRadius: 4, 
                padding: isMobile ? 8 : 12, 
                marginBottom: 16 
              }}
              onScroll={handleScroll}
            >
              {loadingMore && (
                <div style={{ textAlign: 'center', color: '#666', padding: '12px', fontSize: 14 }}>
                  Loading more messages...
                </div>
              )}
              {getCurrentMessages().length === 0 ? (
                <div style={{ textAlign: 'center', color: '#888', marginTop: 20 }}>
                  {searchQuery ? 'No messages found matching your search.' : 'No messages yet. Start the conversation!'}
                </div>
              ) : (
                getCurrentMessages().map(renderMessage)
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '12px',
                  background: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                📎
              </button>
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a message..."
                value={input}
                onChange={handleInputChange}
                onFocus={() => setIsTyping(true)}
                style={{ 
                  flex: 1, 
                  padding: 12, 
                  border: '1px solid #ddd',
                  borderRadius: 4,
                  fontSize: 14
                }}
                disabled={!connected}
              />
              <button 
                type="submit" 
                style={{ 
                  padding: '12px 24px',
                  backgroundColor: '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: input.trim() ? 'pointer' : 'not-allowed',
                  opacity: input.trim() ? 1 : 0.6
                }} 
                disabled={!input.trim()}
              >
                Send
              </button>
            </form>

            {/* Typing Indicator */}
            <div style={{ marginTop: 8, minHeight: 24 }}>
              {typingUsers.length > 0 && (
                <span style={{ color: '#888', fontStyle: 'italic', fontSize: 14 }}>
                  {typingUsers.filter(u => u !== username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                </span>
              )}
            </div>

            {/* Disconnect Button */}
            <button 
              onClick={disconnect} 
              style={{ 
                marginTop: 16, 
                background: '#f44336', 
                color: '#fff', 
                border: 'none', 
                padding: '8px 16px', 
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              Leave Chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedChat; 