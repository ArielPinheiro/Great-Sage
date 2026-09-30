export type SageStatus = 'idle' | 'thinking' | 'responding' | 'error';

export interface ConsciousnessTheme {
  coreColor: string;
  haloColor: string;
  edgeTealColor: string;
  networkColor: string;
  pulseSpeed: number;
  coreIntensity: number;
}

export const CONSCIOUSNESS_THEMES: Record<SageStatus, ConsciousnessTheme> = {
  idle: {
    coreColor: '#ffffff',
    haloColor: '#38bdf8',
    edgeTealColor: '#0d9488',
    networkColor: '#93c5fd',
    pulseSpeed: 1.0,
    coreIntensity: 2.8,
  },
  thinking: {
    coreColor: '#ffffff',
    haloColor: '#a855f7',
    edgeTealColor: '#6366f1',
    networkColor: '#c084fc',
    pulseSpeed: 3.2,
    coreIntensity: 4.2,
  },
  responding: {
    coreColor: '#ffffff',
    haloColor: '#22d3ee',
    edgeTealColor: '#14b8a6',
    networkColor: '#67e8f9',
    pulseSpeed: 1.8,
    coreIntensity: 3.5,
  },
  error: {
    coreColor: '#ffffff',
    haloColor: '#ef4444',
    edgeTealColor: '#f97316',
    networkColor: '#fca5a5',
    pulseSpeed: 2.5,
    coreIntensity: 2.6,
  },
};
