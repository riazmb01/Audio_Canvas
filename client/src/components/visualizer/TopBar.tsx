import { Mic, Monitor, Settings, Menu, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVisualizationStore } from '@/state/visualizationStore';
import { audioAnalyzer } from '@/modules/audio/AudioAnalyzer';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function TopBar() {
  const { 
    audioSource, 
    setAudioSource, 
    isAudioConnected, 
    setIsAudioConnected, 
    setAudioData,
    toggleSidebar,
    toggleSettings,
    toggleUI,
    isUIVisible,
  } = useVisualizationStore();
  
  const { toast } = useToast();

  const handleConnect = async () => {
    if (isAudioConnected) {
      await audioAnalyzer.disconnect();
      setIsAudioConnected(false);
      setAudioData(null);
      toast({
        title: 'Audio Disconnected',
        description: 'Audio source has been disconnected.',
      });
      return;
    }

    try {
      await audioAnalyzer.connect(audioSource);
      setIsAudioConnected(true);
      
      audioAnalyzer.subscribe((data) => {
        setAudioData(data);
      });

      toast({
        title: 'Audio Connected',
        description: `Now listening to ${audioSource === 'microphone' ? 'microphone' : 'screen audio'}.`,
      });
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: 'Could not access audio source. Please check permissions.',
        variant: 'destructive',
      });
    }
  };

  const handleSourceChange = (value: string) => {
    const source = value as 'microphone' | 'screen';
    setAudioSource(source);
    
    if (isAudioConnected) {
      handleConnect();
    }
  };

  return (
    <div 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 h-14 transition-all duration-300",
        "backdrop-blur-xl bg-black/40 border-b border-white/10",
        !isUIVisible && "opacity-0 pointer-events-none"
      )}
    >
      <div className="flex items-center justify-between h-full px-4 gap-4">
        <div className="flex items-center gap-3">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={toggleSidebar}
            className="text-white/80 hover:text-white hover:bg-white/10"
            data-testid="button-toggle-sidebar"
          >
            <Menu className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">AV</span>
            </div>
            <span className="text-white font-semibold text-lg hidden sm:block">Audio Visualizer</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select value={audioSource} onValueChange={handleSourceChange}>
            <SelectTrigger 
              className="w-40 bg-white/10 border-white/20 text-white"
              data-testid="select-audio-source"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="microphone" data-testid="option-microphone">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4" />
                  <span>Microphone</span>
                </div>
              </SelectItem>
              <SelectItem value="screen" data-testid="option-screen">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  <span>Screen Audio</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={handleConnect}
            variant={isAudioConnected ? "default" : "outline"}
            className={cn(
              isAudioConnected 
                ? "bg-green-500 hover:bg-green-600 text-white" 
                : "border-white/20 text-white hover:bg-white/10"
            )}
            data-testid="button-connect-audio"
          >
            {isAudioConnected ? 'Connected' : 'Connect'}
          </Button>

          <div className="flex items-center gap-1">
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={toggleUI}
              className="text-white/80 hover:text-white hover:bg-white/10"
              data-testid="button-toggle-ui"
            >
              {isUIVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </Button>
            
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={toggleSettings}
              className="text-white/80 hover:text-white hover:bg-white/10"
              data-testid="button-settings"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
