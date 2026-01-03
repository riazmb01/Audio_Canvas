import { VisualizationModule, VisualizationRenderContext, AudioFrameData } from '../../types';

interface Ribbon {
  points: { x: number; y: number; targetY: number }[];
  hue: number;
  thickness: number;
  speed: number;
  phase: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
  trail: { x: number; y: number }[];
}

interface Burst {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  hue: number;
  life: number;
}

interface Orb {
  x: number;
  y: number;
  radius: number;
  hue: number;
  pulsePhase: number;
  vx: number;
  vy: number;
}

export const auroraBloom: VisualizationModule = {
  metadata: {
    id: 'aurora-bloom',
    name: 'Aurora Bloom',
    description: 'Explosive aurora ribbons with reactive bursts and dancing sparks',
    category: 'geometric',
  },
  audioPreferences: {
    fftSize: 512,
    smoothingTimeConstant: 0.7,
    minDecibels: -85,
    maxDecibels: -10,
  },
  defaultParameters: {
    ribbonCount: { type: 'number' as const, label: 'Ribbons', value: 6, min: 3, max: 10, step: 1 },
    intensity: { type: 'number' as const, label: 'Intensity', value: 1.2, min: 0.5, max: 2.0, step: 0.1 },
    sparkDensity: { type: 'number' as const, label: 'Sparks', value: 50, min: 20, max: 100, step: 10 },
    colorTheme: { type: 'select' as const, label: 'Colors', value: '0', options: [
      { value: '0', label: 'Cosmic Purple' },
      { value: '1', label: 'Northern Lights' },
      { value: '2', label: 'Fire Storm' },
      { value: '3', label: 'Deep Ocean' },
    ]},
    chaos: { type: 'number' as const, label: 'Chaos', value: 0.7, min: 0.2, max: 1.5, step: 0.1 },
  },
  createInstance: () => {
    let ribbons: Ribbon[] = [];
    let sparks: Spark[] = [];
    let bursts: Burst[] = [];
    let orbs: Orb[] = [];
    let time = 0;
    let lastBassHit = 0;
    let bassAccumulator = 0;
    let prevBass = 0;
    let prevMid = 0;
    let prevHigh = 0;
    let globalHueShift = 0;
    let shakeX = 0;
    let shakeY = 0;
    let width = 0;
    let height = 0;
    
    const colorThemes = [
      { base: 280, range: 80, accent: 320 },
      { base: 120, range: 100, accent: 180 },
      { base: 15, range: 50, accent: 45 },
      { base: 200, range: 60, accent: 240 },
    ];

    const initRibbons = (count: number, w: number, h: number) => {
      ribbons = [];
      const segmentCount = 80;
      for (let i = 0; i < count; i++) {
        const points = [];
        const baseY = h * (0.2 + (0.6 * i / count));
        for (let j = 0; j <= segmentCount; j++) {
          const x = (j / segmentCount) * w;
          points.push({ x, y: baseY, targetY: baseY });
        }
        ribbons.push({
          points,
          hue: i * (360 / count),
          thickness: 15 + Math.random() * 25,
          speed: 0.5 + Math.random() * 0.5,
          phase: Math.random() * Math.PI * 2,
        });
      }
    };

    const spawnSpark = (x: number, y: number, intensity: number, hue: number) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = (3 + Math.random() * 8) * intensity;
      sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 60 + Math.random() * 60,
        size: 2 + Math.random() * 4,
        hue,
        trail: [],
      });
    };

    const spawnBurst = (x: number, y: number, hue: number, size: number) => {
      bursts.push({
        x,
        y,
        radius: 0,
        maxRadius: size,
        hue,
        life: 1,
      });
    };

    const initOrbs = (w: number, h: number) => {
      orbs = [];
      for (let i = 0; i < 5; i++) {
        orbs.push({
          x: Math.random() * w,
          y: Math.random() * h,
          radius: 60 + Math.random() * 100,
          hue: Math.random() * 360,
          pulsePhase: Math.random() * Math.PI * 2,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
        });
      }
    };

    return {
      init: (ctx: VisualizationRenderContext) => {
        width = ctx.width;
        height = ctx.height;
        initRibbons(6, width, height);
        initOrbs(width, height);
      },

      render: (
        ctx: VisualizationRenderContext,
        audio: AudioFrameData,
        params: Record<string, string | number | boolean>
      ) => {
        const { ctx: c } = ctx;
        width = ctx.width;
        height = ctx.height;
        
        const ribbonCount = (params.ribbonCount as number) || 6;
        const intensity = (params.intensity as number) || 1.2;
        const sparkDensity = (params.sparkDensity as number) || 50;
        const colorThemeIndex = parseInt(params.colorTheme as string, 10) || 0;
        const chaos = (params.chaos as number) || 0.7;
        
        const theme = colorThemes[colorThemeIndex % colorThemes.length];
        time += 0.016;

        const bass = audio.bassLevel * intensity;
        const mid = audio.midLevel * intensity;
        const high = audio.highLevel * intensity;
        const avg = audio.averageFrequency * intensity;

        const bassNorm = Math.min(bass / 150, 1);
        const midNorm = Math.min(mid / 120, 1);
        const highNorm = Math.min(high / 80, 1);
        const avgNorm = Math.min(avg / 100, 1);

        const bassDelta = bass - prevBass;
        const midDelta = mid - prevMid;
        const highDelta = high - prevHigh;
        prevBass = bass;
        prevMid = mid;
        prevHigh = high;

        if (bassDelta > 15 * chaos && time - lastBassHit > 0.1) {
          lastBassHit = time;
          const burstX = width * (0.2 + Math.random() * 0.6);
          const burstY = height * (0.3 + Math.random() * 0.4);
          spawnBurst(burstX, burstY, theme.base + Math.random() * theme.range, 150 + bassNorm * 200);
          
          for (let i = 0; i < 15 * chaos; i++) {
            spawnSpark(burstX, burstY, 1 + bassNorm, theme.base + Math.random() * theme.range);
          }
          
          shakeX = (Math.random() - 0.5) * 20 * bassNorm * chaos;
          shakeY = (Math.random() - 0.5) * 20 * bassNorm * chaos;
        }

        if (midDelta > 10 * chaos) {
          for (let i = 0; i < 5; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            spawnSpark(x, y, 0.5 + midNorm, theme.accent);
          }
        }

        if (highNorm > 0.5 && Math.random() < highNorm * 0.3 * chaos) {
          const x = Math.random() * width;
          const y = Math.random() * height * 0.5;
          spawnSpark(x, y, 0.3, theme.base + 60);
        }

        shakeX *= 0.85;
        shakeY *= 0.85;
        globalHueShift += avgNorm * 0.5;

        c.save();
        c.translate(shakeX, shakeY);

        c.fillStyle = `rgba(0, 0, 0, ${0.15 + (1 - avgNorm) * 0.1})`;
        c.fillRect(-20, -20, width + 40, height + 40);

        c.globalCompositeOperation = 'lighter';

        orbs.forEach((orb, i) => {
          const pulse = Math.sin(time * 2 + orb.pulsePhase) * 0.4 + 0.6;
          const audioBoost = 1 + midNorm * 2;
          const currentRadius = orb.radius * pulse * audioBoost;
          
          orb.x += orb.vx * (1 + bassNorm);
          orb.y += orb.vy * (1 + bassNorm);
          
          if (orb.x < -100) orb.x = width + 100;
          if (orb.x > width + 100) orb.x = -100;
          if (orb.y < -100) orb.y = height + 100;
          if (orb.y > height + 100) orb.y = -100;
          
          const hue = (theme.base + orb.hue + globalHueShift) % 360;
          const gradient = c.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, currentRadius);
          gradient.addColorStop(0, `hsla(${hue}, 100%, 70%, ${0.4 * midNorm + 0.2})`);
          gradient.addColorStop(0.4, `hsla(${hue}, 80%, 50%, ${0.2 * midNorm + 0.1})`);
          gradient.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
          
          c.fillStyle = gradient;
          c.beginPath();
          c.arc(orb.x, orb.y, currentRadius, 0, Math.PI * 2);
          c.fill();
        });

        bursts = bursts.filter(burst => {
          burst.life -= 0.03;
          burst.radius += (burst.maxRadius - burst.radius) * 0.15;
          
          if (burst.life <= 0) return false;
          
          const hue = (burst.hue + globalHueShift) % 360;
          const gradient = c.createRadialGradient(burst.x, burst.y, 0, burst.x, burst.y, burst.radius);
          gradient.addColorStop(0, `hsla(${hue}, 100%, 80%, ${burst.life * 0.6})`);
          gradient.addColorStop(0.3, `hsla(${hue}, 90%, 60%, ${burst.life * 0.4})`);
          gradient.addColorStop(0.6, `hsla(${(hue + 30) % 360}, 80%, 50%, ${burst.life * 0.2})`);
          gradient.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
          
          c.fillStyle = gradient;
          c.beginPath();
          c.arc(burst.x, burst.y, burst.radius, 0, Math.PI * 2);
          c.fill();
          
          return true;
        });

        if (ribbons.length !== ribbonCount) {
          initRibbons(ribbonCount, width, height);
        }

        const freqData = audio.frequencyData;
        const freqBucketSize = Math.floor(freqData.length / 80);

        ribbons.forEach((ribbon, ribbonIndex) => {
          const ribbonOffset = ribbonIndex * 10;
          
          ribbon.points.forEach((point, i) => {
            const freqIndex = Math.min(Math.floor(i * freqBucketSize) + ribbonOffset, freqData.length - 1);
            const freqValue = freqData[freqIndex] || 0;
            const freqNorm = freqValue / 255;
            
            const wave1 = Math.sin(i * 0.15 + time * ribbon.speed * 3 + ribbon.phase) * 30;
            const wave2 = Math.sin(i * 0.08 + time * ribbon.speed * 2) * 20;
            const wave3 = Math.sin(i * 0.25 + time * ribbon.speed * 5) * 10 * highNorm;
            
            const audioWave = freqNorm * 80 * intensity * chaos;
            const bassWave = bassNorm * 40 * Math.sin(i * 0.1 + time * 4);
            
            const baseY = height * (0.2 + (0.6 * ribbonIndex / ribbonCount));
            point.targetY = baseY + wave1 + wave2 + wave3 + audioWave + bassWave;
            point.y += (point.targetY - point.y) * 0.15;
          });

          const dynamicThickness = ribbon.thickness * (0.5 + bassNorm * 1.5 + midNorm * 0.5);
          
          c.beginPath();
          ribbon.points.forEach((point, i) => {
            if (i === 0) c.moveTo(point.x, point.y);
            else c.lineTo(point.x, point.y);
          });
          for (let i = ribbon.points.length - 1; i >= 0; i--) {
            const point = ribbon.points[i];
            c.lineTo(point.x, point.y + dynamicThickness);
          }
          c.closePath();
          
          const hue = (theme.base + ribbon.hue + globalHueShift) % 360;
          const gradient = c.createLinearGradient(0, 0, width, 0);
          
          for (let i = 0; i <= 10; i++) {
            const t = i / 10;
            const freqIdx = Math.floor(t * freqData.length * 0.5);
            const freqVal = (freqData[freqIdx] || 0) / 255;
            const localHue = (hue + freqVal * 60) % 360;
            const alpha = 0.3 + freqVal * 0.5 + bassNorm * 0.2;
            gradient.addColorStop(t, `hsla(${localHue}, 85%, ${55 + freqVal * 20}%, ${alpha})`);
          }
          
          c.fillStyle = gradient;
          c.fill();

          c.strokeStyle = `hsla(${hue}, 100%, 80%, ${0.3 + avgNorm * 0.4})`;
          c.lineWidth = 2;
          c.beginPath();
          ribbon.points.forEach((point, i) => {
            if (i === 0) c.moveTo(point.x, point.y);
            else c.lineTo(point.x, point.y);
          });
          c.stroke();
        });

        const maxSparks = Math.round(sparkDensity * 2);
        sparks = sparks.filter(spark => {
          spark.life -= 1 / spark.maxLife;
          spark.vy += 0.1;
          spark.vx *= 0.98;
          spark.vy *= 0.98;
          spark.x += spark.vx;
          spark.y += spark.vy;
          
          spark.trail.unshift({ x: spark.x, y: spark.y });
          if (spark.trail.length > 8) spark.trail.pop();
          
          if (spark.life <= 0) return false;
          
          const hue = (spark.hue + globalHueShift) % 360;
          
          c.beginPath();
          spark.trail.forEach((pos, i) => {
            if (i === 0) c.moveTo(pos.x, pos.y);
            else c.lineTo(pos.x, pos.y);
          });
          c.strokeStyle = `hsla(${hue}, 100%, 70%, ${spark.life * 0.5})`;
          c.lineWidth = spark.size * spark.life * 0.5;
          c.stroke();
          
          const size = spark.size * (0.5 + spark.life * 0.5);
          const gradient = c.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, size * 3);
          gradient.addColorStop(0, `hsla(${hue}, 100%, 95%, ${spark.life})`);
          gradient.addColorStop(0.3, `hsla(${hue}, 100%, 70%, ${spark.life * 0.6})`);
          gradient.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
          
          c.fillStyle = gradient;
          c.beginPath();
          c.arc(spark.x, spark.y, size * 3, 0, Math.PI * 2);
          c.fill();
          
          return true;
        });

        while (sparks.length > maxSparks) {
          sparks.shift();
        }

        if (avgNorm > 0.3) {
          const centerX = width / 2;
          const centerY = height / 2;
          const pulseRadius = Math.max(width, height) * (0.3 + bassNorm * 0.3);
          const hue = (theme.accent + globalHueShift) % 360;
          
          const gradient = c.createRadialGradient(centerX, centerY, 0, centerX, centerY, pulseRadius);
          gradient.addColorStop(0, `hsla(${hue}, 80%, 60%, ${avgNorm * 0.15})`);
          gradient.addColorStop(0.5, `hsla(${hue}, 60%, 40%, ${avgNorm * 0.08})`);
          gradient.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
          
          c.fillStyle = gradient;
          c.fillRect(-20, -20, width + 40, height + 40);
        }

        const edgeGradientTop = c.createLinearGradient(0, 0, 0, 100);
        edgeGradientTop.addColorStop(0, `hsla(${(theme.base + globalHueShift) % 360}, 70%, 50%, ${0.1 + highNorm * 0.2})`);
        edgeGradientTop.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
        c.fillStyle = edgeGradientTop;
        c.fillRect(0, 0, width, 100);

        const edgeGradientBottom = c.createLinearGradient(0, height - 100, 0, height);
        edgeGradientBottom.addColorStop(0, 'hsla(0, 0%, 0%, 0)');
        edgeGradientBottom.addColorStop(1, `hsla(${(theme.accent + globalHueShift) % 360}, 70%, 50%, ${0.1 + bassNorm * 0.2})`);
        c.fillStyle = edgeGradientBottom;
        c.fillRect(0, height - 100, width, 100);

        c.globalCompositeOperation = 'source-over';
        c.restore();
      },

      resize: (ctx: VisualizationRenderContext) => {
        width = ctx.width;
        height = ctx.height;
        initRibbons(ribbons.length || 6, width, height);
        initOrbs(width, height);
      },

      destroy: () => {
        ribbons = [];
        sparks = [];
        bursts = [];
        orbs = [];
      },
    };
  },
};
