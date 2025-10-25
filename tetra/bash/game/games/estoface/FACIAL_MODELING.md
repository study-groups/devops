# Estoface Facial Modeling & Control System

## Overview

Estoface is a real-time facial animation and speech synthesis system that combines:
- **Gamepad control** - MIDI-esque controller for expressive performance
- **Anatomical modeling** - FACS-based facial mechanics with degrees of freedom
- **UTF-8 rendering** - Budget terminal UI with brightness/dimness for 3D hints
- **Formant synthesis** - Integration with ../formant speech synthesis engine

This document describes the architecture for modeling facial features (primarily mouth) and controlling them via gamepad to generate both visual animation and speech synthesis parameters.

## System Architecture

```
┌─────────────┐
│   Gamepad   │  Raw input (joysticks, buttons, hat)
└──────┬──────┘
       │
       v
┌─────────────────────────────────────────────────────┐
│  GAMEPAD INTERFACE MODULE                           │
│  - Maps raw input to coarse positions (4x4 grid)    │
│  - Handles joystick → phoneme/position mapping      │
│  - State machine for hat controller modes           │
└──────┬──────────────────────────────────────────────┘
       │
       v
┌─────────────────────────────────────────────────────┐
│  INTERNAL FACIAL MODEL                              │
│  - High DOF representation                          │
│  - FACS-based action units (AUs)                    │
│  - Anatomical parameters (jaw, tongue, lips, etc.)  │
│  - Future: collagen/tissue modeling for realism     │
└──────┬────────────┬─────────────────────────────────┘
       │            │
       v            v
┌──────────┐  ┌─────────────────────────────────────┐
│ RENDERER │  │  FORMANT SYNTHESIS CONTROLLER       │
│ (UTF-8)  │  │  - Maps facial state → formants     │
│          │  │  - Sends control signals to engine  │
└──────────┘  └──────┬──────────────────────────────┘
                     │
                     v
              ┌─────────────┐
              │  ../formant │  Speech synthesis engine
              │   engine    │
              └─────────────┘
```

## Design Philosophy

### Tech Art + Science
We balance technical accuracy with artistic expression:
- **Anatomically inspired** - Based on FACS (Facial Action Coding System)
- **Artistically expressive** - Performance-oriented control scheme
- **Computationally efficient** - Budget UI, low latency
- **Modular** - Clean separation: input → model → output

### Progressive Fidelity
Start simple, add complexity:
1. **Phase 1**: Coarse 4x4 grid, basic mouth shapes
2. **Phase 2**: Smooth interpolation, lip rounding, tongue position
3. **Phase 3**: Tissue modeling (collagen), micro-expressions
4. **Phase 4**: Full face (eyes, brows, expressiveness)

## Core Components

### 1. Gamepad Interface Module

**Purpose**: Translate raw gamepad input to semantic mouth positions

**Input Mapping**:
```
Left Joystick (Y-axis):  Jaw Open/Close     [4 discrete positions]
Left Joystick (X-axis):  Lip Rounding        [4 discrete positions]
Right Joystick (Y-axis): Tongue Height       [4 discrete positions]
Right Joystick (X-axis): Tongue Front/Back   [4 discrete positions]
Hat Controller:          Mode/State selector
Triggers:                Intensity/Expression modulation
Face Buttons:            Quick presets (A/E/I/O/U vowels)
```

**4x4 Grid System**:
- Each joystick axis divided into 4 zones (on/off style)
- Primary grid: Jaw × Lip Rounding = 16 base positions
- Secondary grid: Tongue Height × Tongue Position = 16 tongue shapes
- Combined: 16 × 16 = 256 possible mouth configurations
- Diagonals (NE/SW, NW/SE) are "harder to hit" - use for less common phonemes

**Output**: Coarse position indices (0-3) for each dimension

### 2. Internal Facial Model

**Purpose**: High-fidelity representation of facial mechanics

