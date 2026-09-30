import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { createSoftCoreTexture } from './haloTexture';
import { CONSCIOUSNESS_THEMES } from './types';
import type { SageStatus } from './types';

interface ConsciousnessCoreProps {
  status: SageStatus;
  isHovered: boolean;
  introProgress: number;
  intensityMultiplier?: number;
  customHaloColor?: string;
  showCoreSphere?: boolean;
  showRays?: boolean;
  showHalo?: boolean;
}

export const ConsciousnessCore: React.FC<ConsciousnessCoreProps> = ({
  status,
  isHovered,
  introProgress,
  intensityMultiplier = 1.0,
  customHaloColor,
  showCoreSphere = true,
  showRays = true,
  showHalo = true,
}) => {
  const pointLightRef = useRef<THREE.PointLight>(null);
  const plasmaMeshRef = useRef<THREE.Mesh>(null);
  const raysGroupRef = useRef<THREE.Group>(null);
  const haloMeshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  const softCoreTexture = useMemo(() => createSoftCoreTexture(256), []);
  const theme = CONSCIOUSNESS_THEMES[status];
  const currentThemeColor = useRef(new THREE.Color(customHaloColor || theme.haloColor));

  // White-hot plasma shader — much brighter core than before
  const plasmaShader = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: currentThemeColor.current },
        uIntensity: { value: 1.8 },
      },
      vertexShader: `
        precision highp float;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uIntensity;
        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
          float p1 = sin(vPosition.x * 4.0 + uTime * 0.7) * cos(vPosition.y * 4.0 + uTime * 0.5);
          float p2 = sin(vPosition.z * 5.0 - uTime * 0.6) * cos((vPosition.x + vPosition.y) * 3.0 + uTime * 0.4);
          float plasma = clamp((p1 + p2) * 0.25 + 0.5, 0.0, 1.0);

          vec3 warmWhite = vec3(1.0, 0.99, 0.96);
          vec3 baseColor = mix(uColor * 0.4 + warmWhite * 0.6, warmWhite, pow(plasma, 1.2));

          float dRim = clamp(abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 0.0, 1.0);
          float rim = pow(clamp(1.0 - dRim, 0.0, 1.0), 1.5);
          vec3 finalColor = baseColor * (uIntensity + rim * 0.6);

          gl_FragColor = vec4(finalColor, 0.98);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  // 32 thin starburst rays — every 4th is an "accent" (longer)
  const rays = useMemo(() => {
    const count = 32;
    const rayList: { rot: THREE.Euler; len: number }[] = [];
    const phi = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = phi * i;

      const dir = new THREE.Vector3(
        Math.cos(theta) * radiusAtY,
        y,
        Math.sin(theta) * radiusAtY
      ).normalize();

      const orientation = new THREE.Matrix4().lookAt(
        new THREE.Vector3(0, 0, 0),
        dir,
        new THREE.Vector3(0, 1, 0)
      );
      const rot = new THREE.Euler().setFromRotationMatrix(orientation);

      const isAccent = i % 4 === 0;
      rayList.push({
        rot,
        len: isAccent
          ? 2.0 + ((i * 3) % 5) * 0.25
          : 1.0 + ((i * 7) % 5) * 0.18,
      });
    }
    return rayList;
  }, []);

  const rayShader = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color('#ffffff') },
        uThemeColor: { value: currentThemeColor.current },
        uOpacity: { value: 0.32 },
      },
      vertexShader: `
        precision highp float;
        varying float vY;
        void main() {
          vY = position.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform vec3 uColor;
        uniform vec3 uThemeColor;
        uniform float uOpacity;
        varying float vY;

        void main() {
          float normY = clamp(vY + 0.5, 0.0, 1.0);
          vec3 col = mix(uColor, uThemeColor, pow(normY, 0.4));
          float alpha = pow(clamp(1.0 - normY, 0.0, 1.0), 1.5) * uOpacity;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    currentThemeColor.current.lerp(
      new THREE.Color(customHaloColor || theme.haloColor),
      delta * 4
    );

    // Distance-based attenuation: dims core when camera is close to prevent white blowout
    const camDist = camera.position.length();
    const distAtten = Math.min(1.0, camDist / 3.0);

    const speed = theme.pulseSpeed * 0.8 * (isHovered ? 1.4 : 1.0);
    const pulseHarmonic = Math.sin(time * speed * 2.0) * 0.5 + 0.5;
    const heartRhythm = Math.pow(pulseHarmonic, 2.0) * 0.08;
    const hoverScale = isHovered ? 1.08 : 1.0;

    // Core Point Light
    if (pointLightRef.current) {
      const base = theme.coreIntensity * 0.8 * intensityMultiplier * introProgress;
      pointLightRef.current.intensity = (base + heartRhythm * 0.8) * distAtten;
      pointLightRef.current.color.copy(currentThemeColor.current);
    }

    // Plasma Sphere
    if (plasmaMeshRef.current && showCoreSphere) {
      plasmaShader.uniforms.uTime.value = time;
      plasmaShader.uniforms.uColor.value.copy(currentThemeColor.current);
      plasmaShader.uniforms.uIntensity.value = (1.6 + heartRhythm * 0.4) * intensityMultiplier * distAtten;

      const s = (0.28 + heartRhythm * 0.02) * hoverScale * introProgress;
      plasmaMeshRef.current.scale.set(s, s, s);
      plasmaMeshRef.current.rotation.y += delta * 0.3;
      plasmaMeshRef.current.rotation.z += delta * 0.15;
    }

    // Starburst Rays
    if (raysGroupRef.current && showRays) {
      rayShader.uniforms.uThemeColor.value.copy(currentThemeColor.current);
      rayShader.uniforms.uOpacity.value = (0.25 + heartRhythm * 0.12) * introProgress * distAtten;
      raysGroupRef.current.rotation.y += delta * 0.04;
      raysGroupRef.current.rotation.x += delta * 0.02;

      const baseRayScale = hoverScale * introProgress * (1.0 + heartRhythm * 0.04);
      raysGroupRef.current.scale.set(baseRayScale, baseRayScale, baseRayScale);
    }

    // Halo opacity attenuation on zoom
    if (haloMeshRef.current && showHalo) {
      const hMat = haloMeshRef.current.material as THREE.MeshBasicMaterial;
      hMat.opacity = 0.75 * introProgress * distAtten;
    }
  });

  return (
    <group position={[0, 0, 0]} renderOrder={1}>
      {/* Core Point Light */}
      <pointLight ref={pointLightRef} distance={8} decay={2} />

      {/* White-hot Plasma Sphere */}
      {showCoreSphere && (
        <mesh ref={plasmaMeshRef} material={plasmaShader}>
          <sphereGeometry args={[1, 32, 32]} />
        </mesh>
      )}

      {/* 32 Thin Starburst Light Rays */}
      {showRays && (
        <group ref={raysGroupRef}>
          {rays.map((ray, i) => (
            <group key={i} rotation={ray.rot}>
              <mesh
                position={[0, ray.len * 0.5 + 0.22, 0]}
                material={rayShader}
                scale={[1, ray.len, 1]}
              >
                <cylinderGeometry args={[0.001, 0.006, 1, 4]} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* Billboard Core Glow (always faces camera) */}
      {showHalo && (
        <Billboard>
          <mesh ref={haloMeshRef} scale={0.9 * introProgress}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              map={softCoreTexture}
              color="#ffffff"
              transparent
              opacity={0.75 * introProgress}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </Billboard>
      )}
    </group>
  );
};
