import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CONSCIOUSNESS_THEMES } from './types';
import type { SageStatus } from './types';

interface DataFragmentsProps {
  status: SageStatus;
  introProgress: number;
  isMobile?: boolean;
}

interface FragmentData {
  basePos: THREE.Vector3;
  rot: THREE.Euler;
  rotSpeed: THREE.Vector3;
  scale: [number, number, number];
  parallaxFactor: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitAngle: number;
}

/**
 * Procedural texture for holographic data chips:
 * Delicate emissive 1px border with ultra-clean translucent glass interior.
 */
function createDataChipTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2; // 2:1 aspect ratio
  const ctx = canvas.getContext('2d');

  if (!ctx) return new THREE.CanvasTexture(canvas);

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Soft interior glass fill
  ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
  ctx.fillRect(4, 4, w - 8, h - 8);

  // Intense emissive perimeter glow border
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.8)';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  ctx.strokeStyle = 'rgba(125, 211, 252, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(5, 5, w - 10, h - 10);

  // Interior data telemetry lines
  ctx.fillStyle = 'rgba(125, 211, 252, 0.5)';
  ctx.fillRect(10, 10, (w - 20) * 0.65, 2);
  ctx.fillRect(10, 16, (w - 20) * 0.4, 1.5);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export const DataFragments: React.FC<DataFragmentsProps> = ({
  status,
  introProgress,
  isMobile = false,
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = isMobile ? 6 : 10;
  const { pointer } = useThree();

  const chipTexture = useMemo(() => createDataChipTexture(256), []);

  const fragments = useMemo<FragmentData[]>(() => {
    const list: FragmentData[] = [];
    for (let i = 0; i < count; i++) {
      // Clear exclusion radius: orbit outside the 4.10 outer polygon layer (r between 4.45 and 5.15)
      const radius = 4.45 + (i % 4) * 0.22 + Math.random() * 0.15;
      const angle = (i / count) * Math.PI * 2 + 0.2;

      // Bound Y gracefully
      const y = -1.6 + (i / count) * 3.2 + (Math.random() - 0.5) * 0.3;

      const zDepth = -0.5 + Math.random() * 1.0;
      const parallaxFactor = 0.4 + (zDepth + 0.8) * 0.5;

      const scaleW = 0.16 + Math.random() * 0.04;
      const scaleH = scaleW * 0.45;

      const pos = new THREE.Vector3(
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius + zDepth
      );

      list.push({
        basePos: pos,
        rot: new THREE.Euler(
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 1.2,
          0
        ),
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.3,
          0
        ),
        scale: [scaleW, scaleH, 1],
        parallaxFactor,
        orbitRadius: radius,
        orbitSpeed: (0.08 + (i % 3) * 0.04) * (i % 2 === 0 ? 1 : -1),
        orbitAngle: angle,
      });
    }
    return list;
  }, [count]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const theme = CONSCIOUSNESS_THEMES[status];
  const currentColor = useRef(new THREE.Color(theme.networkColor));

  useFrame((_, delta) => {
    currentColor.current.lerp(new THREE.Color(theme.networkColor), delta * 4);
    const speedMult = status === 'thinking' ? 1.8 : 1.0;

    if (meshRef.current) {
      fragments.forEach((item, i) => {
        item.orbitAngle += delta * item.orbitSpeed * speedMult * 0.4;
        const ox = Math.cos(item.orbitAngle) * item.orbitRadius;
        const oz = Math.sin(item.orbitAngle) * item.orbitRadius;

        // Distinct layer parallax response
        const px = pointer.x * item.parallaxFactor * 0.45;
        const py = pointer.y * item.parallaxFactor * 0.45;

        dummy.position.set(ox + px, item.basePos.y + py, oz);

        item.rot.x += item.rotSpeed.x * delta;
        item.rot.y += item.rotSpeed.y * delta;
        dummy.rotation.copy(item.rot);

        const s = introProgress;
        dummy.scale.set(item.scale[0] * s, item.scale[1] * s, 1);
        dummy.updateMatrix();

        meshRef.current?.setMatrixAt(i, dummy.matrix);
      });

      meshRef.current.instanceMatrix.needsUpdate = true;
      const mat = meshRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.color.copy(currentColor.current);
        mat.opacity = 0.45 * introProgress;
      }
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
      renderOrder={4}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={chipTexture}
        color={currentColor.current}
        transparent
        opacity={0.45}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
};
