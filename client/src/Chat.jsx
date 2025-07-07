import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from './socket/socket';

const Chat = () => {
  const [username, setUsername] = useState('');
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeout = useRef(null);

  const {
    isConnected,
    messages,
    users,
    typingUsers,
    connect,
    disconnect,
    sendMessage,
    setTyping,
  } = useSocket();

  useEffect(() => {
    setConnected(isConnected);
  }, [isConnected]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle typing indicator
  useEffect(() => {
    if (isTyping) {
      setTyping(true);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        setIsTyping(false);
        setTyping(false);
      }, 1500);
    } else {
      setTyping(false);
    }
    // Cleanup on unmount
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
    // eslint-disable-next-line
  }, [isTyping]);

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
    
    // Check if username is already taken
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
      sendMessage(input.trim());
      setInput('');
      setIsTyping(false);
      setTyping(false);
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    setIsTyping(true);
  };

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 24, border: '1px solid #ccc', borderRadius: 8, background: '#fafafa' }}>
      <h2>Socket.io Chat</h2>
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
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 4, padding: 12 }}>
                <strong style={{ color: '#333' }}>Online Users ({users.length})</strong>
                <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0 0' }}>
                  {users.map(user => (
                    <li key={user.id} style={{ 
                      color: user.username === username ? '#007bff' : '#333',
                      padding: '4px 0',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#4CAF50',
                        marginRight: 8,
                        display: 'inline-block'
                      }}></span>
                      {user.username} {user.username === username && '(You)'}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div style={{ flex: 2 }}>
              <div style={{ height: 400, overflowY: 'auto', background: '#fff', border: '1px solid #eee', borderRadius: 4, padding: 12 }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#888', marginTop: 20 }}>
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} style={{ 
                      marginBottom: 12,
                      padding: '8px 12px',
                      borderRadius: 8,
                      backgroundColor: msg.sender === username ? '#e3f2fd' : '#f5f5f5',
                      border: msg.sender === username ? '1px solid #2196f3' : '1px solid #e0e0e0'
                    }}>
                      {msg.system ? (
                        <em style={{ color: '#888', fontSize: 12 }}>{msg.message}</em>
                      ) : (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ 
                              fontWeight: 'bold', 
                              color: msg.sender === username ? '#1976d2' : '#333',
                              fontSize: 14
                            }}>
                              {msg.sender}
                            </span>
                            <span style={{ fontSize: 11, color: '#aaa' }}>
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div style={{ color: '#333', wordBreak: 'break-word' }}>
                            {msg.message}
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>
          <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          <div style={{ marginTop: 8, minHeight: 24 }}>
            {typingUsers.length > 0 && (
              <span style={{ color: '#888', fontStyle: 'italic', fontSize: 14 }}>
                {typingUsers.filter(u => u !== username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </span>
            )}
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, color: '#666' }}>
              Connected as: <strong>{username}</strong>
            </div>
            <button 
              onClick={disconnect} 
              style={{ 
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
        </>
      )}
    </div>
  );
};

export default Chat; 