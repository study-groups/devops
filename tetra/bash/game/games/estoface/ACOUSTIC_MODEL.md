# Acoustic Model for Estoface

## Overview

This document describes the acoustic modeling approach used in Estoface, which maps articulatory configurations (facial states) to acoustic properties relevant for speech production. The primary goal is to establish a functional relationship between visible articulator positions and the acoustic tube model of the vocal tract.

## Core Principle: Articulatory-Acoustic Mapping

Speech sounds are produced by modulating airflow through the vocal tract. The shape and length of this resonating tube determine the acoustic properties of the resulting sound. In Estoface, we model this relationship by mapping facial state parameters to effective acoustic dimensions.

## Vocal Tract Length Calculation

### The Length Parameter

The **vocal tract length** is the effective acoustic distance from the glottis (vocal folds) to the lips. This length is the primary determinant of formant frequencies in vowel production. Longer vocal tracts produce lower formants; shorter tracts produce higher formants.

### Formula

```
tract_length = base_length + (jaw_openness * jaw_length_scale) + (lip_protrusion * protrusion_length_scale)
```

### Default Parameters

```
base_length = 17.5          # cm - typical adult neutral tract length
jaw_length_scale = 2.0      # cm - maximum jaw contribution to length
protrusion_length_scale = 1.5  # cm - maximum lip protrusion contribution
```

### Parameter Explanations

#### `base_length` (17.5 cm)
The baseline vocal tract length from glottis to lips in a neutral configuration (jaw closed, lips unrounded and not protruded). This is based on typical adult male vocal tract dimensions.

**Variations:**
- Adult male: ~17.5 cm
- Adult female: ~14.5 cm
- Child (age 5): ~10 cm

#### `jaw_length_scale` (2.0 cm)
The maximum additional length contributed by jaw opening. When the jaw is fully open (`jaw_openness = 1.0`), the vocal tract becomes effectively longer due to the increased vertical dimension of the oral cavity.

**Physical basis:** Opening the jaw lowers the mandible and increases the vertical distance from the hard palate to the jaw, effectively lengthening the resonating cavity.

#### `protrusion_length_scale` (1.5 cm)
The maximum additional length contributed by lip protrusion. When lips are fully protruded (`lip_protrusion = 1.0`), they extend the front opening of the vocal tract.

**Physical basis:** Lip protrusion physically extends the vocal tract at its anterior end, directly increasing the acoustic tube length.

### Control Mapping: I/K as Pipe Length

The **I/K keys** control jaw openness, which directly affects vocal tract length:

- **I** = close jaw → shorter pipe → higher formants
- **K** = open jaw → longer pipe → lower formants

This metaphor helps users think of the vocal tract as a variable-length resonating pipe, similar to a trombone or other brass instruments where changing the tube length changes the pitch.

## Impact of Tongue and Lip Position on Airflow and Acoustics

### Tongue Position

The tongue is the most dynamic articulator and has the greatest impact on vowel quality:

#### Tongue Height (`tongue_height`)
- **High tongue** (0.8-1.0): Constricts the vocal tract at the palatal region
  - Decreases area → increases air velocity → affects F1 (lowers it)
  - Associated with vowels like [i] (feet) and [u] (boot)

- **Low tongue** (0.0-0.2): Opens the pharyngeal/oral cavity
  - Increases area → decreases air velocity → affects F1 (raises it)
  - Associated with vowels like [a] (father) and [æ] (cat)

#### Tongue Frontness (`tongue_frontness`)
- **Front tongue** (0.8-1.0): Creates constriction near the hard palate
  - Shortens front cavity, lengthens back cavity → raises F2
  - Associated with front vowels like [i] (feet) and [e] (bait)

- **Back tongue** (0.0-0.2): Creates constriction near the velum
  - Lengthens front cavity, shortens back cavity → lowers F2
  - Associated with back vowels like [u] (boot) and [o] (boat)

### Lip Configuration

Lip shape affects both the length and cross-sectional area of the vocal tract at its anterior opening:

#### Lip Rounding (`lip_rounding`)
- **Rounded lips** (0.8-1.0):
  - Reduces lip aperture area → lowers F2 and F3
  - Often combined with protrusion for maximum effect
  - Essential for rounded vowels like [u] (boot) and [o] (boat)