**State Variables** (Phase 1):
```c
typedef struct {
    // Jaw
    float jaw_openness;      // 0.0 (closed) to 1.0 (open)
    float jaw_thrust;        // -1.0 (back) to 1.0 (forward)

    // Lips
    float lip_rounding;      // 0.0 (spread) to 1.0 (rounded)
    float lip_compression;   // 0.0 (relaxed) to 1.0 (tight)
    float lip_protrusion;    // 0.0 (neutral) to 1.0 (forward)
    float lip_corner_height; // -1.0 (frown) to 1.0 (smile)

    // Tongue
    float tongue_height;     // 0.0 (low) to 1.0 (high)
    float tongue_frontness;  // 0.0 (back) to 1.0 (front)
    float tongue_tip_raised; // 0.0 (down) to 1.0 (up at alveolar ridge)

    // Velum (for nasality)
    float velum_lowered;     // 0.0 (raised, oral) to 1.0 (lowered, nasal)

} FacialState;
```

**FACS Action Units** (see MOUTH_RIGGING.md):
- AU26: Jaw Drop
- AU12: Lip Corner Puller (smile)
- AU15: Lip Corner Depressor (frown)
- AU18: Lip Pucker
- AU22: Lip Funneler
- AU23: Lip Tightener
- AU24: Lip Presser
- (See full mapping in MOUTH_RIGGING.md)

**Coordinate Spaces**:
1. **Discrete Gamepad Space**: 4×4×4×4 integer grid
2. **Continuous Anatomical Space**: Normalized floats [0.0, 1.0]
3. **Acoustic Space**: Formant frequencies F1, F2, F3
4. **Visual Space**: UTF-8 character grid with brightness

### 3. Rendering Engine

**Purpose**: Project internal model to terminal display

**Rendering Approach**:
- **Budget UI**: Stacking panels (bottom to top)
- **Single/double line panels** numbered 1-5
- **Keys toggle panels** on/off
- **Eyes positioned lower** than in pulsar
- **Brightness/dimness** hints at 3D depth

**Panel Layout**:
```
┌────────────────────────────────────────┐
│ Panel 5: Command/Status Line           │ (top)
├────────────────────────────────────────┤
│ Panel 4: Eyes & Expression             │
├────────────────────────────────────────┤
│ Panel 3: Mouth Front View              │
├────────────────────────────────────────┤
│ Panel 2: Mouth Side View               │
├────────────────────────────────────────┤
│ Panel 1: Control Values / IPA Display  │ (bottom)
└────────────────────────────────────────┘
```

**UTF-8 Character Palette**:
```
Lips:    ( ) [ ] { } ⟨ ⟩ ╱ ╲ ─ │ ◡ ◠
Teeth:   ‿ ⌢ ▁ ▂ ▃
Tongue:  ~ ∼ ≈ * ·
Jaw:     ‾ _ ⌞ ⌟ └ ┘
Shading: Dim (back/shadow) vs Bright (front/highlight)
```

### 4. Formant Synthesis Controller

**Purpose**: Map facial state to speech synthesis parameters

**IPC Protocol** (see IPC_DESIGN.md):
- **Method**: Named pipes (FIFOs) for low-latency streaming
- **Format**: Binary or text protocol (TBD)
- **Direction**: estoface → formant (unidirectional for now)

**Facial State → Formant Mapping**:
```
jaw_openness     → F1 (higher when open)
tongue_height    → F1 (lower when high)
tongue_frontness → F2 (higher when front)
lip_rounding     → F2, F3 (lower when rounded)
```

**Control Signal Format** (proposed):
```
FORMANT <F1_hz> <F2_hz> <F3_hz> <amplitude> <voicing>
```

Example:
```
FORMANT 730 1090 2440 0.8 1.0    # [a] as in "father"
FORMANT 270 2290 3010 0.7 1.0    # [i] as in "beet"
```

## Phoneme Mapping Strategy

### Cardinal Vowels (4x4 Grid Corners)

```
        FRONT           CENTRAL         BACK
HIGH    [i] NE          [ɨ]             [u] NW
        beet            roses           boot

MID     [e]             [ə]             [o]
        bed             about           boat

LOW     [æ]             [a]             [ɑ] SW
        cat             father          thought

        unrounded       →               rounded
```

