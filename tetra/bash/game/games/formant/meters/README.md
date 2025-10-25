# Meter Filter Coefficients

This directory contains FIR filter coefficient files for audio metering.

## File Format

- One coefficient per line (float)
- Lines starting with `#` are comments
- Blank lines are ignored

## Presets

### vu.coef
Classic VU meter response with flat frequency response. Unity gain pass-through.
- Ballistics: 300ms attack/release
- Integration: 300ms RMS window

### a_weight.coef
A-weighting filter (ITU-R 468 approximation)
- Emphasizes 2-5kHz (human hearing sensitivity)
- 31-tap FIR filter
- Designed for 48kHz sample rate

### bass.coef
Bass emphasis for low-frequency monitoring
- Low-pass characteristics
- Emphasizes <500Hz
- 21-tap FIR filter

### treble.coef
Treble emphasis for high-frequency monitoring
- High-pass characteristics
- Emphasizes >2kHz
- 15-tap FIR filter

## Creating Custom Filters

You can create custom FIR filters using tools like:
- MATLAB/Octave: `fir1()`, `firpm()`
- Python scipy: `scipy.signal.firwin()`
- Online filter designers

Export coefficients to a text file (one per line) and place in this directory.

## Usage

```c
formant_meter_t* meter = formant_meter_create(48000.0f, "vu");
formant_meter_load_filter(meter, "meters/a_weight.coef");
```

Or from bash REPL:
```bash
meter a_weight
```
