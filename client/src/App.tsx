import { useState } from 'react';
import { Leva } from 'leva';
import { SageScene } from './components/orb/SageScene';
import { HudHeader } from './components/hud/HudHeader';
import { HudFrame } from './components/hud/HudFrame';
import type { SageStatus } from './components/orb/types';

export function App() {
  const [status] = useState<SageStatus>('idle');

  const handleCoreClick = () => {
    // This will open the radial menu in Parte 2
    console.log('[Daikenja] Nucleo acionado pelo usuario.');
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#05060f',
      }}
    >
      {/* Leva Live Debug & Tuning Panel (Minimized by default in bottom-left) */}
      <Leva
        collapsed={true}
        oneLineLabels={false}
        flat={true}
        theme={{
          colors: {
            elevation1: '#0d1023',
            elevation2: '#121630',
            elevation3: '#181e42',
            accent1: '#8b5cf6',
            accent2: '#22d3ee',
            accent3: '#3b82f6',
            highlight1: '#e6e9f5',
            highlight2: '#7c86a2',
            highlight3: '#4b556e',
          },
        }}
      />

      {/* Decorative HUD Frame */}
      <HudFrame />

      {/* System Telemetry Header */}
      <HudHeader status={status} />

      {/* Central 3D Sage Scene */}
      <main
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        }}
      >
        <SageScene externalStatus={undefined} onCoreClick={handleCoreClick} />
      </main>
    </div>
  );
}

export default App;
