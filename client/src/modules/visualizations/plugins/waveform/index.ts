import { VisualizationModule, VisualizationInstance, VisualizationRenderContext, AudioFrameData } from '../../types';

const metadata = {
  id: 'waveform',
  name: 'Waveform',
  description: 'Oscilloscope-style waveform visualization with glow effects',
  category: 'waveform' as const,
};

const audioPreferences = {
  fftSize: 2048 as const,
  smoothingTimeConstant: 0.5,
  minDecibels: -90,
  maxDecibels: -10,
};

const defaultParameters = {
  sensitivity: { type: 'number' as const, label: 'Sensitivity', value: 1.5, min: 0.2, max: 5, step: 0.1 },
  amplitude: { type: 'number' as const, label: 'Amplitude', value: 1, min: 0.2, max: 3, step: 0.1 },
  smoothness: { type: 'number' as const, label: 'Smoothness', value: 0, min: 0, max: 1, step: 0.1 },
  lineWidth: { type: 'number' as const, label: 'Line Width', value: 3, min: 1, max: 8, step: 0.5 },
  glowIntensity: { type: 'number' as const, label: 'Glow', value: 20, min: 0, max: 50, step: 5 },
  colorMode: { type: 'select' as const, label: 'Color', value: 'cyan', options: [
    { label: 'Cyan', value: 'cyan' },
    { label: 'Purple', value: 'purple' },
    { label: 'Green', value: 'green' },
    { label: 'Reactive', value: 'reactive' },
  ]},
  filled: { type: 'boolean' as const, label: 'Filled', value: false },
  showGridLines: { type: 'boolean' as const, label: 'Grid Lines', value: true },
};

