import { VisualizationModule, VisualizationInstance, VisualizationRenderContext, AudioFrameData } from '../../types';

interface SmoothedAudio {
  bass: number;
  mid: number;
  treble: number;
  energy: number;
}

interface OscillatorState {
  phase1: number;
  phase2: number;
  phaseVelocity: number;
}

const metadata = {
  id: 'oscillatory-motion',
  name: 'Oscillatory Motion',
  description: 'Rhythmic oscillating visuals synchronized to music with Lissajous patterns',
  category: 'geometric' as const,
};

const audioPreferences = {
  fftSize: 256 as const,
  smoothingTimeConstant: 0.7,
  minDecibels: -80,
  maxDecibels: -10,
};

const defaultParameters = {
  sensitivity: { type: 'number' as const, label: 'Sensitivity', value: 1.5, min: 0.2, max: 5, step: 0.1 },
  pointCount: { type: 'number' as const, label: 'Points', value: 64, min: 16, max: 256, step: 8 },
  mode: { type: 'select' as const, label: 'Mode', value: 'rings', options: [
    { label: 'Radial Rings', value: 'rings' },
    { label: 'Particles', value: 'particles' },
    { label: 'Lissajous', value: 'lissajous' },
  ]},
  amplitudeMax: { type: 'number' as const, label: 'Max Amplitude', value: 100, min: 20, max: 200, step: 10 },
  baseSpeed: { type: 'number' as const, label: 'Base Speed', value: 1, min: 0.1, max: 3, step: 0.1 },
  ringCount: { type: 'number' as const, label: 'Ring Count', value: 5, min: 1, max: 12, step: 1 },
  trails: { type: 'boolean' as const, label: 'Trails', value: false },
  trailLength: { type: 'number' as const, label: 'Trail Length', value: 0.92, min: 0.8, max: 0.98, step: 0.01 },
  colorMode: { type: 'select' as const, label: 'Color', value: 'spectrum', options: [
    { label: 'Spectrum', value: 'spectrum' },
    { label: 'Ocean', value: 'ocean' },
    { label: 'Fire', value: 'fire' },
    { label: 'Mono', value: 'mono' },
  ]},
  colorSensitivity: { type: 'number' as const, label: 'Color Sensitivity', value: 1, min: 0.2, max: 3, step: 0.1 },
};

