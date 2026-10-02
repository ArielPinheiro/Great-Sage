import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { CameraControls, Billboard } from '@react-three/drei';
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

const R_FRAME = 5.5; // Radius of icosahedron frame
const CAMERA_FOV = 45; // Camera vertical FOV in degrees
const TEAL_SPRITE_POS = new THREE.Vector3(-10.0, 8.0, -18.0);

// Exact responsive framing distance formula:
// d = R / (0.85 * tan(fov/2)) in wide screens, divided by aspect in narrow screens
function calculateFramingDistance(w: number, h: number): number {
  const aspect = w / h;
  const fovRad = (CAMERA_FOV * Math.PI) / 180;
  const dBase = R_FRAME / (0.85 * Math.tan(fovRad / 2)); // ~15.62m
  return aspect >= 1.0 ? dBase : dBase / aspect;
}

// Atmospheric teal glow: large distant additive billboard sprite in top-left quadrant (opacity 0.20)
// Fades out completely when camera approaches the sprite or enters the structure
const AtmosphericTealGlow: React.FC = () => {
  const shader = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uDistToSprite: { value: 25.0 },
        uCamDistOrigin: { value: 16.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uDistToSprite;
        uniform float uCamDistOrigin;
        varying vec2 vUv;

        void main() {
          float r = length(vUv - vec2(0.5)) * 2.0;
          if (r >= 1.0) discard;

          // Fade by distance to the sprite itself (disappears when close)
          float fadeSprite = smoothstep(12.0, 22.0, uDistToSprite);
          // Fade when entering the structure
          float fadeStructure = smoothstep(5.0, 9.5, uCamDistOrigin);

          // Calibrated presence between 0.18 and 0.22
          float alpha = pow(smoothstep(1.0, 0.0, r), 2.2) * 0.20 * fadeSprite * fadeStructure;
          vec3 teal = vec3(0.05, 0.58, 0.54); // #0d9488
          gl_FragColor = vec4(teal, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
  }, []);

  useFrame(({ camera }) => {
    shader.uniforms.uDistToSprite.value = camera.position.distanceTo(TEAL_SPRITE_POS);
    shader.uniforms.uCamDistOrigin.value = camera.position.length();
  });

  return (
    <Billboard position={[-10.0, 8.0, -18.0]} scale={26.0}>
      <planeGeometry args={[1, 1]} />
      <primitive object={shader} attach="material" />
    </Billboard>
  );
};

// Proximity mist confined strictly near the core (r < 2.0)
// Fades to zero when camera approaches ~2x the mist radius (~3.8 units from center)
const CoreProximityMist: React.FC<{ color: string }> = ({ color }) => {
  const colorRef = useRef(new THREE.Color(color));

  const shader = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: colorRef.current },
        uCamDist: { value: 16.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uCamDist;
        varying vec2 vUv;

        void main() {
          float r = length(vUv - vec2(0.5)) * 2.0;
          if (r >= 1.0) discard;

          // Dedicated mist fade: begins fading at 2x mist radius (~3.8m), completely 0 at 1.5m
          float distFade = smoothstep(1.5, 3.8, uCamDist);

          // Exponential falloff confined strictly near the core
          float alpha = exp(-r * 3.8) * smoothstep(1.0, 0.45, r) * 0.14 * distFade;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
  }, []);

  useFrame(({ camera }, delta) => {
    colorRef.current.lerp(new THREE.Color(color), delta * 4);
    shader.uniforms.uColor.value.copy(colorRef.current);
    shader.uniforms.uCamDist.value = camera.position.length();
  });

  return (
    <Billboard position={[0, 0, 0]} scale={3.6}>
      <planeGeometry args={[1, 1]} />
      <primitive object={shader} attach="material" />
    </Billboard>
  );
};

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

  // Manual zoom tracking: re-framing on resize only occurs if the user has NOT manually zoomed
  const hasManuallyZoomed = useRef(false);

  // Calculate exact initial distance from window dimensions
  const [initialDistance] = useState(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const h = typeof window !== 'undefined' ? window.innerHeight : 720;
    return calculateFramingDistance(w, h);
  });

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
      coreIntensity: { value: 2.2, min: 0.5, max: 6.0, step: 0.1 },
      overrideHaloColor: false,
      haloColor: { value: '#38bdf8' },
    }),
    'Rede Neural': folder({
      numCamadas: { value: 4, min: 2, max: 6, step: 1, label: 'Camadas' },
      raioExterno: { value: 4.10, min: 1.5, max: 6.0, step: 0.05, label: 'Raio Externo' },
      velocidadeRotacao: { value: 0.05, min: 0.01, max: 0.3, step: 0.01, label: 'Vel. Rotacao' },
      tamanhoNos: { value: 0.024, min: 0.006, max: 0.06, step: 0.001, label: 'Tamanho Nos' },
      brilhoLinhas: { value: 0.9, min: 0.1, max: 1.5, step: 0.05, label: 'Brilho Linhas' },
      nosLivres: { value: 0.25, min: 0.0, max: 0.5, step: 0.05, label: 'Nos Livres (%)' },
      overrideNetworkColor: false,
      networkColor: { value: '#3b82f6' },
    }),
    'Post-Processing': folder({
      bloomIntensity: { value: 1.15, min: 0.0, max: 3.0, step: 0.05 },
      bloomThreshold: { value: 0.90, min: 0.0, max: 1.5, step: 0.02 },
    }),
  }));

  const activeStatus: SageStatus = externalStatus || levaConfig.status;

  // Entrance Progression
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

  // Responsive Window Resize Handler
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsMobile(w < 768);

      const targetD = calculateFramingDistance(w, h);

      if (cameraControlsRef.current) {
        cameraControlsRef.current.minDistance = 1.2;
        cameraControlsRef.current.maxDistance = Math.max(45.0, targetD * 1.8);

        // Only re-frame if user has NOT manually zoomed
        if (!hasManuallyZoomed.current) {
          cameraControlsRef.current.dollyTo(targetD, false);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Distinguish clicks from camera orbits & track manual zoom
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
        hasManuallyZoomed.current = true;
        cameraControlsRef.current?.dollyTo(1.6, true);
      } else {
        if (onCoreClick) onCoreClick();
      }
    }
  };

  const handleWheel = () => {
    hasManuallyZoomed.current = true;
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
      onWheel={handleWheel}
    >
      <Suspense fallback={<LoadingOverlay />}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, initialDistance], fov: 45, near: 0.05, far: 120 }}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
          }}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Pure solid background to completely prevent gray washing */}
          <color attach="background" args={['#05060f']} />

          {/* Distant atmospheric safety cutoff only, structure remains 100% crisp */}
          <fog attach="fog" args={['#05060f', 55.0, 110.0]} />

          {/* Atmospheric teal glow in top-left background with distance fade */}
          <AtmosphericTealGlow />

          {/* Dedicated proximity mist with distance fade (r < 2.0) */}
          <CoreProximityMist color={levaConfig.overrideHaloColor ? levaConfig.haloColor : '#38bdf8'} />

          {/* Ambient & Directional Scene Lighting with left teal glow */}
          <ambientLight intensity={0.25} />
          <directionalLight position={[-4, 2, 3]} intensity={0.55} color="#0d9488" />
          <directionalLight position={[4, 5, 4]} intensity={0.65} color="#38bdf8" />

          {/* Smooth CameraControls: minDistance 1.2 protects close core inspection */}
          <CameraControls
            ref={cameraControlsRef}
            minDistance={1.2}
            maxDistance={Math.max(45.0, initialDistance * 1.8)}
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
        DISTANCIA: <span ref={telemetrySpanRef} style={{ color: 'var(--accent-cyan)' }}>{initialDistance.toFixed(1)}m</span> // CAMADAS: <span style={{ color: 'var(--accent-violet)' }}>{levaConfig.numCamadas}</span>
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
