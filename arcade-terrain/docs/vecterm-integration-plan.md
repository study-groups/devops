# Vecterm Integration Plan

## Technical Summary for Next Coding Session

### What is Vecterm?

Vecterm (`~/src/mricos/demos/vecterm`) is a **Redux-Canvas Terminal Engine** with:
- Full VT100-style CLI with tab completion and inline parameter sliders
- 3D wireframe graphics engine
- CRT visual effects pipeline (scanlines, glow, raster wave)
- ECS game architecture
- MIDI/gamepad hardware integration
- Audio synthesis (Tines engine)

**Key stats**: 87KB command processor, 1926-line reducer, 2129-line event handlers, 3000+ lines CSS

---

## Phase 1: Enhance Current NoiseCard CLI

### 1.1 Add Tab Completion with Inline Sliders

**Current state**: Basic tab completion in NoiseCLI.js
**Target**: Vecterm-style space+tab pattern with inline slider editing

**Key pattern from Vecterm** (`tab-completion.js:284-363`):
```javascript
// Space+Tab triggers slider mode
if (endsWithSpace && CONTINUOUS_COMMANDS[trimmedInput.toLowerCase()]) {
  const matchedCommand = trimmedInput.toLowerCase();
  input.value = '';
  cliLog(`vecterm> ${matchedCommand}`, 'success');
  showInlineSlider(matchedCommand, CONTINUOUS_COMMANDS[matchedCommand]);
  return true;
}
```

**Slider config format**:
```javascript
const CONTINUOUS_COMMANDS = {
  'blend': { min: 0, max: 1, step: 0.05, default: 0.15, unit: '' },
  'speed': { min: 0, max: 120, step: 1, default: 30, unit: ' fps' },
  'scale': { min: 0.001, max: 0.2, step: 0.001, default: 0.02, unit: '' },
  'rule': { min: 0, max: 255, step: 1, default: 30, unit: '' },
  'cells': { min: 4, max: 128, step: 4, default: 32, unit: 'px' }
};
```

### 1.2 Slider Lifecycle (3 states)

From `slider-lifecycle.js`:
- **ACTIVE**: Currently being edited, full interactivity
- **HISTORY**: Previous slider, dimmed but clickable to reactivate
- **ARCHIVED**: Swiped away, hidden but in history

**Gestures**:
- Drag left/right: Adjust value
- Swipe left: Archive slider
- Swipe right: Add to quick settings
- Long press (800ms): MIDI learn mode

### 1.3 Files to Create/Modify

```
modules/components/NoiseCard/
├── NoiseCLI.js           # Modify: Add slider trigger on space+tab
├── SliderManager.js      # Create: Slider lifecycle, DOM creation
├── SliderGestures.js     # Create: Touch/mouse gesture handling
└── slider-config.js      # Create: CONTINUOUS_COMMANDS config
```

---

## Phase 2: Vecterm as Embeddable Component

### 2.1 Extract Core Modules

Create `modules/services/vecterm/` with:

```
vecterm/
├── index.js              # VectermService API
├── VectermRenderer.js    # 3D wireframe canvas (from Vecterm.js)
├── VectermMath.js        # Vector/matrix math
├── VT100Effects.js       # CRT effect pipeline
├── TerminalRenderer.js   # VT100 canvas rendering
└── config.js             # Effect presets, defaults
```

### 2.2 Key Interfaces to Expose

```javascript
// VectermService API
VectermService.create(container, config)  // Create instance
VectermService.destroy(instance)          // Cleanup

// Instance methods
instance.setDemo(demoName)        // 'cube', 'pyramid', etc.
instance.setCamera(azimuth, elev) // Orbit camera
instance.setEffect(name, value)   // VT100 effects
instance.render()                 // Manual render
instance.start() / .stop()        // Animation loop
```

### 2.3 VT100 Effect Config

