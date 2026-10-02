import React, { useEffect } from 'react';
import {
  MessageSquare,
  Search,
  Zap,
  Mic,
  Settings,
  X,
} from 'lucide-react';
import { useSageStore } from '../../store/useSageStore';

interface MenuNode {
  id: string;
  label: string;
  icon: React.ReactNode;
  angle: number; // in degrees
  color: string;
  action: () => void;
}

export const RadialMenu: React.FC = () => {
  const { isRadialMenuOpen, setRadialMenuOpen, setChatOpen } = useSageStore();

  // Keyboard shortcut listener: 'M' or 'Space' to toggle radial menu, 'Escape' to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setRadialMenuOpen(!isRadialMenuOpen);
      } else if (e.key === 'Escape') {
        if (isRadialMenuOpen) {
          e.preventDefault();
          setRadialMenuOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRadialMenuOpen, setRadialMenuOpen]);

  if (!isRadialMenuOpen) return null;

  const radius = 175; // distance from center in px

  const nodes: MenuNode[] = [
    {
      id: 'ask',
      label: 'PERGUNTAR',
      icon: <MessageSquare size={18} />,
      angle: -90, // Top
      color: 'var(--accent-cyan)',
      action: () => {
        setRadialMenuOpen(false);
        setChatOpen(true);
      },
    },
    {
      id: 'analyze',
      label: 'ANALISAR',
      icon: <Search size={18} />,
      angle: -18, // Top-right
      color: 'var(--accent-violet)',
      action: () => {
        setRadialMenuOpen(false);
        setChatOpen(true);
      },
    },
    {
      id: 'skills',
      label: 'HABILIDADES',
      icon: <Zap size={18} />,
      angle: 54, // Bottom-right
      color: '#f59e0b',
      action: () => {
        alert('Módulo de Habilidades será ativado na Parte 3.');
      },
    },
    {
      id: 'voice',
      label: 'VOZ',
      icon: <Mic size={18} />,
      angle: 126, // Bottom-left
      color: '#10b981',
      action: () => {
        alert('Módulo de Voz será ativado na Parte 3.');
      },
    },
    {
      id: 'settings',
      label: 'SISTEMA',
      icon: <Settings size={18} />,
      angle: 198, // Top-left
      color: '#ec4899',
      action: () => {
        alert('Painel de Configurações será ativado na Parte 3.');
      },
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(5, 6, 15, 0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={() => setRadialMenuOpen(false)}
    >
      <div
        style={{
          position: 'relative',
          width: '440px',
          height: '440px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Orbital decorative rings */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          <circle
            cx="220"
            cy="220"
            r={radius}
            fill="none"
            stroke="rgba(139, 92, 246, 0.25)"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
          <circle
            cx="220"
            cy="220"
            r="80"
            fill="none"
            stroke="rgba(34, 211, 238, 0.2)"
            strokeWidth="1"
          />
        </svg>

        {/* Center Close / Dismiss Trigger */}
        <button
          onClick={() => setRadialMenuOpen(false)}
          className="font-mono"
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(13, 16, 35, 0.85)',
            border: '1px solid var(--border-line)',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
            transition: 'all 0.2s ease',
            boxShadow: '0 0 20px rgba(0, 0, 0, 0.8)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-error)';
            e.currentTarget.style.color = 'var(--accent-error)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-line)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <X size={20} />
          <span style={{ fontSize: '0.6rem', marginTop: '2px' }}>FECHAR</span>
        </button>

        {/* Orbiting Nodes */}
        {nodes.map((node) => {
          const rad = (node.angle * Math.PI) / 180;
          const x = Math.cos(rad) * radius;
          const y = Math.sin(rad) * radius;

          return (
            <button
              key={node.id}
              onClick={node.action}
              className="font-mono"
              style={{
                position: 'absolute',
                transform: `translate(${x}px, ${y}px)`,
                width: '100px',
                height: '76px',
                background: 'rgba(13, 16, 35, 0.85)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: `1px solid ${node.color}`,
                clipPath: 'var(--clip-cut-corner-sm)',
                color: 'var(--text-main)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: `0 0 16px rgba(0, 0, 0, 0.6), inset 0 0 12px ${node.color}22`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = `translate(${x}px, ${y}px) scale(1.1)`;
                e.currentTarget.style.boxShadow = `0 0 24px ${node.color}66, inset 0 0 16px ${node.color}44`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = `translate(${x}px, ${y}px) scale(1.0)`;
                e.currentTarget.style.boxShadow = `0 0 16px rgba(0, 0, 0, 0.6), inset 0 0 12px ${node.color}22`;
              }}
            >
              <div style={{ color: node.color }}>{node.icon}</div>
              <span
                style={{
                  fontSize: '0.65rem',
                  letterSpacing: '0.12em',
                  fontWeight: 700,
                  color: 'var(--text-bright)',
                }}
              >
                {node.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
