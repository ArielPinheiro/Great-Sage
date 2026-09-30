import React from 'react';

export const HudFrame: React.FC = () => {
  const cornerStyle: React.CSSProperties = {
    position: 'absolute',
    width: '32px',
    height: '32px',
    pointerEvents: 'none',
    borderColor: 'var(--border-line)',
    borderStyle: 'solid',
    zIndex: 5,
  };

  return (
    <>
      {/* Top Left Corner */}
      <div
        style={{
          ...cornerStyle,
          top: '16px',
          left: '16px',
          borderWidth: '2px 0 0 2px',
        }}
      />
      {/* Top Right Corner */}
      <div
        style={{
          ...cornerStyle,
          top: '16px',
          right: '16px',
          borderWidth: '2px 2px 0 0',
        }}
      />
      {/* Bottom Left Corner */}
      <div
        style={{
          ...cornerStyle,
          bottom: '16px',
          left: '16px',
          borderWidth: '0 0 2px 2px',
        }}
      />
      {/* Bottom Right Corner */}
      <div
        style={{
          ...cornerStyle,
          bottom: '16px',
          right: '16px',
          borderWidth: '0 2px 2px 0',
        }}
      />

      {/* Subtle Bottom System Status Line */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '120px',
          right: '340px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.2em',
          }}
        >
          COORD: [50.21.09] // FLUXO: ESTAVEL
        </div>
        <div
          style={{
            flex: 1,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, var(--border-line), transparent)',
            margin: '0 20px',
          }}
        />
        <div
          className="font-mono"
          style={{
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.2em',
          }}
        >
          SISTEMA MENTAL HOLOGRAFICO
        </div>
      </div>
    </>
  );
};
