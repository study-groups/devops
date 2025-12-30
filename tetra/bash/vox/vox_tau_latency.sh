#!/usr/bin/env bash

# vox_tau_latency.sh - Latency measurement for tau audio pipeline
# Uses BlackHole loopback to measure actual audio latency

#==============================================================================
# CONFIGURATION
#==============================================================================

VOX_LATENCY_CAPTURE_DEVICE="${VOX_LATENCY_CAPTURE_DEVICE:-BlackHole 2ch}"
VOX_LATENCY_PLAYBACK_DEVICE="${VOX_LATENCY_PLAYBACK_DEVICE:-BlackHole 2ch}"
VOX_LATENCY_RECORD_DIR="${VOX_LATENCY_RECORD_DIR:-$TAU_RUNTIME/latency}"

#==============================================================================
# HELPERS
#==============================================================================

# Get current monotonic time in nanoseconds
_vox_mono_ns() {
    if [[ "$(uname)" == "Darwin" ]]; then
        # macOS: use python for nanosecond precision
        python3 -c "import time; print(int(time.monotonic_ns()))"
    else
        # Linux: use date
        date +%s%N
    fi
}

# Get current monotonic time in milliseconds
_vox_mono_ms() {
    local ns=$(_vox_mono_ns)
    echo $((ns / 1000000))
}

