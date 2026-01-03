import { VisualizationModule, VisualizationInstance, VisualizationRenderContext, AudioFrameData } from '../../types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
  life: number;
  maxLife: number;
}

const metadata = {
  id: 'particles',
  name: 'Particle Storm',
  description: 'Reactive particle system that responds to audio energy',
  category: 'particle' as const,
};

const audioPreferences = {
  fftSize: 256 as const,
  smoothingTimeConstant: 0.7,
  minDecibels: -80,
  maxDecibels: -10,
};

const defaultParameters = {
  particleCount: { type: 'number' as const, label: 'Particles', value: 200, min: 50, max: 500, step: 50 },
  particleSize: { type: 'number' as const, label: 'Size', value: 3, min: 1, max: 8, step: 0.5 },
  speed: { type: 'number' as const, label: 'Speed', value: 1, min: 0.2, max: 3, step: 0.2 },
  trails: { type: 'boolean' as const, label: 'Trails', value: true },
  gravity: { type: 'boolean' as const, label: 'Gravity', value: false },
};

function createInstance(): VisualizationInstance {
  let particles: Particle[] = [];
  let width = 0;
  let height = 0;

  function createParticle(w: number, h: number, audio: AudioFrameData | null): Particle {
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 2 + 1) * (audio ? 1 + audio.bassLevel / 255 : 1);
    
    return {
      x: w / 2 + (Math.random() - 0.5) * 100,
      y: h / 2 + (Math.random() - 0.5) * 100,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 3 + 1,
      hue: Math.random() * 60 + 250,
      life: 0,
      maxLife: Math.random() * 100 + 100,
    };
  }

  return {
    init(ctx: VisualizationRenderContext) {
      width = ctx.width;
      height = ctx.height;
      particles = Array.from({ length: 200 }, () => createParticle(width, height, null));
    },

    render(ctx: VisualizationRenderContext, audio: AudioFrameData, params: Record<string, number | string | boolean>) {
      const context = ctx.ctx;
      width = ctx.width;
      height = ctx.height;
      
      const targetCount = params.particleCount as number || 200;
      const baseSize = params.particleSize as number || 3;
      const speedMult = params.speed as number || 1;
      const showTrails = params.trails as boolean;
      const hasGravity = params.gravity as boolean;

      if (showTrails) {
        context.fillStyle = 'rgba(0, 0, 0, 0.1)';
        context.fillRect(0, 0, width, height);
      } else {
        context.clearRect(0, 0, width, height);
      }

      const audioEnergy = audio.averageFrequency / 255;
      const bassEnergy = audio.bassLevel / 255;

      while (particles.length < targetCount) {
        particles.push(createParticle(width, height, audio));
      }
      while (particles.length > targetCount) {
        particles.pop();
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        
        p.vx += (Math.random() - 0.5) * 0.5 * bassEnergy;
        p.vy += (Math.random() - 0.5) * 0.5 * bassEnergy;
        
        if (hasGravity) {
          p.vy += 0.05;
        }

        p.x += p.vx * speedMult * (1 + audioEnergy);
        p.y += p.vy * speedMult * (1 + audioEnergy);
        p.life++;

        if (p.x < 0 || p.x > width || p.y < 0 || p.y > height || p.life > p.maxLife) {
          particles[i] = createParticle(width, height, audio);
          continue;
        }

        const lifeRatio = 1 - p.life / p.maxLife;
        const size = (p.size + bassEnergy * 4) * baseSize / 3;
        const alpha = lifeRatio * 0.8;
        const hue = (p.hue + audioEnergy * 60) % 360;

        context.beginPath();
        context.arc(p.x, p.y, size, 0, Math.PI * 2);
        context.fillStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
        context.fill();

        if (bassEnergy > 0.5) {
          context.shadowBlur = 10;
          context.shadowColor = `hsl(${hue}, 80%, 60%)`;
          context.beginPath();
          context.arc(p.x, p.y, size * 0.5, 0, Math.PI * 2);
          context.fill();
          context.shadowBlur = 0;
        }
      }

      const centerX = width / 2;
      const centerY = height / 2;
      const coreSize = 30 + bassEnergy * 50;

      const coreGradient = context.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, coreSize
      );
      coreGradient.addColorStop(0, 'hsla(271, 91%, 75%, 0.8)');
      coreGradient.addColorStop(0.5, 'hsla(271, 91%, 65%, 0.3)');
      coreGradient.addColorStop(1, 'hsla(271, 91%, 65%, 0)');

      context.fillStyle = coreGradient;
      context.beginPath();
      context.arc(centerX, centerY, coreSize, 0, Math.PI * 2);
      context.fill();
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

export const particles: VisualizationModule = {
  metadata,
  audioPreferences,
  defaultParameters,
  createInstance,
};
