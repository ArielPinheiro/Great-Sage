import React from 'react';

export const LoadingOverlay: React.FC = () => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#05060f',
        zIndex: 50,
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: '0.8rem',
          letterSpacing: '0.3em',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          marginBottom: '1rem',
        }}
      >
        [ SISTEMA: INICIALIZANDO MATRIZ DO GRANDE SABIO ]
      </div>

      <div
        style={{
          width: '180px',
          height: '2px',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: '40%',
            backgroundColor: 'var(--accent-cyan)',
            boxShadow: '0 0 10px var(--accent-cyan)',
            animation: 'scanProgress 1.4s ease-in-out infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes scanProgress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
};
