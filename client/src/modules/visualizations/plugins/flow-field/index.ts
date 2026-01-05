import { VisualizationModule, VisualizationInstance, VisualizationRenderContext, AudioFrameData } from '../../types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
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
  description: 'Particles flowing through audio-reactive curl noise vector fields',
  category: 'particle' as const,
};

const audioPreferences = {
  fftSize: 256 as const,
  smoothingTimeConstant: 0.7,
  minDecibels: -80,
  maxDecibels: -10,
};

const defaultParameters = {
  particleCount: { type: 'number' as const, label: 'Particles', value: 800, min: 200, max: 2000, step: 100 },
  fieldStrength: { type: 'number' as const, label: 'Field Strength', value: 1, min: 0.2, max: 3, step: 0.1 },
  noiseScale: { type: 'number' as const, label: 'Noise Scale', value: 0.003, min: 0.001, max: 0.01, step: 0.001 },
  timeScale: { type: 'number' as const, label: 'Flow Speed', value: 0.5, min: 0.1, max: 2, step: 0.1 },
  drag: { type: 'number' as const, label: 'Drag', value: 0.97, min: 0.9, max: 0.99, step: 0.01 },
  trails: { type: 'boolean' as const, label: 'Trails', value: true },
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
  let beatFlash = 0;
  let instantBass = 0;
  let instantTreble = 0;
  const SMOOTHING = 0.25;
  const FAST_SMOOTHING = 0.4;

  function respawnParticle(w: number, h: number, hue: number, burst = false): Particle {
    if (burst) {
      const cx = w / 2;
      const cy = h / 2;
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 100;
      return {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: Math.cos(angle) * (Math.random() * 3 + 2),
        vy: Math.sin(angle) * (Math.random() * 3 + 2),
        life: 0,
        maxLife: Math.random() * 150 + 80,
        size: Math.random() * 3 + 2,
        hue: hue,
      };
    }
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: Math.random() * 200 + 100,
      size: Math.random() * 2 + 1,
      hue: hue,
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

  function getColorHue(mode: string, baseHue: number, energy: number, treble: number, colorSens: number): number {
    const trebleShift = treble * 120 * colorSens;
    const energyShift = energy * colorSens;
    switch (mode) {
      case 'ocean':
        return 180 + baseHue * 0.3 + energyShift * 60 + trebleShift * 0.3;
      case 'fire':
        return baseHue * 0.2 + energyShift * 50 + trebleShift * 0.2;
      case 'mono':
        return 260 + trebleShift * 0.1;
      case 'spectrum':
      default:
        return (baseHue + energyShift * 120 + trebleShift) % 360;
    }
  }

  return {
    init(ctx: VisualizationRenderContext) {
      width = ctx.width;
      height = ctx.height;
      noise = new SimplexNoise(Math.random());
      particles = Array.from({ length: 800 }, () => 
        respawnParticle(width, height, Math.random() * 360)
      );
    },

    render(ctx: VisualizationRenderContext, audio: AudioFrameData, params: Record<string, number | string | boolean>) {
      const context = ctx.ctx;
      width = ctx.width;
      height = ctx.height;
      
      const targetCount = params.particleCount as number || 800;
      const baseFieldStrength = params.fieldStrength as number || 1;
      const baseNoiseScale = params.noiseScale as number || 0.003;
      const timeScale = params.timeScale as number || 0.5;
      const drag = params.drag as number || 0.97;
      const showTrails = params.trails as boolean ?? true;
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

      smoothedAudio.bass += (rawBass - smoothedAudio.bass) * SMOOTHING;
      smoothedAudio.mid += (rawMid - smoothedAudio.mid) * SMOOTHING;
      smoothedAudio.treble += (rawTreble - smoothedAudio.treble) * SMOOTHING;
      smoothedAudio.energy += (rawEnergy - smoothedAudio.energy) * SMOOTHING;

      instantBass += (rawBass / 255 - instantBass) * FAST_SMOOTHING;
      instantTreble += (rawTreble / 255 - instantTreble) * FAST_SMOOTHING;

      const bass = smoothedAudio.bass / 255;
      const mid = smoothedAudio.mid / 255;
      const treble = smoothedAudio.treble / 255;
      const energy = smoothedAudio.energy / 255;

      const fieldStrength = baseFieldStrength * (0.3 + bass * 4 + instantBass * 2);
      const noiseScale = baseNoiseScale * (0.3 + mid * 3);
      const jitter = treble * 6 + instantTreble * 4;

      const isBeat = rawBass > prevBass + 25 && beatCooldown <= 0;
      if (isBeat) {
        beatCooldown = 8;
        beatFlash = 1.0;
      }
      prevBass = rawBass;
      if (beatCooldown > 0) beatCooldown--;
      beatFlash *= 0.85;

      time += ctx.deltaTime * timeScale * 0.001 * (1 + mid * 2);

      const fadeSpeed = showTrails 
        ? 0.03 + energy * 0.15 + (isBeat ? 0.1 : 0)
        : 1;
      
      if (showTrails) {
        context.fillStyle = `rgba(0, 0, 0, ${fadeSpeed})`;
        context.fillRect(0, 0, width, height);
      } else {
        context.clearRect(0, 0, width, height);
      }

      if (beatFlash > 0.1) {
        const flashHue = getColorHue(colorMode, 200, energy, treble, colorSensitivity);
        context.fillStyle = `hsla(${flashHue}, 80%, 50%, ${beatFlash * 0.15})`;
        context.fillRect(0, 0, width, height);
      }

      const spawnRate = Math.floor(2 + energy * 15 + (isBeat ? 30 : 0));
      
      while (particles.length < targetCount) {
        const centroidHue = (audio.peakFrequency / len) * 360;
        particles.push(respawnParticle(width, height, centroidHue));
      }
      while (particles.length > targetCount) {
        particles.pop();
      }

      if (isBeat) {
        const burstCount = Math.floor(20 + bass * 40);
        for (let i = 0; i < burstCount && particles.length < targetCount + 50; i++) {
          const idx = Math.floor(Math.random() * particles.length);
          const centroidHue = (audio.peakFrequency / len) * 360;
          particles[idx] = respawnParticle(width, height, centroidHue, true);
        }
      }

      for (let i = 0; i < spawnRate && particles.length > 0; i++) {
        const idx = Math.floor(Math.random() * particles.length);
        if (particles[idx].life > particles[idx].maxLife * 0.7) {
          const centroidHue = (audio.peakFrequency / len) * 360;
          particles[idx] = respawnParticle(width, height, centroidHue);
        }
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        const curl = getCurlNoise(p.x, p.y, time, noiseScale);
        
        p.vx += curl.vx * fieldStrength;
        p.vy += curl.vy * fieldStrength;

        if (jitter > 0.1) {
          p.vx += (Math.random() - 0.5) * jitter;
          p.vy += (Math.random() - 0.5) * jitter;
        }

        if (isBeat) {
          const impulse = 15 + bass * 25;
          p.vx += (Math.random() - 0.5) * impulse;
          p.vy += (Math.random() - 0.5) * impulse;
        }

        const dynamicDrag = drag - bass * 0.03;
        p.vx *= dynamicDrag;
        p.vy *= dynamicDrag;

        p.x += p.vx * (1 + energy * 0.5);
        p.y += p.vy * (1 + energy * 0.5);

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
        const alpha = Math.min(1, baseAlpha * (0.5 + energy * 0.5 + instantBass * 0.3));
        const size = p.size * (1 + instantBass * 2 + beatFlash * 1.5);
        const hue = getColorHue(colorMode, p.hue, energy, treble, colorSensitivity);
        const saturation = Math.min(100, 60 + treble * 40 * colorSensitivity);
        const lightness = Math.min(90, 45 + energy * 30 * colorSensitivity + instantTreble * 15 * colorSensitivity);

        context.beginPath();
        context.arc(p.x, p.y, size, 0, Math.PI * 2);
        context.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
        context.fill();
      }

      if (instantBass > 0.3 || beatFlash > 0.2) {
        context.save();
        const glowIntensity = Math.max(instantBass, beatFlash);
        const glowCount = Math.floor(particles.length * (0.03 + glowIntensity * 0.1));
        
        for (let i = 0; i < glowCount; i++) {
          const p = particles[Math.floor(Math.random() * particles.length)];
          const hue = getColorHue(colorMode, p.hue, energy, treble, colorSensitivity);
          context.shadowBlur = 20 + glowIntensity * 40;
          context.shadowColor = `hsl(${hue}, 90%, 60%)`;
          context.beginPath();
          context.arc(p.x, p.y, p.size * (2 + glowIntensity * 2), 0, Math.PI * 2);
          context.fillStyle = `hsla(${hue}, 90%, 75%, ${0.6 + glowIntensity * 0.4})`;
          context.fill();
        }
        context.restore();
      }

      if (treble > 0.5) {
        context.save();
        const sparkleCount = Math.floor(treble * 30);
        for (let i = 0; i < sparkleCount; i++) {
          const sx = Math.random() * width;
          const sy = Math.random() * height;
          const sparkleHue = getColorHue(colorMode, Math.random() * 360, energy, treble, colorSensitivity);
          context.beginPath();
          context.arc(sx, sy, 1 + Math.random() * 2, 0, Math.PI * 2);
          context.fillStyle = `hsla(${sparkleHue}, 100%, 80%, ${0.3 + Math.random() * 0.5})`;
          context.fill();
        }
        context.restore();
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
