import { VisualizationModule, VisualizationInstance, VisualizationRenderContext, AudioFrameData } from '../../types';

type ParticleType = 'tracer' | 'drifter' | 'anchor';

interface Particle {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
  type: ParticleType;
}

interface SmoothedAudio {
  bass: number;
  mid: number;
  treble: number;
  energy: number;
}

const metadata = {
  id: 'flow-field',
  name: 'Flow Field',
  description: 'Particles tracing smooth curl noise vector fields',
  category: 'particle' as const,
};

const audioPreferences = {
  fftSize: 256 as const,
  smoothingTimeConstant: 0.7,
  minDecibels: -80,
  maxDecibels: -10,
};

const defaultParameters = {
  particleCount: { type: 'number' as const, label: 'Particles', value: 600, min: 200, max: 1500, step: 100 },
  fieldStrength: { type: 'number' as const, label: 'Field Strength', value: 1.5, min: 0.5, max: 5, step: 0.1 },
  noiseScale: { type: 'number' as const, label: 'Noise Scale', value: 0.001, min: 0.0005, max: 0.003, step: 0.0002 },
  timeScale: { type: 'number' as const, label: 'Flow Speed', value: 0.4, min: 0.1, max: 1.5, step: 0.1 },
  drag: { type: 'number' as const, label: 'Drag', value: 0.96, min: 0.9, max: 0.99, step: 0.01 },
  colorMode: { type: 'select' as const, label: 'Color', value: 'spectrum', options: [
    { label: 'Spectrum', value: 'spectrum' },
    { label: 'Ocean', value: 'ocean' },
    { label: 'Fire', value: 'fire' },
    { label: 'Monochrome', value: 'mono' },
  ]},
  colorSensitivity: { type: 'number' as const, label: 'Color Sensitivity', value: 1, min: 0.2, max: 3, step: 0.1 },
};

class SimplexNoise {
  private perm: number[] = [];
  private gradP: { x: number; y: number; z: number }[] = [];
  
  private grad3 = [
    {x:1,y:1,z:0}, {x:-1,y:1,z:0}, {x:1,y:-1,z:0}, {x:-1,y:-1,z:0},
    {x:1,y:0,z:1}, {x:-1,y:0,z:1}, {x:1,y:0,z:-1}, {x:-1,y:0,z:-1},
    {x:0,y:1,z:1}, {x:0,y:-1,z:1}, {x:0,y:1,z:-1}, {x:0,y:-1,z:-1}
  ];

  constructor(seed = Math.random()) {
    const p: number[] = [];
    for (let i = 0; i < 256; i++) {
      p[i] = Math.floor(seed * 256);
      seed = (seed * 16807) % 2147483647;
      seed = seed / 2147483647;
    }
    
    for (let i = 255; i > 0; i--) {
      const n = Math.floor((i + 1) * seed);
      seed = (seed * 16807) % 2147483647;
      seed = seed / 2147483647;
      const t = p[i];
      p[i] = p[n % 256];
      p[n % 256] = t;
    }
    
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.gradP[i] = this.grad3[this.perm[i] % 12];
    }
  }

  private dot3(g: { x: number; y: number; z: number }, x: number, y: number, z: number): number {
    return g.x * x + g.y * y + g.z * z;
  }

  noise3D(x: number, y: number, z: number): number {
    const F3 = 1 / 3;
    const G3 = 1 / 6;
    
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);
    
    const t = (i + j + k) * G3;
    const X0 = i - t;
    const Y0 = j - t;
    const Z0 = k - t;
    
    const x0 = x - X0;
    const y0 = y - Y0;
    const z0 = z - Z0;
    
    let i1: number, j1: number, k1: number;
    let i2: number, j2: number, k2: number;
    
    if (x0 >= y0) {
      if (y0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
      else if (x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
      else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
    } else {
      if (y0 < z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
      else if (x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
      else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
    }
    
    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3;
    const y2 = y0 - j2 + 2 * G3;
    const z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3;
    const y3 = y0 - 1 + 3 * G3;
    const z3 = z0 - 1 + 3 * G3;
    
    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;
    
    let n0 = 0, n1 = 0, n2 = 0, n3 = 0;
    
    let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    if (t0 >= 0) {
      const gi0 = this.gradP[ii + this.perm[jj + this.perm[kk]]];
      t0 *= t0;
      n0 = t0 * t0 * this.dot3(gi0, x0, y0, z0);
    }
    
    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if (t1 >= 0) {
      const gi1 = this.gradP[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]];
      t1 *= t1;
      n1 = t1 * t1 * this.dot3(gi1, x1, y1, z1);
    }
    
    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if (t2 >= 0) {
      const gi2 = this.gradP[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]];
      t2 *= t2;
      n2 = t2 * t2 * this.dot3(gi2, x2, y2, z2);
    }
    
    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if (t3 >= 0) {
      const gi3 = this.gradP[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]];
      t3 *= t3;
      n3 = t3 * t3 * this.dot3(gi3, x3, y3, z3);
    }
    
    return 32 * (n0 + n1 + n2 + n3);
  }
}

