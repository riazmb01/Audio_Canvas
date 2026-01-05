import { VisualizationModule } from './types';
import { frequencyBars } from './plugins/frequency-bars';
import { waveform } from './plugins/waveform';
import { circularSpectrum } from './plugins/circular-spectrum';
import { particles } from './plugins/particles';
import { flowField } from './plugins/flow-field';

class VisualizationRegistry {
  private visualizations: Map<string, VisualizationModule> = new Map();

  constructor() {
    this.register(frequencyBars);
    this.register(waveform);
    this.register(circularSpectrum);
    this.register(particles);
    this.register(flowField);
  }

  register(module: VisualizationModule): void {
    this.visualizations.set(module.metadata.id, module);
  }

  get(id: string): VisualizationModule | undefined {
    return this.visualizations.get(id);
  }

  getAll(): VisualizationModule[] {
    return Array.from(this.visualizations.values());
  }

  getByCategory(category: string): VisualizationModule[] {
    return this.getAll().filter(v => v.metadata.category === category);
  }

  getCategories(): string[] {
    const categories = new Set(this.getAll().map(v => v.metadata.category));
    return Array.from(categories);
  }
}

export const visualizationRegistry = new VisualizationRegistry();