function map(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getColorHue(mode: string, baseHue: number, energy: number, treble: number, sensitivity: number): number {
  const trebleShift = treble * 60 * sensitivity;
  const energyShift = energy * 30 * sensitivity;
  
  switch (mode) {
    case 'ocean':
      return 180 + trebleShift * 0.5 + energyShift * 0.3;
    case 'fire':
      return (30 + trebleShift * 0.3) % 60;
    case 'mono':
      return 220;
    case 'spectrum':
    default:
      return (baseHue + trebleShift + energyShift) % 360;
  }
}

function getOsc(osc: OscillatorState, time: number, omega: number, phaseOffset: number = 0): number {
  const o1 = Math.sin(omega * time + osc.phase1 + phaseOffset);
  const o2 = Math.sin(omega * time * 1.5 + osc.phase2 + phaseOffset);
  return o1 + 0.5 * o2;
}

export const oscillatoryMotion: VisualizationModule = {
  metadata,
  audioPreferences,
  defaultParameters,

  createInstance(): VisualizationInstance {
    let width = 0;
    let height = 0;
    let time = 0;
    
    let smoothed: SmoothedAudio = { bass: 0, mid: 0, treble: 0, energy: 0 };
    let instantBass = 0;
    let prevRawBass = 0;
    let beatCooldown = 0;
    
    const oscillators: OscillatorState[] = [];
    const SMOOTH_FACTOR = 0.08;
    const FAST_SMOOTH = 0.3;
    
    let lissajousA = 2;
    let lissajousB = 3;
    
    let trailCanvas: HTMLCanvasElement | null = null;
    let trailCtx: CanvasRenderingContext2D | null = null;
    
    interface Particle {
      baseX: number;
      baseY: number;
      phase: number;
      size: number;
      hue: number;
    }
    let particles: Particle[] = [];

    function initParticles(count: number, w: number, h: number) {
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          baseX: Math.random() * w,
          baseY: Math.random() * h,
          phase: Math.random() * Math.PI * 2,
          size: 2 + Math.random() * 4,
          hue: Math.random() * 360,
        });
      }
    }

    function initOscillators(count: number) {
      oscillators.length = 0;
      for (let i = 0; i < count; i++) {
        oscillators.push({
          phase1: (i / count) * Math.PI * 2,
          phase2: (i / count) * Math.PI + Math.PI / 4,
          phaseVelocity: 0.02,
        });
      }
    }

    return {
      init(ctx: VisualizationRenderContext) {
        width = ctx.width;
        height = ctx.height;
        time = 0;
        lissajousA = 2;
        lissajousB = 3;
        initParticles(256, width, height);
        initOscillators(12);
      },

      render(ctx: VisualizationRenderContext, audio: AudioFrameData, params: Record<string, unknown>) {
        const context = ctx.ctx;
        width = ctx.width;
        height = ctx.height;

        const sensitivity = params.sensitivity as number || 1.5;
        const pointCount = params.pointCount as number || 64;
        const mode = params.mode as string || 'rings';
        const amplitudeMax = params.amplitudeMax as number || 100;
        const baseSpeed = params.baseSpeed as number || 1;
        const ringCount = params.ringCount as number || 5;
        const showTrails = params.trails as boolean ?? false;
        const trailLength = params.trailLength as number || 0.92;
        const colorMode = params.colorMode as string || 'spectrum';
        const colorSensitivity = params.colorSensitivity as number || 1;

        const freqData = audio.frequencyData;
        let bassSum = 0, midSum = 0, trebleSum = 0, totalSum = 0;
        const len = freqData.length;
        const bassEnd = Math.floor(len * 0.15);
        const midEnd = Math.floor(len * 0.5);

        for (let i = 0; i < len; i++) {
          const val = freqData[i];
          totalSum += val;
          if (i < bassEnd) bassSum += val;
          else if (i < midEnd) midSum += val;
          else trebleSum += val;
        }

        const rawBass = bassEnd > 0 ? bassSum / bassEnd : 0;
        const rawMid = (midEnd - bassEnd) > 0 ? midSum / (midEnd - bassEnd) : 0;
        const rawTreble = (len - midEnd) > 0 ? trebleSum / (len - midEnd) : 0;
        const rawEnergy = len > 0 ? totalSum / len : 0;

        smoothed.bass += (rawBass / 255 - smoothed.bass) * SMOOTH_FACTOR;
        smoothed.mid += (rawMid / 255 - smoothed.mid) * SMOOTH_FACTOR;
        smoothed.treble += (rawTreble / 255 - smoothed.treble) * SMOOTH_FACTOR;
        smoothed.energy += (rawEnergy / 255 - smoothed.energy) * SMOOTH_FACTOR;

        instantBass += (rawBass / 255 - instantBass) * FAST_SMOOTH;

        const isBeat = rawBass > prevRawBass + 25 && beatCooldown <= 0;
        if (isBeat) {
          beatCooldown = 8;
          for (const osc of oscillators) {
            osc.phaseVelocity += 0.15 + smoothed.bass * 0.3;
          }
        }
        beatCooldown = Math.max(0, beatCooldown - 1);
        prevRawBass = rawBass;

        const bass = Math.min(1, smoothed.bass * sensitivity);
        const mid = Math.min(1, smoothed.mid * sensitivity);
        const treble = Math.min(1, smoothed.treble * sensitivity);
        const energy = Math.min(1, smoothed.energy * sensitivity);

        const amplitude = clamp(map(bass, 0, 1, 5, amplitudeMax), 5, amplitudeMax);
        const frequency = map(mid, 0, 1, 0.5, 4.0);
        const omega = 2 * Math.PI * frequency;
        const phaseJitterSpeed = treble * 0.005 * baseSpeed;

        for (const osc of oscillators) {
          const basePhaseSpeed = 0.02 * baseSpeed;
          osc.phaseVelocity *= 0.95;
          osc.phaseVelocity = Math.max(osc.phaseVelocity, basePhaseSpeed);
          osc.phase1 += osc.phaseVelocity + phaseJitterSpeed;
          osc.phase2 += (osc.phaseVelocity + phaseJitterSpeed) * 1.5;
        }

        time += 0.016 * baseSpeed;

        if (showTrails) {
          if (!trailCanvas || trailCanvas.width !== width || trailCanvas.height !== height) {
            trailCanvas = document.createElement('canvas');
            trailCanvas.width = width;
            trailCanvas.height = height;
            trailCtx = trailCanvas.getContext('2d');
            if (trailCtx) {
              trailCtx.fillStyle = 'rgb(0, 0, 0)';
              trailCtx.fillRect(0, 0, width, height);
            }
          }
          
          if (trailCtx) {
            trailCtx.save();
            trailCtx.globalCompositeOperation = 'destination-in';
            trailCtx.fillStyle = `rgba(255, 255, 255, ${trailLength})`;
            trailCtx.fillRect(0, 0, width, height);
            trailCtx.restore();
          }
        }

        context.fillStyle = 'rgb(0, 0, 0)';
        context.fillRect(0, 0, width, height);

        const drawCtx = showTrails && trailCtx ? trailCtx : context;

        const cx = width / 2;
        const cy = height / 2;

        if (mode === 'rings') {
          for (let ring = 0; ring < ringCount; ring++) {
            const ringPhase = (ring / ringCount) * Math.PI * 2;
            const baseRadius = 50 + ring * (Math.min(width, height) * 0.35 / ringCount);
            
            const osc = oscillators[ring % oscillators.length];
            
            const ox = Math.sin(omega * time + osc.phase1 + ringPhase) * amplitude;
            const oy = Math.cos(omega * time + osc.phase2 + ringPhase) * amplitude * 0.6;

            drawCtx.beginPath();
            for (let i = 0; i <= pointCount; i++) {
              const theta = (i / pointCount) * Math.PI * 2;
              const r = baseRadius;
              
              const x = cx + (r + ox) * Math.cos(theta);
              const y = cy + (r + oy) * Math.sin(theta);
              
              if (i === 0) drawCtx.moveTo(x, y);
              else drawCtx.lineTo(x, y);
            }
            drawCtx.closePath();

            const hue = getColorHue(colorMode, (ring * 40 + time * 20) % 360, energy, treble, colorSensitivity);
            const saturation = clamp(70 + treble * 30 * colorSensitivity, 0, 100);
            const lightness = clamp(50 + energy * 20 * colorSensitivity, 30, 80);
            const alpha = 0.6 + instantBass * 0.4;

            drawCtx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
            drawCtx.lineWidth = 2 + instantBass * 3;
            drawCtx.stroke();

            for (let i = 0; i < pointCount; i += 8) {
              const theta = (i / pointCount) * Math.PI * 2;
              const r = baseRadius;
              const x = cx + (r + ox) * Math.cos(theta);
              const y = cy + (r + oy) * Math.sin(theta);
              
              const dotSize = 2 + instantBass * 3;
              drawCtx.beginPath();
              drawCtx.arc(x, y, dotSize, 0, Math.PI * 2);
              drawCtx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness + 10}%, ${alpha})`;
              drawCtx.fill();
            }
          }

        } else if (mode === 'particles') {
          if (particles.length !== pointCount) {
            initParticles(pointCount, width, height);
          }

          for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const osc = oscillators[i % oscillators.length];
            
            const oscValue = getOsc(osc, time, omega, p.phase);
            
            const x = p.baseX + oscValue * amplitude;
            const y = p.baseY + Math.cos(omega * time + p.phase + osc.phase1) * amplitude * 0.7;

            const hue = getColorHue(colorMode, p.hue + time * 10, energy, treble, colorSensitivity);
            const saturation = clamp(60 + treble * 40 * colorSensitivity, 0, 100);
            const lightness = clamp(50 + energy * 25 * colorSensitivity, 30, 85);
            const alpha = 0.5 + instantBass * 0.5;
            const size = p.size * (1 + instantBass * 1.5);

            drawCtx.beginPath();
            drawCtx.arc(x, y, size, 0, Math.PI * 2);
            drawCtx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
            drawCtx.fill();

            if (instantBass > 0.4) {
              drawCtx.beginPath();
              drawCtx.arc(x, y, size * 1.8, 0, Math.PI * 2);
              drawCtx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha * 0.2})`;
              drawCtx.lineWidth = 1;
              drawCtx.stroke();
            }
          }

        } else if (mode === 'lissajous') {
          const targetA = map(bass, 0, 1, 1, 5);
          const targetB = map(mid, 0, 1, 2, 7);
          lissajousA = lerp(lissajousA, targetA, 0.05);
          lissajousB = lerp(lissajousB, targetB, 0.05);
          
          const delta = treble * Math.PI * 0.5;
          
          const A = Math.min(width, height) * 0.45 * (0.6 + bass * 0.4);
          const B = Math.min(width, height) * 0.45 * (0.6 + mid * 0.4);

          for (let layer = 0; layer < 3; layer++) {
            const layerPhase = layer * 0.3;
            const layerScale = 1 - layer * 0.15;
            
            drawCtx.beginPath();
            for (let i = 0; i <= pointCount * 4; i++) {
              const t = (i / (pointCount * 4)) * Math.PI * 2 + time;
              const x = cx + A * layerScale * Math.sin(lissajousA * t + delta + layerPhase);
              const y = cy + B * layerScale * Math.sin(lissajousB * t + layerPhase);
              
              if (i === 0) drawCtx.moveTo(x, y);
              else drawCtx.lineTo(x, y);
            }

            const hue = getColorHue(colorMode, (layer * 60 + time * 30) % 360, energy, treble, colorSensitivity);
            const saturation = clamp(70 + treble * 30 * colorSensitivity, 0, 100);
            const lightness = clamp(55 + energy * 20 * colorSensitivity - layer * 10, 30, 80);
            const alpha = (0.8 - layer * 0.2) * (0.6 + instantBass * 0.4);

            drawCtx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
            drawCtx.lineWidth = (3 - layer) + instantBass * 2;
            drawCtx.stroke();
          }

          const dotCount = 8;
          for (let i = 0; i < dotCount; i++) {
            const t = (i / dotCount) * Math.PI * 2 + time;
            const x = cx + A * Math.sin(lissajousA * t + delta);
            const y = cy + B * Math.sin(lissajousB * t);
            
            const hue = getColorHue(colorMode, (i * 45 + time * 50) % 360, energy, treble, colorSensitivity);
            const dotSize = 4 + instantBass * 4;
            
            drawCtx.beginPath();
            drawCtx.arc(x, y, dotSize, 0, Math.PI * 2);
            drawCtx.fillStyle = `hsla(${hue}, 90%, 70%, ${0.7 + instantBass * 0.3})`;
            drawCtx.fill();
          }
        }

        if (showTrails && trailCanvas) {
          context.drawImage(trailCanvas, 0, 0);
        }
      },

      resize(ctx: VisualizationRenderContext) {
        width = ctx.width;
        height = ctx.height;
        initParticles(256, width, height);
      },

      destroy() {
        particles = [];
        oscillators.length = 0;
        trailCanvas = null;
        trailCtx = null;
      },
    };
  },
};