# Analyze WAV file for onset (first sample above threshold)
# Returns: offset in milliseconds, or -1 if not found
_vox_detect_onset() {
    local wav_file="$1"
    local threshold="${2:-0.01}"  # Default threshold: 1% of max amplitude

    if [[ ! -f "$wav_file" ]]; then
        echo "-1"
        return 1
    fi

    # Use Python for WAV analysis
    python3 <<EOF
import wave
import struct
import sys

try:
    with wave.open('$wav_file', 'rb') as w:
        rate = w.getframerate()
        frames = w.getnframes()
        channels = w.getnchannels()
        sampwidth = w.getsampwidth()

        # Read all frames
        data = w.readframes(frames)

        # Unpack based on sample width
        if sampwidth == 2:
            fmt = '<' + 'h' * (len(data) // 2)
            samples = struct.unpack(fmt, data)
            max_val = 32768.0
        elif sampwidth == 4:
            fmt = '<' + 'f' * (len(data) // 4)
            samples = struct.unpack(fmt, data)
            max_val = 1.0
        else:
            print("-1")
            sys.exit(1)

        # Find first sample above threshold
        threshold = $threshold * max_val
        for i, sample in enumerate(samples):
            if abs(sample) > threshold:
                # Convert sample index to milliseconds
                sample_idx = i // channels
                onset_ms = (sample_idx / rate) * 1000
                print(f"{onset_ms:.3f}")
                sys.exit(0)

        print("-1")
except Exception as e:
    print("-1", file=sys.stderr)
    sys.exit(1)
EOF
}

#==============================================================================
# LOOPBACK SETUP
#==============================================================================

# Configure tau for loopback testing (BlackHole)
vox_latency_setup_loopback() {
    echo "Configuring loopback via $VOX_LATENCY_PLAYBACK_DEVICE..." >&2

    # Set playback device to BlackHole
    local result
    result=$(vox_tau_send "DEVICE playback $VOX_LATENCY_PLAYBACK_DEVICE" 2>&1)
    if [[ "$result" == *"restart required"* ]]; then
        echo "Device change requires restart, restarting tau..." >&2
        vox_tau_daemon_restart
        sleep 0.5
        # Re-apply device settings after restart
        vox_tau_send "DEVICE playback $VOX_LATENCY_PLAYBACK_DEVICE" >/dev/null
    fi

    # Set capture device to BlackHole
    result=$(vox_tau_send "DEVICE capture $VOX_LATENCY_CAPTURE_DEVICE" 2>&1)
    if [[ "$result" == *"restart required"* ]]; then
        echo "Capture device change requires restart, restarting tau..." >&2
        vox_tau_daemon_restart
        sleep 0.5
        vox_tau_send "DEVICE playback $VOX_LATENCY_PLAYBACK_DEVICE" >/dev/null
        vox_tau_send "DEVICE capture $VOX_LATENCY_CAPTURE_DEVICE" >/dev/null
    fi

    echo "Loopback configured: playback → $VOX_LATENCY_PLAYBACK_DEVICE → capture" >&2
    return 0
}

# Restore default audio devices
vox_latency_restore_devices() {
    echo "Restoring default audio devices..." >&2
    # Set back to default (usually index 0 or speakers)
    vox_tau_send "DEVICE playback 0" >/dev/null 2>&1
    vox_tau_send "DEVICE capture 0" >/dev/null 2>&1
}

#==============================================================================
# LATENCY MEASUREMENT
#==============================================================================

# Measure pipeline latency with timestamps only (no audio detection)
# Returns: JSON with timing breakdown
vox_latency_measure_simple() {
    local test_file="${1:-}"
    local voice="${2:-shimmer}"

    local t_start t_gen_done t_load_done t_trig_done t_play_done

    # Start timing
    t_start=$(_vox_mono_ms)

    if [[ -z "$test_file" ]]; then
        # Generate test audio
        local temp_file=$(mktemp /tmp/vox_latency_XXXXXX.mp3)
        echo "Latency test" | vox_generate_tts "$voice" "$temp_file" 2>/dev/null
        test_file="$temp_file"
        t_gen_done=$(_vox_mono_ms)
    else
        t_gen_done=$t_start
    fi

    # Load into tau
    local slot=15  # Use slot 15 for latency tests
    vox_tau_send "SAMPLE $slot LOAD $test_file" >/dev/null
    t_load_done=$(_vox_mono_ms)

    # Trigger playback
    vox_tau_send "SAMPLE $slot TRIG" >/dev/null
    t_trig_done=$(_vox_mono_ms)

    # Estimate play duration (rough)
    sleep 0.5
    t_play_done=$(_vox_mono_ms)

    # Calculate deltas
    local gen_time=$((t_gen_done - t_start))
    local load_time=$((t_load_done - t_gen_done))
    local trig_time=$((t_trig_done - t_load_done))
    local total_time=$((t_trig_done - t_start))

    # Output results
    cat <<EOF
{
  "test": "simple",
  "voice": "$voice",
  "timings_ms": {
    "generation": $gen_time,
    "load": $load_time,
    "trigger": $trig_time,
    "total_to_trigger": $total_time
  },
  "note": "Does not measure actual audio output latency"
}
EOF

    # Cleanup temp file if we created it
    [[ -n "$temp_file" ]] && rm -f "$temp_file"
}

# Measure actual audio latency using loopback recording
# Returns: JSON with timing including audio onset
vox_latency_measure_loopback() {
    local test_file="${1:-}"
    local duration="${2:-2}"  # Recording duration in seconds

    mkdir -p "$VOX_LATENCY_RECORD_DIR"
    local record_file="$VOX_LATENCY_RECORD_DIR/latency_$(date +%s).wav"

    echo "Setting up loopback..." >&2
    vox_latency_setup_loopback || return 1

    local t_start t_record_start t_trig t_record_stop

    # Prepare test sound (use existing or generate tone)
    if [[ -z "$test_file" ]]; then
        # Generate a short test tone using tau voice
        test_file="$VOX_LATENCY_RECORD_DIR/test_tone.wav"
        # Create a simple click/beep by triggering voice briefly
        vox_tau_send "VOICE 8 FREQ 1000" >/dev/null
        vox_tau_send "VOICE 8 GAIN 0.5" >/dev/null
    fi

    # Start timing
    t_start=$(_vox_mono_ms)

    # Get monotonic timestamp for recording
    local t0_ns=$(_vox_mono_ns)

    # Start recording
    vox_tau_send "RECORD START $record_file $t0_ns" >/dev/null
    t_record_start=$(_vox_mono_ms)

    # Small delay to ensure recording is active
    sleep 0.1

    # Trigger test sound
    if [[ -f "$test_file" ]]; then
        vox_tau_send "SAMPLE 15 LOAD $test_file" >/dev/null
        vox_tau_send "SAMPLE 15 TRIG" >/dev/null
    else
        # Use synthesized tone
        vox_tau_send "VOICE 8 ON" >/dev/null
        sleep 0.05
        vox_tau_send "VOICE 8 OFF" >/dev/null
    fi
    t_trig=$(_vox_mono_ms)

    # Record for specified duration
    sleep "$duration"

    # Stop recording
    vox_tau_send "RECORD STOP" >/dev/null
    t_record_stop=$(_vox_mono_ms)

    # Restore audio devices
    vox_latency_restore_devices

    # Analyze recording for onset
    local onset_ms
    onset_ms=$(_vox_detect_onset "$record_file" 0.01)

    # Calculate timings
    local setup_time=$((t_record_start - t_start))
    local trig_delay=$((t_trig - t_record_start))
    local record_duration=$((t_record_stop - t_record_start))

    # Audio latency = time from trigger to detected onset
    # onset_ms is relative to recording start
    # trig_delay is time from recording start to trigger
    local audio_latency
    if [[ "$onset_ms" != "-1" ]]; then
        # onset_ms - (trig_delay in the recording timeline)
        # Since we triggered ~100ms after recording started
        audio_latency=$(echo "$onset_ms - 100" | bc)
    else
        audio_latency="-1"
    fi

    # Output results
    cat <<EOF
{
  "test": "loopback",
  "record_file": "$record_file",
  "timings_ms": {
    "setup": $setup_time,
    "trigger_delay": $trig_delay,
    "record_duration": $record_duration,
    "onset_in_recording": $onset_ms,
    "audio_latency": $audio_latency
  },
  "devices": {
    "playback": "$VOX_LATENCY_PLAYBACK_DEVICE",
    "capture": "$VOX_LATENCY_CAPTURE_DEVICE"
  }
}
EOF
}

# Quick latency test (just measure trigger latency)
vox_latency_quick() {
    local iterations="${1:-5}"

    echo "Quick latency test ($iterations iterations)..." >&2
    echo ""

    local total=0
    local results=()

    for i in $(seq 1 "$iterations"); do
        local t1=$(_vox_mono_ms)
        vox_tau_send "SAMPLE 15 TRIG" >/dev/null 2>&1
        local t2=$(_vox_mono_ms)
        local delta=$((t2 - t1))
        results+=("$delta")
        total=$((total + delta))
        echo "  Run $i: ${delta}ms" >&2
    done

    local avg=$((total / iterations))
    echo ""
    echo "Average trigger latency: ${avg}ms" >&2

    # Return as JSON
    printf '{"test":"quick","iterations":%d,"avg_ms":%d,"runs_ms":[%s]}\n' \
        "$iterations" "$avg" "$(IFS=,; echo "${results[*]}")"
}

#==============================================================================
# COMMAND INTERFACE
#==============================================================================

vox_latency_cmd() {
    local cmd="${1:-help}"
    shift || true

    case "$cmd" in
        quick)
            vox_latency_quick "$@"
            ;;
        simple)
            vox_latency_measure_simple "$@"
            ;;
        loopback)
            vox_latency_measure_loopback "$@"
            ;;
        setup)
            vox_latency_setup_loopback
            ;;
        restore)
            vox_latency_restore_devices
            ;;
        help|--help|-h)
            cat <<'EOF'
