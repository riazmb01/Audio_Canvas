import { VisualizationCanvas } from '@/components/visualizer/VisualizationCanvas';
import { TopBar } from '@/components/visualizer/TopBar';
import { VisualizationGallery } from '@/components/visualizer/VisualizationGallery';
import { ControlDock } from '@/components/visualizer/ControlDock';
import { SettingsPanel } from '@/components/visualizer/SettingsPanel';
import { KeyboardHandler } from '@/components/visualizer/KeyboardHandler';
import { useVisualizationStore } from '@/state/visualizationStore';

export default function Visualizer() {
  const { toggleUI, showHintLabel } = useVisualizationStore();

  const handleCanvasClick = () => {
    toggleUI();
  };

  return (
    <div 
      className="relative w-screen h-screen overflow-hidden bg-black"
      data-testid="container-visualizer"
    >
      <KeyboardHandler />
      
      <div 
        className="absolute inset-0"
        onClick={handleCanvasClick}
      >
        <VisualizationCanvas />
      </div>

      <TopBar />
      <VisualizationGallery />
      <ControlDock />
      <SettingsPanel />

      {showHintLabel && (
        <div className="fixed bottom-4 right-4 z-30 text-white/30 text-xs font-mono pointer-events-none">
          <span>Press H to toggle UI</span>
        </div>
      )}
    </div>
  );
}
