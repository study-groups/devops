#!/usr/bin/env bash

# vox_analyze.sh - Audio analysis using tau filter bank
# Discriminator for GAN-style TTS parameter tuning
#
# Uses tau's tscale for onset detection and a matched filter bank
# to extract F0, formants, and timing from TTS output.

: "${TAU_SRC:=$HOME/src/tau}"
: "${VOX_SRC:=$TETRA_SRC/bash/vox}"

# Filter bank center frequencies (Hz)
# Fundamental detection: 80-400Hz in 4 bands
# Formants: F1 (300-900), F2 (900-2500), F3 (2000-3500)
declare -a VOX_FB_FUNDAMENTAL=(100 150 200 300)
declare -a VOX_FB_FORMANTS=(500 1200 2800)

# Analyze audio file - whole sample first pass
# Returns: JSON with f0_estimate, formant_energies, onset_times, total_energy
vox_analyze() {
    local audio_file="$1"
    local output_file="${2:-}"

    if [[ ! -f "$audio_file" ]]; then
        echo "Error: Audio file not found: $audio_file" >&2
        return 1
    fi

    # Check for tau tscale binary
    local tscale_bin="$TAU_SRC/tau_lib/algorithms/tscale/tscale"
    if [[ ! -x "$tscale_bin" ]]; then
        echo "Error: tscale not built. Run: cd $TAU_SRC/tau_lib/algorithms/tscale && make" >&2
        return 1
    fi

    # Filterbank binary for matched filter analysis
    local fb_bin="$TAU_SRC/tau_lib/algorithms/filterbank/filterbank"

    # Build filterbank if needed
    if [[ ! -x "$fb_bin" ]]; then
        local fb_src="$TAU_SRC/tau_lib/algorithms/filterbank/filterbank.c"
        if [[ -f "$fb_src" ]]; then
            echo "Building filterbank..." >&2
            clang -std=c11 -O3 -o "$fb_bin" "$fb_src" -lm 2>/dev/null
        fi
    fi

    local tmp_dir=$(mktemp -d)
    local onset_tsv="$tmp_dir/onsets.tsv"
    local fb_tsv="$tmp_dir/filterbank.tsv"

    # 1. Run tscale for onset detection (phoneme boundaries)
    echo "Detecting onsets..." >&2
    "$tscale_bin" -i "$audio_file" -o "$onset_tsv" \
        -ta 0.002 -tr 0.010 -th 2.5 -ref 0.030 -sym 2>/dev/null

    if [[ ! -f "$onset_tsv" ]]; then
        echo "Error: tscale failed" >&2
        rm -rf "$tmp_dir"
        return 1
    fi

    # 2. Extract onset times (where evt=1)
    local onset_times=$(awk -F'\t' 'NR>1 && $4==1 {printf "%.4f ", $1}' "$onset_tsv")
    local onset_count=$(echo "$onset_times" | wc -w | tr -d ' ')

    # 3. Run filter bank analysis (if available) or use tscale approximation
    local f0_estimate="0"
    local f1_energy="0"
    local f2_energy="0"
    local f3_energy="0"
    local total_energy="0"

    if [[ -x "$fb_bin" ]]; then
        # Use dedicated filterbank tool
        echo "Running filter bank analysis..." >&2
        "$fb_bin" -i "$audio_file" -o "$fb_tsv" 2>/dev/null

        if [[ -f "$fb_tsv" ]]; then
            # Extract band energies and compute F0 via weighted centroid
            # Bands: b80(80Hz), b120(120Hz), b180(180Hz), b270(270Hz), f1(500Hz), f2(1500Hz), f3(2500Hz)
            eval $(awk -F'\t' '
                BEGIN {
                    # Center frequencies for each band
                    freq[1]=80; freq[2]=120; freq[3]=180; freq[4]=270
                }
                NR>1 {
                    # Accumulate energies (columns 2-5 are fundamental bands, 6-8 are formants)
                    for(i=1; i<=4; i++) { fund[i]+=$(i+1) }
                    f1_sum+=$6; f2_sum+=$7; f3_sum+=$8
                    total_sum+=$9
                    n++
                }
                END {
                    if(n>0) {
                        # Mean energies
                        for(i=1; i<=4; i++) { fund[i]/=n }
                        f1_e=f1_sum/n; f2_e=f2_sum/n; f3_e=f3_sum/n
                        total_e=total_sum/n

                        # F0 estimation via energy-weighted centroid of fundamental bands
                        # This gives center of mass of spectral energy
                        num=0; denom=0
                        for(i=1; i<=4; i++) {
                            num += freq[i] * fund[i]
                            denom += fund[i]
                        }
                        f0_est = (denom > 1e-10) ? num/denom : 150

                        # Also compute spectral tilt (ratio of high to low bands)
                        low_e = fund[1] + fund[2]
                        high_e = fund[3] + fund[4]
                        tilt = (low_e > 1e-10) ? high_e/low_e : 1.0

                        printf "f0_estimate=%.2f ", f0_est
                        printf "f1_energy=%.9f f2_energy=%.9f f3_energy=%.9f ", f1_e, f2_e, f3_e
                        printf "total_energy=%.9f ", total_e
                        printf "spectral_tilt=%.4f ", tilt
                        printf "b80=%.9f b120=%.9f b180=%.9f b270=%.9f", fund[1], fund[2], fund[3], fund[4]
                    }
                }
            ' "$fb_tsv")
        fi
    else
        # Fallback: use tscale envelope energy as proxy
        # Run multiple tscale passes with different tau values to approximate bands
        echo "Using tscale approximation (filterbank not built)..." >&2

        # Fast tau = high freq content, slow tau = low freq content
        local env_fast="$tmp_dir/env_fast.tsv"
        local env_slow="$tmp_dir/env_slow.tsv"

        "$tscale_bin" -i "$audio_file" -o "$env_fast" -ta 0.0005 -tr 0.002 -th 100 -sym 2>/dev/null
        "$tscale_bin" -i "$audio_file" -o "$env_slow" -ta 0.005 -tr 0.020 -th 100 -sym 2>/dev/null

        # Extract mean envelope energy
        local fast_energy=$(awk -F'\t' 'NR>1 {s+=$3; n++} END {print (n>0)?s/n:0}' "$env_fast")
        local slow_energy=$(awk -F'\t' 'NR>1 {s+=$3; n++} END {print (n>0)?s/n:0}' "$env_slow")

        # Ratio indicates spectral tilt
        total_energy=$(echo "scale=6; $fast_energy + $slow_energy" | bc)

        # Rough F0 estimate from spectral balance
        if (( $(echo "$slow_energy > 0.0001" | bc -l) )); then
            local ratio=$(echo "scale=4; $fast_energy / $slow_energy" | bc)
            # Higher ratio = more high freq = higher F0
            f0_estimate=$(echo "scale=2; 100 + ($ratio * 50)" | bc)
        else
            f0_estimate="150"  # default
        fi

        f1_energy="$slow_energy"
        f2_energy="$fast_energy"
        f3_energy="0"
    fi

    # 4. Calculate duration
    local duration=$(awk -F'\t' 'END {print $1}' "$onset_tsv")

    # 5. Output JSON
    local spectral_tilt="${spectral_tilt:-1.0}"
    local b80="${b80:-0}"
    local b120="${b120:-0}"
    local b180="${b180:-0}"
    local b270="${b270:-0}"

    local result=$(cat <<EOF
{
  "file": "$audio_file",
  "duration_sec": $duration,
  "analysis": {
    "f0_estimate_hz": $f0_estimate,
    "spectral_tilt": $spectral_tilt,
    "fundamental_bands": {
      "b80": $b80,
      "b120": $b120,
      "b180": $b180,
      "b270": $b270
    },
    "formants": {
      "f1_energy": $f1_energy,
      "f2_energy": $f2_energy,
      "f3_energy": $f3_energy
    },
    "total_energy": $total_energy,
    "onsets": {
      "count": $onset_count,
      "times": [$( echo "$onset_times" | sed 's/ /, /g; s/, $//' )]
    }
  }
}
EOF
)

    # Cleanup
    rm -rf "$tmp_dir"

    if [[ -n "$output_file" ]]; then
        echo "$result" > "$output_file"
        echo "Analysis saved to: $output_file" >&2
    else
        echo "$result"
    fi
}

# Compare TTS output against expected phoneme features
# Input: analysis JSON, phoneme sequence
# Output: error metrics for GAN feedback
vox_compare() {
    local analysis_json="$1"
    local expected_phonemes="$2"

    # Load expected formants from estovox phoneme table
    # This will be the "target" for the discriminator

    echo "Comparison not yet implemented" >&2
    echo "Expected phonemes: $expected_phonemes" >&2
    return 1
}

# Batch analyze for parameter sweep
vox_analyze_batch() {
    local pattern="$1"
    local output_dir="${2:-.}"

    for f in $pattern; do
        [[ -f "$f" ]] || continue
        local base=$(basename "$f" .mp3)
        echo "Analyzing: $f" >&2
        vox_analyze "$f" "$output_dir/${base}.analysis.json"
    done
}

# Quick summary of analysis
vox_analyze_summary() {
    local audio_file="$1"
    local result=$(vox_analyze "$audio_file")

    echo "$result" | jq -r '
        "File: \(.file)",
        "Duration: \(.duration_sec)s",
        "F0 estimate: \(.analysis.f0_estimate_hz) Hz",
        "Onsets: \(.analysis.onsets.count)",
        "Energy: \(.analysis.total_energy)"
    '
}

# RMS envelope via tscale - downsample to ~50 fps
# Output: JSON with windowMs, hopMs, values[]
vox_rms() {
    local audio_file="$1"
    local hop_ms="${2:-20}"

    if [[ ! -f "$audio_file" ]]; then
        echo "Error: Audio file not found: $audio_file" >&2
        return 1
    fi

    local tscale_bin="$TAU_SRC/tau_lib/algorithms/tscale/tscale"
    if [[ ! -x "$tscale_bin" ]]; then
        echo "Error: tscale not built" >&2
        return 1
    fi

    local tmp_dir=$(mktemp -d)
    local env_tsv="$tmp_dir/env.tsv"
    local tau_sec
    tau_sec=$(echo "scale=6; $hop_ms / 1000" | bc)

    # Run tscale with moderate tau for envelope extraction
    # -th 100 effectively disables onset detection, giving us raw envelope
    "$tscale_bin" -i "$audio_file" -o "$env_tsv" \
        -ta "$tau_sec" -tr "$(echo "scale=6; $tau_sec * 2" | bc)" \
        -th 100 -sym 2>/dev/null

    if [[ ! -f "$env_tsv" ]]; then
        echo "Error: tscale failed" >&2
        rm -rf "$tmp_dir"
        return 1
    fi

    # Downsample envelope to hop_ms intervals, output JSON
    awk -F'\t' -v hop="$hop_ms" '
        BEGIN { printf "{\"windowMs\":%s,\"hopMs\":%s,\"values\":[", hop, hop; first=1 }
        NR > 1 {
            t = $1; env = $3
            target = count * (hop / 1000.0)
            if (t >= target) {
                if (!first) printf ","
                printf "%.6f", env
                first = 0
                count++
            }
        }
        END { print "]}" }
    ' "$env_tsv"

    rm -rf "$tmp_dir"
}

# VAD from RMS envelope - threshold + hangover
# Output: JSON with threshold, hangoverMs, segments[]
vox_vad() {
    local audio_file="$1"
    local threshold_db="${2:--40}"
    local hangover_ms="${3:-300}"

    local rms_json
    rms_json=$(vox_rms "$audio_file" 20)
    if [[ $? -ne 0 ]]; then return 1; fi

    echo "$rms_json" | awk -v thr_db="$threshold_db" -v hang_ms="$hangover_ms" '
    BEGIN { hop_sec = 0.020 }
    {
        # Parse values array from the JSON
        gsub(/.*"values":\[/, "")
        gsub(/\].*/, "")
        n = split($0, vals, ",")

        # Find peak
        peak = 0
        for (i = 1; i <= n; i++) {
            v = vals[i] + 0
            if (v > peak) peak = v
        }

        # Threshold: thr_db relative to peak
        # dB to linear: 10^(dB/20)
        thr_lin = peak * exp(thr_db / 20 * log(10))
        if (thr_lin < 1e-8) thr_lin = 1e-8

        hangover_frames = int(hang_ms / 1000.0 / hop_sec)

        # Detect speech frames with hangover
        seg_start = -1
        hang_count = 0
        seg_json = ""
        seg_n = 0

        for (i = 1; i <= n; i++) {
            v = vals[i] + 0
            t = (i - 1) * hop_sec
            if (v >= thr_lin) {
                if (seg_start < 0) seg_start = t
                hang_count = hangover_frames
            } else {
                if (hang_count > 0) {
                    hang_count--
                } else if (seg_start >= 0) {
                    if (seg_n > 0) seg_json = seg_json ","
                    seg_json = seg_json sprintf("{\"start\":%.3f,\"end\":%.3f}", seg_start, t)
                    seg_n++
                    seg_start = -1
                }
            }
        }
        # Close last segment
        if (seg_start >= 0) {
            if (seg_n > 0) seg_json = seg_json ","
            seg_json = seg_json sprintf("{\"start\":%.3f,\"end\":%.3f}", seg_start, (n - 1) * hop_sec)
            seg_n++
        }

        printf "{\"threshold\":%.8f,\"hangoverMs\":%d,\"segments\":[%s]}\n", thr_lin, hang_ms, seg_json
    }'
}

# Full analysis: onsets + rms + vad in one pass
# Writes {id}.vox.onsets.json, {id}.vox.rms.json, {id}.vox.vad.json
vox_analyze_full() {
    local audio_file="$1"
    local output_dir="${2:-$(dirname "$audio_file")}"

    if [[ ! -f "$audio_file" ]]; then
        echo "Error: Audio file not found: $audio_file" >&2
        return 1
    fi

    # Derive id from filename: {id}.vox.audio.*
    local base
    base=$(basename "$audio_file")
    local id="${base%%.*}"

    local onsets_file="$output_dir/${id}.vox.onsets.json"
    local rms_file="$output_dir/${id}.vox.rms.json"
    local vad_file="$output_dir/${id}.vox.vad.json"

    echo "Running full analysis for $id..." >&2

    # 1. Onsets (existing analysis, extract just onset times)
    local full_result
    full_result=$(vox_analyze "$audio_file")
    if [[ $? -eq 0 ]]; then
        echo "$full_result" | jq '.analysis.onsets.times' > "$onsets_file" 2>/dev/null || echo "[]" > "$onsets_file"
        echo "  onsets -> $onsets_file" >&2
    else
        echo "[]" > "$onsets_file"
        echo "  onsets failed, wrote empty" >&2
    fi

    # 2. RMS envelope
    local rms_result
    rms_result=$(vox_rms "$audio_file")
    if [[ $? -eq 0 ]]; then
        echo "$rms_result" > "$rms_file"
        echo "  rms -> $rms_file" >&2
    else
        echo '{"windowMs":20,"hopMs":20,"values":[]}' > "$rms_file"
        echo "  rms failed, wrote empty" >&2
    fi

    # 3. VAD
    local vad_result
    vad_result=$(vox_vad "$audio_file")
    if [[ $? -eq 0 ]]; then
        echo "$vad_result" > "$vad_file"
        echo "  vad -> $vad_file" >&2
    else
        echo '{"threshold":0,"hangoverMs":300,"segments":[]}' > "$vad_file"
        echo "  vad failed, wrote empty" >&2
    fi

    # Summary JSON to stdout
    local rms_mean rms_peak vad_count
    rms_mean=$(jq '[.values[]] | add / length // 0' "$rms_file" 2>/dev/null || echo 0)
    rms_peak=$(jq '[.values[]] | max // 0' "$rms_file" 2>/dev/null || echo 0)
    vad_count=$(jq '.segments | length' "$vad_file" 2>/dev/null || echo 0)
    local onset_count
    onset_count=$(jq 'length' "$onsets_file" 2>/dev/null || echo 0)

    cat <<EOF
{
  "ok": true,
  "id": "$id",
  "onsets": $onset_count,
  "rms": {"mean": $rms_mean, "peak": $rms_peak},
  "vad": {"segments": $vad_count}
}
EOF
}

# Export functions
export -f vox_analyze vox_compare vox_analyze_batch vox_analyze_summary vox_rms vox_vad vox_analyze_full
