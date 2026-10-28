import React, { useState, useRef, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:3000';

export default function ChatPopup({ result, onSelectPackage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        '👋 Hi! I am your **Security Copilot**. Ask me anything about your dependency graph, risk score, blast radius, or recommended upgrades!'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Handle send message
  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: result || null,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with HTTP ${res.status}`);
      }

      const data = await res.json();
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply,
          relatedPackages: data.relatedPackages || [],
          suggestedAction: data.suggestedAction || null
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ **Error**: ${err.message || 'Failed to communicate with RAG engine. Is the backend server running?'}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAction = (cmd) => {
    if (!cmd) return;
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const quickPrompts = [
    'Why is my project score at this grade?',
    'Explain the best upgrade',
    'Which packages have highest blast radius?',
    'Are there dangerous install scripts?'
  ];

  // Simple Markdown renderer
  const renderFormatted = (text, relatedPackages = []) => {
    if (!text) return null;
    const lines = text.split('\n');

    return lines.map((line, idx) => {
      // Headers
      if (line.startsWith('### ')) {
        return <h4 key={idx} style={{ margin: '8px 0 4px', fontSize: '14px', fontWeight: 600, color: '#f1f5f9' }}>{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={idx} style={{ margin: '4px 0', fontWeight: 600, color: '#e2e8f0' }}>{line.replace(/\*\*/g, '')}</p>;
      }
      // Bullets
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const clean = line.substring(2);
        return (
          <li key={idx} style={{ margin: '3px 0', paddingLeft: '4px' }}>
            {formatTokens(clean, relatedPackages)}
          </li>
        );
      }
      // Numbered list
      if (/^\d+\.\s/.test(line)) {
        const clean = line.replace(/^\d+\.\s/, '');
        return (
          <div key={idx} style={{ margin: '3px 0', display: 'flex', gap: '6px' }}>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>•</span>
            <div>{formatTokens(clean, relatedPackages)}</div>
          </div>
        );
      }
      // Blank lines
      if (!line.trim()) {
        return <div key={idx} style={{ height: '6px' }} />;
      }
      // Regular paragraph
      return (
        <p key={idx} style={{ margin: '3px 0' }}>
          {formatTokens(line, relatedPackages)}
        </p>
      );
    });
  };

  // Parses inline code `pkg` and **bold**
  const formatTokens = (str, relatedPackages = []) => {
    const parts = str.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        const codeText = part.slice(1, -1);
        const isClickable = onSelectPackage && (relatedPackages.includes(codeText) || codeText.includes('@') || codeText.length < 25);
        return (
          <code
            key={i}
            onClick={() => isClickable && onSelectPackage(codeText)}
            title={isClickable ? 'Click to highlight in graph' : undefined}
            style={{
              backgroundColor: '#1e293b',
              color: '#38bdf8',
              padding: '1px 5px',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: 'monospace',
              cursor: isClickable ? 'pointer' : 'default',
              textDecoration: isClickable ? 'underline dotted' : 'none'
            }}
          >
            {codeText}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: '#f8fafc' }}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 18px',
          borderRadius: '9999px',
          backgroundColor: '#0284c7',
          color: '#ffffff',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.5), 0 8px 10px -6px rgba(2, 132, 199, 0.4)',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '14px',
          transition: 'all 0.2s ease-in-out',
          outline: 'none'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)';
          e.currentTarget.style.backgroundColor = '#0369a1';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.backgroundColor = '#0284c7';
        }}
        title="Open Security Copilot Chat"
      >
        <span style={{ fontSize: '18px' }}>🤖</span>
        <span>{isOpen ? 'Close Copilot' : 'Ask AI Copilot'}</span>
        {!isOpen && (
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '9999px',
              backgroundColor: '#4ade80',
              boxShadow: '0 0 8px #4ade80'
            }}
          />
        )}
      </button>

      {/* Floating Chat Popup Window */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '84px',
            right: '24px',
            width: '390px',
            maxWidth: 'calc(100vw - 32px)',
            height: '540px',
            maxHeight: 'calc(100vh - 110px)',
            backgroundColor: '#0b1120',
            border: '1px solid #1e293b',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(56, 189, 248, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999,
            overflow: 'hidden',
            fontFamily: 'inherit',
            animation: 'fadeInUp 0.2s ease-out'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#0f172a',
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px'
                }}
              >
                🛡️
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
                  Security Copilot
                </h4>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {result ? `Active graph: ${result.packages?.length || 0} packages` : 'Dependency RAG Assistant'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setMessages([{ role: 'assistant', content: 'Chat history cleared. How can I help you?' }])}
                title="Clear chat history"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  fontSize: '12px'
                }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  fontSize: '16px',
                  fontWeight: 600
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Quick Prompts Bar */}
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              scrollbarWidth: 'none'
            }}
          >
            {quickPrompts.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(prompt)}
                disabled={loading}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  borderRadius: '9999px',
                  backgroundColor: '#1e293b',
                  color: '#94a3b8',
                  border: '1px solid #334155',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#334155';
                  e.currentTarget.style.color = '#f1f5f9';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#1e293b';
                  e.currentTarget.style.color = '#94a3b8';
                }}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Message Stream */}
          <div
            style={{
              flex: 1,
              padding: '14px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {messages.map((m, idx) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={idx}
                  style={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '88%',
                    backgroundColor: isUser ? '#0284c7' : '#1e293b',
                    color: '#f8fafc',
                    padding: '10px 14px',
                    borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    fontSize: '13px',
                    lineHeight: '1.45',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  {isUser ? (
                    <div>{m.content}</div>
                  ) : (
                    <div>
                      {renderFormatted(m.content, m.relatedPackages)}
                      {m.suggestedAction && (
                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #334155' }}>
                          <button
                            type="button"
                            onClick={() => handleCopyAction(m.suggestedAction)}
                            style={{
                              padding: '5px 10px',
                              fontSize: '11px',
                              borderRadius: '6px',
                              backgroundColor: '#0f172a',
                              color: '#38bdf8',
                              border: '1px solid #0284c7',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontWeight: 600
                            }}
                          >
                            <span>📋 {copied ? 'Copied to Clipboard!' : `Copy: ${m.suggestedAction}`}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: '#1e293b',
                  color: '#94a3b8',
                  padding: '8px 14px',
                  borderRadius: '16px 16px 16px 4px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>Analyzing graph context...</span>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: '10px 12px',
              backgroundColor: '#0f172a',
              borderTop: '1px solid #1e293b',
              display: 'flex',
              gap: '8px'
            }}
          >
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about vulnerabilities, blast radius..."
              disabled={loading}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                fontSize: '13px',
                outline: 'none'
              }}
              onFocus={e => (e.target.style.borderColor = '#38bdf8')}
              onBlur={e => (e.target.style.borderColor = '#334155')}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                padding: '0 14px',
                borderRadius: '8px',
                backgroundColor: input.trim() && !loading ? '#0284c7' : '#334155',
                color: '#ffffff',
                border: 'none',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                fontWeight: 600,
                fontSize: '13px'
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
