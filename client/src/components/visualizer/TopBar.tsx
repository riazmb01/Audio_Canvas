import { Mic, Monitor, Settings, Menu, Eye, EyeOff, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
    demoMode,
    setDemoMode,
  } = useVisualizationStore();
  
  const { toast } = useToast();

  const handleConnect = async () => {
    if (isAudioConnected) {
      await audioAnalyzer.disconnect();
      setIsAudioConnected(false);
      setAudioData(null);
      setDemoMode(true);
      toast({
        title: 'Audio Disconnected',
        description: 'Switched back to demo mode.',
      });
      return;
    }

    try {
      setDemoMode(false);
      await audioAnalyzer.connect(audioSource);
      setIsAudioConnected(true);
      
      audioAnalyzer.subscribe((data) => {
        setAudioData(data);
      });

      const sourceDesc = audioSource === 'microphone' 
        ? 'microphone' 
        : 'screen share (select a tab playing audio)';

      toast({
        title: 'Audio Connected',
        description: `Now listening to ${sourceDesc}.`,
      });
    } catch (error) {
      setDemoMode(true);
      console.error('Audio connection error:', error);
      toast({
        title: 'Connection Failed',
        description: audioSource === 'screen' 
          ? 'Could not access screen audio. Make sure to select a browser tab that is playing audio.'
          : 'Could not access microphone. Please check your browser permissions.',
        variant: 'destructive',
      });
    }
  };

  const handleSourceChange = async (value: string) => {
    const source = value as 'microphone' | 'screen';
    setAudioSource(source);
    
    if (isAudioConnected) {
      await audioAnalyzer.disconnect();
      setIsAudioConnected(false);
      setAudioData(null);
      
      setTimeout(() => {
        handleConnect();
      }, 100);
    }
  };

  const toggleDemoMode = () => {
    if (isAudioConnected) {
      return;
    }
    setDemoMode(!demoMode);
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

          {demoMode && !isAudioConnected && (
            <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
              Demo Mode
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleDemoMode}
            className={cn(
              "text-white/80 hover:text-white hover:bg-white/10",
              isAudioConnected && "opacity-50 cursor-not-allowed"
            )}
            disabled={isAudioConnected}
            data-testid="button-toggle-demo"
            title={demoMode ? "Demo mode on" : "Demo mode off"}
          >
            {demoMode ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>

          <Select value={audioSource} onValueChange={handleSourceChange}>
            <SelectTrigger 
              className="w-44 bg-white/10 border-white/20 text-white"
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
                  <span>System Audio</span>
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
