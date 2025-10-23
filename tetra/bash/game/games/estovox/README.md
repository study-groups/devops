# Estovox - Audio-Visual Synthesis Engine

## Overview

Estovox is an interactive audio-visual synthesis engine for the terminal. It combines sound generation with visual feedback for creating immersive sonic experiences.

## Status

🏗️ **Skeleton** - Framework in place, engine not yet implemented

## Concept

Estovox will provide:
- Real-time audio synthesis
- Visual waveform/spectrum display
- Interactive parameter control via REPL
- Preset sound configurations
- Recording and playback capabilities

## Architecture

```
estovox/
├── core/
│   ├── estovox.sh          # Engine interface (TODO)
│   └── estovox_repl.sh     # REPL integration (skeleton)
├── config/
│   ├── presets.toml        # Sound presets (TODO)
│   └── controls.toml       # Control mappings (TODO)
├── scripts/
│   └── examples/           # Example sound scripts (TODO)
└── engine/
    └── (C implementation TBD)
```

## Future Implementation

### Engine (C)
- Audio buffer management
- Oscillator synthesis (sine, square, saw, triangle)
- Filter system (low-pass, high-pass, band-pass)
- Envelope generators (ADSR)
- Effects (reverb, delay, distortion)

### REPL Commands
- `synth <type> <freq> <amp>` - Create oscillator
- `filter <type> <cutoff> <resonance>` - Apply filter
- `env <attack> <decay> <sustain> <release>` - Set envelope
- `fx <type> <param>` - Add effect
- `play` - Start playback
- `stop` - Stop playback
- `record <file>` - Record output
- `preset <name>` - Load preset

## Integration

Estovox will integrate with:
- bash/repl - REPL framework
- bash/tds - Visual display
- bash/color - Color system
- bash/tcurses - Input handling

## Development Roadmap

1. ✅ Skeleton structure
2. ⬜ C engine foundation
3. ⬜ Basic oscillator implementation
4. ⬜ REPL command system
5. ⬜ Visual feedback display
6. ⬜ Preset system
7. ⬜ Effects and filters
8. ⬜ Recording capabilities