function createInstance(): VisualizationInstance {
  let smoothedBass = 0;
  let smoothedTreble = 0;
  let smoothedEnergy = 0;
  let time = 0;
  const SMOOTH_FACTOR = 0.25;

  return {
    init(ctx: VisualizationRenderContext) {},

    render(ctx: VisualizationRenderContext, audio: AudioFrameData, params: Record<string, number | string | boolean>) {
      const { width, height, deltaTime } = ctx;
      const context = ctx.ctx;
      const sensitivity = params.sensitivity as number || 1.5;
      const amplitude = (params.amplitude as number ?? 1) * sensitivity;
      const smoothness = params.smoothness as number ?? 0;
      const lineWidth = params.lineWidth as number || 3;
      const glowIntensity = params.glowIntensity as number || 20;
      const colorMode = params.colorMode as string || 'cyan';
      const filled = params.filled as boolean || false;
      const showGridLines = params.showGridLines as boolean ?? true;

      time += deltaTime * 0.001;

      const freqData = audio.frequencyData;
      const len = freqData.length;
      const bassEnd = Math.floor(len * 0.15);
      const midEnd = Math.floor(len * 0.5);
      
      let bassSum = 0, trebleSum = 0, totalSum = 0;
      for (let i = 0; i < len; i++) {
        const val = freqData[i];
        if (i < bassEnd) bassSum += val;
        else if (i >= midEnd) trebleSum += val;
        totalSum += val;
      }
      
      const rawBass = bassEnd > 0 ? bassSum / bassEnd / 255 : 0;
      const rawTreble = (len - midEnd) > 0 ? trebleSum / (len - midEnd) / 255 : 0;
      const rawEnergy = totalSum / len / 255;
      
      smoothedBass += (rawBass - smoothedBass) * SMOOTH_FACTOR;
      smoothedTreble += (rawTreble - smoothedTreble) * SMOOTH_FACTOR;
      smoothedEnergy += (rawEnergy - smoothedEnergy) * SMOOTH_FACTOR;

      context.fillStyle = 'rgb(0, 0, 0)';
      context.fillRect(0, 0, width, height);

      const bassInfluence = smoothedBass * 300;
      const trebleInfluence = smoothedTreble * 250;
      const energyInfluence = smoothedEnergy * 200;
      const reactiveHue = (bassInfluence + trebleInfluence + energyInfluence) % 360;
      const reactiveSat = 70 + smoothedEnergy * 30;
      const reactiveLit = 45 + smoothedTreble * 25 + smoothedBass * 15;

      const colors: Record<string, string> = {
        cyan: 'hsl(190, 95%, 50%)',
        purple: 'hsl(271, 91%, 65%)',
        green: 'hsl(142, 76%, 45%)',
        reactive: `hsl(${reactiveHue}, ${reactiveSat}%, ${reactiveLit}%)`,
      };

      const color = colors[colorMode] || colors.cyan;
      const bufferLength = audio.waveformData.length;
      const sliceWidth = width / bufferLength;

      context.lineCap = 'round';
      context.lineJoin = 'round';

      const centerY = height / 2;
      
      const sampleStep = Math.max(1, Math.floor(1 + smoothness * 31));
      const points: { x: number; y: number }[] = [];
      
      for (let i = 0; i < bufferLength; i += sampleStep) {
        let sum = 0;
        let count = 0;
        for (let j = i; j < Math.min(i + sampleStep, bufferLength); j++) {
          sum += audio.waveformData[j];
          count++;
        }
        const avg = sum / count;
        const v = (avg / 128.0) - 1;
        const y = centerY + v * (height / 2) * amplitude;
        points.push({ x: (i + sampleStep / 2) * sliceWidth, y });
      }
      
      if (points.length > 0) {
        points[0].x = 0;
        points[points.length - 1].x = width;
      }

      const drawPath = () => {
        context.beginPath();
        if (smoothness > 0.3 && points.length >= 4) {
          const tension = 0.3 + smoothness * 0.4;
          context.moveTo(points[0].x, points[0].y);
          for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[Math.min(points.length - 1, i + 1)];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            const cp1x = p1.x + (p2.x - p0.x) * tension / 3;
            const cp1y = p1.y + (p2.y - p0.y) * tension / 3;
            const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
            const cp2y = p2.y - (p3.y - p1.y) * tension / 3;
            context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
          }
        } else {
          context.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            context.lineTo(points[i].x, points[i].y);
          }
        }
      };

      if (glowIntensity > 0) {
        const glowPasses = [
          { blur: glowIntensity * 2, alpha: 0.15, widthMult: 4 },
          { blur: glowIntensity * 1.5, alpha: 0.25, widthMult: 2.5 },
          { blur: glowIntensity, alpha: 0.4, widthMult: 1.5 },
        ];
        
        for (const pass of glowPasses) {
          context.shadowBlur = pass.blur;
          context.shadowColor = color;
          context.strokeStyle = color.replace(')', `, ${pass.alpha})`).replace('hsl', 'hsla');
          context.lineWidth = lineWidth * pass.widthMult;
          drawPath();
          context.stroke();
        }
      }

      context.shadowBlur = 0;
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      drawPath();

      if (filled) {
        context.lineTo(width, centerY);
        context.lineTo(0, centerY);
        context.closePath();
        const gradient = context.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, color.replace(')', ', 0.3)').replace('hsl', 'hsla'));
        gradient.addColorStop(0.5, color.replace(')', ', 0.1)').replace('hsl', 'hsla'));
        gradient.addColorStop(1, color.replace(')', ', 0.3)').replace('hsl', 'hsla'));
        context.fillStyle = gradient;
        context.fill();
      }

      context.stroke();

      if (showGridLines) {
        context.strokeStyle = `${color.replace(')', ', 0.1)').replace('hsl', 'hsla')}`;
        context.lineWidth = 1;
        
        const gridLineCount = 5;
        for (let i = 1; i < gridLineCount; i++) {
          const y = (height / gridLineCount) * i;
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(width, y);
          context.stroke();
        }
      }
    },

    resize(ctx: VisualizationRenderContext) {},

    destroy() {},
  };
}

export const waveform: VisualizationModule = {
  metadata,
  audioPreferences,
  defaultParameters,
  createInstance,
};
