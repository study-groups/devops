#!/usr/bin/env bash

# vox_sound_synth.sh - Custom wave synthesis
# Pure math wave generation + Go WAV encoder

# Generate sine wave samples
synth_sine() {
    local freq="$1"
    local duration="$2"      # in seconds
    local sample_rate="${3:-44100}"
    local amplitude="${4:-0.5}"

    # Calculate number of samples
    local num_samples=$(echo "$duration * $sample_rate" | bc)

    # Generate samples using awk for speed
    awk -v freq="$freq" \
        -v samples="$num_samples" \
        -v rate="$sample_rate" \
        -v amp="$amplitude" \
        'BEGIN {
            pi = 3.14159265358979323846
            for (i = 0; i < samples; i++) {
                t = i / rate
                value = amp * sin(2 * pi * freq * t)
                print value
            }
        }'
}

# Generate square wave
synth_square() {
    local freq="$1"
    local duration="$2"
    local sample_rate="${3:-44100}"
    local amplitude="${4:-0.5}"

    local num_samples=$(echo "$duration * $sample_rate" | bc)

    awk -v freq="$freq" \
        -v samples="$num_samples" \
        -v rate="$sample_rate" \
        -v amp="$amplitude" \
        'BEGIN {
            pi = 3.14159265358979323846
            for (i = 0; i < samples; i++) {
                t = i / rate
                phase = (2 * pi * freq * t) % (2 * pi)
                value = (phase < pi) ? amp : -amp
                print value
            }
        }'
}

# Generate sawtooth wave
synth_saw() {
    local freq="$1"
    local duration="$2"
    local sample_rate="${3:-44100}"
    local amplitude="${4:-0.5}"

    local num_samples=$(echo "$duration * $sample_rate" | bc)

    awk -v freq="$freq" \
        -v samples="$num_samples" \
        -v rate="$sample_rate" \
        -v amp="$amplitude" \
        'BEGIN {
            for (i = 0; i < samples; i++) {
                t = i / rate
                phase = (freq * t) % 1.0
                value = amp * (2 * phase - 1)
                print value
            }
        }'
}

# Generate triangle wave
synth_triangle() {
    local freq="$1"
    local duration="$2"
    local sample_rate="${3:-44100}"
    local amplitude="${4:-0.5}"

    local num_samples=$(echo "$duration * $sample_rate" | bc)

    awk -v freq="$freq" \
        -v samples="$num_samples" \
        -v rate="$sample_rate" \
        -v amp="$amplitude" \
        'BEGIN {
            for (i = 0; i < samples; i++) {
                t = i / rate
                phase = (freq * t) % 1.0
                value = amp * (4 * (phase < 0.5 ? phase : 1 - phase) - 1)
                print value
            }
        }'
}

# Generate noise (white noise)
synth_noise() {
    local duration="$1"
    local sample_rate="${2:-44100}"
    local amplitude="${3:-0.5}"

    local num_samples=$(echo "$duration * $sample_rate" | bc)

    awk -v samples="$num_samples" \
        -v amp="$amplitude" \
        'BEGIN {
            srand()
            for (i = 0; i < samples; i++) {
                value = amp * (2 * rand() - 1)
                print value
            }
        }'
}

# Kick drum (synthesized bass drum)
synth_kick() {
    local duration="${1:-0.5}"
    local sample_rate="${2:-44100}"

    # Kick: pitch envelope from 150Hz → 40Hz with exponential decay
    local num_samples=$(echo "$duration * $sample_rate" | bc)

    awk -v samples="$num_samples" \
        -v rate="$sample_rate" \
        'BEGIN {
            pi = 3.14159265358979323846
            for (i = 0; i < samples; i++) {
                t = i / rate
                # Pitch envelope: 150 → 40 Hz
                freq = 40 + 110 * exp(-t * 8)
                # Amplitude envelope: exponential decay
                amp = exp(-t * 6)
                # Sine wave
                value = amp * sin(2 * pi * freq * t)
                print value
            }
        }'
}

