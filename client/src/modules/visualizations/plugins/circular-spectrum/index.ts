import { VisualizationModule, VisualizationInstance, VisualizationRenderContext, AudioFrameData } from '../../types';

const metadata = {
  id: 'circular-spectrum',
  name: 'Circular Spectrum',
  description: 'Radial frequency visualization with pulsing center',
  category: 'geometric' as const,
};

const audioPreferences = {
  fftSize: 512 as const,
  smoothingTimeConstant: 0.8,
  minDecibels: -85,
  maxDecibels: -10,
};

const defaultParameters = {
  barCount: { type: 'number' as const, label: 'Bars', value: 120, min: 32, max: 180, step: 8 },
  innerRadius: { type: 'number' as const, label: 'Inner Radius', value: 0.2, min: 0.1, max: 0.4, step: 0.05 },
  rotation: { type: 'boolean' as const, label: 'Rotate', value: true },
  rotationSpeed: { type: 'number' as const, label: 'Speed', value: 0.5, min: 0.1, max: 2, step: 0.1 },
  colorShift: { type: 'boolean' as const, label: 'Color Shift', value: true },
};

function createInstance(): VisualizationInstance {
  let angle = 0;
  let colorOffset = 0;

  return {
    init(ctx: VisualizationRenderContext) {
      angle = 0;
      colorOffset = 0;
    },

    render(ctx: VisualizationRenderContext, audio: AudioFrameData, params: Record<string, number | string | boolean>) {
      const { width, height, deltaTime } = ctx;
      const context = ctx.ctx;
      const barCount = params.barCount as number || 120;
      const innerRadiusRatio = params.innerRadius as number || 0.2;
      const rotate = params.rotation as boolean;
      const rotationSpeed = params.rotationSpeed as number || 0.5;
      const colorShift = params.colorShift as boolean;

      context.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.min(width, height) / 2 * 0.9;
      const innerRadius = maxRadius * innerRadiusRatio;

      if (rotate) {
        angle += deltaTime * 0.001 * rotationSpeed;
      }

      if (colorShift) {
        colorOffset += deltaTime * 0.05;
      }

      const step = Math.floor(audio.frequencyData.length / barCount);
      const angleStep = (Math.PI * 2) / barCount;

      for (let i = 0; i < barCount; i++) {
        const dataIndex = i * step;
        const value = audio.frequencyData[dataIndex] / 255;
        const barLength = value * (maxRadius - innerRadius) * 0.8;

        const currentAngle = i * angleStep + angle;
        const x1 = centerX + Math.cos(currentAngle) * innerRadius;
        const y1 = centerY + Math.sin(currentAngle) * innerRadius;
        const x2 = centerX + Math.cos(currentAngle) * (innerRadius + barLength);
        const y2 = centerY + Math.sin(currentAngle) * (innerRadius + barLength);

        const hue = colorShift 
          ? ((i / barCount) * 120 + colorOffset + value * 60) % 360
          : 271 + (i / barCount) * 80;

        context.strokeStyle = `hsl(${hue}, 85%, ${50 + value * 20}%)`;
        context.lineWidth = Math.max(2, (Math.PI * 2 * innerRadius) / barCount - 1);
        context.lineCap = 'round';

        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.stroke();
      }

      const pulseRadius = innerRadius * 0.8 * (1 + audio.bassLevel / 255 * 0.3);
      const gradient = context.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, pulseRadius
      );
      gradient.addColorStop(0, 'hsla(271, 91%, 65%, 0.8)');
      gradient.addColorStop(0.5, 'hsla(271, 91%, 65%, 0.3)');
      gradient.addColorStop(1, 'hsla(271, 91%, 65%, 0)');

      context.fillStyle = gradient;
      context.beginPath();
      context.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = 'hsla(271, 91%, 75%, 0.9)';
      context.beginPath();
      context.arc(centerX, centerY, innerRadius * 0.3, 0, Math.PI * 2);
      context.fill();
    },

    resize(ctx: VisualizationRenderContext) {},

    destroy() {},
  };
}

export const circularSpectrum: VisualizationModule = {
  metadata,
  audioPreferences,
  defaultParameters,
  createInstance,
};
