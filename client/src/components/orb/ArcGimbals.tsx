import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CONSCIOUSNESS_THEMES } from './types';
import type { SageStatus } from './types';

interface ArcGimbalsProps {
  status: SageStatus;
  isHovered: boolean;
  introProgress: number;
  customColor?: string;
}

// Custom shader for luminous glowing rings with energy pulses, rim glow and tapered ends
const createRingShader = (
  color: THREE.Color,
  glowColor: THREE.Color,
  pulseFreq: number,
  pulseSpeed: number,
  isArc: boolean
) => {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
      uGlowColor: { value: glowColor },
      uPulseFreq: { value: pulseFreq },
      uPulseSpeed: { value: pulseSpeed },
      uIsArc: { value: isArc ? 1.0 : 0.0 },
      uOpacity: { value: 1.0 },
    },
    vertexShader: `
      precision highp float;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;
      varying vec3 vViewPosition;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec3 uColor;
      uniform vec3 uGlowColor;
      uniform float uTime;
      uniform float uPulseFreq;
      uniform float uPulseSpeed;
      uniform float uIsArc;
      uniform float uOpacity;

      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;
      varying vec3 vViewPosition;

      void main() {
        float angle = vUv.x * 6.2831853;

        // Dynamic light pulse traveling along the orbit
        float pulse = sin(angle * uPulseFreq - uTime * uPulseSpeed) * 0.5 + 0.5;
        pulse = pow(pulse, 2.8);

        // Edge/Rim luminous Fresnel
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        float rim = 1.0 - abs(dot(normal, viewDir));
        rim = pow(clamp(rim, 0.0, 1.0), 1.5);

        // White-hot luminous core + ethereal color aura
        vec3 pureWhite = vec3(1.0, 1.0, 1.0);
        vec3 baseTint = mix(pureWhite, uGlowColor, 0.22);
        vec3 finalColor = baseTint * (1.2 + pulse * 0.7 + rim * 0.6);

        // Smooth tapering for open arcs at their terminal ends
        float edgeFade = 1.0;
        if (uIsArc > 0.5) {
          edgeFade = smoothstep(0.0, 0.07, vUv.x) * smoothstep(1.0, 0.93, vUv.x);
        }

        float alpha = (0.75 + 0.25 * rim + 0.2 * pulse) * edgeFade * uOpacity;

        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
};

export const ArcGimbals: React.FC<ArcGimbalsProps> = ({
  status,
  isHovered,
  introProgress,
  customColor,
}) => {
  // Groups for each ring/arc to animate rotations
  const hexRingRef = useRef<THREE.Group>(null);
  const innerArcRef = useRef<THREE.Group>(null);
  const dualTrackGroupRef = useRef<THREE.Group>(null);
  const meridianRingRef = useRef<THREE.Group>(null);
  const counterRingRef = useRef<THREE.Group>(null);
  const midArcRef = useRef<THREE.Group>(null);
  const horizonRingRef = useRef<THREE.Group>(null);

  // Refs for orbiting data beads
  const bead1Ref = useRef<THREE.Mesh>(null);
  const bead2Ref = useRef<THREE.Mesh>(null);
  const bead3Ref = useRef<THREE.Mesh>(null);
  const bead4Ref = useRef<THREE.Mesh>(null);

  const theme = CONSCIOUSNESS_THEMES[status];
  const glowColorRef = useRef(new THREE.Color(customColor || theme.haloColor));
  const whiteCoreColor = useMemo(() => new THREE.Color('#ffffff'), []);

  // Geometries memoized
  const geometries = useMemo(() => {
    return {
      // 1. Hexagonal computing ring (6 tubular segments = exact regular hexagon)
      hex: new THREE.TorusGeometry(0.92, 0.009, 8, 6),
      // 2. Inner high-frequency partial arc (240 degrees)
      innerArc: new THREE.TorusGeometry(0.78, 0.008, 12, 64, Math.PI * 1.33),
      // 3. Dual equatorial track A
      dualTrackA: new THREE.TorusGeometry(1.12, 0.007, 12, 90),
      // 4. Dual equatorial track B
      dualTrackB: new THREE.TorusGeometry(1.17, 0.007, 12, 90),
      // 5. Major meridian full ring
      meridian: new THREE.TorusGeometry(1.34, 0.011, 14, 100),
      // 6. Mid-range tilted partial arc (210 degrees)
      midArc: new THREE.TorusGeometry(1.41, 0.008, 12, 70, Math.PI * 1.18),
      // 7. Counter-tilted full ring
      counter: new THREE.TorusGeometry(1.50, 0.009, 14, 100),
      // 8. Outer delicate horizon ring
      horizon: new THREE.TorusGeometry(1.64, 0.006, 12, 100),
      // Data bead geometry
      bead: new THREE.SphereGeometry(0.024, 12, 12),
    };
  }, []);

  // Shaders memoized for each orbital ring
  const shaders = useMemo(() => {
    const glow = glowColorRef.current;
    return {
      hex: createRingShader(whiteCoreColor, glow, 3.0, 1.8, false),
      innerArc: createRingShader(whiteCoreColor, glow, 2.0, 2.5, true),
      dualA: createRingShader(whiteCoreColor, glow, 4.0, 1.2, false),
      dualB: createRingShader(whiteCoreColor, glow, 4.0, 1.2, false),
      meridian: createRingShader(whiteCoreColor, glow, 2.0, 1.0, false),
      midArc: createRingShader(whiteCoreColor, glow, 2.0, 1.6, true),
      counter: createRingShader(whiteCoreColor, glow, 3.0, 1.4, false),
      horizon: createRingShader(whiteCoreColor, glow, 1.0, 0.7, false),
    };
  }, [whiteCoreColor]);

  // Material for the floating data beads
  const beadMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
  }, []);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    glowColorRef.current.lerp(new THREE.Color(customColor || theme.haloColor), delta * 4);

    const speedMult = (status === 'thinking' ? 2.4 : 1.0) * (isHovered ? 0.35 : 1.0);
    const opacityValue = introProgress;

    // Update uniform time & opacity on all ring shaders
    Object.values(shaders).forEach((mat) => {
      mat.uniforms.uTime.value = time;
      mat.uniforms.uOpacity.value = opacityValue;
      mat.uniforms.uGlowColor.value.copy(glowColorRef.current);
    });

    beadMaterial.opacity = 0.9 * introProgress;

    // 1. Hexagonal Aperture Ring (rotates with slight wobble)
    if (hexRingRef.current) {
      hexRingRef.current.rotation.x = 0.45 + Math.sin(time * 0.4 * speedMult) * 0.15;
      hexRingRef.current.rotation.y = time * 0.22 * speedMult;
      hexRingRef.current.rotation.z = -0.3 + time * 0.08 * speedMult;
    }

    // 2. Inner High-Frequency Partial Arc (rapid counter-spin)
    if (innerArcRef.current) {
      innerArcRef.current.rotation.x = -1.1 + time * -0.32 * speedMult;
      innerArcRef.current.rotation.y = 0.5 + time * 0.45 * speedMult;
      innerArcRef.current.rotation.z = time * 0.2 * speedMult;
    }

    // 3. Dual Equatorial Precision Rings (harmonious precession)
    if (dualTrackGroupRef.current) {
      dualTrackGroupRef.current.rotation.x = 0.32 + Math.cos(time * 0.25 * speedMult) * 0.08;
      dualTrackGroupRef.current.rotation.y = time * 0.14 * speedMult;
    }

    // 4. Major Meridian Ring (majestic vertical gyro)
    if (meridianRingRef.current) {
      meridianRingRef.current.rotation.x = time * 0.12 * speedMult;
      meridianRingRef.current.rotation.y = 1.15 + time * 0.09 * speedMult;
      meridianRingRef.current.rotation.z = 0.4;
    }

    // 5. Counter-Tilted Ring
    if (counterRingRef.current) {
      counterRingRef.current.rotation.x = -0.65 + time * -0.16 * speedMult;
      counterRingRef.current.rotation.y = time * -0.11 * speedMult;
      counterRingRef.current.rotation.z = 0.5 + Math.sin(time * 0.3 * speedMult) * 0.12;
    }

    // 6. Mid-Range Segmented Arc
    if (midArcRef.current) {
      midArcRef.current.rotation.x = 0.8 + time * 0.18 * speedMult;
      midArcRef.current.rotation.y = -0.7 + time * -0.25 * speedMult;
      midArcRef.current.rotation.z = time * 0.15 * speedMult;
    }

    // 7. Outer Horizon Ring (slow celestial drift)
    if (horizonRingRef.current) {
      horizonRingRef.current.rotation.x = 0.2 + time * 0.05 * speedMult;
      horizonRingRef.current.rotation.y = time * -0.07 * speedMult;
      horizonRingRef.current.rotation.z = -0.4 + time * 0.04 * speedMult;
    }

    // Position orbiting data beads along rings
    if (bead1Ref.current) {
      const a1 = time * 0.7 * speedMult;
      bead1Ref.current.position.set(Math.cos(a1) * 1.12, Math.sin(a1) * 1.12, 0);
    }
    if (bead2Ref.current) {
      const a2 = -time * 0.85 * speedMult + 2.2;
      bead2Ref.current.position.set(Math.cos(a2) * 1.17, Math.sin(a2) * 1.17, 0);
    }
    if (bead3Ref.current) {
      const a3 = time * 0.6 * speedMult + 1.0;
      bead3Ref.current.position.set(Math.cos(a3) * 1.34, Math.sin(a3) * 1.34, 0);
    }
    if (bead4Ref.current) {
      const a4 = -time * 0.5 * speedMult + 3.5;
      bead4Ref.current.position.set(Math.cos(a4) * 1.50, Math.sin(a4) * 1.50, 0);
    }
  });

  return (
    <group renderOrder={3}>
      {/* 1. Hexagonal Aperture Ring (Inner AI Iris) */}
      <group ref={hexRingRef}>
        <mesh geometry={geometries.hex} material={shaders.hex} />
      </group>

      {/* 2. Inner High-Frequency Partial Arc */}
      <group ref={innerArcRef}>
        <mesh geometry={geometries.innerArc} material={shaders.innerArc} />
      </group>

      {/* 3 & 4. Dual Precision Track Rings + Orbiting Beads */}
      <group ref={dualTrackGroupRef}>
        <mesh geometry={geometries.dualTrackA} material={shaders.dualA} />
        <mesh geometry={geometries.dualTrackB} material={shaders.dualB} />
        <mesh ref={bead1Ref} geometry={geometries.bead} material={beadMaterial} />
        <mesh ref={bead2Ref} geometry={geometries.bead} material={beadMaterial} />
      </group>

      {/* 5. Major Meridian Gyro Ring + Bead */}
      <group ref={meridianRingRef}>
        <mesh geometry={geometries.meridian} material={shaders.meridian} />
        <mesh ref={bead3Ref} geometry={geometries.bead} material={beadMaterial} />
      </group>

      {/* 6. Mid-Range Segmented Open Arc */}
      <group ref={midArcRef}>
        <mesh geometry={geometries.midArc} material={shaders.midArc} />
      </group>

      {/* 7. Counter-Tilted Resonance Ring + Bead */}
      <group ref={counterRingRef}>
        <mesh geometry={geometries.counter} material={shaders.counter} />
        <mesh ref={bead4Ref} geometry={geometries.bead} material={beadMaterial} />
      </group>

      {/* 8. Outer Delicate Horizon Ring */}
      <group ref={horizonRingRef}>
        <mesh geometry={geometries.horizon} material={shaders.horizon} />
      </group>
    </group>
  );
};