From `config/vt100-config.js`:
```javascript
export const VT100_EFFECTS = [
  { id: 'glow', min: 0, max: 2, default: 0.3, cssVar: '--vt100-border-glow' },
  { id: 'scanlines', min: 0, max: 1, default: 0.15, cssVar: '--vt100-scanline-intensity' },
  { id: 'wave', min: 0, max: 30, default: 2, unit: 'px', cssVar: '--vt100-wave-amplitude' },
  { id: 'jitter', min: 0, max: 5, default: 0.5, cssVar: '--vt100-jitter' },
  { id: 'barrel', min: 0, max: 0.3, default: 0.05, cssVar: '--vt100-barrel' }
];
```

---

## Phase 3: iframe Integration for Games & Vecterm

### 3.1 Home Page Layout

```
┌─────────────────────────────────────────────┐
│  Header (logo, nav, secondary nav)          │
├─────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐   │
│  │  Featured Game  │  │    Vecterm      │   │
│  │   (iframe)      │  │   (iframe)      │   │
│  │                 │  │                 │   │
│  └─────────────────┘  └─────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │        Cabinet Card (NoiseCard)     │    │
│  │        [double-click for CLI]       │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  Footer                                     │
└─────────────────────────────────────────────┘
```

### 3.2 iframe Communication

Use `postMessage` for parent-child communication:

```javascript
// Parent (arcade-terrain)
const gameFrame = document.getElementById('game-iframe');
gameFrame.contentWindow.postMessage({ type: 'LOAD_GAME', gameId: 'quadrapong' }, '*');

window.addEventListener('message', (e) => {
  if (e.data.type === 'GAME_STATE') {
    // Update parent state
  }
});

// Child (game iframe)
window.addEventListener('message', (e) => {
  if (e.data.type === 'LOAD_GAME') {
    loadGame(e.data.gameId);
  }
});

// Report state to parent
parent.postMessage({ type: 'GAME_STATE', state: gameState }, '*');
```

### 3.3 VectermEmbed Component

```javascript
// modules/components/VectermEmbed/index.js
export const VectermEmbed = {
  create(container, config = {}) {
    const iframe = document.createElement('iframe');
    iframe.src = config.src || '/vecterm/embed.html';
    iframe.className = 'vecterm-embed';

    // Communication channel
    const channel = {
      send: (type, data) => iframe.contentWindow.postMessage({ type, ...data }, '*'),
      on: (handler) => window.addEventListener('message', handler)
    };

    container.appendChild(iframe);
    return { iframe, channel };
  }
};
```

---

## Phase 4: Unified CLI System

### 4.1 Shared Command Registry

```javascript
// modules/services/cli/registry.js
export const CommandRegistry = {
  commands: new Map(),

  register(namespace, commands) {
    for (const [name, handler] of Object.entries(commands)) {
      this.commands.set(`${namespace}.${name}`, handler);
    }
  },

  execute(cmdString, context) {
    const [cmd, ...args] = cmdString.split(' ');
    const handler = this.commands.get(cmd) || this.commands.get(`global.${cmd}`);
    if (handler) return handler(args, context);
    return { error: `Unknown command: ${cmd}` };
  }
};

// NoiseCard registers its commands
CommandRegistry.register('noise', {
  preset: (args, ctx) => ctx.card.setPreset(args[0]),
  blend: (args, ctx) => ctx.card.setNoise({ blend: parseFloat(args[0]) }),
  rule: (args, ctx) => ctx.card.setNoise({ type: 'cellular', rule: parseInt(args[0]) })
});

// Vecterm registers its commands
CommandRegistry.register('vecterm', {
  demo: (args, ctx) => ctx.vecterm.setDemo(args[0]),
  camera: (args, ctx) => ctx.vecterm.setCamera(args[0], args[1])
});
```

### 4.2 Tab Completion Config

