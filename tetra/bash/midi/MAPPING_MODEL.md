# 2-Exponential Mapping Model

## Overview

A parameterized mapping function for transforming MIDI CC values (0-127) to normalized semantic values (0.0-1.0) with flexible non-linear response curves.

## Mathematical Model

The 2-exponential model uses two exponential segments to create S-curves, logarithmic, or exponential responses:

```
Input: x ∈ [0, 127]      (MIDI CC value)
Output: y ∈ [0.0, 1.0]   (Semantic value)

Normalized input: n = x / 127

y = {
    A₁ * (exp(α₁ * n) - 1) / (exp(α₁) - 1)               if n ≤ 0.5
    A₂ * (exp(α₂ * (n - 0.5)) - 1) / (exp(α₂/2) - 1)    if n > 0.5
}

Where:
  A₁, A₂  = Amplitude scaling factors (typically 0.5 each)
  α₁, α₂  = Exponential parameters (curvature)
  n       = Normalized input [0, 1]
```

## Parameter Meanings

### α (Alpha) - Curvature Parameter

- **α = 0**: Linear response
- **α > 0**: Exponential (slow start, fast end)
- **α < 0**: Logarithmic (fast start, slow end)
- **|α| > 5**: Strong curvature
- **|α| < 2**: Gentle curvature

### Amplitude (A₁, A₂)

Usually `A₁ = A₂ = 0.5` for symmetric curves, but can vary for asymmetric responses.

## Presets

### 1. Linear
```toml
[mapping.VOLUME]
model = "2exp"
alpha1 = 0.0
alpha2 = 0.0
amp1 = 0.5
amp2 = 0.5
```

### 2. Log (Audio Taper)
```toml
[mapping.VOLUME]
model = "2exp"
alpha1 = -4.0
alpha2 = -4.0
amp1 = 0.5
amp2 = 0.5
description = "Logarithmic, like audio pots"
```

### 3. Exponential (Slow to Fast)
```toml
[mapping.SENSITIVITY]
model = "2exp"
alpha1 = 4.0
alpha2 = 4.0
amp1 = 0.5
amp2 = 0.5
description = "Gentle at low values, aggressive at high"
```

### 4. S-Curve (Center-weighted)
```toml
[mapping.CROSSFADE]
model = "2exp"
alpha1 = 3.0
alpha2 = -3.0
amp1 = 0.5
amp2 = 0.5
description = "Slow edges, fast middle transition"
```

### 5. Inverted S-Curve (Edge-weighted)
```toml
[mapping.BLEND]
model = "2exp"
alpha1 = -3.0
alpha2 = 3.0
amp1 = 0.5
amp2 = 0.5
description = "Fast edges, slow middle"
```

## Device Config Format

Example VMX8 config with 2-exponential mappings:

```toml
[device]
name = "vmx8"
type = "midi_controller"
ports = [0]

[device.variants.a]
name = "mixer"
description = "Audio mixing controls"

[[device.variants.a.mappings]]
cc = 7
semantic = "VOLUME_1"
model = "2exp"
alpha1 = -4.0
alpha2 = -4.0
amp1 = 0.5
amp2 = 0.5

[[device.variants.a.mappings]]
cc = 8
semantic = "CROSSFADE_1"
model = "2exp"
alpha1 = 3.0
alpha2 = -3.0
amp1 = 0.5
amp2 = 0.5

[[device.variants.a.mappings]]
cc = 10
semantic = "RESONANCE_1"
model = "2exp"
alpha1 = 2.0
alpha2 = 2.0
amp1 = 0.5
amp2 = 0.5
```

## CLI Commands for Mapping Management

### View Mappings
```bash
map list                    # List all mappings for current device
map show VOLUME_1           # Show specific mapping details
map show cc:7               # Show mapping by CC number
```

### Create/Edit Mappings
```bash
map create VOLUME_1 cc:7    # Create new mapping
map edit VOLUME_1           # Edit existing mapping
map delete VOLUME_1         # Remove mapping
```

### Test Mappings Interactively
```bash
map test VOLUME_1           # Enter test mode for mapping
  > Input CC values, see output
  > Adjust parameters live
  > Graph the curve (ASCII art)
```

### Curve Presets
```bash
map preset list             # List available presets
map preset apply VOLUME_1 log     # Apply preset to mapping
map preset save VOLUME_1 mycurve  # Save current as preset
```

### Visual Curve Display
```bash
map curve VOLUME_1          # ASCII art graph of mapping curve

Output:
  1.0 ┤            ╭───────
      │          ╭─╯
  0.5 ┤      ╭──╯
      │   ╭──╯
  0.0 ┼──╯
      0    63   127

  Model: 2exp
  α1=-4.0 α2=-4.0 (logarithmic)
```

## Implementation

### JavaScript (midi.js service)
```javascript
function map2Exp(cc, alpha1, alpha2, amp1 = 0.5, amp2 = 0.5) {
    const n = cc / 127.0;

    if (n <= 0.5) {
        const e = Math.exp(alpha1 * n);
        const norm = (Math.exp(alpha1) - 1);
        return amp1 * (e - 1) / norm;
    } else {
        const e = Math.exp(alpha2 * (n - 0.5));
        const norm = (Math.exp(alpha2 / 2) - 1);
        return amp1 + amp2 * (e - 1) / norm;
    }
}
```

### Bash (REPL testing)
```bash
map_2exp() {
    local cc=$1 alpha1=$2 alpha2=$3 amp1=${4:-0.5} amp2=${5:-0.5}

    # Call JavaScript helper for accurate math
    node -e "
        const n = $cc / 127.0;
        let y;
        if (n <= 0.5) {
            const e = Math.exp($alpha1 * n);
            const norm = Math.exp($alpha1) - 1;
            y = $amp1 * (e - 1) / norm;
        } else {
            const e = Math.exp($alpha2 * (n - 0.5));
            const norm = Math.exp($alpha2 / 2) - 1;
            y = $amp1 + $amp2 * (e - 1) / norm;
        }
        console.log(y.toFixed(6));
    "
}
```

## Benefits

1. **Flexible**: Single model covers linear, log, exp, S-curves
2. **Parameterized**: Easy to save/load/share configurations
3. **Intuitive**: α parameter directly controls curvature feel
4. **Efficient**: Simple exponential math, no lookup tables
5. **Smooth**: Continuous derivatives, no discontinuities
6. **Symmetric**: Two segments allow complex shapes

## Future Extensions

- **3+ segments** for more complex curves
- **Deadzone parameters** (min/max thresholds)
- **Inversion flag** (reverse mapping)
- **Clipping modes** (hard/soft limiting)
