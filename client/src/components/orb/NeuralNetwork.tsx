import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CONSCIOUSNESS_THEMES } from './types';
import type { SageStatus } from './types';

// Deterministic hash — no Math.random() in render/useMemo
function srand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Regular polygon vertices in the XY plane
function polyVerts(sides: number, radius: number, phase: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (Math.PI * 2 * i) / sides + phase;
    out.push(new THREE.Vector3(radius * Math.cos(a), radius * Math.sin(a), 0));
  }
  return out;
}

// Alternating hex/pent layer templates (up to 6 layers)
const LAYER_DEFS = [
  { sides: 6, rFrac: 1.0,   phase0: 0 },
  { sides: 5, rFrac: 0.74,  phase0: Math.PI / 10 },
  { sides: 6, rFrac: 0.50,  phase0: Math.PI / 6 },
  { sides: 5, rFrac: 0.32,  phase0: Math.PI / 5 },
  { sides: 6, rFrac: 0.19,  phase0: Math.PI / 8 },
  { sides: 5, rFrac: 0.11,  phase0: Math.PI / 12 },
];

// 3 gyroscopic planes: initial orientations
const PLANE_INIT = [
  new THREE.Euler(0, 0, 0),
  new THREE.Euler(Math.PI * 0.52, 0, Math.PI * 0.12),
  new THREE.Euler(0, Math.PI * 0.48, Math.PI * 0.28),
];

// Per-plane spin axis and relative speed
const PLANE_SPIN = [
  { axis: new THREE.Vector3(0, 1, 0), sMult: 1.0 },
  { axis: new THREE.Vector3(1, 0, 0.3).normalize(), sMult: -0.7 },
  { axis: new THREE.Vector3(0.2, 0, 1).normalize(), sMult: 0.85 },
];

interface NeuralNetworkProps {
  status: SageStatus;
  isHovered: boolean;
  introProgress: number;
  isMobile?: boolean;
  numLayers?: number;
  outerRadius?: number;
  rotationSpeed?: number;
  nodeSize?: number;
  lineBrightness?: number;
  freeNodeRatio?: number;
  customNetworkColor?: string;
}

