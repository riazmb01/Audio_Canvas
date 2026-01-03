import { VisualizationModule, VisualizationInstance, VisualizationRenderContext, AudioFrameData } from '../../types';

const metadata = {
  id: 'frequency-bars',
  name: 'Frequency Bars',
  description: 'Classic spectrum analyzer with reactive color bars',
  category: 'frequency' as const,
};

const audioPreferences = {
  fftSize: 256 as const,
  smoothingTimeConstant: 0.85,
  minDecibels: -90,
  maxDecibels: -10,
};

const defaultParameters = {
  barCount: { type: 'number' as const, label: 'Bar Count', value: 64, min: 16, max: 128, step: 8 },
  barGap: { type: 'number' as const, label: 'Gap Size', value: 2, min: 0, max: 8, step: 1 },
  colorMode: { type: 'select' as const, label: 'Color Mode', value: 'gradient', options: [
    { label: 'Gradient', value: 'gradient' },
    { label: 'Solid', value: 'solid' },
    { label: 'Rainbow', value: 'rainbow' },
  ]},
  sensitivity: { type: 'number' as const, label: 'Sensitivity', value: 1.5, min: 0.5, max: 3, step: 0.1 },
  mirror: { type: 'boolean' as const, label: 'Mirror Effect', value: false },
};

function createInstance(): VisualizationInstance {
  let barHeights: number[] = [];

  return {
    init(ctx: VisualizationRenderContext) {
      barHeights = new Array(128).fill(0);
    },

    render(ctx: VisualizationRenderContext, audio: AudioFrameData, params: Record<string, number | string | boolean>) {
      const { canvas, width, height } = ctx;
      const context = ctx.ctx;
      const barCount = params.barCount as number || 64;
      const barGap = params.barGap as number || 2;
      const colorMode = params.colorMode as string || 'gradient';
      const sensitivity = params.sensitivity as number || 1.5;
      const mirror = params.mirror as boolean || false;

      context.clearRect(0, 0, width, height);

      const barWidth = (width - (barCount - 1) * barGap) / barCount;
      const step = Math.floor(audio.frequencyData.length / barCount);

      for (let i = 0; i < barCount; i++) {
        const dataIndex = i * step;
        const value = audio.frequencyData[dataIndex] / 255;
        const targetHeight = value * height * sensitivity * 0.8;
        
        barHeights[i] = barHeights[i] + (targetHeight - barHeights[i]) * 0.3;
        const barHeight = Math.max(2, barHeights[i]);

        const x = i * (barWidth + barGap);
        const y = mirror ? (height - barHeight) / 2 : height - barHeight;

        let gradient;
        if (colorMode === 'gradient') {
          gradient = context.createLinearGradient(x, y + barHeight, x, y);
          gradient.addColorStop(0, 'hsl(271, 91%, 65%)');
          gradient.addColorStop(0.5, 'hsl(340, 82%, 52%)');
          gradient.addColorStop(1, 'hsl(43, 96%, 56%)');
        } else if (colorMode === 'rainbow') {
          const hue = (i / barCount) * 360;
          gradient = `hsl(${hue}, 80%, 60%)`;
        } else {
          gradient = 'hsl(271, 91%, 65%)';
        }

        context.fillStyle = gradient;
        context.beginPath();
        context.roundRect(x, y, barWidth, mirror ? barHeight * 2 : barHeight, 2);
        context.fill();

        if (mirror) {
          context.globalAlpha = 0.3;
          context.beginPath();
          context.roundRect(x, y, barWidth, barHeight * 2, 2);
          context.fill();
          context.globalAlpha = 1;
        }
      }
    },

    resize(ctx: VisualizationRenderContext) {
      barHeights = new Array(128).fill(0);
    },

    destroy() {
      barHeights = [];
    },
  };
}

export const frequencyBars: VisualizationModule = {
  metadata,
  audioPreferences,
  defaultParameters,
  createInstance,
};
