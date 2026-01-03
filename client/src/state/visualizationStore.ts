import { create } from 'zustand';
import { AudioFrameData } from '@/modules/visualizations/types';
import { visualizationRegistry } from '@/modules/visualizations/registry';

interface VisualizationState {
  activeVisualizationId: string;
  parameters: Record<string, Record<string, number | string | boolean>>;
  isAudioConnected: boolean;
  audioSource: 'microphone' | 'screen';
  audioData: AudioFrameData | null;
  isUIVisible: boolean;
  isSidebarOpen: boolean;
  isSettingsOpen: boolean;
  sensitivity: number;
  
  setActiveVisualization: (id: string) => void;
  setParameter: (vizId: string, paramId: string, value: number | string | boolean) => void;
  setIsAudioConnected: (connected: boolean) => void;
  setAudioSource: (source: 'microphone' | 'screen') => void;
  setAudioData: (data: AudioFrameData | null) => void;
  toggleUI: () => void;
  toggleSidebar: () => void;
  toggleSettings: () => void;
  setSensitivity: (value: number) => void;
}

const defaultParameters: Record<string, Record<string, number | string | boolean>> = {};
visualizationRegistry.getAll().forEach(viz => {
  defaultParameters[viz.metadata.id] = {};
  Object.entries(viz.defaultParameters).forEach(([key, param]) => {
    defaultParameters[viz.metadata.id][key] = param.value;
  });
});

export const useVisualizationStore = create<VisualizationState>((set) => ({
  activeVisualizationId: 'frequency-bars',
  parameters: defaultParameters,
  isAudioConnected: false,
  audioSource: 'microphone',
  audioData: null,
  isUIVisible: true,
  isSidebarOpen: false,
  isSettingsOpen: false,
  sensitivity: 1,

  setActiveVisualization: (id) => set({ activeVisualizationId: id }),
  
  setParameter: (vizId, paramId, value) => set((state) => ({
    parameters: {
      ...state.parameters,
      [vizId]: {
        ...state.parameters[vizId],
        [paramId]: value,
      },
    },
  })),

  setIsAudioConnected: (connected) => set({ isAudioConnected: connected }),
  
  setAudioSource: (source) => set({ audioSource: source }),
  
  setAudioData: (data) => set({ audioData: data }),
  
  toggleUI: () => set((state) => ({ isUIVisible: !state.isUIVisible })),
  
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  
  toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
  
  setSensitivity: (value) => set({ sensitivity: value }),
}));