vox tau latency - Measure audio pipeline latency

TESTS:
  vox tau latency quick [N]       Quick socket round-trip (N iterations)
  vox tau latency simple [file]   Measure with timestamps only
  vox tau latency loopback [file] Full loopback test with audio detection

SETUP:
  vox tau latency setup           Configure BlackHole loopback
  vox tau latency restore         Restore default audio devices

REQUIREMENTS:
  - BlackHole 2ch installed (for loopback tests)
  - tau-engine running

WHAT IT MEASURES:
  quick:    Socket command round-trip time
  simple:   Generation → Load → Trigger timestamps
  loopback: Actual audio latency (trigger → sound detected)

ENVIRONMENT:
  VOX_LATENCY_CAPTURE_DEVICE   Capture device (default: BlackHole 2ch)
  VOX_LATENCY_PLAYBACK_DEVICE  Playback device (default: BlackHole 2ch)
EOF
            ;;
        *)
            echo "Unknown latency command: $cmd" >&2
            return 1
            ;;
    esac
}

#==============================================================================
# EXPORTS
#==============================================================================

export -f vox_latency_cmd vox_latency_quick
export -f vox_latency_measure_simple vox_latency_measure_loopback
export -f vox_latency_setup_loopback vox_latency_restore_devices
export -f _vox_mono_ns _vox_mono_ms _vox_detect_onset
