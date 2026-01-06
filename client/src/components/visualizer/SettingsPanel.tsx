import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVisualizationStore } from '@/state/visualizationStore';
import { visualizationRegistry } from '@/modules/visualizations/registry';
import { cn } from '@/lib/utils';

export function SettingsPanel() {
  const { 
    isSettingsOpen, 
    toggleSettings,
    activeVisualizationId,
    parameters,
    setParameter,
    showHintLabel,
    setShowHintLabel,
  } = useVisualizationStore();

  const activeViz = visualizationRegistry.get(activeVisualizationId);
  const currentParams = parameters[activeVisualizationId] || {};

  return (
    <>
      {isSettingsOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={toggleSettings}
          data-testid="overlay-settings-backdrop"
        />
      )}
      
      <div 
        className={cn(
          "fixed right-0 top-0 bottom-0 w-80 z-50",
          "bg-black/80 backdrop-blur-xl border-l border-white/10",
          "transform transition-transform duration-300 ease-out",
          isSettingsOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-white font-semibold text-lg">Settings</h2>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={toggleSettings}
            className="text-white/80 hover:text-white hover:bg-white/10"
            data-testid="button-close-settings"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <Tabs defaultValue="visualization" className="h-[calc(100vh-65px)]">
          <TabsList className="w-full justify-start rounded-none border-b border-white/10 bg-transparent p-0">
            <TabsTrigger 
              value="visualization" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:bg-transparent text-white/60 data-[state=active]:text-white"
            >
              Visuals
            </TabsTrigger>
            <TabsTrigger 
              value="audio" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:bg-transparent text-white/60 data-[state=active]:text-white"
            >
              Audio
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(100%-48px)]">
            <TabsContent value="visualization" className="p-4 space-y-6 mt-0">
              {activeViz && (
                <>
                  <div className="space-y-2">
                    <h3 className="text-white font-medium">{activeViz.metadata.name}</h3>
                    <p className="text-white/50 text-sm">{activeViz.metadata.description}</p>
                  </div>

                  <div className="space-y-4">
                    {Object.entries(activeViz.defaultParameters).map(([key, param]) => (
                      <div key={key} className="space-y-2">
                        {param.type !== 'boolean' && (
                          <Label className="text-white/80">{param.label}</Label>
                        )}
                        
                        {param.type === 'number' && (() => {
                          const value = currentParams[key] as number ?? param.value as number;
                          const step = param.step || 0.1;
                          const decimals = Math.max(0, Math.ceil(-Math.log10(step)));
                          return (
                            <>
                              <div className="flex items-center gap-3">
                                <Slider
                                  value={[value]}
                                  onValueChange={(val) => setParameter(activeVisualizationId, key, val[0])}
                                  min={param.min}
                                  max={param.max}
                                  step={step}
                                  className="flex-1"
                                  data-testid={`slider-param-${key}`}
                                />
                                <span className="text-white/60 text-xs w-14 text-right font-mono">
                                  {value.toFixed(decimals)}
                                </span>
                              </div>
                              {activeVisualizationId === 'frequency-bars' && key === 'sensitivity' && (
                                <p className="text-white/40 text-xs mt-1">
                                  Frequency Bars uses only this slider, not the global sensitivity.
                                </p>
                              )}
                            </>
                          );
                        })()}

                        {param.type === 'boolean' && (
                          <div className="flex items-center justify-between gap-4 py-1">
                            <Label className="text-white/80">{param.label}</Label>
                            <Switch
                              checked={currentParams[key] as boolean ?? param.value as boolean}
                              onCheckedChange={(val) => setParameter(activeVisualizationId, key, val)}
                              data-testid={`switch-param-${key}`}
                            />
                          </div>
                        )}

                        {param.type === 'select' && param.options && (
                          <Select 
                            value={currentParams[key] as string || param.value as string}
                            onValueChange={(val) => setParameter(activeVisualizationId, key, val)}
                          >
                            <SelectTrigger 
                              className="bg-white/10 border-white/20 text-white"
                              data-testid={`select-param-${key}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {param.options.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="audio" className="p-4 space-y-6 mt-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-white/80">Show Hint Label</Label>
                  <Switch
                    checked={showHintLabel}
                    onCheckedChange={setShowHintLabel}
                    data-testid="switch-hint-label"
                  />
                </div>
                <p className="text-white/40 text-xs">
                  Show "Press H to toggle UI" in the bottom right corner
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-white/60 text-sm font-medium">Keyboard Shortcuts</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-white/60">
                    <span>Toggle UI</span>
                    <kbd className="px-2 py-1 bg-white/10 rounded text-white/80">H</kbd>
                  </div>
                  <div className="flex items-center justify-between text-white/60">
                    <span>Open Gallery</span>
                    <kbd className="px-2 py-1 bg-white/10 rounded text-white/80">G</kbd>
                  </div>
                  <div className="flex items-center justify-between text-white/60">
                    <span>Open Settings</span>
                    <kbd className="px-2 py-1 bg-white/10 rounded text-white/80">S</kbd>
                  </div>
                  <div className="flex items-center justify-between text-white/60">
                    <span>Next Visualization</span>
                    <kbd className="px-2 py-1 bg-white/10 rounded text-white/80">Arrow Right</kbd>
                  </div>
                  <div className="flex items-center justify-between text-white/60">
                    <span>Previous Visualization</span>
                    <kbd className="px-2 py-1 bg-white/10 rounded text-white/80">Arrow Left</kbd>
                  </div>
                  <div className="flex items-center justify-between text-white/60">
                    <span>Fullscreen</span>
                    <kbd className="px-2 py-1 bg-white/10 rounded text-white/80">F</kbd>
                  </div>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </>
  );
}
