import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import { useControls, folder } from 'leva';
import { ConsciousnessEntity } from './ConsciousnessEntity';
import { SagePostProcessing } from './SagePostProcessing';
import { LoadingOverlay } from './LoadingOverlay';
import type { SageStatus } from './types';

interface SageSceneProps {
  externalStatus?: SageStatus;
  onCoreClick?: () => void;
  onDistanceChange?: (dist: number) => void;
}

export const SageScene: React.FC<SageSceneProps> = ({
  externalStatus,
  onCoreClick,
  onDistanceChange,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [introProgress, setIntroProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const cameraControlsRef = useRef<CameraControls>(null);
  const pointerDownPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastClickTime = useRef<number>(0);
  const telemetrySpanRef = useRef<HTMLSpanElement>(null);
  const lastTelemetryUpdate = useRef<number>(0);

  // Leva Live Tuning & Diagnosis Layer Toggles
  const [levaConfig] = useControls(() => ({
    'Estado & Sistema': folder({
      status: {
        value: 'idle' as SageStatus,
        options: ['idle', 'thinking', 'responding', 'error'] as SageStatus[],
      },
    }),
    'Diagnostico de Camadas': folder({
      esferaNucleo: { value: true, label: 'Esfera do Nucleo' },
      raios: { value: true, label: 'Raios de Luz' },
      haloCentral: { value: true, label: 'Halo Central' },
      nosNeurais: { value: true, label: 'Nos Luminosos' },
      linhasNeurais: { value: true, label: 'Linhas Neurais' },
      arcosGimbals: { value: true, label: 'Arcos / Aneis Gimbals' },
      fragmentos: { value: true, label: 'Fragmentos de Dados' },
      bloom: { value: true, label: 'Efeito Bloom' },
      depthOfField: { value: false, label: 'Depth of Field' },
    }),
    'Coracao de Luz': folder({
      coreIntensity: { value: 2.5, min: 0.5, max: 6.0, step: 0.1 },
      overrideHaloColor: false,
      haloColor: { value: '#38bdf8' },
    }),
    'Rede Neural': folder({
      numCamadas: { value: 4, min: 2, max: 6, step: 1, label: 'Camadas' },
      raioExterno: { value: 1.6, min: 0.8, max: 2.5, step: 0.05, label: 'Raio Externo' },
      velocidadeRotacao: { value: 0.1, min: 0.02, max: 0.5, step: 0.01, label: 'Vel. Rotacao' },
      tamanhoNos: { value: 0.014, min: 0.006, max: 0.04, step: 0.001, label: 'Tamanho Nos' },
      brilhoLinhas: { value: 0.6, min: 0.1, max: 1.5, step: 0.05, label: 'Brilho Linhas' },
      nosLivres: { value: 0.3, min: 0.0, max: 0.5, step: 0.05, label: 'Nos Livres (%)' },
      overrideNetworkColor: false,
      networkColor: { value: '#93c5fd' },
    }),
    'Post-Processing': folder({
      bloomIntensity: { value: 1.2, min: 0.0, max: 3.5, step: 0.05 },
      bloomThreshold: { value: 0.4, min: 0.0, max: 1.0, step: 0.02 },
    }),
  }));

  const activeStatus: SageStatus = externalStatus || levaConfig.status;

  // Cinematic Entrance Progression on Mount
  useEffect(() => {
    let start: number | null = null;
    const duration = 2200;

    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setIntroProgress(ease);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    const animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Responsiveness
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Distinguish clicks from camera orbits (distance threshold)
  const handlePointerDown = (e: React.PointerEvent) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const dx = Math.abs(e.clientX - pointerDownPos.current.x);
    const dy = Math.abs(e.clientY - pointerDownPos.current.y);

    if (dx < 6 && dy < 6) {
      const now = Date.now();
      const isDoubleClick = now - lastClickTime.current < 320;
      lastClickTime.current = now;

      if (isDoubleClick) {
        cameraControlsRef.current?.dollyTo(1.15, true);
      } else {
        if (onCoreClick) onCoreClick();
      }
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isHovered ? 'pointer' : 'grab',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <Suspense fallback={<LoadingOverlay />}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 7.5], fov: 45, near: 0.05, far: 100 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
          }}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Calibrated Atmospheric Fog: lines near camera are razor-sharp, fade smoothly at distance */}
          <fog attach="fog" args={['#05060f', 3.5, 22.0]} />

          {/* Ambient & Directional Scene Lighting with left teal glow */}
          <ambientLight intensity={0.25} />
          <directionalLight position={[-4, 2, 3]} intensity={0.55} color="#0d9488" />
          <directionalLight position={[4, 5, 4]} intensity={0.65} color="#38bdf8" />

          {/* Smooth CameraControls: Orbit, Scroll Zoom, Mobile Pinch with inertia */}
          <CameraControls
            ref={cameraControlsRef}
            minDistance={0.75}
            maxDistance={12.0}
            smoothTime={0.35}
            draggingSmoothTime={0.15}
            dollySpeed={0.8}
            truckSpeed={0.5}
            onChange={() => {
              // Throttle telemetry update to max 8 times per second directly via DOM ref (0 React re-renders!)
              const now = Date.now();
              if (now - lastTelemetryUpdate.current > 120 && cameraControlsRef.current) {
                lastTelemetryUpdate.current = now;
                const pos = cameraControlsRef.current.camera.position;
                const d = Math.round(pos.length() * 10) / 10;
                if (telemetrySpanRef.current) {
                  telemetrySpanRef.current.textContent = `${d.toFixed(1)}m`;
                }
                if (onDistanceChange) onDistanceChange(d);
              }
            }}
          />

          {/* Living Consciousness Entity */}
          <ConsciousnessEntity
            status={activeStatus}
            isHovered={isHovered}
            onHoverChange={setIsHovered}
            introProgress={introProgress}
            coreIntensity={levaConfig.coreIntensity}
            customHaloColor={
              levaConfig.overrideHaloColor ? levaConfig.haloColor : undefined
            }
            customNetworkColor={
              levaConfig.overrideNetworkColor ? levaConfig.networkColor : undefined
            }
            numLayers={levaConfig.numCamadas}
            outerRadius={levaConfig.raioExterno}
            rotationSpeed={levaConfig.velocidadeRotacao}
            nodeSize={levaConfig.tamanhoNos}
            lineBrightness={levaConfig.brilhoLinhas}
            freeNodeRatio={levaConfig.nosLivres}
            isMobile={isMobile}
            showCoreSphere={levaConfig.esferaNucleo}
            showRays={levaConfig.raios}
            showHalo={levaConfig.haloCentral}
            showNodes={levaConfig.nosNeurais}
            showLines={levaConfig.linhasNeurais}
            showGimbals={levaConfig.arcosGimbals}
            showFragments={levaConfig.fragmentos}
          />

          {/* Post-Processing with Bloom and Optional Depth of Field */}
          <SagePostProcessing
            bloomIntensity={levaConfig.bloomIntensity}
            bloomThreshold={levaConfig.bloomThreshold}
            showBloom={levaConfig.bloom}
            showDepthOfField={levaConfig.depthOfField}
            isMobile={isMobile}
          />
        </Canvas>
      </Suspense>

      {/* Realtime Distance & Telemetry Display positioned cleanly below header */}
      <div
        className="font-mono"
        style={{
          position: 'absolute',
          top: '84px',
          right: '32px',
          pointerEvents: 'none',
          fontSize: '0.7rem',
          letterSpacing: '0.2em',
          color: 'var(--text-secondary)',
          background: 'rgba(5, 6, 15, 0.75)',
          padding: '6px 14px',
          border: '1px solid var(--border-line)',
          clipPath: 'var(--clip-cut-corner-sm)',
          backdropFilter: 'blur(8px)',
          zIndex: 10,
        }}
      >
        DISTANCIA: <span ref={telemetrySpanRef} style={{ color: 'var(--accent-cyan)' }}>7.5m</span> // CAMADAS: <span style={{ color: 'var(--accent-violet)' }}>{levaConfig.numCamadas}</span>
      </div>

      {/* Discrete Access Prompt on Hover */}
      <div
        className="font-mono"
        style={{
          position: 'absolute',
          bottom: '8%',
          pointerEvents: 'none',
          opacity: isHovered ? 1 : 0,
          transform: isHovered ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          fontSize: '0.75rem',
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'var(--accent-cyan)',
          padding: '6px 16px',
          border: '1px solid var(--border-active)',
          background: 'rgba(5, 6, 15, 0.75)',
          backdropFilter: 'blur(8px)',
          clipPath: 'var(--clip-cut-corner-sm)',
          boxShadow: '0 0 16px rgba(34, 211, 238, 0.25)',
        }}
      >
        [ CLIQUE PARA ACESSAR // DUPLO CLIQUE PARA MERGULHAR ]
      </div>
    </div>
  );
};
