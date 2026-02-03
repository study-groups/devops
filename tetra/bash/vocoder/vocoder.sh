#!/usr/bin/env bash
# vocoder.sh - Audio Codec CLI
#
# Usage:
#   vocoder encode opus input.wav [output.opus]
#   vocoder encode c2 input.wav [output.c2] [1200|3200]
#   vocoder info input.wav
#   vocoder player
#   vocoder help

VOCODER_VERSION="${VOCODER_VERSION:-1.0.0}"

_vocoder_help() {
    cat <<'EOF'
vocoder - Audio Codec CLI

USAGE:
    vocoder <command> [arguments]

COMMANDS:
    encode opus <input.wav> [output.opus]         Encode to Opus (8kbps mono 16kHz)
    encode c2 <input.wav> [output.c2] [1200|3200] Encode to Codec2
    info <input.wav>                               Show duration + size table for all codecs
    player                                         Print path to browser player component
    version                                        Show version
    help                                           Show this help

EXAMPLES:
    vocoder encode opus recording.wav
    vocoder encode c2 recording.wav out.c2 1200
    vocoder info recording.wav
EOF
}

_vocoder_info() {
    local input="$1"

    if [[ ! -f "$input" ]]; then
        echo "vocoder info: file not found: $input" >&2
        return 1
    fi

    if ! command -v ffprobe &>/dev/null; then
        echo "vocoder info: ffprobe (ffmpeg) required" >&2
        return 1
    fi

    local duration
    duration=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$input" 2>/dev/null)
    duration="${duration%%[[:space:]]}"

    if [[ -z "$duration" || "$duration" == "N/A" ]]; then
        echo "vocoder info: could not determine duration" >&2
        return 1
    fi

    local wav_size
    wav_size=$(stat -f%z "$input" 2>/dev/null || stat -c%s "$input" 2>/dev/null)

    # Calculate estimated sizes
    local dur_f
    dur_f=$(printf '%.1f' "$duration")

    # wav/pcm: actual file size
    local wav_bps
    wav_bps=$(awk "BEGIN { printf \"%.0f\", $wav_size * 8 / $duration / 1000 }")

    # opus 8kbps
    local opus_bytes
    opus_bytes=$(awk "BEGIN { printf \"%.0f\", 8000 * $duration / 8 }")

    # c2 3200bps
    local c2_3200_bytes
    c2_3200_bytes=$(awk "BEGIN { printf \"%.0f\", 3200 * $duration / 8 }")

    # c2 1200bps
    local c2_1200_bytes
    c2_1200_bytes=$(awk "BEGIN { printf \"%.0f\", 1200 * $duration / 8 }")

    echo "Duration:  ${dur_f}s"
    printf "%-11s %-10s %-10s %s\n" "Codec" "Rate" "Size" "Ratio"
    printf "%-11s %-10s %-10s %s\n" \
        "wav/pcm" "${wav_bps} kbps" "$(_vocoder_fmt_size "$wav_size")" "1.0x"
    printf "%-11s %-10s %-10s %s\n" \
        "opus/8k" "8 kbps" "$(_vocoder_fmt_size "$opus_bytes")" \
        "$(awk "BEGIN { printf \"%.0fx\", $wav_size / $opus_bytes }")"
    printf "%-11s %-10s %-10s %s\n" \
        "c2/3200" "3.2 kbps" "$(_vocoder_fmt_size "$c2_3200_bytes")" \
        "$(awk "BEGIN { printf \"%.0fx\", $wav_size / $c2_3200_bytes }")"
    printf "%-11s %-10s %-10s %s\n" \
        "c2/1200" "1.2 kbps" "$(_vocoder_fmt_size "$c2_1200_bytes")" \
        "$(awk "BEGIN { printf \"%.0fx\", $wav_size / $c2_1200_bytes }")"
}

_vocoder_fmt_size() {
    local bytes="$1"
    if (( bytes < 1024 )); then
        echo "${bytes} B"
    elif (( bytes < 1048576 )); then
        awk "BEGIN { printf \"%.1f KB\", $bytes / 1024 }"
    else
        awk "BEGIN { printf \"%.1f MB\", $bytes / 1048576 }"
    fi
}

vocoder() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        encode)
            vocoder_encode "$@"
            ;;
        info)
            _vocoder_info "$@"
            ;;
        player)
            echo "$VOCODER_SRC/js/vocoder-player.js"
            ;;
        version)
            echo "vocoder $VOCODER_VERSION"
            ;;
        help|--help|-h)
            _vocoder_help
            ;;
        *)
            echo "vocoder: unknown command '$cmd'" >&2
            _vocoder_help >&2
            return 1
            ;;
    esac
}
