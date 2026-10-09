import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Square,
  Trash2,
  X,
  Sparkles,
  Activity,
  Radio,
  ShieldAlert,
  Bot,
  User,
  Camera,
  Video,
  VideoOff,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useSageStore } from '../../store/useSageStore';

const SUGGESTIONS = [
  { label: 'Analise este texto', mode: 'analysis' as const },
  { label: 'Explique de forma simples', mode: 'chat' as const },
  { label: 'Crie um plano de estudos', mode: 'chat' as const },
  { label: 'Revise meu código', mode: 'analysis' as const },
];

export const ChatWindow: React.FC = () => {
  const {
    isChatOpen,
    setChatOpen,
    status,
    serverMode,
    messages,
    taskSteps,
    isStreaming,
    streamingContent,
    isRecording,
    isMonitoring,
    sendMessage,
    stopStreaming,
    clearConversation,
    startScreenRecording,
    stopScreenRecording,
    startMonitoring,
    stopMonitoring,
    captureScreenImage,
  } = useSageStore();

  const [input, setInput] = useState('');
  const [selectedMode, setSelectedMode] = useState<'chat' | 'analysis'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Focus textarea when window opens
  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isChatOpen]);

  if (!isChatOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput('');
    sendMessage(text, selectedMode);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (text: string, mode: 'chat' | 'analysis') => {
    setSelectedMode(mode);
    sendMessage(text, mode);
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'thinking':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 8px',
              fontSize: '0.7rem',
              color: 'var(--accent-violet)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              background: 'rgba(139, 92, 246, 0.1)',
            }}
          >
            <Activity size={11} /> PENSANDO
          </span>
        );
      case 'responding':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 8px',
              fontSize: '0.7rem',
              color: 'var(--accent-cyan)',
              border: '1px solid rgba(34, 211, 238, 0.4)',
              background: 'rgba(34, 211, 238, 0.1)',
            }}
          >
            <Radio size={11} /> RESPONDENDO
          </span>
        );
      case 'error':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 8px',
              fontSize: '0.7rem',
              color: 'var(--accent-error)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              background: 'rgba(239, 68, 68, 0.1)',
            }}
          >
            <ShieldAlert size={11} /> ERRO
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 8px',
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-line)',
              background: 'rgba(5, 6, 15, 0.4)',
            }}
          >
            <Sparkles size={11} /> OCIOSO
          </span>
        );
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: 'min(580px, calc(100vw - 32px))',
        height: 'min(720px, calc(100vh - 48px))',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgba(5, 6, 15, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border-line)',
        clipPath: 'var(--clip-cut-corner-md)',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.8), inset 0 0 24px rgba(139, 92, 246, 0.08)',
      }}
    >
      {/* Window Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-line)',
          background: 'rgba(13, 16, 35, 0.75)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '4px',
              height: '14px',
              backgroundColor: 'var(--accent-cyan)',
              boxShadow: '0 0 8px var(--accent-cyan)',
            }}
          />
          <span
            className="font-mono"
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.15em',
              color: 'var(--text-bright)',
            }}
          >
            COMUNICAÇÃO // ASSISTENTE
          </span>

          {/* Simulated Mode Indicator */}
          {serverMode === 'mock' && (
            <span
              className="font-mono"
              style={{
                fontSize: '0.65rem',
                letterSpacing: '0.12em',
                padding: '2px 8px',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                background: 'rgba(245, 158, 11, 0.1)',
                clipPath: 'var(--clip-cut-corner-sm)',
              }}
            >
              MODO SIMULADO
            </span>
          )}

          {getStatusBadge()}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {messages.length > 0 && (
            <button
              onClick={clearConversation}
              title="Limpar conversa"
              style={{
                background: 'none',
                border: '1px solid var(--border-dim)',
                color: 'var(--text-secondary)',
                padding: '5px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.68rem',
                fontFamily: 'var(--font-mono)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-error)';
                e.currentTarget.style.color = 'var(--accent-error)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-dim)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <Trash2 size={12} />
              LIMPAR
            </button>
          )}

          <button
            onClick={() => setChatOpen(false)}
            title="Fechar janela"
            style={{
              background: 'none',
              border: '1px solid var(--border-dim)',
              color: 'var(--text-secondary)',
              padding: '5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-cyan)';
              e.currentTarget.style.color = 'var(--text-bright)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-dim)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {messages.length === 0 && !streamingContent && (
          <div
            style={{
              margin: 'auto',
              textAlign: 'center',
              padding: '24px 16px',
              maxWidth: '420px',
            }}
          >
            <Bot
              size={32}
              color="var(--accent-cyan)"
              style={{ margin: '0 auto 12px auto', opacity: 0.8 }}
            />
            <h4
              className="font-mono"
              style={{
                fontSize: '0.85rem',
                letterSpacing: '0.15em',
                color: 'var(--text-bright)',
                marginBottom: '8px',
              }}
            >
              ASSISTENTE PRONTO
            </h4>
            <p
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                marginBottom: '20px',
              }}
            >
              Digite sua pergunta ou selecione um dos tópicos rápidos abaixo.
            </p>

            {/* Suggestions Chips */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                justifyContent: 'center',
              }}
            >
              {SUGGESTIONS.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleSuggestionClick(item.label, item.mode)}
                  className="font-mono"
                  style={{
                    fontSize: '0.72rem',
                    padding: '6px 12px',
                    background: 'rgba(13, 16, 35, 0.75)',
                    border: '1px solid var(--border-line)',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    clipPath: 'var(--clip-cut-corner-sm)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                    e.currentTarget.style.color = 'var(--accent-cyan)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-line)';
                    e.currentTarget.style.color = 'var(--text-main)';
                  }}
                >
                  // {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Existing Messages */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
            }}
          >
            <div
              className="font-mono"
              style={{
                fontSize: '0.65rem',
                color: msg.role === 'user' ? 'var(--accent-violet)' : 'var(--accent-cyan)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                marginBottom: '4px',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              {msg.role === 'user' ? <User size={11} /> : <Bot size={11} />}
              {msg.role === 'user' ? 'VOCÊ' : 'ASSISTENTE'}
            </div>

            <div
              style={{
                padding: '12px 16px',
                fontSize: '0.85rem',
                lineHeight: 1.6,
                backgroundColor:
                  msg.role === 'user'
                    ? 'rgba(139, 92, 246, 0.12)'
                    : 'rgba(13, 16, 35, 0.85)',
                border: `1px solid ${
                  msg.role === 'user'
                    ? 'rgba(139, 92, 246, 0.35)'
                    : 'var(--border-line)'
                }`,
                clipPath: 'var(--clip-cut-corner-sm)',
                color: 'var(--text-main)',
                wordBreak: 'break-word',
              }}
            >
              {msg.imageBase64 && (
                <div style={{ marginBottom: '8px' }}>
                  <img
                    src={msg.imageBase64.startsWith('data:') ? msg.imageBase64 : `data:image/jpeg;base64,${msg.imageBase64}`}
                    alt="Captura de tela enviada"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '180px',
                      borderRadius: '4px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      display: 'block',
                      objectFit: 'cover',
                    }}
                  />
                  <span className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>
                    [TELA CAPTURADA]
                  </span>
                </div>
              )}
              {msg.taskSteps && msg.taskSteps.length > 0 && (
                <div
                  style={{
                    marginBottom: '10px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div
                    className="font-mono"
                    style={{
                      fontSize: '0.68rem',
                      color: 'var(--accent-cyan)',
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                    }}
                  >
                    // ETAPAS EXECUTADAS
                  </div>
                  {msg.taskSteps.map((s, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.74rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                      <span>{s.description}</span>
                    </div>
                  ))}
                </div>
              )}
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          </div>
        ))}

        {/* Live Streaming Assistant Message */}
        {isStreaming && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignSelf: 'flex-start',
              maxWidth: '88%',
            }}
          >
            <div
              className="font-mono"
              style={{
                fontSize: '0.65rem',
                color: 'var(--accent-cyan)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                marginBottom: '4px',
              }}
            >
              <Bot size={11} />
              ASSISTENTE // RESPOSTA
            </div>

            <div
              style={{
                padding: '12px 16px',
                fontSize: '0.85rem',
                lineHeight: 1.6,
                backgroundColor: 'rgba(13, 16, 35, 0.85)',
                border: '1px solid var(--accent-cyan)',
                clipPath: 'var(--clip-cut-corner-sm)',
                color: 'var(--text-main)',
                wordBreak: 'break-word',
                boxShadow: '0 0 16px rgba(34, 211, 238, 0.15)',
              }}
            >
              {taskSteps.length > 0 && (
                <div
                  style={{
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid rgba(34, 211, 238, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div
                    className="font-mono"
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--accent-cyan)',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: '6px',
                        height: '6px',
                        backgroundColor: 'var(--accent-cyan)',
                        borderRadius: '50%',
                        boxShadow: '0 0 8px var(--accent-cyan)',
                      }}
                    />
                    EXECUTANDO TAREFA...
                  </div>
                  {taskSteps.map((s, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {s.status === 'done' ? (
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                      ) : s.status === 'running' ? (
                        <span style={{ color: 'var(--accent-cyan)' }}>→</span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>○</span>
                      )}
                      <span
                        style={{
                          color: s.status === 'done' ? 'var(--text-main)' : 'var(--text-secondary)',
                        }}
                      >
                        {s.description}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {streamingContent ? (
                <>
                  <ReactMarkdown>{streamingContent}</ReactMarkdown>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '6px',
                      height: '14px',
                      marginLeft: '4px',
                      backgroundColor: 'var(--accent-cyan)',
                      verticalAlign: 'middle',
                      animation: 'pulse 0.8s infinite',
                    }}
                  />
                </>
              ) : (
                <span
                  className="font-mono"
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.1em',
                  }}
                >
                  {taskSteps.length > 0 ? 'Concluindo tarefa...' : 'Gerando resposta...'}
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input & Control Bar */}
      <div
        style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border-line)',
          background: 'rgba(13, 16, 35, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* Mode Selector and Quick Options */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setSelectedMode('chat')}
              className="font-mono"
              style={{
                fontSize: '0.68rem',
                padding: '3px 10px',
                border:
                  selectedMode === 'chat'
                    ? '1px solid var(--accent-cyan)'
                    : '1px solid var(--border-dim)',
                background:
                  selectedMode === 'chat'
                    ? 'rgba(34, 211, 238, 0.15)'
                    : 'transparent',
                color:
                  selectedMode === 'chat'
                    ? 'var(--accent-cyan)'
                    : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              MODO CONVERSA
            </button>
            <button
              type="button"
              onClick={() => setSelectedMode('analysis')}
              className="font-mono"
              style={{
                fontSize: '0.68rem',
                padding: '3px 10px',
                border:
                  selectedMode === 'analysis'
                    ? '1px solid var(--accent-violet)'
                    : '1px solid var(--border-dim)',
                background:
                  selectedMode === 'analysis'
                    ? 'rgba(139, 92, 246, 0.15)'
                    : 'transparent',
                color:
                  selectedMode === 'analysis'
                    ? 'var(--accent-violet)'
                    : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              MODO ANÁLISE PROFUNDA
            </button>

            {/* Quick Screen Vision Button */}
            <button
              type="button"
              onClick={async () => {
                const img = await captureScreenImage();
                if (img) {
                  sendMessage('Analise o que está visível na minha tela agora (código, janelas, textos, imagens).', 'chat', img);
                }
              }}
              className="font-mono"
              title="Captura e analisa a tela atual com visão IA"
              style={{
                fontSize: '0.68rem',
                padding: '3px 8px',
                border: '1px solid var(--border-dim)',
                background: 'rgba(59, 130, 246, 0.1)',
                color: '#60a5fa',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Camera size={11} /> VER TELA
            </button>

            {/* Screen Recording Toggle Button */}
            <button
              type="button"
              onClick={() => {
                if (isRecording) {
                  stopScreenRecording();
                } else {
                  startScreenRecording();
                }
              }}
              className="font-mono"
              title={isRecording ? 'Parar gravação de tela' : 'Começar a gravar a tela'}
              style={{
                fontSize: '0.68rem',
                padding: '3px 8px',
                border: isRecording ? '1px solid #ef4444' : '1px solid var(--border-dim)',
                background: isRecording ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.08)',
                color: isRecording ? '#ef4444' : '#f87171',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                animation: isRecording ? 'pulse 1.5s infinite' : 'none',
              }}
            >
              {isRecording ? <VideoOff size={11} /> : <Video size={11} />}
              {isRecording ? 'GRAVANDO...' : 'GRAVAR'}
            </button>

            {/* Screen Monitoring Toggle Button */}
            <button
              type="button"
              onClick={() => {
                if (isMonitoring) {
                  stopMonitoring();
                } else {
                  startMonitoring('monitore minha tela');
                }
              }}
              className="font-mono"
              title={isMonitoring ? 'Parar monitoramento de tela' : 'Iniciar monitoramento contínuo da tela'}
              style={{
                fontSize: '0.68rem',
                padding: '3px 8px',
                border: isMonitoring ? '1px solid #10b981' : '1px solid var(--border-dim)',
                background: isMonitoring ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.08)',
                color: isMonitoring ? '#10b981' : '#34d399',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {isMonitoring ? <EyeOff size={11} /> : <Eye size={11} />}
              {isMonitoring ? 'MONITORANDO' : 'MONITORAR'}
            </button>
          </div>

          {isStreaming && (
            <button
              type="button"
              onClick={stopStreaming}
              className="font-mono"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.68rem',
                padding: '4px 10px',
                border: '1px solid var(--accent-error)',
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--accent-error)',
                cursor: 'pointer',
                clipPath: 'var(--clip-cut-corner-sm)',
              }}
            >
              <Square size={10} /> PARAR
            </button>
          )}
        </div>

        {/* Text Input Row */}
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedMode === 'analysis'
                ? 'Insira o texto ou código para análise...'
                : 'Digite sua pergunta...'
            }
            rows={2}
            style={{
              flex: 1,
              backgroundColor: 'rgba(5, 6, 15, 0.75)',
              border: '1px solid var(--border-line)',
              color: 'var(--text-bright)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.85rem',
              padding: '10px 14px',
              borderRadius: 0,
              clipPath: 'var(--clip-cut-corner-sm)',
              resize: 'none',
              outline: 'none',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent-cyan)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border-line)')}
          />

          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            style={{
              padding: '12px 18px',
              background:
                !input.trim() || isStreaming
                  ? 'rgba(13, 16, 35, 0.5)'
                  : 'rgba(34, 211, 238, 0.2)',
              border: `1px solid ${
                !input.trim() || isStreaming
                  ? 'var(--border-dim)'
                  : 'var(--accent-cyan)'
              }`,
              color:
                !input.trim() || isStreaming
                  ? 'var(--text-muted)'
                  : 'var(--accent-cyan)',
              cursor: !input.trim() || isStreaming ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              clipPath: 'var(--clip-cut-corner-sm)',
              transition: 'all 0.2s ease',
              height: '52px',
            }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
