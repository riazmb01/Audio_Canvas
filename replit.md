# Audio Visualizer

A real-time audio visualization web application with an extensible plugin-based architecture for creating stunning visual effects that react to music and audio.

## Overview

This application captures audio from your microphone or screen share and renders beautiful, reactive visualizations in real-time using the Web Audio API and HTML5 Canvas.

### Features
- **Multiple Visualization Styles**: Frequency Bars, Waveform, Circular Spectrum, and Particle Storm
- **Audio Source Options**: Microphone input or screen audio capture
- **Customizable Parameters**: Each visualization has adjustable settings
- **Keyboard Shortcuts**: Quick access to all features
- **Dark Theme**: Full-screen immersive experience
- **Extensible Architecture**: Easy to add new visualization plugins

## Architecture

### Plugin-Based Visualization System

Each visualization is a self-contained module with:
- **Metadata**: Name, description, category
- **Audio Preferences**: FFT size, smoothing, decibel range
- **Parameters**: Configurable settings with UI controls
- **Render Function**: Canvas drawing logic

### Directory Structure

```
client/src/
├── modules/
│   ├── audio/
│   │   └── AudioAnalyzer.ts    # Web Audio API service
│   └── visualizations/
│       ├── types.ts            # TypeScript interfaces
│       ├── registry.ts         # Plugin registry
│       └── plugins/
│           ├── frequency-bars/
│           ├── waveform/
│           ├── circular-spectrum/
│           └── particles/
├── state/
│   └── visualizationStore.ts   # Zustand state management
├── components/visualizer/
│   ├── VisualizationCanvas.tsx
│   ├── TopBar.tsx
│   ├── VisualizationGallery.tsx
│   ├── ControlDock.tsx
│   ├── SettingsPanel.tsx
│   └── KeyboardHandler.tsx
└── pages/
    └── visualizer.tsx
```

## Adding New Visualizations

1. Create a new folder under `client/src/modules/visualizations/plugins/`
2. Implement the `VisualizationModule` interface:

```typescript
import { VisualizationModule } from '../../types';

export const myVisualization: VisualizationModule = {
  metadata: {
    id: 'my-visualization',
    name: 'My Visualization',
    description: 'Description here',
    category: 'frequency' | 'waveform' | 'geometric' | 'particle',
  },
  audioPreferences: {
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
    minDecibels: -90,
    maxDecibels: -10,
  },
  defaultParameters: {
    // Define adjustable parameters
  },
  createInstance: () => ({
    init: (ctx) => { /* Setup */ },
    render: (ctx, audio, params) => { /* Draw each frame */ },
    resize: (ctx) => { /* Handle resize */ },
    destroy: () => { /* Cleanup */ },
  }),
};
```

3. Register in `registry.ts`:
```typescript
import { myVisualization } from './plugins/my-visualization';
// In constructor:
this.register(myVisualization);
```

## Keyboard Shortcuts

- `H` - Toggle UI visibility
- `G` - Open visualization gallery
- `S` - Open settings panel
- `F` - Toggle fullscreen
- `←/→` - Navigate visualizations

## Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **State**: Zustand
- **Audio**: Web Audio API
- **Routing**: Wouter
- **Data Fetching**: TanStack Query

## Development

The app runs on port 5000. The server serves both the frontend (Vite) and any API endpoints.

```bash
npm run dev
```
