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
      const points: { x: number; y: number }[] = [];
      
      for (let i = 0; i < bufferLength; i++) {
        const v = (audio.waveformData[i] / 128.0) - 1;
        const y = centerY + v * (height / 2) * amplitude;
        points.push({ x: i * sliceWidth, y });
      }

      context.beginPath();
      context.moveTo(points[0].x, points[0].y);

      if (smoothness > 0) {
        for (let i = 1; i < points.length - 1; i++) {
          const prev = points[i - 1];
          const curr = points[i];
          const next = points[i + 1];
          
          const cpX1 = prev.x + (curr.x - prev.x) * (0.5 + smoothness * 0.3);
          const cpY1 = prev.y + (curr.y - prev.y) * smoothness;
          const cpX2 = curr.x - (next.x - prev.x) * 0.1 * smoothness;
          const cpY2 = curr.y;
          
          context.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, curr.x, curr.y);
        }
        context.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      } else {
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
