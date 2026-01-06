import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useVisualizationStore } from '@/state/visualizationStore';
import { visualizationRegistry } from '@/modules/visualizations/registry';
import { VisualizationInstance, VisualizationRenderContext, AudioFrameData } from '@/modules/visualizations/types';

function generateDemoAudioData(time: number): AudioFrameData {
  const frequencyData = new Uint8Array(128);
  const waveformData = new Uint8Array(256);
  
  for (let i = 0; i < 128; i++) {
    const bassBoost = i < 20 ? 1.5 : 1;
    const wave1 = Math.sin(time * 0.002 + i * 0.1) * 0.5 + 0.5;
    const wave2 = Math.sin(time * 0.003 + i * 0.05) * 0.3 + 0.5;
    const wave3 = Math.sin(time * 0.001 + i * 0.2) * 0.2 + 0.5;
    const combined = (wave1 + wave2 + wave3) / 3;
    const decay = Math.exp(-i / 60);
    frequencyData[i] = Math.floor(combined * decay * bassBoost * 200 + Math.random() * 20);
  }
  
  for (let i = 0; i < 256; i++) {
    const wave = Math.sin(time * 0.01 + i * 0.05) * 40;
    const wave2 = Math.sin(time * 0.007 + i * 0.1) * 20;
    waveformData[i] = 128 + wave + wave2;
  }
  
  const bassLevel = frequencyData.slice(0, 13).reduce((a, b) => a + b, 0) / 13;
  const midLevel = frequencyData.slice(13, 64).reduce((a, b) => a + b, 0) / 51;
  const highLevel = frequencyData.slice(64).reduce((a, b) => a + b, 0) / 64;
  
  return {
    frequencyData,
    waveformData,
    averageFrequency: frequencyData.reduce((a, b) => a + b, 0) / 128,
    bassLevel,
    midLevel,
    highLevel,
    peakFrequency: 0.2,
  };
}

