import * as THREE from 'three';

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
    networkColor: '#3b82f6',
    pulseSpeed: 1.0,
    coreIntensity: 2.5,
  },
  thinking: {
    coreColor: '#ffffff',
    haloColor: '#a855f7',
    edgeTealColor: '#6366f1',
    networkColor: '#8b5cf6',
    pulseSpeed: 3.2,
    coreIntensity: 3.8,
  },
  responding: {
    coreColor: '#ffffff',
    haloColor: '#22d3ee',
    edgeTealColor: '#14b8a6',
    networkColor: '#06b6d4',
    pulseSpeed: 1.8,
    coreIntensity: 3.2,
  },
  error: {
    coreColor: '#ffffff',
    haloColor: '#ef4444',
    edgeTealColor: '#f97316',
    networkColor: '#ef4444',
    pulseSpeed: 2.5,
    coreIntensity: 2.6,
  },
};

/**
 * Derives visual hierarchy colors dynamically from any base theme color:
 * - Structure: Pure base color (controlled luminance below bloom threshold)
 * - Accent: Lighter variation with hue shift (cyan for blue base, vibrant lighter tone for others)
 */
export function deriveThemeColors(baseColorInput: string | THREE.Color) {
  const base =
    baseColorInput instanceof THREE.Color
      ? baseColorInput.clone()
      : new THREE.Color(baseColorInput);

  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);

  const structure = base.clone();

  // Shift hue by -0.08 (e.g. 217deg blue -> 188deg cyan), boost lightness
  const shiftedHue = (hsl.h - 0.08 + 1.0) % 1.0;
  const accent = new THREE.Color().setHSL(
    shiftedHue,
    Math.min(1.0, hsl.s * 1.05),
    Math.min(0.85, hsl.l + 0.16)
  );

  return { structure, accent };
}

