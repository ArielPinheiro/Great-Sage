import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CONSCIOUSNESS_THEMES, deriveThemeColors } from './types';
import type { SageStatus } from './types';

interface ArcGimbalsProps {
  status: SageStatus;
  isHovered: boolean;
  introProgress: number;
  customColor?: string;
}

// Shader for thin, discrete orbital rings using theme color strictly below bloom threshold
const createDiscreetRingShader = (
  color: THREE.Color,
  pulseFreq: number,
  pulseSpeed: number,
  isArc: boolean
) => {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
      uPulseFreq: { value: pulseFreq },
      uPulseSpeed: { value: pulseSpeed },
      uIsArc: { value: isArc ? 1.0 : 0.0 },
      uOpacity: { value: 0.32 },
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

        // Subtle traveling wave along orbit
        float pulse = sin(angle * uPulseFreq - uTime * uPulseSpeed) * 0.5 + 0.5;
        pulse = pow(pulse, 3.0);

        // Gentle rim Fresnel
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        float rim = 1.0 - abs(dot(normal, viewDir));
        rim = pow(clamp(rim, 0.0, 1.0), 1.8);

        // Pure theme color with strictly controlled luminance (under 0.80) to prevent white blowout
        vec3 finalColor = uColor * (0.65 + 0.15 * pulse + 0.15 * rim);

        // Smooth tapering for open partial arcs at endpoints
        float edgeFade = 1.0;
        if (uIsArc > 0.5) {
          edgeFade = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        }

        float alpha = uOpacity * (0.7 + 0.3 * rim) * edgeFade;
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
  // Exactly 3 discrete gimbal structures: 2 thin rings and 1 delicate open arc
  const ring1Ref = useRef<THREE.Group>(null);
  const ring2Ref = useRef<THREE.Group>(null);
  const arc3Ref = useRef<THREE.Group>(null);

  const theme = CONSCIOUSNESS_THEMES[status];
  const ringColorRef = useRef(new THREE.Color());

  // 70% thickness reduction: tube radius 0.0024 down from 0.009 - 0.011
  const geometries = useMemo(() => {
    return {
      // 1. Inner meridian gyro ring (between layer 1 and 2)
      ring1: new THREE.TorusGeometry(2.75, 0.0022, 8, 96),
      // 2. Mid counter-tilted ring (between layer 2 and 3)
      ring2: new THREE.TorusGeometry(3.65, 0.0020, 8, 96),
      // 3. Outer delicate open arc (outside layer 3, 230 degrees)
      arc3: new THREE.TorusGeometry(4.65, 0.0018, 8, 80, Math.PI * 1.28),
    };
  }, []);

  const shaders = useMemo(() => {
    const baseColor = new THREE.Color(customColor || theme.networkColor);
    const { structure } = deriveThemeColors(baseColor);
    ringColorRef.current.copy(structure);

    return {
      ring1: createDiscreetRingShader(structure, 2.0, 0.8, false),
      ring2: createDiscreetRingShader(structure, 3.0, 0.6, false),
      arc3: createDiscreetRingShader(structure, 1.5, 0.7, true),
    };
  }, [status, customColor]);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    const baseColor = new THREE.Color(customColor || theme.networkColor);
    const { structure } = deriveThemeColors(baseColor);
    ringColorRef.current.lerp(structure, delta * 4);

    const speedMult = (status === 'thinking' ? 1.8 : 1.0) * (isHovered ? 0.35 : 1.0);
    // Opacity kept strictly discreet (0.28)
    const targetOpacity = 0.28 * introProgress;

    Object.values(shaders).forEach((mat) => {
      mat.uniforms.uTime.value = time;
      mat.uniforms.uOpacity.value = targetOpacity;
      mat.uniforms.uColor.value.copy(ringColorRef.current);
    });

    // Slow, graceful orbital rotation on distinct axes
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = time * 0.04 * speedMult;
      ring1Ref.current.rotation.y = 0.8 + time * 0.05 * speedMult;
      ring1Ref.current.rotation.z = 0.3;
    }

    if (ring2Ref.current) {
      ring2Ref.current.rotation.x = -0.5 + time * -0.035 * speedMult;
      ring2Ref.current.rotation.y = time * -0.045 * speedMult;
      ring2Ref.current.rotation.z = 0.6;
    }

    if (arc3Ref.current) {
      arc3Ref.current.rotation.x = 0.65 + time * 0.03 * speedMult;
      arc3Ref.current.rotation.y = -0.4 + time * -0.04 * speedMult;
      arc3Ref.current.rotation.z = time * 0.02 * speedMult;
    }
  });

  return (
    <group renderOrder={3}>
      {/* 1. Inner Meridian Gyro Ring */}
      <group ref={ring1Ref}>
        <mesh geometry={geometries.ring1} material={shaders.ring1} />
      </group>

      {/* 2. Mid Counter-Tilted Ring */}
      <group ref={ring2Ref}>
        <mesh geometry={geometries.ring2} material={shaders.ring2} />
      </group>

      {/* 3. Outer Delicate Open Arc */}
      <group ref={arc3Ref}>
        <mesh geometry={geometries.arc3} material={shaders.arc3} />
      </group>
    </group>
  );
};
