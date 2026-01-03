import { useEffect } from 'react';
import { useVisualizationStore } from '@/state/visualizationStore';
import { visualizationRegistry } from '@/modules/visualizations/registry';

export function KeyboardHandler() {
  const { 
    toggleUI, 
    toggleSidebar, 
    toggleSettings,
    activeVisualizationId,
    setActiveVisualization,
  } = useVisualizationStore();

  useEffect(() => {
    const visualizations = visualizationRegistry.getAll();
    const vizIds = visualizations.map(v => v.metadata.id);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'h':
          toggleUI();
          break;
        case 'g':
          toggleSidebar();
          break;
        case 's':
          if (!e.ctrlKey && !e.metaKey) {
            toggleSettings();
          }
          break;
        case 'f':
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
          } else {
            document.exitFullscreen();
          }
          break;
        case 'arrowright':
          const currentIndex = vizIds.indexOf(activeVisualizationId);
          const nextIndex = (currentIndex + 1) % vizIds.length;
          setActiveVisualization(vizIds[nextIndex]);
          break;
        case 'arrowleft':
          const currIndex = vizIds.indexOf(activeVisualizationId);
          const prevIndex = (currIndex - 1 + vizIds.length) % vizIds.length;
          setActiveVisualization(vizIds[prevIndex]);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleUI, toggleSidebar, toggleSettings, activeVisualizationId, setActiveVisualization]);

  return null;
}
