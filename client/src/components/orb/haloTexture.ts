import * as THREE from 'three';

/**
 * Generates an ethereal multi-layer radial halo sprite texture with seamless Gaussian falloff.
 * Zero hard edges.
 */
export function createHaloTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) return new THREE.CanvasTexture(canvas);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  gradient.addColorStop(0.06, 'rgba(240, 253, 255, 0.95)');
  gradient.addColorStop(0.18, 'rgba(56, 189, 248, 0.7)');
  gradient.addColorStop(0.38, 'rgba(37, 99, 235, 0.3)');
  gradient.addColorStop(0.65, 'rgba(13, 148, 136, 0.1)');
  gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates a warm Gaussian soft-core billboard texture (completely seamless hot center).
 */
export function createSoftCoreTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) return new THREE.CanvasTexture(canvas);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.85);
  gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  gradient.addColorStop(0.18, 'rgba(255, 250, 240, 0.92)');
  gradient.addColorStop(0.38, 'rgba(186, 230, 253, 0.45)');
  gradient.addColorStop(0.65, 'rgba(56, 189, 248, 0.12)');
  gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates a subtle radial god-rays and star streak texture.
 */
export function createGodRaysTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) return new THREE.CanvasTexture(canvas);

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.48;

  ctx.clearRect(0, 0, size, size);

  // Draw 16 subtle radial soft beam wedges
  const rayCount = 16;
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    const width = 0.06 + (i % 2 === 0 ? 0.04 : 0.02);

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    const alpha = i % 2 === 0 ? 0.25 : 0.12;
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(0.2, `rgba(56, 189, 248, ${alpha})`);
    grad.addColorStop(0.7, `rgba(37, 99, 235, ${alpha * 0.4})`);
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxR, angle - width, angle + width);
    ctx.closePath();
    ctx.fill();
  }

  // Horizontal subtle flare streak
  const streakGrad = ctx.createLinearGradient(0, cy, size, cy);
  streakGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.0)');
  streakGrad.addColorStop(0.35, 'rgba(56, 189, 248, 0.15)');
  streakGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)');
  streakGrad.addColorStop(0.65, 'rgba(56, 189, 248, 0.15)');
  streakGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = streakGrad;
  ctx.fillRect(0, cy - 2, size, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates a clean Gaussian point sprite for neural nodes.
 */
export function createPointSpriteTexture(size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) return new THREE.CanvasTexture(canvas);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  gradient.addColorStop(0.25, 'rgba(224, 242, 254, 0.9)');
  gradient.addColorStop(0.55, 'rgba(56, 189, 248, 0.4)');
  gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates an open arc texture with fine graduation measurement ticks.
 */
export function createOpenArcTexture(size = 1024, angleExtent = Math.PI * 1.2): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) return new THREE.CanvasTexture(canvas);

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.46;

  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = '#ffffff';

  const startAngle = -angleExtent / 2;
  const endAngle = angleExtent / 2;

  // Primary open arc
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(cx, cy, maxR, startAngle, endAngle);
  ctx.stroke();

  // Secondary offset arc
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(cx, cy, maxR - 8, startAngle, endAngle);
  ctx.stroke();

  // Measurement graduation ticks
  const ticks = 42;
  for (let i = 0; i <= ticks; i++) {
    const a = startAngle + (i / ticks) * angleExtent;
    const isMajor = i % 6 === 0;
    const len = isMajor ? 12 : 5;
    const r1 = maxR - 10;
    const r2 = r1 - len;

    ctx.lineWidth = isMajor ? 1.5 : 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
