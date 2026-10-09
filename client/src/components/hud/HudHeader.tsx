import React from 'react';
import { Activity, ShieldAlert, Radio, Sparkles, MessageSquare, Cpu } from 'lucide-react';
import type { SageStatus } from '../orb/types';
import { useSageStore } from '../../store/useSageStore';

interface HudHeaderProps {
  status: SageStatus;
}

export const HudHeader: React.FC<HudHeaderProps> = ({ status }) => {
  const {
    serverMode,
    isChatOpen,
    setChatOpen,
    isRecording,
    isMonitoring,
    apiCallCount,
    apiLimit,
  } = useSageStore();

  const getStatusIcon = () => {
    switch (status) {
      case 'thinking':
        return <Activity size={14} color="#a855f7" />;
      case 'responding':
        return <Radio size={14} color="#22d3ee" />;
      case 'error':
        return <ShieldAlert size={14} color="#ef4444" />;
      default:
        return <Sparkles size={14} color="#60a5fa" />;
    }
  };

  const getStatusLabel = () => {
    if (isRecording) return 'GRAVAÇÃO DE TELA ATIVA';
    if (isMonitoring) return 'MONITORAMENTO CONTÍNUO ATIVO';
    switch (status) {
      case 'thinking':
        return 'PROCESSAMENTO ANALITICO EM CURSO';
      case 'responding':
        return 'TRANSMISSAO DE DADOS ATIVA';
      case 'error':
        return 'ANOMALIA DE SISTEMA DETECTADA';
      default:
        return 'SISTEMA EM MODO DE VIGILANCIA';
    }
  };

  return (
    <header
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {/* Left System Identification */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '6px',
              height: '18px',
              backgroundColor: 'var(--accent-violet)',
              boxShadow: '0 0 10px var(--accent-violet)',
            }}
          />
          <h1
            className="font-display"
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: 'var(--text-bright)',
              margin: 0,
              letterSpacing: '0.25em',
            }}
          >
            DAIKENJA
          </h1>
          <span
            className="font-mono"
            style={{
              fontSize: '0.7rem',
              color: 'var(--accent-cyan)',
              border: '1px solid var(--border-active)',
              padding: '2px 8px',
              letterSpacing: '0.15em',
              clipPath: 'var(--clip-cut-corner-sm)',
            }}
          >
            VER 2.4.0
          </span>

          {/* Discrete Simulated Mode Tag */}
          {serverMode === 'mock' && (
            <span
              className="font-mono"
              style={{
                fontSize: '0.68rem',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.5)',
                background: 'rgba(245, 158, 11, 0.12)',
                padding: '2px 8px',
                letterSpacing: '0.15em',
                clipPath: 'var(--clip-cut-corner-sm)',
              }}
            >
              [ MODO SIMULADO ]
            </span>
          )}
        </div>
        <span
          className="font-mono"
          style={{
            fontSize: '0.68rem',
            color: 'var(--text-secondary)',
            letterSpacing: '0.2em',
          }}
        >
          SISTEMA CENTRAL DO GRANDE SABIO
        </span>
      </div>

      {/* Right Controls and Realtime Telemetry Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', pointerEvents: 'auto' }}>
        {/* Discrete Toggle Button for Communication Window */}
        <button
          onClick={() => setChatOpen(!isChatOpen)}
          className="font-mono hud-panel"
          style={{
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '0.7rem',
            letterSpacing: '0.15em',
            color: isChatOpen ? 'var(--accent-cyan)' : 'var(--text-main)',
            border: isChatOpen ? '1px solid var(--accent-cyan)' : '1px solid var(--border-line)',
            background: isChatOpen ? 'rgba(34, 211, 238, 0.15)' : 'var(--bg-surface)',
          }}
        >
          <MessageSquare size={13} color={isChatOpen ? 'var(--accent-cyan)' : 'var(--text-secondary)'} />
          {isChatOpen ? 'FECHAR CHAT' : 'PERGUNTAR'}
        </button>

        {/* API Session Calls Counter (Quota Telemetry) */}
        <div
          className="hud-panel"
          title={`Chamadas feitas nesta sessão: ${apiCallCount} / limite: ${apiLimit}`}
          style={{
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'default',
          }}
        >
          <Cpu size={13} color={apiCallCount >= apiLimit ? '#ef4444' : 'var(--accent-cyan)'} />
          <span
            className="font-mono"
            style={{
              fontSize: '0.7rem',
              letterSpacing: '0.12em',
              color: apiCallCount >= apiLimit ? '#ef4444' : 'var(--text-main)',
            }}
          >
            API: {apiCallCount} / {apiLimit}
          </span>
        </div>

        <div
          className="hud-panel"
          style={{
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}>{getStatusIcon()}</span>
          <span
            className="font-mono"
            style={{
              fontSize: '0.7rem',
              letterSpacing: '0.15em',
              color: 'var(--text-main)',
              textTransform: 'uppercase',
            }}
          >
            {getStatusLabel()}
          </span>
        </div>
      </div>
    </header>
  );
};
