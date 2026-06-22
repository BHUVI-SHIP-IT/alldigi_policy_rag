import React, { useState, useEffect, useRef } from 'react';
import useAuthStore from '../store/useAuthStore';
import ReactMarkdown from 'react-markdown';
import { Plus, MessageSquare, LogOut, Send, Bot, User, Trash2 } from 'lucide-react';
import logo from '../assets/logo.png';
import './EmployeeChat.css';

const EmployeeChat = () => {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { token, logout } = useAuthStore();
  const messagesEndRef = useRef(null);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/chat/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
        if (data.length > 0 && !activeConvId) {
          setActiveConvId(data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMessages = async (convId) => {
    try {
      const res = await fetch(`/api/chat/conversations/${convId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const createConversation = async () => {
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ title: 'New Conversation' })
      });
      if (res.ok) {
        const data = await res.json();
        setConversations([data, ...conversations]);
        setActiveConvId(data.id);
        setMessages([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteConversation = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this chat?')) return;
    
    try {
      const res = await fetch(`/api/chat/conversations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setConversations(conversations.filter(c => c.id !== id));
        if (activeConvId === id) {
          setActiveConvId(null);
          setMessages([]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (activeConvId) {
      fetchMessages(activeConvId);
    }
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !activeConvId) return;

    const userMessage = { role: 'user', content: input };
    const currentInput = input;
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Optimistically update conversation title if it's the first message
    if (messages.length === 0) {
      setConversations(prev => prev.map(conv => {
        if (conv.id === activeConvId && conv.title === 'New Conversation') {
          return { ...conv, title: currentInput.length > 40 ? currentInput.substring(0, 40) + '...' : currentInput };
        }
        return conv;
      }));
    }

    try {
      const res = await fetch(`/api/chat/conversations/${activeConvId}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ question: userMessage.content })
      });

      if (!res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
        return;
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      // Add empty assistant message placeholder
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      setIsLoading(false); // Disable spinner since we are streaming text now
      
      let doneReading = false;
      let assistantResponse = "";
      let buffer = "";

      while (!doneReading) {
        const { value, done } = await reader.read();
        if (done) {
          doneReading = true;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete events separated by \n\n
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const eventText = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          
          if (eventText.startsWith('data: ')) {
            const dataStr = eventText.slice(6);
            if (!dataStr) continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                assistantResponse += `\n\n[Error: ${data.error}]`;
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1].content = assistantResponse;
                  return newMsgs;
                });
              } else if (data.chunk) {
                if (data.clear) {
                  assistantResponse = "";
                }
                assistantResponse += data.chunk;
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1].content = assistantResponse;
                  return newMsgs;
                });
              } else if (data.done) {
                doneReading = true;
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", dataStr, e);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection failed. Please check your network and try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-layout">
      {/* Sidebar */}
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <img src={logo} alt="AllDigi Logo" className="sidebar-logo" />
        </div>
        <button onClick={createConversation} className="new-chat-btn">
          <Plus size={18} /> New Chat
        </button>
        
        <div className="conversations-list">
          {conversations.map(conv => (
            <div 
              key={conv.id} 
              className={`conv-item ${activeConvId === conv.id ? 'active' : ''}`}
              onClick={() => setActiveConvId(conv.id)}
            >
              <MessageSquare size={16} />
              <span className="conv-title">{conv.title}</span>
              <button 
                className="conv-delete-btn" 
                onClick={(e) => deleteConversation(conv.id, e)}
                title="Delete Chat"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button onClick={logout} className="logout-btn">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-main">
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-state">
              <Bot size={48} color="var(--accent-color)" />
              <h2>How can I help you today?</h2>
              <p>Ask me anything about the company policies, guidelines, or employee handbooks.</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`message-row ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                </div>
                <div className="message-content">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="message-row assistant">
              <div className="message-avatar"><Bot size={20} /></div>
              <div className="message-content">
                <div className="typing-indicator"><span></span><span></span><span></span></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="input-area">
          <form onSubmit={handleSubmit} className="input-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message Policy Assistant..."
              disabled={isLoading || !activeConvId}
            />
            <button type="submit" disabled={!input.trim() || isLoading || !activeConvId}>
              <Send size={18} />
            </button>
          </form>
          <div className="input-footer">
            Policy Assistant can make mistakes. Consider verifying important information.
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeChat;
