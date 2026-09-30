import React from 'react';
import { Activity, ShieldAlert, Radio, Sparkles } from 'lucide-react';
import type { SageStatus } from '../orb/types';

interface HudHeaderProps {
  status: SageStatus;
}

export const HudHeader: React.FC<HudHeaderProps> = ({ status }) => {
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

      {/* Right Realtime Telemetry Status */}
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
    </header>
  );
};
