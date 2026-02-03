#!/usr/bin/env bash
# vocoder_encode.sh - Audio encoding functions
#
# wav→opus, wav→c2 (Codec2)

vocoder_encode_opus() {
    local input="$1"
    local output="${2:-${input%.wav}.opus}"

    if [[ ! -f "$input" ]]; then
        echo "vocoder encode opus: file not found: $input" >&2
        return 1
    fi

    if ! command -v ffmpeg &>/dev/null; then
        echo "vocoder encode opus: ffmpeg required" >&2
        return 1
    fi

    ffmpeg -y -i "$input" \
        -ac 1 -ar 16000 \
        -c:a libopus -b:a 8k -application voip \
        "$output" 2>/dev/null

    if [[ $? -eq 0 && -f "$output" ]]; then
        echo "$output"
    else
        echo "vocoder encode opus: encoding failed" >&2
        return 1
    fi
}

vocoder_encode_c2() {
    local input="$1"
    local output="${2:-${input%.wav}.c2}"
    local mode="${3:-3200}"

    if [[ ! -f "$input" ]]; then
        echo "vocoder encode c2: file not found: $input" >&2
        return 1
    fi

    if ! command -v c2enc &>/dev/null; then
        echo "vocoder encode c2: c2enc (Codec2) not found" >&2
        echo "  Install: brew install codec2  or  apt install codec2" >&2
        return 1
    fi

    if ! command -v ffmpeg &>/dev/null; then
        echo "vocoder encode c2: ffmpeg required for resampling" >&2
        return 1
    fi

    # Validate mode
    case "$mode" in
        1200|3200) ;;
        *)
            echo "vocoder encode c2: invalid mode '$mode' (use 1200 or 3200)" >&2
            return 1
            ;;
    esac

    # Resample to 8kHz 16-bit signed LE mono, then encode
    local raw_tmp
    raw_tmp=$(mktemp /tmp/vocoder.XXXXXX.raw)

    ffmpeg -y -i "$input" -ac 1 -ar 8000 -f s16le "$raw_tmp" 2>/dev/null
    if [[ $? -ne 0 ]]; then
        rm -f "$raw_tmp"
        echo "vocoder encode c2: resampling failed" >&2
        return 1
    fi

    c2enc "$mode" "$raw_tmp" "$output" 2>/dev/null
    local rc=$?
    rm -f "$raw_tmp"

    if [[ $rc -eq 0 && -f "$output" ]]; then
        echo "$output"
    else
        echo "vocoder encode c2: encoding failed" >&2
        return 1
    fi
}

vocoder_encode() {
    local codec="$1"
    shift
    case "$codec" in
        opus) vocoder_encode_opus "$@" ;;
        c2)   vocoder_encode_c2 "$@" ;;
        *)
            echo "vocoder encode: unknown codec '$codec' (use opus or c2)" >&2
            return 1
            ;;
    esac
}