function createInstance(): VisualizationInstance {
  let particles: Particle[] = [];
  let width = 0;
  let height = 0;
  let noise: SimplexNoise;
  let time = 0;
  let smoothedAudio: SmoothedAudio = { bass: 0, mid: 0, treble: 0, energy: 0 };
  let prevBass = 0;
  let beatCooldown = 0;
  let globalBrightness = 0;
  const SMOOTHING = 0.15;

  function getParticleType(): ParticleType {
    const r = Math.random();
    if (r < 0.3) return 'tracer';
    if (r < 0.7) return 'drifter';
    return 'anchor';
  }

  function respawnParticle(w: number, h: number, hue: number): Particle {
    const type = getParticleType();
    const baseSize = type === 'anchor' ? 2.5 : type === 'tracer' ? 0.8 : 1.5;
    const lifeMultiplier = type === 'anchor' ? 1.3 : type === 'tracer' ? 0.8 : 1;
    
    const x = Math.random() * w;
    const y = Math.random() * h;
    return {
      x,
      y,
      px: x,
      py: y,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: (Math.random() * 600 + 400) * lifeMultiplier,
      size: baseSize + Math.random() * 0.5,
      hue: hue,
      type,
    };
  }

  function getCurlNoise(x: number, y: number, t: number, scale: number): { vx: number; vy: number } {
    const eps = 0.0001;
    
    const n1 = noise.noise3D(x * scale, (y + eps) * scale, t);
    const n2 = noise.noise3D(x * scale, (y - eps) * scale, t);
    const n3 = noise.noise3D((x + eps) * scale, y * scale, t);
    const n4 = noise.noise3D((x - eps) * scale, y * scale, t);
    
    const dx = (n1 - n2) / (2 * eps);
    const dy = (n3 - n4) / (2 * eps);
    
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return {
      vx: dy / len,
      vy: -dx / len,
    };
  }

  function getColorHue(mode: string, baseHue: number, treble: number, colorSens: number): number {
    const trebleShift = treble * 60 * colorSens;
    switch (mode) {
      case 'ocean':
        return 180 + baseHue * 0.2 + trebleShift * 0.3;
      case 'fire':
        return baseHue * 0.15 + trebleShift * 0.2;
      case 'mono':
        return 260 + trebleShift * 0.1;
      case 'spectrum':
      default:
        return (baseHue + trebleShift) % 360;
    }
  }

  return {
    init(ctx: VisualizationRenderContext) {
      width = ctx.width;
      height = ctx.height;
      noise = new SimplexNoise(Math.random());
      particles = Array.from({ length: 600 }, () => 
        respawnParticle(width, height, Math.random() * 360)
      );
    },

    render(ctx: VisualizationRenderContext, audio: AudioFrameData, params: Record<string, number | string | boolean>) {
      const context = ctx.ctx;
      width = ctx.width;
      height = ctx.height;
      
      const targetCount = params.particleCount as number || 600;
      const baseFieldStrength = params.fieldStrength as number || 1.5;
      const baseNoiseScale = params.noiseScale as number || 0.002;
      const timeScale = params.timeScale as number || 0.4;
      const drag = params.drag as number || 0.96;
      const colorMode = params.colorMode as string || 'spectrum';
      const colorSensitivity = params.colorSensitivity as number || 1;

      const freqData = audio.frequencyData;
      let bassSum = 0, midSum = 0, trebleSum = 0, totalSum = 0;
      const len = freqData.length;
      
      for (let i = 0; i < Math.min(11, len); i++) bassSum += freqData[i];
      for (let i = 20; i < Math.min(61, len); i++) midSum += freqData[i];
      for (let i = 80; i < Math.min(121, len); i++) trebleSum += freqData[i];
      for (let i = 0; i < len; i++) totalSum += freqData[i];
      
      const rawBass = bassSum / 11;
      const rawMid = midSum / 41;
      const rawTreble = trebleSum / 41;
      const rawEnergy = totalSum / len;

      smoothedAudio.bass += (rawBass / 255 - smoothedAudio.bass) * SMOOTHING;
      smoothedAudio.mid += (rawMid / 255 - smoothedAudio.mid) * SMOOTHING;
      smoothedAudio.treble += (rawTreble / 255 - smoothedAudio.treble) * SMOOTHING;
      smoothedAudio.energy += (rawEnergy / 255 - smoothedAudio.energy) * SMOOTHING;

      const bass = smoothedAudio.bass;
      const treble = smoothedAudio.treble;
      const energy = smoothedAudio.energy;

      const fieldStrength = baseFieldStrength * (0.5 + bass * 2);
      const noiseScale = baseNoiseScale * (0.6 + bass * 0.3);
      
      const cx = width * 0.5;
      const cy = height * 0.5;

      const isBeat = rawBass > prevBass + 25 && beatCooldown <= 0;
      if (isBeat) {
        beatCooldown = 10;
        globalBrightness = 0.15;
      }
      prevBass = rawBass;
      if (beatCooldown > 0) beatCooldown--;
      globalBrightness *= 0.9;

      time += ctx.deltaTime * timeScale * 0.001 * (0.8 + bass * 0.4);

      context.fillStyle = 'rgb(0, 0, 0)';
      context.fillRect(0, 0, width, height);

      while (particles.length < targetCount) {
        const centroidHue = (audio.peakFrequency / len) * 360;
        particles.push(respawnParticle(width, height, centroidHue));
      }
      while (particles.length > targetCount) {
        particles.pop();
      }

      const anchors = particles.filter(p => p.type === 'anchor');

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        p.px = p.x;
        p.py = p.y;
        
        const curl = getCurlNoise(p.x, p.y, time, noiseScale);
        
        const typeStrength = p.type === 'tracer' ? 1.4 : p.type === 'anchor' ? 0.4 : 1;
        p.vx += curl.vx * fieldStrength * typeStrength;
        p.vy += curl.vy * fieldStrength * typeStrength;

        const curve = treble * 0.15;
        p.vx += curl.vx * curve;
        p.vy += curl.vy * curve;

        const dx = p.x - cx;
        const dy = p.y - cy;
        const distToCenter = Math.sqrt(dx * dx + dy * dy) + 0.0001;
        const globalSpin = 0.0004 * (0.5 + bass);
        p.vx += -dy / distToCenter * globalSpin;
        p.vy += dx / distToCenter * globalSpin;

        if (p.type !== 'anchor') {
          for (const anchor of anchors) {
            const ax = p.x - anchor.x;
            const ay = p.y - anchor.y;
            const d2 = ax * ax + ay * ay + 50;
            p.vx -= ax / d2 * 0.6;
            p.vy -= ay / d2 * 0.6;
          }
        }

        if (isBeat) {
          const impulse = 3 + bass * 6;
          p.vx += curl.vx * impulse;
          p.vy += curl.vy * impulse;
        }

        const calm = 0.4;
        p.vx *= (calm + energy * 0.6);
        p.vy *= (calm + energy * 0.6);

        if (p.type === 'anchor') {
          p.vx *= 0.85;
          p.vy *= 0.85;
        }

        p.vx *= drag;
        p.vy *= drag;

        p.x += p.vx;
        p.y += p.vy;

        p.life++;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        if (p.life > p.maxLife) {
          const centroidHue = (audio.peakFrequency / len) * 360;
          particles[i] = respawnParticle(width, height, centroidHue);
          continue;
        }

        const lifeRatio = p.life / p.maxLife;
        const baseAlpha = Math.sin(lifeRatio * Math.PI);
        const alpha = Math.min(0.9, baseAlpha * (0.4 + globalBrightness));
        
        const hue = getColorHue(colorMode, p.hue, treble, colorSensitivity);
        const saturation = Math.min(100, 65 + treble * 35 * colorSensitivity);
        const lightness = Math.min(85, 50 + treble * 20 * colorSensitivity + globalBrightness * 30);

        const moveDx = p.x - p.px;
        const moveDy = p.y - p.py;
        const moveDist = Math.sqrt(moveDx * moveDx + moveDy * moveDy);
        
        if (moveDist < 1.2 && p.type !== 'anchor') continue;
        
        if (moveDist > 0.5) {
          const strokeWidth = p.type === 'anchor' 
            ? p.size * (1.5 + treble * 0.5) 
            : p.size * (1 + treble * 0.3);
          
          context.beginPath();
          context.moveTo(p.px, p.py);
          context.lineTo(p.x, p.y);
          context.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
          context.lineWidth = strokeWidth;
          context.lineCap = 'round';
          context.stroke();
        }

        if (p.type === 'anchor') {
          const glowSize = p.size * (2 + treble * 1.5);
          context.beginPath();
          context.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
          context.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness + 10}%, ${alpha * 0.3})`;
          context.fill();
        }
      }

    },

    resize(ctx: VisualizationRenderContext) {
      width = ctx.width;
      height = ctx.height;
    },

    destroy() {
      particles = [];
    },
  };
}

export const flowField: VisualizationModule = {
  metadata,
  audioPreferences,
  defaultParameters,
  createInstance,
};