**Gamepad Mapping**:
- **Jaw (Left-Y)**: High → Low (0-3)
- **Rounding (Left-X)**: Spread → Round (0-3)
- **Tongue-H (Right-Y)**: High → Low (0-3)
- **Tongue-F (Right-X)**: Back → Front (0-3)

**Corner Positions** (easiest to hit):
- NE: [i] - jaw closed, tongue high front
- NW: [u] - jaw closed, tongue high back, lips rounded
- SE: [æ] - jaw open, tongue front
- SW: [ɑ] - jaw open, tongue back

### Rhythm & Sequencing

The gamepad enables **rhythmic phoneme sequences**:
- Use **triggers** for intensity/stress patterns
- Use **hat** to change mode (sustained vowel vs. rapid articulation)
- Create "chord progressions" of vowel sequences
- Think MIDI performance, not typing

## Testing Strategy

### Comprehensive Position Testing

**Script**: `test_all_positions.sh` (see TODO)

**Generates**:
1. Text file with all 256 mouth configurations
2. Visual rendering of each position
3. Formant parameters for each
4. IPA phoneme closest match

**Format**:
```
Position: [0,0,0,0] (jaw=0, round=0, tongue_h=0, tongue_f=0)
State: jaw_open=0.0, lip_round=0.0, tongue_h=0.0, tongue_f=0.0
Formants: F1=270Hz F2=2290Hz F3=3010Hz
IPA: [i] (CLOSE FRONT UNROUNDED)
Rendering:
  //  \\
  O    O
    v
/----------\
(tight closed)

Position: [0,0,0,1]
...
```

### Interactive Calibration

**REPL commands** for tuning:
```
> show grid 2 3      # Show specific grid position
> morph 0,0,0,0 3,3,3,3  # Animate from [i] to [ɑ]
> formant            # Display current formant values
> record sequence.esto   # Record a performance
> playback sequence.esto # Play it back
```

## Development Roadmap

### Phase 1: Mouth Foundation (Current)
- [x] Basic mouth rendering (test_mouth.c)
- [ ] FACS-based mouth model (MOUTH_RIGGING.md)
- [ ] Gamepad input mapping (GAMEPAD_PROTOCOL.md)
- [ ] 4x4 grid position indexing
- [ ] All-positions testing script

### Phase 2: Integration
- [ ] IPC with formant engine (IPC_DESIGN.md)
- [ ] Formant parameter mapping
- [ ] Real-time rendering loop
- [ ] REPL interface (similar to pulsar_repl.sh)

### Phase 3: Refinement
- [ ] Interpolation between positions
- [ ] Expression modulation (intensity, affect)
- [ ] Recording/playback system
- [ ] Preset phoneme sequences

### Phase 4: Full Face
- [ ] Eye positioning & movement
- [ ] Eyebrow expressiveness
- [ ] Facial affect (happy, sad, angry, etc.)
- [ ] Synchronized eye-mouth coordination

### Phase 5: Advanced Modeling
- [ ] Tissue properties (collagen in lips)
- [ ] Physics-based animation
- [ ] Micro-expressions
- [ ] Gender/age/individual variation

## References

- **FACS**: https://melindaozel.com/facs-cheat-sheet/
- **IPA Chart**: https://www.internationalphoneticalphabet.org/ipa-charts/
- **Formant Synthesis**: See ../formant/README.md
- **Pulsar Architecture**: ../pulsar/pulsar_repl.sh
- **Existing Examples**: ARTICULATION_EXAMPLES.md

## Related Documents

1. **MOUTH_RIGGING.md** - Detailed FACS action units and mouth mechanics
2. **GAMEPAD_PROTOCOL.md** - Complete gamepad mapping specification
3. **IPC_DESIGN.md** - Inter-process communication with formant engine
4. **RENDERING.md** - UTF-8 rendering system and visual design
5. **TESTING.md** - Testing strategy and validation tools

---

**Status**: Design phase (December 2024)
**Next**: Implement MOUTH_RIGGING.md with FACS-based action units