export function VisualizationCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<VisualizationInstance | null>(null);
  const lastTimeRef = useRef<number>(0);
  const animationIdRef = useRef<number | null>(null);

  const activeVisualizationId = useVisualizationStore(state => state.activeVisualizationId);

  // Get initial state from store
  const initialState = useVisualizationStore.getState();
  const audioDataRef = useRef<AudioFrameData | null>(initialState.audioData);
  const sensitivityRef = useRef<number>(initialState.sensitivity);
  const demoModeRef = useRef<boolean>(initialState.demoMode);
  const isAudioConnectedRef = useRef<boolean>(initialState.isAudioConnected);
  const activeParamsRef = useRef<Record<string, string | number | boolean>>(
    (initialState.parameters[initialState.activeVisualizationId] || {}) as Record<string, string | number | boolean>
  );
  const activeVizIdRef = useRef<string>(activeVisualizationId);

  useEffect(() => {
    // Initialize refs with current state on mount
    const state = useVisualizationStore.getState();
    audioDataRef.current = state.audioData;
    sensitivityRef.current = state.sensitivity;
    demoModeRef.current = state.demoMode;
    isAudioConnectedRef.current = state.isAudioConnected;
    activeParamsRef.current = (state.parameters[state.activeVisualizationId] || {}) as Record<string, string | number | boolean>;
    activeVizIdRef.current = state.activeVisualizationId;

    return useVisualizationStore.subscribe((state) => {
      audioDataRef.current = state.audioData;
      sensitivityRef.current = state.sensitivity;
      demoModeRef.current = state.demoMode;
      isAudioConnectedRef.current = state.isAudioConnected;
      activeParamsRef.current = (state.parameters[state.activeVisualizationId] || {}) as Record<string, string | number | boolean>;
      activeVizIdRef.current = state.activeVisualizationId;
    });
  }, []);

  const activeViz = useMemo(() => {
    return visualizationRegistry.get(activeVisualizationId);
  }, [activeVisualizationId]);

  const setupCanvas = useCallback((): VisualizationRenderContext | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return {
      canvas,
      ctx,
      width: rect.width,
      height: rect.height,
      dpr,
      time: 0,
      deltaTime: 0,
    };
  }, []);

  useEffect(() => {
    if (!activeViz) return;

    if (instanceRef.current) {
      instanceRef.current.destroy();
      instanceRef.current = null;
    }

    instanceRef.current = activeViz.createInstance();
    const context = setupCanvas();
    
    if (context && instanceRef.current) {
      instanceRef.current.init(context);
    }

    return () => {
      if (instanceRef.current) {
        instanceRef.current.destroy();
        instanceRef.current = null;
      }
    };
  }, [activeVisualizationId, activeViz, setupCanvas]);

  useEffect(() => {
    const handleResize = () => {
      const context = setupCanvas();
      if (context && instanceRef.current) {
        instanceRef.current.resize(context);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setupCanvas]);

  useEffect(() => {
    let running = true;
    let frameCount = 0;

    const render = (timestamp: number) => {
      if (!running) return;

      const canvas = canvasRef.current;
      if (!canvas) {
        animationIdRef.current = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx || !instanceRef.current) {
        animationIdRef.current = requestAnimationFrame(render);
        return;
      }

      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const context: VisualizationRenderContext = {
        canvas,
        ctx,
        width: rect.width,
        height: rect.height,
        dpr,
        time: timestamp,
        deltaTime,
      };

      const audioData = audioDataRef.current;
      const sensitivity = sensitivityRef.current;
      const demoMode = demoModeRef.current;
      const isAudioConnected = isAudioConnectedRef.current;
      const activeParams = activeParamsRef.current;
      const currentVizId = activeVizIdRef.current;

      let currentAudioData: AudioFrameData;

      if (isAudioConnected && audioData) {
        const skipGlobalSensitivity = currentVizId === 'frequency-bars';
        
        if (skipGlobalSensitivity) {
          currentAudioData = {
            frequencyData: audioData.frequencyData,
            waveformData: audioData.waveformData,
            averageFrequency: audioData.averageFrequency,
            bassLevel: audioData.bassLevel,
            midLevel: audioData.midLevel,
            highLevel: audioData.highLevel,
            peakFrequency: audioData.peakFrequency,
          };
        } else {
          const amplifiedSensitivity = sensitivity * 2.5;
          
          const scaledFrequencyData = new Uint8Array(audioData.frequencyData.length);
          for (let i = 0; i < audioData.frequencyData.length; i++) {
            const amplified = audioData.frequencyData[i] * amplifiedSensitivity;
            scaledFrequencyData[i] = Math.min(255, Math.round(amplified));
          }

          const scaledWaveformData = new Uint8Array(audioData.waveformData.length);
          for (let i = 0; i < audioData.waveformData.length; i++) {
            const centered = audioData.waveformData[i] - 128;
            const scaled = centered * sensitivity;
            scaledWaveformData[i] = Math.max(0, Math.min(255, Math.round(128 + scaled)));
          }

          currentAudioData = {
            frequencyData: scaledFrequencyData,
            waveformData: scaledWaveformData,
            averageFrequency: audioData.averageFrequency * amplifiedSensitivity,
            bassLevel: audioData.bassLevel * amplifiedSensitivity,
            midLevel: audioData.midLevel * amplifiedSensitivity,
            highLevel: audioData.highLevel * amplifiedSensitivity,
            peakFrequency: audioData.peakFrequency,
          };
        }

        frameCount++;
        if (frameCount % 120 === 0) {
          console.log('Rendering LIVE audio:', {
            avgFreq: currentAudioData.averageFrequency.toFixed(2),
            bass: currentAudioData.bassLevel.toFixed(2),
            first5: Array.from(currentAudioData.frequencyData.slice(0, 5)),
          });
        }
      } else if (demoMode) {
        currentAudioData = generateDemoAudioData(timestamp);
      } else {
        currentAudioData = {
          frequencyData: new Uint8Array(128).fill(0),
          waveformData: new Uint8Array(256).fill(128),
          averageFrequency: 0,
          bassLevel: 0,
          midLevel: 0,
          highLevel: 0,
          peakFrequency: 0,
        };
      }

      try {
        instanceRef.current.render(context, currentAudioData, activeParams);
      } catch (e) {
        console.error('Error rendering visualization:', e);
      }

      animationIdRef.current = requestAnimationFrame(render);
    };

    animationIdRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      if (animationIdRef.current !== null) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="canvas-visualization"
      className="absolute inset-0 w-full h-full bg-black"
      style={{ touchAction: 'none' }}
    />
  );
}
