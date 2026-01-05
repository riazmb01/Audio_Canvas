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
};

function createInstance(): VisualizationInstance {
  return {
    init(ctx: VisualizationRenderContext) {},

    render(ctx: VisualizationRenderContext, audio: AudioFrameData, params: Record<string, number | string | boolean>) {
      const { width, height } = ctx;
      const context = ctx.ctx;
      const amplitude = params.amplitude as number ?? 1;
      const smoothness = params.smoothness as number ?? 0;
      const lineWidth = params.lineWidth as number || 3;
      const glowIntensity = params.glowIntensity as number || 20;
      const colorMode = params.colorMode as string || 'cyan';
      const filled = params.filled as boolean || false;

      context.clearRect(0, 0, width, height);

      const colors: Record<string, string> = {
        cyan: 'hsl(190, 95%, 50%)',
        purple: 'hsl(271, 91%, 65%)',
        green: 'hsl(142, 76%, 45%)',
        reactive: `hsl(${190 + audio.averageFrequency * 0.5}, 90%, 55%)`,
      };

      const color = colors[colorMode] || colors.cyan;
      const bufferLength = audio.waveformData.length;
      const sliceWidth = width / bufferLength;

      context.shadowBlur = glowIntensity;
      context.shadowColor = color;
      context.lineWidth = lineWidth;
      context.strokeStyle = color;
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

      context.shadowBlur = 0;

      context.strokeStyle = `${color.replace(')', ', 0.1)').replace('hsl', 'hsla')}`;
      context.lineWidth = 1;
      
      const gridLines = 5;
      for (let i = 1; i < gridLines; i++) {
        const y = (height / gridLines) * i;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
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
