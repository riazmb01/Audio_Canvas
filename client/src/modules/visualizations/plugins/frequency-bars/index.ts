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
    { label: 'Reactive', value: 'reactive' },
  ]},
  sensitivity: { type: 'number' as const, label: 'Sensitivity', value: 1.5, min: 0.2, max: 5, step: 0.1 },
  mirror: { type: 'boolean' as const, label: 'Mirror Effect', value: false },
};

function createInstance(): VisualizationInstance {
  let barHeights: number[] = [];
  let bandBoundaries: number[] = [];
  let smoothedBass = 0;
  let smoothedTreble = 0;
  let smoothedEnergy = 0;
  let time = 0;
  const SMOOTH_FACTOR = 0.15;

  function computeBandBoundaries(barCount: number, dataLength: number): number[] {
    const boundaries: number[] = [];
    const minFreq = 1;
    const maxFreq = dataLength;
    
    for (let i = 0; i <= barCount; i++) {
      const ratio = i / barCount;
      const logBoundary = minFreq * Math.pow(maxFreq / minFreq, ratio);
      boundaries.push(Math.floor(logBoundary));
    }
    
    for (let i = 1; i <= barCount; i++) {
      if (boundaries[i] <= boundaries[i - 1]) {
        boundaries[i] = boundaries[i - 1] + 1;
      }
      if (boundaries[i] > dataLength) {
        boundaries[i] = dataLength;
      }
    }
    
    return boundaries;
  }

  return {
    init(ctx: VisualizationRenderContext) {
      barHeights = new Array(128).fill(0);
      bandBoundaries = [];
    },

    render(ctx: VisualizationRenderContext, audio: AudioFrameData, params: Record<string, number | string | boolean>) {
      const { canvas, width, height, deltaTime } = ctx;
      const context = ctx.ctx;
      const barCount = params.barCount as number || 64;
      const barGap = params.barGap as number || 2;
      const colorMode = params.colorMode as string || 'gradient';
      const sensitivity = params.sensitivity as number || 1.5;
      const mirror = params.mirror as boolean || false;

      time += deltaTime * 0.001;

      const freqData = audio.frequencyData;
      const len = freqData.length;
      const bassEnd = Math.floor(len * 0.15);
      const midEnd = Math.floor(len * 0.5);
      
      let bassSum = 0, trebleSum = 0, totalSum = 0;
      for (let j = 0; j < len; j++) {
        const val = freqData[j];
        if (j < bassEnd) bassSum += val;
        else if (j >= midEnd) trebleSum += val;
        totalSum += val;
      }
      
      const rawBass = bassEnd > 0 ? bassSum / bassEnd / 255 : 0;
      const rawTreble = (len - midEnd) > 0 ? trebleSum / (len - midEnd) / 255 : 0;
      const rawEnergy = totalSum / len / 255;
      
      smoothedBass += (rawBass - smoothedBass) * SMOOTH_FACTOR;
      smoothedTreble += (rawTreble - smoothedTreble) * SMOOTH_FACTOR;
      smoothedEnergy += (rawEnergy - smoothedEnergy) * SMOOTH_FACTOR;

      context.clearRect(0, 0, width, height);

      if (bandBoundaries.length !== barCount + 1) {
        bandBoundaries = computeBandBoundaries(barCount, audio.frequencyData.length);
      }

      const barWidth = (width - (barCount - 1) * barGap) / barCount;

      for (let i = 0; i < barCount; i++) {
        const startIndex = bandBoundaries[i];
        const endIndex = bandBoundaries[i + 1];
        
        let maxValue = 0;
        for (let j = startIndex; j < endIndex && j < audio.frequencyData.length; j++) {
          if (audio.frequencyData[j] > maxValue) {
            maxValue = audio.frequencyData[j];
          }
        }
        
        const octaveBoost = 1 + (i / barCount) * 0.5;
        const normalizedValue = Math.min(1, (maxValue / 255) * octaveBoost);
        
        const targetHeight = normalizedValue * height * sensitivity * 0.8;
        
        barHeights[i] = barHeights[i] + (targetHeight - barHeights[i]) * 0.3;
        const barHeight = Math.max(2, barHeights[i]);

        const x = i * (barWidth + barGap);
        const centerY = height / 2;
        const y = mirror ? centerY - barHeight : height - barHeight;
        const drawHeight = mirror ? barHeight * 2 : barHeight;

        let gradient;
        if (colorMode === 'gradient') {
          gradient = context.createLinearGradient(x, y + drawHeight, x, y);
          gradient.addColorStop(0, 'hsl(271, 91%, 65%)');
          gradient.addColorStop(0.5, 'hsl(340, 82%, 52%)');
          gradient.addColorStop(1, 'hsl(43, 96%, 56%)');
        } else if (colorMode === 'rainbow') {
          const hue = (i / barCount) * 360;
          gradient = `hsl(${hue}, 80%, 60%)`;
        } else if (colorMode === 'reactive') {
          const trebleShift = smoothedTreble * 120;
          const energyShift = smoothedEnergy * 80;
          const timeShift = time * 20;
          const barOffset = (i / barCount) * 60;
          const baseHue = (190 + trebleShift + energyShift + timeShift + barOffset) % 360;
          const sat = 75 + smoothedEnergy * 25;
          const lit = 50 + smoothedTreble * 20;
          
          gradient = context.createLinearGradient(x, y + drawHeight, x, y);
          gradient.addColorStop(0, `hsl(${baseHue}, ${sat}%, ${lit}%)`);
          gradient.addColorStop(1, `hsl(${(baseHue + 40) % 360}, ${sat}%, ${lit + 10}%)`);
        } else {
          gradient = 'hsl(271, 91%, 65%)';
        }

        context.fillStyle = gradient;
        context.beginPath();
        context.roundRect(x, y, barWidth, drawHeight, 2);
        context.fill();
      }
    },

    resize(ctx: VisualizationRenderContext) {
      barHeights = new Array(128).fill(0);
      bandBoundaries = [];
    },

    destroy() {
      barHeights = [];
      bandBoundaries = [];
    },
  };
}

export const frequencyBars: VisualizationModule = {
  metadata,
  audioPreferences,
  defaultParameters,
  createInstance,
};
