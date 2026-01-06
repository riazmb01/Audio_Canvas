import { useRef, useEffect } from 'react';
import { Sliders, Info } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useVisualizationStore } from '@/state/visualizationStore';
import { visualizationRegistry } from '@/modules/visualizations/registry';
import { cn } from '@/lib/utils';

function MiniSpectrum() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { audioData, demoMode, isAudioConnected } = useVisualizationStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    
    ctx.clearRect(0, 0, width, height);

    const barCount = 20;

    if (isAudioConnected && audioData) {
      const step = Math.floor(audioData.frequencyData.length / barCount);
      
      for (let i = 0; i < barCount; i++) {
        const value = audioData.frequencyData[i * step] / 255;
        const x = i * 5 + 2;
        const barHeight = value * height * 0.8 + 2;
        
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, 'hsl(271, 91%, 65%)');
        gradient.addColorStop(1, 'hsl(340, 82%, 52%)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - barHeight, 3, barHeight);
      }
    } else if (demoMode) {
      const time = Date.now();
      for (let i = 0; i < barCount; i++) {
        const wave = Math.sin(time * 0.003 + i * 0.3) * 0.5 + 0.5;
        const barHeight = wave * height * 0.7 + 4;
        const x = i * 5 + 2;
        
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, 'hsl(271, 91%, 65%)');
        gradient.addColorStop(1, 'hsl(340, 82%, 52%)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - barHeight, 3, barHeight);
      }
    } else {
      for (let i = 0; i < barCount; i++) {
        const x = i * 5 + 2;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(x, height - 4, 3, 4);
      }
    }
  }, [audioData, demoMode, isAudioConnected]);

  useEffect(() => {
    if (!demoMode || isAudioConnected) return;
    
    const interval = setInterval(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      
      const barCount = 20;
      const time = Date.now();
      
      for (let i = 0; i < barCount; i++) {
        const wave = Math.sin(time * 0.003 + i * 0.3) * 0.5 + 0.5;
        const barHeight = wave * height * 0.7 + 4;
        const x = i * 5 + 2;
        
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, 'hsl(271, 91%, 65%)');
        gradient.addColorStop(1, 'hsl(340, 82%, 52%)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - barHeight, 3, barHeight);
      }
    }, 50);
    
    return () => clearInterval(interval);
  }, [demoMode, isAudioConnected]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-24 h-8"
      data-testid="canvas-mini-spectrum"
    />
  );
}

export function ControlDock() {
  const { 
    isUIVisible, 
    activeVisualizationId,
    sensitivity,
    setSensitivity,
    isAudioConnected,
    audioData,
    demoMode,
  } = useVisualizationStore();

  const activeViz = visualizationRegistry.get(activeVisualizationId);

  const getStatusText = () => {
    if (isAudioConnected && audioData) {
      const bass = audioData.bassLevel || 0;
      const mid = audioData.midLevel || 0;
      const high = audioData.highLevel || 0;
      const weightedLevel = (bass * 0.5 + mid * 0.35 + high * 0.15);
      const normalized = weightedLevel / 255;
      const logLevel = normalized > 0 ? (Math.log10(normalized * 9 + 1) / Math.log10(10)) * 100 : 0;
      return `Level: ${Math.round(Math.min(100, logLevel * 1.2))}%`;
    }
    if (demoMode) {
      return 'Demo mode - Connect audio for live input';
    }
    return 'Not connected';
  };

  return (
    <div 
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-40",
        "transition-all duration-300",
        !isUIVisible && "opacity-0 pointer-events-none translate-y-4"
      )}
    >
      <div className="bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 p-4 min-w-80">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MiniSpectrum />
            
            <div className="flex flex-col">
              <span className="text-white font-medium text-sm">
                {activeViz?.metadata.name || 'No Visualization'}
              </span>
              <span className="text-white/50 text-xs flex items-center gap-1">
                {demoMode && !isAudioConnected && <Info className="w-3 h-3" />}
                {getStatusText()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 min-w-32">
            <Sliders className="w-4 h-4 text-white/60" />
            <Slider
              value={[sensitivity]}
              onValueChange={(val) => setSensitivity(val[0])}
              min={0.2}
              max={5}
              step={0.1}
              className="w-24"
              data-testid="slider-sensitivity"
            />
            <span className="text-white/60 text-xs w-8 text-right font-mono">
              {sensitivity.toFixed(1)}x
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
