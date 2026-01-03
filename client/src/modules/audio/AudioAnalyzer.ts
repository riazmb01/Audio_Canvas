import { AudioFrameData, AudioPreferences } from '../visualizations/types';

type AudioSource = 'microphone' | 'screen';

const defaultPreferences: AudioPreferences = {
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
  minDecibels: -90,
  maxDecibels: -10,
};

class AudioAnalyzerService {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private frequencyData: Uint8Array = new Uint8Array(0);
  private waveformData: Uint8Array = new Uint8Array(0);
  private subscribers: Set<(data: AudioFrameData) => void> = new Set();
  private animationId: number | null = null;
  private isConnected: boolean = false;
  private currentSource: AudioSource = 'microphone';

  async connect(sourceType: AudioSource = 'microphone'): Promise<void> {
    if (this.isConnected) {
      await this.disconnect();
    }

    try {
      this.currentSource = sourceType;
      
      if (sourceType === 'microphone') {
        this.stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          }
        });
      } else {
        this.stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
      }

      this.audioContext = new AudioContext();
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      this.analyser = this.audioContext.createAnalyser();
      this.applyPreferences(defaultPreferences);

      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);

      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.waveformData = new Uint8Array(this.analyser.fftSize);

      this.isConnected = true;
      this.startLoop();
      
      console.log('Audio connected successfully:', {
        sampleRate: this.audioContext.sampleRate,
        fftSize: this.analyser.fftSize,
        frequencyBinCount: this.analyser.frequencyBinCount,
      });
    } catch (error) {
      console.error('Failed to connect audio:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.subscribers.clear();
  }

  applyPreferences(prefs: AudioPreferences): void {
    if (!this.analyser) return;

    this.analyser.fftSize = prefs.fftSize;
    this.analyser.smoothingTimeConstant = prefs.smoothingTimeConstant;
    this.analyser.minDecibels = prefs.minDecibels;
    this.analyser.maxDecibels = prefs.maxDecibels;

    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.waveformData = new Uint8Array(this.analyser.fftSize);
  }

  subscribe(callback: (data: AudioFrameData) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private startLoop(): void {
    const loop = () => {
      if (!this.analyser || !this.isConnected) {
        return;
      }

      this.analyser.getByteFrequencyData(this.frequencyData);
      this.analyser.getByteTimeDomainData(this.waveformData);

      const frameData = this.calculateFrameData();
      
      this.subscribers.forEach(cb => {
        try {
          cb(frameData);
        } catch (e) {
          console.error('Error in audio subscriber:', e);
        }
      });

      this.animationId = requestAnimationFrame(loop);
    };

    this.animationId = requestAnimationFrame(loop);
  }

  private calculateFrameData(): AudioFrameData {
    const len = this.frequencyData.length;
    
    if (len === 0) {
      return {
        frequencyData: new Uint8Array(128),
        waveformData: new Uint8Array(256),
        averageFrequency: 0,
        bassLevel: 0,
        midLevel: 0,
        highLevel: 0,
        peakFrequency: 0,
      };
    }

    let sum = 0;
    let bassSum = 0;
    let midSum = 0;
    let highSum = 0;
    let peakValue = 0;
    let peakIndex = 0;

    const bassEnd = Math.floor(len * 0.1);
    const midEnd = Math.floor(len * 0.5);

    for (let i = 0; i < len; i++) {
      const value = this.frequencyData[i];
      sum += value;

      if (value > peakValue) {
        peakValue = value;
        peakIndex = i;
      }

      if (i < bassEnd) {
        bassSum += value;
      } else if (i < midEnd) {
        midSum += value;
      } else {
        highSum += value;
      }
    }

    const bassCount = bassEnd || 1;
    const midCount = (midEnd - bassEnd) || 1;
    const highCount = (len - midEnd) || 1;

    return {
      frequencyData: new Uint8Array(this.frequencyData),
      waveformData: new Uint8Array(this.waveformData),
      averageFrequency: sum / len,
      bassLevel: bassSum / bassCount,
      midLevel: midSum / midCount,
      highLevel: highSum / highCount,
      peakFrequency: peakIndex / len,
    };
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  getCurrentSource(): AudioSource {
    return this.currentSource;
  }
}

export const audioAnalyzer = new AudioAnalyzerService();
export type { AudioSource };
