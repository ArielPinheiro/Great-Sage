import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CONSCIOUSNESS_THEMES, deriveThemeColors } from './types';
import type { SageStatus } from './types';

// Deterministic pseudo-random helper (avoids Math.random in useMemo)
function srand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Generate regular polygon vertices in 2D plane (XY)
function regularPolyVerts(sides: number, radius: number, phase: number): THREE.Vector3[] {
  const verts: THREE.Vector3[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides + phase;
    verts.push(new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), 0));
  }
  return verts;
}

// Distinct gyroscopic tilt configurations per layer (20 to 35 degrees relative inclination)
// Ensures true 3D volumetric gyroscopic appearance from all angles (including side view)
// without layers ever intersecting or obstructing inter-layer corridors
const LAYER_ORIENTATIONS = [
  // Layer 0 (r ~ 1.40): slight initial orientation
  { tiltEuler: new THREE.Euler(0.08, 0.05, 0.0), spinAxis: new THREE.Vector3(0, 1, 0.1).normalize(), spinSpeed: 0.036 },
  // Layer 1 (r ~ 2.30): ~24 deg tilt on tilted axis
  { tiltEuler: new THREE.Euler(0.38, 0.15, -0.22), spinAxis: new THREE.Vector3(0.3, 1, 0.2).normalize(), spinSpeed: -0.028 },
  // Layer 2 (r ~ 3.20): ~30 deg tilt on counter axis
  { tiltEuler: new THREE.Euler(-0.35, 0.32, 0.28), spinAxis: new THREE.Vector3(1, 0.2, 0.35).normalize(), spinSpeed: 0.031 },
  // Layer 3 (r ~ 4.10): ~26 deg tilt on compound axis
  { tiltEuler: new THREE.Euler(0.25, -0.38, 0.22), spinAxis: new THREE.Vector3(-0.2, 0.4, 1).normalize(), spinSpeed: -0.025 },
  // Layer 4 (extra, r ~ 4.6): ~32 deg tilt
  { tiltEuler: new THREE.Euler(-0.45, -0.20, 0.30), spinAxis: new THREE.Vector3(0.5, 0.8, -0.3).normalize(), spinSpeed: 0.026 },
  // Layer 5 (extra, r ~ 5.0): ~22 deg tilt
  { tiltEuler: new THREE.Euler(0.30, 0.40, -0.15), spinAxis: new THREE.Vector3(-0.4, 1, 0.2).normalize(), spinSpeed: -0.024 },
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
  outerRadius = 4.10,
  rotationSpeed = 0.05,
  nodeSize = 0.024,
  lineBrightness = 0.9,
  freeNodeRatio = 0.25,
  customNetworkColor,
}) => {
  const nodesRef = useRef<THREE.InstancedMesh>(null);
  const halosRef = useRef<THREE.InstancedMesh>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const icoRef = useRef<THREE.LineSegments>(null);
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  const theme = CONSCIOUSNESS_THEMES[status];

  // Dynamic color derivation
  const currentStructureColor = useRef(new THREE.Color());
  const currentAccentColor = useRef(new THREE.Color());

  // Accumulator for per-layer spin angles
  const layerSpinAngles = useRef<number[]>([0, 0, 0, 0, 0, 0]);

  // ---- Geometric computation for nested alternating polygons ----
  const networkData = useMemo(() => {
    const layerCount = Math.max(4, Math.min(6, isMobile ? Math.min(numLayers, 4) : numLayers));
    const rMin = 1.40; // Clear wide berth around core (radius 0.45 - 0.90)
    const rMax = Math.max(3.8, outerRadius);

    // Radii separated evenly (e.g. 1.40, 2.30, 3.20, 4.10 for 4 layers, ~0.90 corridor between each)
    const layerConfigs = Array.from({ length: layerCount }, (_, idx) => {
      const frac = idx / (layerCount - 1);
      const radius = rMin + (rMax - rMin) * frac;
      const sides = idx % 2 === 0 ? 6 : 5; // Alternating 6 (hexagon) and 5 (pentagon)
      const phase = (idx * Math.PI) / 3.8;
      const orientation = LAYER_ORIENTATIONS[idx % LAYER_ORIENTATIONS.length];
      return { sides, radius, phase, orientation };
    });

    // Anchored polygon vertices
    const anchoredNodes: {
      layerIdx: number;
      localPos: THREE.Vector3;
      hasFreeNode: boolean;
      freeSeed: number;
    }[] = [];

    // Indices map: [layer] -> array of global node indices
    const layerNodeIndices: number[][] = [];

    layerConfigs.forEach((layer, lIdx) => {
      const q = new THREE.Quaternion().setFromEuler(layer.orientation.tiltEuler);
      const verts2D = regularPolyVerts(layer.sides, layer.radius, layer.phase);

      const nodeIndices: number[] = [];
      verts2D.forEach((v, vIdx) => {
        v.applyQuaternion(q);
        const globalIdx = anchoredNodes.length;
        nodeIndices.push(globalIdx);

        const seed = lIdx * 100 + vIdx;
        const isFree = srand(seed) < freeNodeRatio;

        anchoredNodes.push({
          layerIdx: lIdx,
          localPos: v.clone(),
          hasFreeNode: isFree,
          freeSeed: seed,
        });
      });

      layerNodeIndices.push(nodeIndices);
    });

    // Free tethered nodes entries
    const freeNodeEntries: {
      parentAnchorIdx: number;
      layerIdx: number;
      seed: number;
      wPh: number;
      wAmp: number;
    }[] = [];

    anchoredNodes.forEach((node, aIdx) => {
      if (node.hasFreeNode) {
        freeNodeEntries.push({
          parentAnchorIdx: aIdx,
          layerIdx: node.layerIdx,
          seed: node.freeSeed,
          wPh: srand(node.freeSeed + 30) * Math.PI * 2,
          wAmp: 0.16 + srand(node.freeSeed + 60) * 0.18,
        });
      }
    });

    const totalNodesCount = anchoredNodes.length + freeNodeEntries.length;

    // ---- Build clean edge list ----
    const edges: {
      fromAnchor: number;
      toAnchor: number;
      isFreeTether?: boolean;
      freeEntryIdx?: number;
      baseOpacity: number;
    }[] = [];

    // 1. Polygon perimeter and star diagonals
    layerConfigs.forEach((layer, lIdx) => {
      const ni = layerNodeIndices[lIdx];
      const sides = layer.sides;

      // Primary perimeter edges: prominent and crisp (opacity 0.95)
      for (let i = 0; i < sides; i++) {
        edges.push({
          fromAnchor: ni[i],
          toAnchor: ni[(i + 1) % sides],
          baseOpacity: 0.95,
        });
      }

      // Star diagonals ONLY on alternating layers (layers 1 and 3) to prevent dense central webbing
      // Opacity subtle: 0.12
      const hasStarDiagonals = lIdx % 2 === 1;
      if (hasStarDiagonals) {
        if (sides === 6) {
          for (let i = 0; i < 6; i++) {
            edges.push({
              fromAnchor: ni[i],
              toAnchor: ni[(i + 2) % 6],
              baseOpacity: 0.12,
            });
          }
        } else if (sides === 5) {
          for (let i = 0; i < 5; i++) {
            edges.push({
              fromAnchor: ni[i],
              toAnchor: ni[(i + 2) % 5],
              baseOpacity: 0.12,
            });
          }
        }
      }

      // Inter-layer connections: fine, discrete radial bridges (opacity 0.32)
      if (lIdx < layerConfigs.length - 1) {
        const innerIndices = layerNodeIndices[lIdx + 1];
        for (let i = 0; i < ni.length; i++) {
          const outerPos = anchoredNodes[ni[i]].localPos;
          let bestInner = innerIndices[0];
          let bestDist = Infinity;

          for (let j = 0; j < innerIndices.length; j++) {
            const d = outerPos.distanceTo(anchoredNodes[innerIndices[j]].localPos);
            if (d < bestDist) {
              bestDist = d;
              bestInner = innerIndices[j];
            }
          }

          edges.push({
            fromAnchor: ni[i],
            toAnchor: bestInner,
            baseOpacity: 0.32,
          });
        }
      }
    });

    // 2. Free node dynamic tethers: NO free node ever floats alone
    freeNodeEntries.forEach((free, fIdx) => {
      edges.push({
        fromAnchor: free.parentAnchorIdx,
        toAnchor: free.parentAnchorIdx,
        isFreeTether: true,
        freeEntryIdx: fIdx,
        baseOpacity: 0.40,
      });
    });

    return {
      layerConfigs,
      anchoredNodes,
      freeNodeEntries,
      totalNodesCount,
      edges,
    };
  }, [numLayers, outerRadius, freeNodeRatio, isMobile]);

  const { layerConfigs, anchoredNodes, freeNodeEntries, totalNodesCount, edges } = networkData;

  const totalEdgesCount = edges.length;
  const lineBuffers = useMemo(() => {
    return {
      position: new Float32Array(totalEdgesCount * 6),
      dist: new Float32Array(totalEdgesCount * 2),
      opacity: new Float32Array(totalEdgesCount * 2),
    };
  }, [totalEdgesCount]);

  const anchorWorldPositions = useRef(new Float32Array(anchoredNodes.length * 3));
  const freeWorldPositions = useRef(new Float32Array(freeNodeEntries.length * 3));
  const freeNodeProgress = useRef(new Float32Array(freeNodeEntries.length).fill(1.0));

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempVec = useMemo(() => new THREE.Vector3(), []);
  const tempQuat = useMemo(() => new THREE.Quaternion(), []);

  // Custom Shader for Lines with Traveling Neural Impulse
  const lineShader = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uStructureColor: { value: new THREE.Color() },
        uAccentColor: { value: new THREE.Color() },
        uTime: { value: 0 },
        uPulseSpeed: { value: 2.0 },
        uGlobalOp: { value: 1.0 },
      },
      vertexShader: `
        precision highp float;
        attribute float aOp;
        attribute float aDist;
        varying float vOp;
        varying float vDist;

        void main() {
          vOp = aOp;
          vDist = aDist;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform vec3 uStructureColor;
        uniform vec3 uAccentColor;
        uniform float uTime;
        uniform float uPulseSpeed;
        uniform float uGlobalOp;
        varying float vOp;
        varying float vDist;

        void main() {
          // Traveling neural impulse wave from center outwards
          float wave = sin(uTime * uPulseSpeed - vDist * 2.2);
          float pulse = pow(clamp(wave, 0.0, 1.0), 3.2);

          // Base structure: pure theme color, strictly under 0.80 luminance (no white blowout)
          vec3 baseColor = uStructureColor * 0.75;
          // Peak impulse: accent color slightly exceeding 0.90 for controlled glow
          vec3 peakColor = uAccentColor * 1.15;

          vec3 finalColor = mix(baseColor, peakColor, pulse);
          float alpha = vOp * (0.45 + 0.55 * pulse) * uGlobalOp;

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  // Soft Radial Halo Shader for Node Halos
  const haloShader = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color() },
        uOpacity: { value: 0.28 },
      },
      vertexShader: `
        precision highp float;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vUv;

        void main() {
          float d = length(vUv - vec2(0.5));
          if (d > 0.5) discard;
          float falloff = smoothstep(0.5, 0.0, d);
          falloff = pow(falloff, 2.0);
          gl_FragColor = vec4(uColor, falloff * uOpacity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, []);

  const nodeMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
  }, []);

  const icoMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: '#3b82f6',
      transparent: true,
      opacity: 0.09,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  // Per-Frame Animation
  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    const baseColor = new THREE.Color(customNetworkColor || theme.networkColor);
    const { structure, accent } = deriveThemeColors(baseColor);

    currentStructureColor.current.lerp(structure, delta * 4);
    currentAccentColor.current.lerp(accent, delta * 4);

    const speedMult = (status === 'thinking' ? 2.5 : 1.0) * (isHovered ? 0.4 : 1.0);
    const hoverScale = isHovered ? 0.95 : 1.0;

    // Accumulate per-layer independent gyroscopic spin
    layerConfigs.forEach((layer, lIdx) => {
      layerSpinAngles.current[lIdx] += delta * rotationSpeed * layer.orientation.spinSpeed * 22 * speedMult;
    });

    // 1. Compute anchored polygon vertex world positions
    const aWp = anchorWorldPositions.current;
    if (aWp.length !== anchoredNodes.length * 3) {
      anchorWorldPositions.current = new Float32Array(anchoredNodes.length * 3);
    }
    const currentAwp = anchorWorldPositions.current;

    for (let i = 0; i < anchoredNodes.length; i++) {
      const node = anchoredNodes[i];
      tempVec.copy(node.localPos);

      // Rotate along per-layer spin axis
      const orientation = layerConfigs[node.layerIdx].orientation;
      tempQuat.setFromAxisAngle(orientation.spinAxis, layerSpinAngles.current[node.layerIdx]);
      tempVec.applyQuaternion(tempQuat);
      tempVec.multiplyScalar(hoverScale);

      currentAwp[i * 3] = tempVec.x;
      currentAwp[i * 3 + 1] = tempVec.y;
      currentAwp[i * 3 + 2] = tempVec.z;
    }

    // 2. Compute tethered free node positions
    const fWp = freeWorldPositions.current;
    if (fWp.length !== freeNodeEntries.length * 3) {
      freeWorldPositions.current = new Float32Array(freeNodeEntries.length * 3);
      freeNodeProgress.current = new Float32Array(freeNodeEntries.length).fill(1.0);
    }
    const currentFwp = freeWorldPositions.current;
    const progress = freeNodeProgress.current;

    let pMin = 0.7;
    let pMax = 1.0;
    let wanderSpeed = 1.0;
    if (status === 'thinking') {
      pMin = 0.35;
      pMax = 0.85;
      wanderSpeed = 2.4;
    } else if (status === 'responding') {
      pMin = 0.95;
      pMax = 1.0;
      wanderSpeed = 0.4;
    } else if (status === 'error') {
      pMin = 0.2;
      pMax = 0.6;
      wanderSpeed = 3.2;
    }

    for (let j = 0; j < freeNodeEntries.length; j++) {
      const free = freeNodeEntries[j];
      const parentIdx = free.parentAnchorIdx;
      const px = currentAwp[parentIdx * 3];
      const py = currentAwp[parentIdx * 3 + 1];
      const pz = currentAwp[parentIdx * 3 + 2];

      const target = pMin + (pMax - pMin) * (Math.sin(time * 0.9 + free.wPh) * 0.5 + 0.5);
      progress[j] += (target - progress[j]) * delta * 2.8;

      const displacement = free.wAmp * wanderSpeed * (1.0 - progress[j]);
      currentFwp[j * 3] = px + Math.sin(time * 0.8 + free.wPh) * displacement;
      currentFwp[j * 3 + 1] = py + Math.cos(time * 0.6 + free.wPh * 1.2) * displacement;
      currentFwp[j * 3 + 2] = pz + Math.sin(time * 0.7 + free.wPh * 0.8) * displacement;
    }

    // 3. Update Instanced Nodes and Halos (with screen size limit clamp)
    const camDist = camera.position.length();
    // Clamp prevents nodes from blowing up into oversized balls when camera is close
    const sizeClamp = Math.min(1.0, Math.max(0.25, camDist / 16.0));

    if (nodesRef.current && halosRef.current) {
      let instIdx = 0;

      // Anchored nodes
      for (let i = 0; i < anchoredNodes.length; i++) {
        dummy.position.set(currentAwp[i * 3], currentAwp[i * 3 + 1], currentAwp[i * 3 + 2]);
        const pulse = 1.0 + Math.sin(time * 3.5 + i * 0.4) * 0.12;
        const s = nodeSize * pulse * introProgress * sizeClamp;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        nodesRef.current.setMatrixAt(instIdx, dummy.matrix);

        // Tiny additive halo (1.8x scale)
        const hs = s * 1.8;
        dummy.scale.set(hs, hs, hs);
        dummy.updateMatrix();
        halosRef.current.setMatrixAt(instIdx, dummy.matrix);

        instIdx++;
      }

      // Free tethered nodes
      for (let j = 0; j < freeNodeEntries.length; j++) {
        dummy.position.set(currentFwp[j * 3], currentFwp[j * 3 + 1], currentFwp[j * 3 + 2]);
        const pulse = 1.0 + Math.sin(time * 4.0 + j * 0.5) * 0.15;
        const s = nodeSize * 0.9 * pulse * introProgress * sizeClamp;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        nodesRef.current.setMatrixAt(instIdx, dummy.matrix);

        const hs = s * 1.8;
        dummy.scale.set(hs, hs, hs);
        dummy.updateMatrix();
        halosRef.current.setMatrixAt(instIdx, dummy.matrix);

        instIdx++;
      }

      nodesRef.current.instanceMatrix.needsUpdate = true;
      halosRef.current.instanceMatrix.needsUpdate = true;

      // Nodes slightly above bloom threshold (1.08) for crisp luminous glow
      nodeMaterial.color.copy(currentAccentColor.current).multiplyScalar(1.08);
      nodeMaterial.opacity = 0.95 * introProgress;

      // Halos: delicate additive aura
      haloShader.uniforms.uColor.value.copy(currentAccentColor.current);
      haloShader.uniforms.uOpacity.value = 0.28 * introProgress;
    }

    // 4. Update LineSegments Buffers
    if (linesRef.current) {
      const pb = lineBuffers.position;
      const db = lineBuffers.dist;
      const ob = lineBuffers.opacity;

      for (let e = 0; e < edges.length; e++) {
        const edge = edges[e];
        const offset = e * 6;

        let fx = 0, fy = 0, fz = 0;
        let tx = 0, ty = 0, tz = 0;

        if (edge.isFreeTether && edge.freeEntryIdx !== undefined) {
          const pIdx = edge.fromAnchor;
          const fIdx = edge.freeEntryIdx;
          fx = currentAwp[pIdx * 3];
          fy = currentAwp[pIdx * 3 + 1];
          fz = currentAwp[pIdx * 3 + 2];
          tx = currentFwp[fIdx * 3];
          ty = currentFwp[fIdx * 3 + 1];
          tz = currentFwp[fIdx * 3 + 2];
        } else {
          const f = edge.fromAnchor;
          const t = edge.toAnchor;
          fx = currentAwp[f * 3];
          fy = currentAwp[f * 3 + 1];
          fz = currentAwp[f * 3 + 2];
          tx = currentAwp[t * 3];
          ty = currentAwp[t * 3 + 1];
          tz = currentAwp[t * 3 + 2];
        }

        pb[offset] = fx;
        pb[offset + 1] = fy;
        pb[offset + 2] = fz;
        pb[offset + 3] = tx;
        pb[offset + 4] = ty;
        pb[offset + 5] = tz;

        const dF = Math.sqrt(fx * fx + fy * fy + fz * fz);
        const dT = Math.sqrt(tx * tx + ty * ty + tz * tz);
        db[e * 2] = dF;
        db[e * 2 + 1] = dT;

        ob[e * 2] = edge.baseOpacity;
        ob[e * 2 + 1] = edge.baseOpacity;
      }

      const geom = linesRef.current.geometry;
      (geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (geom.attributes.aDist as THREE.BufferAttribute).needsUpdate = true;
      (geom.attributes.aOp as THREE.BufferAttribute).needsUpdate = true;
    }

    // Line shader uniforms
    const pulseSpeed = status === 'thinking' ? 4.2 : status === 'responding' ? 3.0 : 1.8;
    lineShader.uniforms.uStructureColor.value.copy(currentStructureColor.current);
    lineShader.uniforms.uAccentColor.value.copy(currentAccentColor.current);
    lineShader.uniforms.uTime.value = time;
    lineShader.uniforms.uPulseSpeed.value = pulseSpeed;
    lineShader.uniforms.uGlobalOp.value = lineBrightness * introProgress;

    // 5. Outer Icosahedron Frame: Radius 5.5 (inradius ~4.156 > 4.10, completely encloses structure)
    // Low opacity 0.09, perfectly centered at [0, 0, 0]
    if (icoRef.current) {
      icoRef.current.rotation.y -= delta * 0.02;
      icoRef.current.rotation.x += delta * 0.012;
      icoMaterial.color.copy(currentStructureColor.current).multiplyScalar(0.7);
      icoMaterial.opacity = 0.09 * introProgress;
    }

    // Group-level jitter on error status
    if (groupRef.current) {
      if (status === 'error') {
        groupRef.current.position.x = Math.sin(time * 43.0) * 0.035;
        groupRef.current.position.y = Math.cos(time * 47.0) * 0.035;
      } else {
        groupRef.current.position.set(0, 0, 0);
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]} renderOrder={2}>
      {/* Outer subtle icosahedron frame: radius 5.5 completely wraps outside the 4.10 outer polygon layer */}
      <lineSegments ref={icoRef} scale={5.5} material={icoMaterial}>
        <icosahedronGeometry args={[1, 0]} />
      </lineSegments>

      {/* Concentric nested polygons with traveling neural pulses */}
      <lineSegments key={`lines-${totalEdgesCount}`} ref={linesRef} material={lineShader}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[lineBuffers.position, 3]} />
          <bufferAttribute attach="attributes-aOp" args={[lineBuffers.opacity, 1]} />
          <bufferAttribute attach="attributes-aDist" args={[lineBuffers.dist, 1]} />
        </bufferGeometry>
      </lineSegments>

      {/* Discrete crisp node spheres */}
      <instancedMesh
        key={`nodes-${totalNodesCount}`}
        ref={nodesRef}
        args={[undefined, undefined, totalNodesCount]}
        material={nodeMaterial}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 8]} />
      </instancedMesh>

      {/* Subtle additive halos around every node */}
      <instancedMesh
        key={`halos-${totalNodesCount}`}
        ref={halosRef}
        args={[undefined, undefined, totalNodesCount]}
        material={haloShader}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
      </instancedMesh>
    </group>
  );
};
