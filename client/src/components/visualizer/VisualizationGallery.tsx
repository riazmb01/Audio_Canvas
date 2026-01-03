import { X, Waves, BarChart3, Circle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useVisualizationStore } from '@/state/visualizationStore';
import { visualizationRegistry } from '@/modules/visualizations/registry';
import { cn } from '@/lib/utils';

const categoryIcons: Record<string, typeof Waves> = {
  frequency: BarChart3,
  waveform: Waves,
  geometric: Circle,
  particle: Sparkles,
};

const categoryColors: Record<string, string> = {
  frequency: 'from-purple-500 to-pink-500',
  waveform: 'from-cyan-500 to-blue-500',
  geometric: 'from-orange-500 to-yellow-500',
  particle: 'from-green-500 to-emerald-500',
};

export function VisualizationGallery() {
  const { 
    isSidebarOpen, 
    toggleSidebar, 
    activeVisualizationId, 
    setActiveVisualization 
  } = useVisualizationStore();

  const visualizations = visualizationRegistry.getAll();
  const categories = visualizationRegistry.getCategories();

  const handleSelect = (id: string) => {
    setActiveVisualization(id);
  };

  return (
    <>
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={toggleSidebar}
          data-testid="overlay-sidebar-backdrop"
        />
      )}
      
      <div 
        className={cn(
          "fixed left-0 top-0 bottom-0 w-80 z-50",
          "bg-black/80 backdrop-blur-xl border-r border-white/10",
          "transform transition-transform duration-300 ease-out",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-white font-semibold text-lg">Visualizations</h2>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={toggleSidebar}
            className="text-white/80 hover:text-white hover:bg-white/10"
            data-testid="button-close-sidebar"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-65px)]">
          <div className="p-4 space-y-6">
            {categories.map(category => {
              const categoryViz = visualizations.filter(v => v.metadata.category === category);
              const Icon = categoryIcons[category] || Waves;
              
              return (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2 text-white/60 text-sm font-medium uppercase tracking-wider">
                    <Icon className="w-4 h-4" />
                    <span>{category}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {categoryViz.map(viz => {
                      const isActive = viz.metadata.id === activeVisualizationId;
                      const gradientClass = categoryColors[viz.metadata.category] || 'from-gray-500 to-gray-600';
                      
                      return (
                        <button
                          key={viz.metadata.id}
                          onClick={() => handleSelect(viz.metadata.id)}
                          className={cn(
                            "relative group rounded-lg overflow-hidden",
                            "aspect-video transition-all duration-200",
                            "border-2",
                            isActive 
                              ? "border-purple-500 ring-2 ring-purple-500/30" 
                              : "border-white/10 hover:border-white/30"
                          )}
                          data-testid={`button-viz-${viz.metadata.id}`}
                        >
                          <div className={cn(
                            "absolute inset-0 bg-gradient-to-br opacity-60",
                            gradientClass
                          )} />
                          
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                            <Icon className="w-6 h-6 text-white mb-1" />
                            <span className="text-white text-xs font-medium text-center leading-tight">
                              {viz.metadata.name}
                            </span>
                          </div>

                          {isActive && (
                            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
