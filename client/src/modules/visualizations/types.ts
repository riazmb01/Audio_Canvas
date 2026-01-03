export interface VisualizationMetadata {
  id: string;
  name: string;
  description: string;
  category: 'frequency' | 'waveform' | 'geometric' | 'particle';
  thumbnail?: string;
}

export interface AudioPreferences {
  fftSize: 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096 | 8192;
  smoothingTimeConstant: number;
  minDecibels: number;
  maxDecibels: number;
}

export interface VisualizationParameters {
  [key: string]: {
    type: 'number' | 'color' | 'boolean' | 'select';
    label: string;
    value: number | string | boolean;
    min?: number;
    max?: number;
    step?: number;
    options?: { label: string; value: string }[];
  };
}

export interface VisualizationRenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  time: number;
  deltaTime: number;
}

export interface AudioFrameData {
  frequencyData: Uint8Array;
  waveformData: Uint8Array;
  averageFrequency: number;
  bassLevel: number;
  midLevel: number;
  highLevel: number;
  peakFrequency: number;
}

export interface VisualizationInstance {
  init: (ctx: VisualizationRenderContext) => void;
  render: (ctx: VisualizationRenderContext, audio: AudioFrameData, params: Record<string, number | string | boolean>) => void;
  resize: (ctx: VisualizationRenderContext) => void;
  destroy: () => void;
}

export interface VisualizationModule {
  metadata: VisualizationMetadata;
  audioPreferences: AudioPreferences;
  defaultParameters: VisualizationParameters;
  createInstance: () => VisualizationInstance;
}
