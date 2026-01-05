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
  showGridLines: { type: 'boolean' as const, label: 'Grid Lines', value: true },
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
      const showGridLines = params.showGridLines as boolean ?? true;

      context.clearRect(0, 0, width, height);

      const freqData = audio.frequencyData;
      const freqLen = freqData.length;
      
      let bassSum = 0, midSum = 0, trebleSum = 0;
      const bassEnd = Math.floor(freqLen * 0.1);
      const midEnd = Math.floor(freqLen * 0.5);
      
      for (let i = 0; i < freqLen; i++) {
        const val = freqData[i] / 255;
        if (i < bassEnd) bassSum += val;
        else if (i < midEnd) midSum += val;
        else trebleSum += val;
      }
      
      const bass = bassSum / bassEnd;
      const mid = midSum / (midEnd - bassEnd);
      const treble = trebleSum / (freqLen - midEnd);
      const energy = (bass + mid + treble) / 3;

      const colors: Record<string, string> = {
        cyan: 'hsl(190, 95%, 50%)',
        purple: 'hsl(271, 91%, 65%)',
        green: 'hsl(142, 76%, 45%)',
        reactive: 'dynamic',
      };

      const isReactive = colorMode === 'reactive';
      const staticColor = colors[colorMode] || colors.cyan;
      
      const bufferLength = audio.waveformData.length;
      const sliceWidth = width / bufferLength;

      const centerY = height / 2;
      
      const sampleStep = Math.max(1, Math.floor(1 + smoothness * 31));
      const points: { x: number; y: number; intensity: number }[] = [];
      
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
        const intensity = Math.abs(v);
        points.push({ x: (i + sampleStep / 2) * sliceWidth, y, intensity });
      }
      
      if (points.length > 0) {
        points[0].x = 0;
        points[points.length - 1].x = width;
      }

      if (isReactive && points.length > 1) {
        context.lineCap = 'round';
        context.lineJoin = 'round';
        
        for (let i = 0; i < points.length - 1; i++) {
          const progress = i / (points.length - 1);
          const localIntensity = points[i].intensity;
          
          const freqIndex = Math.floor(progress * freqLen);
          const localFreq = freqData[Math.min(freqIndex, freqLen - 1)] / 255;
          
          const baseHue = progress * 300;
          const hueShift = bass * 60 - treble * 40 + localFreq * 80;
          const hue = (baseHue + hueShift + energy * 50) % 360;
          
          const saturation = 70 + localFreq * 30 + mid * 20;
          const lightness = 45 + localIntensity * 25 + treble * 20;
          
          const segmentColor = `hsl(${hue}, ${Math.min(100, saturation)}%, ${Math.min(75, lightness)}%)`;
          
          context.beginPath();
          context.strokeStyle = segmentColor;
          context.lineWidth = lineWidth + localIntensity * 2 + bass * 2;
          context.shadowBlur = glowIntensity + localFreq * 15;
          context.shadowColor = segmentColor;
          
          const p1 = points[i];
          const p2 = points[i + 1];
          
          if (smoothness > 0.3 && i > 0 && i < points.length - 2) {
            const p0 = points[i - 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            const tension = 0.3 + smoothness * 0.4;
            
            const cp1x = p1.x + (p2.x - p0.x) * tension / 3;
            const cp1y = p1.y + (p2.y - p0.y) * tension / 3;
            const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
            const cp2y = p2.y - (p3.y - p1.y) * tension / 3;
            
            context.moveTo(p1.x, p1.y);
            context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
          } else {
            context.moveTo(p1.x, p1.y);
            context.lineTo(p2.x, p2.y);
          }
          
          context.stroke();
        }
        
        if (filled) {
          const gradient = context.createLinearGradient(0, 0, width, 0);
          for (let i = 0; i <= 10; i++) {
            const progress = i / 10;
            const freqIndex = Math.floor(progress * freqLen);
            const localFreq = freqData[Math.min(freqIndex, freqLen - 1)] / 255;
            const hue = (progress * 300 + bass * 60 + energy * 50) % 360;
            gradient.addColorStop(progress, `hsla(${hue}, 80%, 50%, ${0.1 + localFreq * 0.2})`);
          }
          
          context.beginPath();
          context.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            context.lineTo(points[i].x, points[i].y);
          }
          context.lineTo(width, centerY);
          context.lineTo(0, centerY);
          context.closePath();
          context.fillStyle = gradient;
          context.shadowBlur = 0;
          context.fill();
        }
      } else {
        context.shadowBlur = glowIntensity;
        context.shadowColor = staticColor;
        context.lineWidth = lineWidth;
        context.strokeStyle = staticColor;
        context.lineCap = 'round';
        context.lineJoin = 'round';

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
          gradient.addColorStop(0, staticColor.replace(')', ', 0.3)').replace('hsl', 'hsla'));
          gradient.addColorStop(0.5, staticColor.replace(')', ', 0.1)').replace('hsl', 'hsla'));
          gradient.addColorStop(1, staticColor.replace(')', ', 0.3)').replace('hsl', 'hsla'));
          context.fillStyle = gradient;
          context.fill();
        }

        context.stroke();
      }

      context.shadowBlur = 0;

      if (showGridLines) {
        const gridColor = isReactive 
          ? `hsla(${(energy * 100 + bass * 60) % 360}, 70%, 50%, 0.1)`
          : `${staticColor.replace(')', ', 0.1)').replace('hsl', 'hsla')}`;
        context.strokeStyle = gridColor;
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
