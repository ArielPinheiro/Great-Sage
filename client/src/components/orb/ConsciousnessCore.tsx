import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
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

// 3D Simplex noise implementation for isotropic organic plasma (no angular sine/symmetry)
const simplexNoiseGLSL = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

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
  const coreSphereRef = useRef<THREE.Mesh>(null);
  const outerHaloRef = useRef<THREE.Mesh>(null);
  const raysGroupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  const theme = CONSCIOUSNESS_THEMES[status];
  const currentThemeColor = useRef(new THREE.Color(customHaloColor || theme.haloColor));

  // 1. Core Sphere Material: 3D Sphere with inverse Fresnel + 3D Simplex FBM noise
  // Guarantees 100% circular silhouette from EVERY angle with smooth zero-edge falloff
  const coreSphereMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: currentThemeColor.current },
        uIntensity: { value: 1.8 },
        uHeartbeat: { value: 0.0 },
        uCamDist: { value: 16.0 },
        uRadius: { value: 0.55 },
      },
      vertexShader: `
        precision highp float;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vViewPosition;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPos.xyz;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uHeartbeat;
        uniform float uCamDist;
        uniform float uRadius;

        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vViewPosition;

        ${simplexNoiseGLSL}

        void main() {
          vec3 viewDir = normalize(vViewPosition);
          vec3 norm = normalize(vNormal);
          float NdotV = clamp(dot(norm, viewDir), 0.0, 1.0);

          // 3D Simplex noise based on 3D coordinates (zero angular symmetry!)
          vec3 noiseCoord = vPosition * 3.2 + vec3(0.0, uTime * 0.4, uTime * 0.25);
          float n1 = snoise(noiseCoord);
          float n2 = snoise(noiseCoord * 2.2 - vec3(uTime * 0.2));
          float fbm = n1 * 0.65 + n2 * 0.35; // [-1.0, 1.0]

          // Distance from camera to sphere surface: prevents camera from being submerged in blinding glow
          float distToSurface = max(0.0, uCamDist - uRadius);
          float proxFade = smoothstep(0.2, 1.0, distToSurface);

          // Smooth edge falloff reaching EXACT zero at silhouette (no hard cutoff edge)
          float edgeFalloff = smoothstep(0.0, 0.32, NdotV);

          // Center hot spot (NdotV -> 1.0) with emission exceeding bloom threshold (> 1.0)
          float centerHot = pow(NdotV, 2.5) * (0.85 + 0.15 * fbm);
          float midBody = pow(NdotV, 1.2);

          vec3 warmWhite = vec3(1.0, 0.98, 0.95);
          vec3 lightTheme = mix(uColor, vec3(1.0), 0.55);

          vec3 col = centerHot * warmWhite * 2.5 * uIntensity
                   + midBody * lightTheme * 1.1;

          float alpha = edgeFalloff * (0.85 + 0.15 * centerHot) * proxFade * (1.0 + uHeartbeat);

          gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
  }, []);

  // 2. Wide, soft, low-intensity outer halo billboard (pure Euclidean radius with zero angular symmetry)
  const outerHaloMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: currentThemeColor.current },
        uCamDist: { value: 16.0 },
        uOpacity: { value: 0.32 },
      },
      vertexShader: `
        precision highp float;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform vec3 uColor;
        uniform float uCamDist;
        uniform float uOpacity;
        varying vec2 vUv;

        void main() {
          // Pure Euclidean distance from center (strictly circular)
          vec2 p = (vUv - vec2(0.5)) * 2.0;
          float r = length(p);
          if (r >= 1.0) discard;

          // Zero-boundary cut before quad boundary (smoothstep(0.95, 0.45, r))
          float boundaryMask = smoothstep(0.95, 0.45, r);

          // Proximity fade: disappears as camera zooms close
          float proxFade = smoothstep(1.5, 4.5, uCamDist);

          // Exponential soft falloff (low intensity, purely diffuse glow)
          float decay = exp(-r * 3.2);

          vec3 haloCol = mix(uColor, vec3(1.0), 0.25);
          float alpha = decay * boundaryMask * uOpacity * proxFade;

          gl_FragColor = vec4(haloCol * 0.85, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
  }, []);

  // 3. 14 Thin 3D Rays: Isotropic 3D distribution, increased length (up to 2.6) and high contrast (0.28 to 0.35)
  const rays = useMemo(() => {
    const count = 14;
    const rayList: { rot: THREE.Euler; len: number }[] = [];
    const phi = Math.PI * (3.0 - Math.sqrt(5.0)); // Golden angle

    for (let i = 0; i < count; i++) {
      const y = 1.0 - (i / (count - 1)) * 2.0; // [-1, 1]
      const radiusAtY = Math.sqrt(Math.max(0.0, 1.0 - y * y));
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

      // Increased length up to 2.6
      const len = 1.6 + ((i * 5) % 7) * 0.16; // 1.6 to 2.56
      rayList.push({ rot, len });
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
        uniform float uThemeColor;
        uniform float uOpacity;
        varying float vY;

        void main() {
          float normY = clamp(vY + 0.5, 0.0, 1.0);
          vec3 col = mix(uColor, uThemeColor, pow(normY, 0.4));
          // Higher contrast opacity (0.28 - 0.35)
          float alpha = pow(clamp(1.0 - normY, 0.0, 1.0), 1.5) * uOpacity;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
  }, []);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    currentThemeColor.current.lerp(
      new THREE.Color(customHaloColor || theme.haloColor),
      delta * 4
    );

    const camDist = camera.position.length();
    const speed = theme.pulseSpeed * 0.75 * (isHovered ? 1.35 : 1.0);
    const pulseHarmonic = Math.sin(time * speed * 2.0) * 0.5 + 0.5;
    const heartRhythm = Math.pow(pulseHarmonic, 2.2) * 0.08;
    const hoverScale = isHovered ? 1.06 : 1.0;

    // Point Light
    if (pointLightRef.current) {
      const base = theme.coreIntensity * 0.65 * intensityMultiplier * introProgress;
      pointLightRef.current.intensity = base + heartRhythm * 0.5;
      pointLightRef.current.color.copy(currentThemeColor.current);
    }

    // 3D Core Sphere
    if (coreSphereRef.current && showCoreSphere) {
      coreSphereMaterial.uniforms.uTime.value = time;
      coreSphereMaterial.uniforms.uColor.value.copy(currentThemeColor.current);
      coreSphereMaterial.uniforms.uIntensity.value = (1.5 + heartRhythm * 0.35) * intensityMultiplier;
      coreSphereMaterial.uniforms.uHeartbeat.value = heartRhythm;
      coreSphereMaterial.uniforms.uCamDist.value = camDist;

      const s = (0.55 + heartRhythm * 0.02) * hoverScale * introProgress;
      coreSphereRef.current.scale.set(s, s, s);
      coreSphereMaterial.uniforms.uRadius.value = s;
    }

    // Outer Soft Halo Billboard
    if (outerHaloRef.current && showHalo) {
      outerHaloMaterial.uniforms.uColor.value.copy(currentThemeColor.current);
      outerHaloMaterial.uniforms.uCamDist.value = camDist;
      outerHaloMaterial.uniforms.uOpacity.value = (0.30 + heartRhythm * 0.08) * introProgress;

      const hs = 2.8 * hoverScale * introProgress;
      outerHaloRef.current.scale.set(hs, hs, hs);
    }

    // 14 3D Starburst Rays
    if (raysGroupRef.current && showRays) {
      rayShader.uniforms.uThemeColor.value.copy(currentThemeColor.current);
      rayShader.uniforms.uOpacity.value = (0.30 + heartRhythm * 0.06) * introProgress;

      raysGroupRef.current.rotation.y += delta * 0.032;
      raysGroupRef.current.rotation.x += delta * 0.016;
      raysGroupRef.current.rotation.z += delta * 0.012;

      const baseRayScale = hoverScale * introProgress * (1.0 + heartRhythm * 0.02);
      raysGroupRef.current.scale.set(baseRayScale, baseRayScale, baseRayScale);
    }
  });

  return (
    <group position={[0, 0, 0]} renderOrder={1}>
      {/* Core Point Light */}
      <pointLight ref={pointLightRef} distance={8} decay={2} />

      {/* 3D Core Sphere (Guaranteed 100% circular silhouette from every angle) */}
      {showCoreSphere && (
        <mesh ref={coreSphereRef} material={coreSphereMaterial}>
          <sphereGeometry args={[1, 48, 48]} />
        </mesh>
      )}

      {/* Outer Soft Halo Billboard with Euclidean exponential decay and boundary cutoff */}
      {showHalo && (
        <Billboard>
          <mesh ref={outerHaloRef} material={outerHaloMaterial}>
            <planeGeometry args={[1, 1]} />
          </mesh>
        </Billboard>
      )}

      {/* 14 Isotropic 3D Starburst Rays (visible from front, top, and lateral angles) */}
      {showRays && (
        <group ref={raysGroupRef}>
          {rays.map((ray, i) => (
            <group key={i} rotation={ray.rot}>
              <mesh
                position={[0, ray.len * 0.5 + 0.2, 0]}
                material={rayShader}
                scale={[1, ray.len, 1]}
              >
                <cylinderGeometry args={[0.001, 0.004, 1, 6]} />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );
};