```javascript
// modules/services/cli/completions.js
export const SLIDER_COMMANDS = {
  // NoiseCard commands
  'noise.blend': { min: 0, max: 1, step: 0.05, default: 0.15 },
  'noise.speed': { min: 0, max: 120, step: 1, default: 30 },
  'noise.scale': { min: 0.001, max: 0.2, step: 0.001, default: 0.02 },
  'noise.rule': { min: 0, max: 255, step: 1, default: 30 },

  // Vecterm commands
  'vecterm.glow': { min: 0, max: 2, step: 0.05, default: 0.3 },
  'vecterm.scanlines': { min: 0, max: 1, step: 0.01, default: 0.15 },
  'vecterm.wave': { min: 0, max: 30, step: 0.5, default: 2 }
};
```

---

## Key Vecterm Patterns to Adopt

### 1. Slider DOM Structure

```html
<div class="cli-slider-container" data-state="active" data-command="blend">
  <div class="slider-header">
    <span class="slider-label">blend</span>
    <span class="slider-value">0.15</span>
  </div>
  <input type="range" class="slider-input" min="0" max="1" step="0.05" value="0.15">
  <div class="slider-track">
    <div class="slider-fill" style="width: 15%"></div>
  </div>
</div>
```

### 2. Gesture Detection

```javascript
// Swipe threshold: 50px horizontal, <30px vertical
const isSwipe = Math.abs(deltaX) > 50 && Math.abs(deltaY) < 30;
const direction = deltaX > 0 ? 'right' : 'left';

// Long press: 800ms without movement
const isLongPress = duration > 800 && movement < 10;
```

### 3. Color-Coded Categories

```javascript
const CATEGORY_COLORS = {
  noise: '#ff9900',   // --one (orange)
  vecterm: '#00e1cf', // --three (cyan)
  audio: '#65ac07',   // --four (green)
  game: '#f04f4a'     // --two (red)
};
```

---

## Implementation Order

1. **Phase 1a**: Add slider config to NoiseCard (`slider-config.js`) ✅ DONE
2. **Phase 1b**: Create SliderManager with DOM creation ✅ DONE
3. **Phase 1c**: Add space+tab detection in NoiseCLI.js ✅ DONE
4. **Phase 1d**: Implement gesture handling ✅ DONE
5. **Phase 2a**: Extract VT100Effects from Vecterm
6. **Phase 2b**: Create VectermService wrapper
7. **Phase 3a**: Add iframe containers to Home page
8. **Phase 3b**: Implement postMessage communication
9. **Phase 4**: Unify command registry across components

---

## Files Reference

### Vecterm Source (to study)
- `~/src/mricos/demos/vecterm/cli/tab-completion.js` - Tab completion logic
- `~/src/mricos/demos/vecterm/cli/slider-lifecycle.js` - Slider state management
- `~/src/mricos/demos/vecterm/cli/slider-gestures.js` - Touch/mouse gestures
- `~/src/mricos/demos/vecterm/cli/command-processor.js` - Command parsing (87KB)
- `~/src/mricos/demos/vecterm/config/vt100-config.js` - Effect definitions
- `~/src/mricos/demos/vecterm/Vecterm.js` - 3D renderer
- `~/src/mricos/demos/vecterm/style.css` - CLI styling (lines 1304-1500)

### Arcade-Terrain Target
- `modules/components/NoiseCard/NoiseCLI.js` - Enhance with sliders
- `modules/components/NoiseCard/SliderManager.js` - Create
- `modules/services/vecterm/` - Create service wrapper
- `modules/pages/Home.js` - Add iframe layout
- `styles/components/noise-card.css` - Add slider styles

---

## Session Checklist

Before starting implementation:
- [ ] Review `slider-lifecycle.js` for state machine pattern
- [ ] Review `slider-gestures.js` for touch handling
- [ ] Review `tab-completion.js` lines 284-363 for space+tab pattern
- [ ] Check `style.css` lines 1304-1500 for slider CSS
- [ ] Decide on iframe vs canvas for Vecterm embedding
