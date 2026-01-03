import { VisualizationModule, VisualizationRenderContext, AudioFrameData } from '../../types';

interface Ribbon {
  phase: number;
  speed: number;
  amplitude: number;
  yOffset: number;
  hueShift: number;
  thickness: number;
}

interface Spark {
  angle: number;
  distance: number;
  speed: number;
  size: number;
  brightness: number;
  hue: number;
}

interface BloomLayer {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  hue: number;
  pulsePhase: number;
}

export const auroraBloom: VisualizationModule = {
  metadata: {
    id: 'aurora-bloom',
    name: 'Aurora Bloom',
    description: 'Ethereal aurora ribbons with glowing halos and orbiting sparks',
    category: 'geometric',
  },
  audioPreferences: {
    fftSize: 2048,
    smoothingTimeConstant: 0.85,
    minDecibels: -90,
    maxDecibels: -10,
  },
  defaultParameters: {
    ribbonCount: { type: 'number' as const, label: 'Ribbons', value: 5, min: 2, max: 8, step: 1 },
    bloomIntensity: { type: 'number' as const, label: 'Bloom', value: 0.7, min: 0, max: 1.5, step: 0.1 },
    sparkDensity: { type: 'number' as const, label: 'Sparks', value: 30, min: 0, max: 80, step: 5 },
    colorTheme: { type: 'select' as const, label: 'Colors', value: '0', options: [
      { value: '0', label: 'Purple Aurora' },
      { value: '1', label: 'Ocean Depths' },
      { value: '2', label: 'Solar Flare' },
      { value: '3', label: 'Borealis' },
    ]},
    motionSpeed: { type: 'number' as const, label: 'Speed', value: 1.0, min: 0.3, max: 2.0, step: 0.1 },
  },
  createInstance: () => {
    let ribbons: Ribbon[] = [];
    let sparks: Spark[] = [];
    let bloomLayers: BloomLayer[] = [];
    let time = 0;
    let bassSmooth = 0;
    let midSmooth = 0;
    let highSmooth = 0;
    
    const colorThemes = [
      { primary: 280, secondary: 200, accent: 320 },
      { primary: 160, secondary: 200, accent: 280 },
      { primary: 20, secondary: 340, accent: 50 },
      { primary: 180, secondary: 220, accent: 160 },
    ];

    const initRibbons = (count: number, height: number) => {
      ribbons = [];
      for (let i = 0; i < count; i++) {
        ribbons.push({
          phase: Math.random() * Math.PI * 2,
          speed: 0.3 + Math.random() * 0.4,
          amplitude: 30 + Math.random() * 50,
          yOffset: height * 0.3 + (height * 0.4 * i / count),
          hueShift: i * 30,
          thickness: 20 + Math.random() * 30,
        });
      }
    };

    const initSparks = (count: number) => {
      sparks = [];
      for (let i = 0; i < count; i++) {
        sparks.push({
          angle: Math.random() * Math.PI * 2,
          distance: 100 + Math.random() * 150,
          speed: 0.5 + Math.random() * 1.5,
          size: 1 + Math.random() * 3,
          brightness: 0.5 + Math.random() * 0.5,
          hue: Math.random() * 60,
        });
      }
    };

    const initBloomLayers = (width: number, height: number) => {
      bloomLayers = [];
      for (let i = 0; i < 4; i++) {
        bloomLayers.push({
          x: width * (0.2 + Math.random() * 0.6),
          y: height * (0.3 + Math.random() * 0.4),
          radius: 80 + Math.random() * 120,
          intensity: 0.3 + Math.random() * 0.4,
          hue: i * 90,
          pulsePhase: Math.random() * Math.PI * 2,
        });
      }
    };

    return {
      init: (ctx: VisualizationRenderContext) => {
        initRibbons(5, ctx.height);
        initSparks(30);
        initBloomLayers(ctx.width, ctx.height);
      },

      render: (
        ctx: VisualizationRenderContext,
        audio: AudioFrameData,
        params: Record<string, string | number | boolean>
      ) => {
        const { canvas, ctx: c, width, height } = ctx;
        const ribbonCount = (params.ribbonCount as number) || 5;
        const bloomIntensity = (params.bloomIntensity as number) || 0.7;
        const sparkDensity = (params.sparkDensity as number) || 30;
        const colorThemeIndex = parseInt(params.colorTheme as string, 10) || 0;
        const motionSpeed = (params.motionSpeed as number) || 1.0;
        
        const theme = colorThemes[colorThemeIndex % colorThemes.length];
        
        const smoothing = 0.15;
        bassSmooth += (audio.bassLevel - bassSmooth) * smoothing;
        midSmooth += (audio.midLevel - midSmooth) * smoothing;
        highSmooth += (audio.highLevel - highSmooth) * smoothing;
        
        const bassNorm = Math.min(bassSmooth / 200, 1);
        const midNorm = Math.min(midSmooth / 150, 1);
        const highNorm = Math.min(highSmooth / 100, 1);
        
        time += 0.016 * motionSpeed;
        
        if (ribbons.length !== ribbonCount) {
          initRibbons(ribbonCount, height);
        }
        if (sparks.length !== Math.round(sparkDensity)) {
          initSparks(Math.round(sparkDensity));
        }

        c.fillStyle = 'rgba(0, 0, 0, 0.15)';
        c.fillRect(0, 0, width, height);

        c.globalCompositeOperation = 'lighter';

        bloomLayers.forEach((bloom, i) => {
          const pulse = Math.sin(time * 0.5 + bloom.pulsePhase) * 0.3 + 0.7;
          const audioBoost = 1 + midNorm * 1.5;
          const currentRadius = bloom.radius * pulse * audioBoost * bloomIntensity;
          const intensity = bloom.intensity * (0.5 + midNorm * 0.5) * bloomIntensity;
          
          const gradient = c.createRadialGradient(
            bloom.x, bloom.y, 0,
            bloom.x, bloom.y, currentRadius
          );
          
          const hue = (theme.primary + bloom.hue + time * 10) % 360;
          gradient.addColorStop(0, `hsla(${hue}, 80%, 70%, ${intensity * 0.6})`);
          gradient.addColorStop(0.3, `hsla(${hue}, 70%, 50%, ${intensity * 0.3})`);
          gradient.addColorStop(0.6, `hsla(${hue}, 60%, 40%, ${intensity * 0.1})`);
          gradient.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
          
          c.fillStyle = gradient;
          c.beginPath();
          c.arc(bloom.x, bloom.y, currentRadius, 0, Math.PI * 2);
          c.fill();
          
          bloom.x += Math.sin(time * 0.3 + i) * 0.5;
          bloom.y += Math.cos(time * 0.2 + i) * 0.3;
          
          if (bloom.x < 0) bloom.x = width;
          if (bloom.x > width) bloom.x = 0;
          if (bloom.y < 0) bloom.y = height;
          if (bloom.y > height) bloom.y = 0;
        });

        ribbons.forEach((ribbon, ribbonIndex) => {
          const waveAmplitude = ribbon.amplitude * (1 + bassNorm * 2);
          const segments = 100;
          
          c.beginPath();
          
          for (let i = 0; i <= segments; i++) {
            const x = (i / segments) * width;
            const progress = i / segments;
            
            const wave1 = Math.sin(progress * Math.PI * 4 + time * ribbon.speed + ribbon.phase);
            const wave2 = Math.sin(progress * Math.PI * 2 + time * ribbon.speed * 0.7) * 0.5;
            const wave3 = Math.sin(progress * Math.PI * 8 + time * ribbon.speed * 1.3) * 0.3 * highNorm;
            
            const combinedWave = (wave1 + wave2 + wave3) * waveAmplitude;
            const y = ribbon.yOffset + combinedWave;
            
            if (i === 0) {
              c.moveTo(x, y);
            } else {
              c.lineTo(x, y);
            }
          }

          for (let i = segments; i >= 0; i--) {
            const x = (i / segments) * width;
            const progress = i / segments;
            
            const wave1 = Math.sin(progress * Math.PI * 4 + time * ribbon.speed + ribbon.phase);
            const wave2 = Math.sin(progress * Math.PI * 2 + time * ribbon.speed * 0.7) * 0.5;
            const wave3 = Math.sin(progress * Math.PI * 8 + time * ribbon.speed * 1.3) * 0.3 * highNorm;
            
            const combinedWave = (wave1 + wave2 + wave3) * waveAmplitude;
            const thickness = ribbon.thickness * (0.5 + midNorm * 0.5);
            const y = ribbon.yOffset + combinedWave + thickness;
            
            c.lineTo(x, y);
          }
          
          c.closePath();
          
          const hue = (theme.primary + ribbon.hueShift + time * 5) % 360;
          const gradient = c.createLinearGradient(0, ribbon.yOffset - 50, 0, ribbon.yOffset + 50);
          gradient.addColorStop(0, `hsla(${hue}, 80%, 60%, 0)`);
          gradient.addColorStop(0.3, `hsla(${hue}, 85%, 65%, ${0.4 + bassNorm * 0.3})`);
          gradient.addColorStop(0.5, `hsla(${(hue + 30) % 360}, 90%, 70%, ${0.6 + bassNorm * 0.3})`);
          gradient.addColorStop(0.7, `hsla(${hue}, 85%, 65%, ${0.4 + bassNorm * 0.3})`);
          gradient.addColorStop(1, `hsla(${hue}, 80%, 60%, 0)`);
          
          c.fillStyle = gradient;
          c.fill();
        });

        const centerX = width / 2;
        const centerY = height / 2;
        
        sparks.forEach((spark) => {
          spark.angle += spark.speed * 0.02 * motionSpeed * (1 + highNorm);
          
          const orbitRadius = spark.distance * (0.8 + bassNorm * 0.4);
          const x = centerX + Math.cos(spark.angle) * orbitRadius;
          const y = centerY + Math.sin(spark.angle * 0.7) * orbitRadius * 0.6;
          
          const twinkle = Math.sin(time * 5 + spark.angle) * 0.3 + 0.7;
          const size = spark.size * (1 + highNorm * 2) * twinkle;
          const brightness = spark.brightness * (0.5 + highNorm * 0.5);
          
          const hue = (theme.accent + spark.hue + time * 20) % 360;
          
          const gradient = c.createRadialGradient(x, y, 0, x, y, size * 3);
          gradient.addColorStop(0, `hsla(${hue}, 100%, 90%, ${brightness})`);
          gradient.addColorStop(0.3, `hsla(${hue}, 90%, 70%, ${brightness * 0.5})`);
          gradient.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
          
          c.fillStyle = gradient;
          c.beginPath();
          c.arc(x, y, size * 3, 0, Math.PI * 2);
          c.fill();
          
          c.fillStyle = `hsla(${hue}, 100%, 95%, ${brightness})`;
          c.beginPath();
          c.arc(x, y, size * 0.5, 0, Math.PI * 2);
          c.fill();
        });

        const peakGlow = audio.averageFrequency / 200;
        if (peakGlow > 0.3) {
          const gradient = c.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, Math.max(width, height) * 0.5
          );
          const hue = (theme.secondary + time * 30) % 360;
          gradient.addColorStop(0, `hsla(${hue}, 70%, 60%, ${peakGlow * 0.15})`);
          gradient.addColorStop(0.5, `hsla(${hue}, 60%, 40%, ${peakGlow * 0.05})`);
          gradient.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
          
          c.fillStyle = gradient;
          c.fillRect(0, 0, width, height);
        }

        c.globalCompositeOperation = 'source-over';
      },

      resize: (ctx: VisualizationRenderContext) => {
        initBloomLayers(ctx.width, ctx.height);
        initRibbons(ribbons.length || 5, ctx.height);
      },

      destroy: () => {
        ribbons = [];
        sparks = [];
        bloomLayers = [];
      },
    };
  },
};
