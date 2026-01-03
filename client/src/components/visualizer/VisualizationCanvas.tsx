import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useVisualizationStore } from '@/state/visualizationStore';
import { visualizationRegistry } from '@/modules/visualizations/registry';
import { VisualizationInstance, VisualizationRenderContext, AudioFrameData } from '@/modules/visualizations/types';

export function VisualizationCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<VisualizationInstance | null>(null);
  const lastTimeRef = useRef<number>(0);
  const animationIdRef = useRef<number | null>(null);

  const activeVisualizationId = useVisualizationStore(state => state.activeVisualizationId);
  const audioData = useVisualizationStore(state => state.audioData);
  const sensitivity = useVisualizationStore(state => state.sensitivity);
  const parameters = useVisualizationStore(state => state.parameters);

  const activeViz = useMemo(() => {
    return visualizationRegistry.get(activeVisualizationId);
  }, [activeVisualizationId]);

  const activeParams = useMemo(() => {
    return parameters[activeVisualizationId] || {};
  }, [parameters, activeVisualizationId]);

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

      const defaultAudioData: AudioFrameData = {
        frequencyData: new Uint8Array(128).fill(0),
        waveformData: new Uint8Array(256).fill(128),
        averageFrequency: 0,
        bassLevel: 0,
        midLevel: 0,
        highLevel: 0,
        peakFrequency: 0,
      };

      const currentAudioData = audioData || defaultAudioData;

      const scaledFrequencyData = new Uint8Array(currentAudioData.frequencyData.length);
      for (let i = 0; i < currentAudioData.frequencyData.length; i++) {
        scaledFrequencyData[i] = Math.min(255, Math.round(currentAudioData.frequencyData[i] * sensitivity));
      }

      const scaledAudioData: AudioFrameData = {
        frequencyData: scaledFrequencyData,
        waveformData: currentAudioData.waveformData,
        averageFrequency: currentAudioData.averageFrequency * sensitivity,
        bassLevel: currentAudioData.bassLevel * sensitivity,
        midLevel: currentAudioData.midLevel * sensitivity,
        highLevel: currentAudioData.highLevel * sensitivity,
        peakFrequency: currentAudioData.peakFrequency,
      };

      try {
        instanceRef.current.render(context, scaledAudioData, activeParams);
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
  }, [audioData, activeParams, sensitivity]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="canvas-visualization"
      className="absolute inset-0 w-full h-full bg-black"
      style={{ touchAction: 'none' }}
    />
  );
}
