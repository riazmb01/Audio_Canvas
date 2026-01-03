# Audio Visualizer Design Guidelines

## Design Approach

**Reference-Based Approach**: Drawing inspiration from Spotify's Canvas feature, Windows Media Player visualizations, and modern creative tools like Figma's minimalist UI overlaid on canvas. The design prioritizes the visualization as the hero element while maintaining accessible, unobtrusive controls.

**Core Principle**: Maximum canvas space with minimal UI interference. All controls are contextual and can be hidden/revealed as needed.

---

## Layout Architecture

### Primary Layout Structure
- **Full-viewport visualization canvas** (100vh, 100vw) as the main element
- **Floating control panels** positioned at strategic screen edges (top-right for settings, bottom for playback controls)
- **Collapsible sidebar** (320px width) for visualization gallery/selector - slides in from left
- **Notification toasts** for system messages (top-center, absolute positioning)

### Spacing System
Use Tailwind units: **2, 3, 4, 6, 8** for consistent spacing
- Component padding: p-4, p-6
- Section gaps: gap-4, gap-6
- Icon spacing: m-2, m-3

---

## Typography Hierarchy

**Font Stack**: 
- Primary: 'Inter' (Google Fonts) - UI elements, controls, labels
- Monospace: 'JetBrains Mono' - audio frequency data, technical readouts

**Scale**:
- Visualization titles: text-2xl, font-semibold
- Control labels: text-sm, font-medium
- Data readouts: text-xs, font-mono
- Button text: text-base, font-medium

---

## Component Library

### Navigation & Control Surfaces

**Top Bar** (fixed, backdrop-blur, 60px height):
- App logo/title (left)
- Audio source selector dropdown
- Settings icon button
- Minimize visualization controls toggle

**Visualization Gallery Sidebar**:
- Grid of thumbnail previews (2 columns, gap-3)
- Each preview: 140px height, rounded corners, hover lift effect
- Active visualization: subtle border treatment
- Category filters: tab-based navigation above grid

**Floating Control Panel** (bottom-center, 400px width):
- Play/pause, skip controls
- Volume slider with live meter visualization
- Current track info display
- Visualization intensity/sensitivity sliders

### Interactive Elements

**Buttons**:
- Icon buttons: 40px × 40px, rounded-lg
- Primary actions: px-6 py-3, rounded-full
- Glass morphism treatment for buttons over canvas (backdrop-blur-md, semi-transparent backgrounds)

**Sliders**:
- Custom range inputs with live value indicators
- Track height: 4px
- Thumb: 16px diameter, grab cursor

**Dropdowns**:
- Minimal style, max-h-64 with scroll
- Options: py-2 px-4, hover state with slight transform

### Data Visualization Components

**Audio Spectrum Display** (within controls):
- Mini frequency bars (30 bars, 2px width each)
- Reflects current audio state
- Subtle animation on audio peaks

**Settings Panel** (slide-in from right, 360px width):
- Tabbed sections: Audio, Visuals, Performance
- Toggle switches for feature flags
- Color picker for accent customization
- FPS/performance monitor toggle

---

## Visualization Canvas Architecture

### Canvas Structure
- Full-screen WebGL/Canvas element (z-index: 0)
- Responsive resize handling
- Performance-optimized rendering loop

### Visualization Styles (Architectural Framework)
Each visualization is a modular plugin with:
- **Preset metadata**: name, description, thumbnail
- **Audio analysis preferences**: FFT size, frequency ranges
- **Render function**: receives audio data, renders to canvas
- **Configurable parameters**: user-adjustable settings

**Style Categories**:
1. Frequency Bars (classic spectrum analyzer)
2. Waveform (oscilloscope-style)
3. Particle Systems (reactive particles)
4. Circular/Radial (spectrum arranged in circles)
5. Abstract Geometry (reactive shapes)

---

## Interaction Patterns

**Mouse Interactions**:
- Click canvas: toggle UI visibility (fade in/out controls)
- Hover controls: reveal full opacity (default: reduced opacity)
- Drag volume slider: immediate visual feedback on visualization intensity

**Keyboard Shortcuts**:
- Space: play/pause
- Arrow keys: navigate visualizations
- F: fullscreen toggle
- H: hide/show UI
- Display keyboard shortcut overlay (press ?)

**Gestures** (touch devices):
- Swipe left/right: change visualization
- Pinch: adjust visualization zoom/scale
- Two-finger tap: toggle controls

---

## Accessibility Implementation

- All controls keyboard navigable (tab order: top bar → sidebar → bottom controls → settings)
- ARIA labels for all icon buttons
- Focus indicators: 2px outline offset
- Screen reader announcements for visualization changes
- Reduced motion respect: disable particle animations, use static frequency bars

---

## Performance Considerations

- Lazy load visualization modules (code splitting)
- RequestAnimationFrame for smooth rendering
- Web Audio API for efficient audio processing
- Canvas optimization: limit draw calls, use offscreen buffers
- FPS limiter option (30fps/60fps toggle) in settings

---

## Responsive Behavior

**Desktop** (1024px+): Full feature set, floating controls
**Tablet** (768px-1023px): Sidebar becomes full-screen overlay, simplified controls
**Mobile** (<768px): Bottom sheet for visualizations, minimal top bar, gesture-first navigation