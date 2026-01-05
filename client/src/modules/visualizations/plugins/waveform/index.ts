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
        
        // Primary hue driven by frequency balance - bass=red/orange, mid=green/cyan, treble=blue/purple
        const bassHue = 0 + bass * 40;      // Red to orange
        const midHue = 120 + mid * 60;      // Green to cyan  
        const trebleHue = 240 + treble * 80; // Blue to purple
        
        // Blend hues based on which frequency is dominant
        const total = bass + mid + treble + 0.001;
        const primaryHue = (bassHue * bass + midHue * mid + trebleHue * treble) / total;
        
        for (let i = 0; i < points.length - 1; i++) {
          const progress = i / (points.length - 1);
          const localIntensity = points[i].intensity;
          
          // Sample frequency at this position for local color variation
          const freqIndex = Math.floor(progress * freqLen);
          const localFreq = freqData[Math.min(freqIndex, freqLen - 1)] / 255;
          
          // Determine local frequency band for this segment
          let localBandHue: number;
          if (progress < 0.33) {
            // Left third - bass influenced
            localBandHue = bassHue + localFreq * 60;
          } else if (progress < 0.66) {
            // Middle third - mid influenced  
            localBandHue = midHue + localFreq * 50;
          } else {
            // Right third - treble influenced
            localBandHue = trebleHue + localFreq * 40;
          }
          
          // Blend between primary hue and local band hue based on local frequency intensity
          const hue = (primaryHue * 0.4 + localBandHue * 0.6 + localIntensity * 60) % 360;
          
          // Saturation pulses with energy
          const saturation = 60 + energy * 40 + localFreq * 20;
          // Lightness responds to local waveform amplitude and treble
          const lightness = 40 + localIntensity * 30 + treble * 25;
          
          const segmentColor = `hsl(${hue}, ${Math.min(100, saturation)}%, ${Math.min(80, lightness)}%)`;
          
          context.beginPath();
          context.strokeStyle = segmentColor;
          context.lineWidth = lineWidth + localIntensity * 3 + bass * 3;
          context.shadowBlur = glowIntensity + energy * 20 + localFreq * 10;
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
          // Gradient based on frequency bands
          gradient.addColorStop(0, `hsla(${bassHue}, ${70 + bass * 30}%, 50%, ${0.15 + bass * 0.2})`);
          gradient.addColorStop(0.33, `hsla(${(bassHue + midHue) / 2}, ${70 + energy * 30}%, 50%, ${0.1 + mid * 0.15})`);
          gradient.addColorStop(0.5, `hsla(${midHue}, ${70 + mid * 30}%, 50%, ${0.15 + mid * 0.2})`);
          gradient.addColorStop(0.66, `hsla(${(midHue + trebleHue) / 2}, ${70 + energy * 30}%, 50%, ${0.1 + treble * 0.15})`);
          gradient.addColorStop(1, `hsla(${trebleHue}, ${70 + treble * 30}%, 50%, ${0.15 + treble * 0.2})`);
          
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
        // Grid color matches the dominant frequency
        const dominantHue = bass > mid && bass > treble ? (bass * 40) 
          : mid > treble ? (120 + mid * 60) 
          : (240 + treble * 80);
        const gridColor = isReactive 
          ? `hsla(${dominantHue}, ${50 + energy * 40}%, 50%, ${0.08 + energy * 0.08})`
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