# Snare drum (noise + tone)
synth_snare() {
    local duration="${1:-0.3}"
    local sample_rate="${2:-44100}"

    local num_samples=$(echo "$duration * $sample_rate" | bc)

    awk -v samples="$num_samples" \
        -v rate="$sample_rate" \
        'BEGIN {
            pi = 3.14159265358979323846
            srand()
            for (i = 0; i < samples; i++) {
                t = i / rate
                # Tone component: 200Hz with decay
                tone = 0.3 * sin(2 * pi * 200 * t) * exp(-t * 15)
                # Noise component with decay
                noise = 0.7 * (2 * rand() - 1) * exp(-t * 20)
                value = tone + noise
                print value
            }
        }'
}

# Clap (short burst of filtered noise)
synth_clap() {
    local duration="${1:-0.15}"
    local sample_rate="${2:-44100}"

    local num_samples=$(echo "$duration * $sample_rate" | bc)

    awk -v samples="$num_samples" \
        -v rate="$sample_rate" \
        'BEGIN {
            srand()
            for (i = 0; i < samples; i++) {
                t = i / rate
                # Multiple short bursts
                burst = (t < 0.02) ? 1.0 : (t < 0.04 ? 0.7 : (t < 0.06 ? 0.5 : 0))
                value = (2 * rand() - 1) * burst * exp(-t * 25)
                print value
            }
        }'
}

# Hi-hat (filtered noise, short)
synth_hihat() {
    local duration="${1:-0.1}"
    local sample_rate="${2:-44100}"
    local brightness="${3:-1.0}"  # 0.0-1.0

    local num_samples=$(echo "$duration * $sample_rate" | bc)

    awk -v samples="$num_samples" \
        -v rate="$sample_rate" \
        -v bright="$brightness" \
        'BEGIN {
            srand()
            for (i = 0; i < samples; i++) {
                t = i / rate
                # High-pass filtered noise
                value = (2 * rand() - 1) * exp(-t * 35) * bright
                print value
            }
        }'
}

# Convert float samples to 16-bit PCM WAV
# Reads samples from stdin, writes WAV to stdout
samples_to_wav() {
    local sample_rate="${1:-44100}"
    local num_channels="${2:-1}"

    # Use Go for WAV encoding (fast and portable)
    # Will create this as a separate tool
    _vox_wav_encode "$sample_rate" "$num_channels"
}

# WAV encoder helper (will be replaced with Go binary)
_vox_wav_encode() {
    local sample_rate="$1"
    local num_channels="$2"

    # For now, use Python as fallback until we build Go version
    python3 - "$sample_rate" "$num_channels" <<'PYTHON'
import sys
import struct
import wave

sample_rate = int(sys.argv[1])
num_channels = int(sys.argv[2])

# Read samples from stdin
samples = []
for line in sys.stdin:
    samples.append(float(line.strip()))

# Convert to 16-bit PCM
pcm_data = b''
for sample in samples:
    # Clamp and convert to int16
    value = max(-1.0, min(1.0, sample))
    int_val = int(value * 32767)
    pcm_data += struct.pack('<h', int_val)

# Write WAV to stdout
with wave.open(sys.stdout.buffer, 'wb') as wav:
    wav.setnchannels(num_channels)
    wav.setsampwidth(2)  # 16-bit
    wav.setframerate(sample_rate)
    wav.writeframes(pcm_data)
PYTHON
}

# High-level sound generation
vox_synth() {
    local sound_type="$1"
    local duration="${2:-0.5}"
    local output_file="${3:-}"

    local samples
    case "$sound_type" in
        bd|kick)
            samples=$(synth_kick "$duration")
            ;;
        sd|snare)
            samples=$(synth_snare "$duration")
            ;;
        cp|clap)
            samples=$(synth_clap "$duration")
            ;;
        hh|hihat)
            samples=$(synth_hihat "$duration")
            ;;
        sine)
            samples=$(synth_sine 440 "$duration")
            ;;
        square)
            samples=$(synth_square 440 "$duration")
            ;;
        saw)
            samples=$(synth_saw 440 "$duration")
            ;;
        triangle)
            samples=$(synth_triangle 440 "$duration")
            ;;
        noise)
            samples=$(synth_noise "$duration")
            ;;
        *)
            echo "Unknown sound type: $sound_type" >&2
            return 1
            ;;
    esac

    if [[ -n "$output_file" ]]; then
        echo "$samples" | samples_to_wav 44100 1 > "$output_file"
    else
        echo "$samples" | samples_to_wav 44100 1
    fi
}