export const NeuralNetwork: React.FC<NeuralNetworkProps> = ({
  status,
  isHovered,
  introProgress,
  isMobile = false,
  numLayers = 4,
  outerRadius = 1.6,
  rotationSpeed = 0.1,
  nodeSize = 0.014,
  lineBrightness = 0.6,
  freeNodeRatio = 0.3,
  customNetworkColor,
}) => {
  const nodesRef = useRef<THREE.InstancedMesh>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const icoRef = useRef<THREE.LineSegments>(null);
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  const theme = CONSCIOUSNESS_THEMES[status];
  const currentColor = useRef(new THREE.Color(customNetworkColor || theme.networkColor));

  // ---- Build all geometry (deterministic, recomputes only when Leva params change) ----
  const networkData = useMemo(() => {
    const nLay = Math.max(2, Math.min(6, isMobile ? Math.min(numLayers, 3) : numLayers));
    const layers = LAYER_DEFS.slice(0, nLay);

    const nodes: {
      pIdx: number; lIdx: number;
      lp: THREE.Vector3; free: boolean;
      wPh: number; wAmp: number;
    }[] = [];

    // plNi[plane][layer] -> array of global node indices
    const plNi: number[][][] = [];

    for (let p = 0; p < 3; p++) {
      const pL: number[][] = [];
      for (let l = 0; l < layers.length; l++) {
        const { sides, rFrac, phase0 } = layers[l];
        const r = outerRadius * rFrac;
        // Phase offset per plane so vertices never align between planes
        const phase = phase0 + (p * Math.PI * 2) / (3 * sides);
        const verts = polyVerts(sides, r, phase);

        // Apply initial plane orientation
        const q = new THREE.Quaternion().setFromEuler(PLANE_INIT[p]);
        verts.forEach(v => v.applyQuaternion(q));

        const idx: number[] = [];
        verts.forEach((v, vi) => {
          const gi = nodes.length;
          idx.push(gi);
          const seed = p * 1000 + l * 100 + vi;
          nodes.push({
            pIdx: p, lIdx: l,
            lp: v.clone(),
            free: srand(seed) < freeNodeRatio,
            wPh: srand(seed + 50) * Math.PI * 2,
            wAmp: 0.12 + srand(seed + 100) * 0.15,
          });
        });
        pL.push(idx);
      }
      plNi.push(pL);
    }

    // Origin node (anchor for core radials, rendered invisible)
    const oIdx = nodes.length;
    nodes.push({
      pIdx: 0, lIdx: -1,
      lp: new THREE.Vector3(0, 0, 0),
      free: false, wPh: 0, wAmp: 0,
    });

    // ---- Build edges ----
    const edges: { f: number; t: number; op: number }[] = [];

    for (let p = 0; p < 3; p++) {
      for (let l = 0; l < layers.length; l++) {
        const { sides } = layers[l];
        const ni = plNi[p][l];

        // Perimeter edges (consecutive polygon vertices)
        for (let i = 0; i < sides; i++) {
          edges.push({ f: ni[i], t: ni[(i + 1) % sides], op: 1.0 });
        }

        // Star pattern (hex: every-2 diagonal, pent: pentagram)
        if (sides === 6) {
          for (let i = 0; i < 6; i++)
            edges.push({ f: ni[i], t: ni[(i + 2) % 6], op: 0.15 });
        } else if (sides === 5) {
          for (let i = 0; i < 5; i++)
            edges.push({ f: ni[i], t: ni[(i + 2) % 5], op: 0.15 });
        }

        // Inter-layer connections (each vertex to nearest in next inner layer)
        if (l < layers.length - 1) {
          const inner = plNi[p][l + 1];
          for (let i = 0; i < ni.length; i++) {
            const outerPos = nodes[ni[i]].lp;
            let bj = 0, bd = Infinity;
            for (let j = 0; j < inner.length; j++) {
              const d = outerPos.distanceTo(nodes[inner[j]].lp);
              if (d < bd) { bd = d; bj = j; }
            }
            edges.push({ f: ni[i], t: inner[bj], op: 0.7 });
          }
        }
      }

      // Core radials: innermost layer to origin
      const innermost = plNi[p][layers.length - 1];
      for (const idx of innermost) {
        edges.push({ f: idx, t: oIdx, op: 0.1 });
      }
    }

    return { nodes, edges, oIdx };
  }, [numLayers, outerRadius, freeNodeRatio, isMobile]);

  const totalN = networkData.nodes.length;
  const totalE = networkData.edges.length;

  // Pre-allocate line buffers (recreated only when edge count changes)
  const lineBufs = useMemo(() => ({
    pos: new Float32Array(totalE * 6),
    dist: new Float32Array(totalE * 2),
    op: new Float32Array(totalE * 2),
  }), [totalE]);

  // Working refs for per-frame computation
  const wpRef = useRef(new Float32Array(0));
  const fpRef = useRef(new Float32Array(0));
  const angRef = useRef([0, 0, 0]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tq = useMemo(() => new THREE.Quaternion(), []);
  const tv = useMemo(() => new THREE.Vector3(), []);

  // ---- Line shader: traveling pulse + proximity glow ----
  const lineShader = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: currentColor.current },
      uTime: { value: 0 },
      uPulseSpeed: { value: 2.0 },
      uCameraPos: { value: new THREE.Vector3() },
      uGlobalOp: { value: 1.0 },
    },
    vertexShader: `
      precision highp float;
      attribute float aOp;
      attribute float aDist;
      uniform float uTime;
      uniform float uPulseSpeed;
      uniform vec3 uCameraPos;
      uniform float uGlobalOp;
      varying float vAlpha;

      void main() {
        // Traveling neural impulse wave expanding from center
        float wave = sin(uTime * uPulseSpeed - aDist * 4.5);
        float pulse = pow(clamp(wave, 0.0, 1.0), 2.5);

        vec4 wPos = modelMatrix * vec4(position, 1.0);
        float dCam = length(wPos.xyz - uCameraPos);

        // Proximity glow: brighter when camera is close
        float proxBoost = 1.0 + clamp((2.5 - dCam) / 1.6, 0.0, 2.0);
        // Distance fade: smooth falloff when far
        float dFade = clamp((12.0 - dCam) / 8.0, 0.2, 1.0);

        vAlpha = (0.25 + pulse * 0.75) * aOp * proxBoost * dFade * uGlobalOp;
        gl_Position = projectionMatrix * viewMatrix * wPos;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        gl_FragColor = vec4(uColor, vAlpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  // ---- Per-frame animation ----
  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    currentColor.current.lerp(
      new THREE.Color(customNetworkColor || theme.networkColor),
      delta * 4
    );

    // Resize working arrays when Leva params change geometry
    if (wpRef.current.length !== totalN * 3) {
      wpRef.current = new Float32Array(totalN * 3);
      fpRef.current = new Float32Array(totalN).fill(1.0);
    }

    const sM = (status === 'thinking' ? 3.0 : 1.0) * (isHovered ? 0.4 : 1.0);
    const hC = isHovered ? 0.92 : 1.0; // Hover contraction

    // Accumulate plane rotation angles
    for (let p = 0; p < 3; p++) {
      angRef.current[p] += delta * rotationSpeed * PLANE_SPIN[p].sMult * sM;
    }

    // ---- Free-node behavior per status ----
    let pMin: number, pMax: number, wS: number;
    switch (status) {
      case 'thinking':
        pMin = 0.3; pMax = 0.9; wS = 2.5;
        break;
      case 'responding':
        pMin = 1.0; pMax = 1.0; wS = 0.0;
        break;
      case 'error': {
        const ep = (time * 2.5) % (Math.PI * 2);
        const eP = ep > Math.PI ? (ep - Math.PI) / Math.PI : 0.0;
        pMin = eP * 0.7; pMax = eP; wS = 3.0 * (1 - eP);
        break;
      }
      default: // idle
        pMin = 0.7; pMax = 1.0; wS = 1.0;
    }

    const { nodes, edges, oIdx } = networkData;
    const wp = wpRef.current;
    const fp = fpRef.current;

    // ---- Compute world positions for all nodes ----
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];

      // Origin node stays at center
      if (i === oIdx) {
        wp[i * 3] = 0; wp[i * 3 + 1] = 0; wp[i * 3 + 2] = 0;
        continue;
      }

      // Apply per-plane dynamic rotation
      tv.copy(n.lp);
      tq.setFromAxisAngle(PLANE_SPIN[n.pIdx].axis, angRef.current[n.pIdx]);
      tv.applyQuaternion(tq);
      tv.multiplyScalar(hC); // Hover contraction

      if (n.free) {
        // Animate free node progress (breathing oscillation)
        const tgt = pMin + (pMax - pMin) * (Math.sin(time * 0.8 + n.wPh) * 0.5 + 0.5);
        fp[i] += (tgt - fp[i]) * delta * 3.0;

        // Wander offset (stronger when progress is low)
        const amp = n.wAmp * wS * (1.0 - fp[i]);
        wp[i * 3]     = tv.x + Math.sin(time * 0.7 + n.wPh) * amp;
        wp[i * 3 + 1] = tv.y + Math.cos(time * 0.5 + n.wPh * 1.3) * amp;
        wp[i * 3 + 2] = tv.z + Math.sin(time * 0.6 + n.wPh * 0.7) * amp;
      } else {
        wp[i * 3] = tv.x; wp[i * 3 + 1] = tv.y; wp[i * 3 + 2] = tv.z;
      }
    }

    // Camera distance for sizeAttenuation clamp (prevents giant balls on zoom)
    const camDist = camera.position.length();
    const sizeClamp = Math.min(1.0, camDist / 1.5);

    // ---- Update InstancedMesh (nodes) ----
    if (nodesRef.current) {
      for (let i = 0; i < nodes.length; i++) {
        // Hide origin node (scale 0)
        if (i === oIdx) {
          dummy.scale.set(0, 0, 0);
          dummy.position.set(0, 0, 0);
          dummy.updateMatrix();
          nodesRef.current.setMatrixAt(i, dummy.matrix);
          continue;
        }

        dummy.position.set(wp[i * 3], wp[i * 3 + 1], wp[i * 3 + 2]);
        const pulse = 1.0 + Math.sin(time * 3 + i * 0.5) * 0.12;
        const s = nodeSize * pulse * introProgress * sizeClamp;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        nodesRef.current.setMatrixAt(i, dummy.matrix);
      }
      nodesRef.current.instanceMatrix.needsUpdate = true;

      const mat = nodesRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.color.copy(currentColor.current);
        mat.opacity = 0.9 * introProgress;
      }
    }

    // ---- Update LineSegments buffer ----
    if (linesRef.current) {
      const pb = lineBufs.pos;
      const db = lineBufs.dist;
      const ob = lineBufs.op;

      for (let e = 0; e < edges.length; e++) {
        const { f: fi, t: ti, op: baseOp } = edges[e];
        const o = e * 6;

        // Positions
        pb[o]     = wp[fi * 3];     pb[o + 1] = wp[fi * 3 + 1]; pb[o + 2] = wp[fi * 3 + 2];
        pb[o + 3] = wp[ti * 3];     pb[o + 4] = wp[ti * 3 + 1]; pb[o + 5] = wp[ti * 3 + 2];

        // Distance from center (for pulse wave propagation)
        const dF = Math.sqrt(
          wp[fi * 3] * wp[fi * 3] +
          wp[fi * 3 + 1] * wp[fi * 3 + 1] +
          wp[fi * 3 + 2] * wp[fi * 3 + 2]
        );
        const dT = Math.sqrt(
          wp[ti * 3] * wp[ti * 3] +
          wp[ti * 3 + 1] * wp[ti * 3 + 1] +
          wp[ti * 3 + 2] * wp[ti * 3 + 2]
        );
        db[e * 2] = dF; db[e * 2 + 1] = dT;

        // Opacity: dim edges connected to wandering free nodes
        let oM = baseOp;
        if (nodes[fi].free) oM *= (0.3 + 0.7 * fp[fi]);
        if (nodes[ti].free) oM *= (0.3 + 0.7 * fp[ti]);
        ob[e * 2] = oM; ob[e * 2 + 1] = oM;
      }

      const geom = linesRef.current.geometry;
      (geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (geom.attributes.aDist as THREE.BufferAttribute).needsUpdate = true;
      (geom.attributes.aOp as THREE.BufferAttribute).needsUpdate = true;
    }

    // ---- Line shader uniforms ----
    const ps = status === 'thinking' ? 4.5 : status === 'responding' ? 3.0 : 1.6;
    lineShader.uniforms.uColor.value.copy(currentColor.current);
    lineShader.uniforms.uTime.value = time;
    lineShader.uniforms.uPulseSpeed.value = ps;
    lineShader.uniforms.uGlobalOp.value = lineBrightness * introProgress;
    lineShader.uniforms.uCameraPos.value.copy(camera.position);

    // ---- Icosahedron outer frame ----
    if (icoRef.current) {
      icoRef.current.rotation.y -= delta * 0.04;
      icoRef.current.rotation.x += delta * 0.02;
      const icoMat = icoRef.current.material as THREE.LineBasicMaterial;
      if (icoMat) {
        icoMat.color.copy(currentColor.current);
        icoMat.opacity = (0.35 + (Math.sin(time * 1.5) + 1) * 0.06) * introProgress;
      }
    }

    // ---- Error state: deterministic jitter ----
    if (groupRef.current) {
      if (status === 'error') {
        groupRef.current.position.x = Math.sin(time * 47.3) * 0.04;
        groupRef.current.position.y = Math.cos(time * 53.7) * 0.04;
      } else {
        groupRef.current.position.set(0, 0, 0);
      }
    }
  });

  return (
    <group ref={groupRef} renderOrder={2}>
      {/* Outer structural icosahedron wireframe */}
      <lineSegments ref={icoRef} scale={2.15}>
        <icosahedronGeometry args={[1, 0]} />
        <lineBasicMaterial
          color={currentColor.current}
          transparent
          opacity={0.4 * introProgress}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* Concentric polygon network: luminous lines with traveling pulses */}
      <lineSegments key={`l-${totalE}`} ref={linesRef} material={lineShader}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[lineBufs.pos, 3]} />
          <bufferAttribute attach="attributes-aOp" args={[lineBufs.op, 1]} />
          <bufferAttribute attach="attributes-aDist" args={[lineBufs.dist, 1]} />
        </bufferGeometry>
      </lineSegments>

      {/* Small luminous node instances */}
      <instancedMesh
        key={`n-${totalN}`}
        ref={nodesRef}
        args={[undefined, undefined, totalN]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color={currentColor.current}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
};