- **Spread lips** (0.0-0.2):
  - Increases lip aperture area → raises F2 and F3
  - Common in front vowels like [i] (feet) and [e] (bait)

#### Lip Protrusion (`lip_protrusion`)
- **Protruded lips** (0.8-1.0):
  - Extends vocal tract length → lowers all formants proportionally
  - Reduces lip opening area → particularly lowers F2 and F3
  - Controlled by **J/L keys** (J=retract, L=protrude)

### Airflow Dynamics

The combination of tongue and lip positions creates a complex pressure-flow relationship:

1. **Constriction Location**: Where the tongue creates the narrowest passage determines turbulence and airflow characteristics

2. **Constriction Degree**: How tight the constriction is affects whether the sound is:
   - Vowel (minimal constriction, laminar flow)
   - Approximant (narrow but not turbulent)
   - Fricative (turbulent airflow through narrow channel)

3. **Radiation Characteristics**: The lip opening acts as the radiation source for speech acoustics:
   - Rounded/protruded lips → omnidirectional radiation
   - Spread lips → more directional radiation

## Acoustic Information Flow

```
[Glottis] → [Pharynx] → [Tongue Constriction] → [Lip Opening] → [Radiated Sound]
    ↓           ↓              ↓                      ↓                ↓
  Source    Length &    Formant Shaping         Length &          Output
           Filtering   (F1, F2 primary)      Final Filtering    Spectrum
```

### Information Preservation

Each stage modulates but preserves information from the previous stage:

- **Source** (glottis): Provides fundamental frequency (pitch) and harmonic structure
- **Pharynx**: Provides baseline filtering based on tract length
- **Tongue**: Shapes the primary formant structure (vowel quality)
- **Lips**: Provides final filtering and determines output impedance
- **Radiation**: Emphasizes higher frequencies (+6 dB/octave above ~500 Hz)

## Implementation Notes

### Current Status

The lip-to-length mapping formula is documented here as a named parameter set. Implementation in code can reference these values for:

1. **Real-time acoustic synthesis** (future feature)
2. **Formant frequency estimation** (visualization aid)
3. **Phoneme distance weighting** (current IPA matching)
4. **Educational visualization** (showing tract length changes)

### Usage in Estoface

When working with Estoface, users should understand that:

- **WASD controls** manipulate the primary sound-shaping articulator (tongue)
- **IJKL controls** manipulate the pipe length and lip configuration
- **I/K specifically** changes the fundamental resonance by altering tract length
- **U/O controls** fine-tune lip shape for final acoustic coloring

### Phoneme Notation Format

When documenting phonemes with their acoustic properties, use the format:

```
(phonetic-symbol:F1-F2-F3:duration-ms)
```

**Example:**
- `[i:270-2290-3010:150]` - High front vowel "ee" with formants and 150ms duration
- `[ɑ:730-1090-2440:200]` - Low back vowel "ah" with formants and 200ms duration

This notation provides complete acoustic specification for esto vox (voice) synthesis.

### Future Extensions

Potential enhancements to the acoustic model:

1. **Real-time formant display**: Show F1, F2, F3 values based on current articulation
2. **Acoustic synthesis**: Generate actual vowel sounds using calculated tract dimensions
3. **Spectral visualization**: Display predicted frequency spectrum
4. **Articulation targets**: Overlay acoustic targets on the parameter space

## References

### Theoretical Background

- **Source-Filter Theory** (Fant, 1960): Speech production as source excitation filtered by vocal tract
- **Perturbation Theory** (Chiba & Kajiyama, 1941): Relationship between constriction location and formant changes
- **Acoustic Theory of Speech Production** (Stevens, 1998): Comprehensive articulatory-acoustic relationships

### Measurement Studies

- Vocal tract length varies with jaw opening by approximately 1-3 cm in adults
- Lip protrusion can extend the vocal tract by 0.5-2 cm
- F1 is primarily determined by jaw opening and tongue height
- F2 is primarily determined by tongue frontness and lip rounding
- F3 is affected by lip rounding and tongue tip position

---

**Version:** 1.0
**Last Updated:** 2025-10-30
**Author:** Estoface Development Team
