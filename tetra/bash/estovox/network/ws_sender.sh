#!/usr/bin/env bash
# ws_sender.sh - WebSocket sender for estovox → multivox communication
# Uses websocat for WebSocket transport (brew install websocat)

MULTIVOX_URL="${MULTIVOX_URL:-ws://localhost:1982}"
MULTIVOX_ENABLED="${MULTIVOX_ENABLED:-0}"

# IPA phoneme to formant mapping
# Format: "f1:f2:f3:bw1:bw2:bw3:noise"
declare -gA ESTOVOX_FORMANT_TABLE=(
    # Vowels
    ["i"]="300:2300:3000:50:100:150:0"
    ["e"]="400:2000:2800:50:100:150:0"
    ["a"]="800:1200:2500:60:120:180:0"
    ["o"]="500:900:2500:50:100:150:0"
    ["u"]="350:700:2300:50:100:150:0"
    ["ə"]="500:1500:2500:50:100:150:0"

    # Nasals
    ["m"]="300:1000:2500:80:150:200:0"
    ["n"]="300:1700:2500:80:150:200:0"

    # Plosives
    ["p"]="200:800:2500:100:200:300:0.1"
    ["b"]="200:800:2500:100:200:300:0.05"
    ["t"]="200:1700:2500:100:200:300:0.1"
    ["d"]="200:1700:2500:100:200:300:0.05"
    ["k"]="200:1800:2500:100:200:300:0.1"
    ["g"]="200:1800:2500:100:200:300:0.05"

    # Fricatives
    ["s"]="200:1800:2500:200:300:400:0.9"
    ["z"]="200:1800:2500:200:300:400:0.8"
    ["f"]="200:1400:3000:150:250:350:0.8"
    ["v"]="200:1400:3000:150:250:350:0.7"
    ["sh"]="200:1700:2300:200:300:400:0.85"
    ["h"]="500:1500:2500:200:300:400:0.8"

    # Approximants
    ["w"]="300:700:2300:50:100:150:0"
    ["j"]="300:2300:3000:50:100:150:0"
    ["y"]="300:2300:3000:50:100:150:0"
    ["l"]="400:1200:2800:60:120:180:0"
    ["r"]="350:1400:1600:60:120:180:0"

    # Special
    ["rest"]="500:1500:2500:50:100:150:0"
    ["neutral"]="500:1500:2500:50:100:150:0"
)

# Check for websocat
multivox_check() {
    if ! command -v websocat &>/dev/null; then
        echo "Error: websocat not found. Install with: brew install websocat" >&2
        return 1
    fi
    return 0
}

# Enable/disable multivox sending
multivox_enable() {
    multivox_check || return 1
    MULTIVOX_ENABLED=1
    echo "Multivox enabled (${MULTIVOX_URL})"
}

multivox_disable() {
    MULTIVOX_ENABLED=0
    echo "Multivox disabled"
}

multivox_is_enabled() {
    [[ "$MULTIVOX_ENABLED" == "1" ]]
}

# Send message via WebSocket (non-blocking)
# Usage: multivox_send '{"t":"fm","f1":800}'
multivox_send() {
    [[ "$MULTIVOX_ENABLED" != "1" ]] && return 0
    local msg="$1"
    # websocat -n: don't wait for response, -1: one message then exit
    echo "$msg" | websocat -n1 "$MULTIVOX_URL" 2>/dev/null &
}

# Get formant JSON for an IPA phoneme
# Usage: estovox_get_formants "a"
estovox_get_formants() {
    local ipa="$1"
    local data="${ESTOVOX_FORMANT_TABLE[$ipa]}"

    # Default to neutral if unknown
    [[ -z "$data" ]] && data="${ESTOVOX_FORMANT_TABLE[neutral]}"

    # Parse f1:f2:f3:bw1:bw2:bw3:noise
    IFS=':' read -r f1 f2 f3 bw1 bw2 bw3 noise <<< "$data"

    echo "\"f1\":$f1,\"f2\":$f2,\"f3\":$f3,\"bw1\":$bw1,\"bw2\":$bw2,\"bw3\":$bw3,\"noise\":$noise"
}

# Send formant parameters for a phoneme
# Usage: multivox_send_formants "a" [duration_ms] [f0] [bits]
multivox_send_formants() {
    [[ "$MULTIVOX_ENABLED" != "1" ]] && return 0

    local ipa="$1"
    local dur="${2:-150}"
    local f0="${3:-120}"
    local bits="${4:-8}"

    local formants
    formants=$(estovox_get_formants "$ipa")

    local msg="{\"t\":\"fm\",$formants,\"f0\":$f0,\"dur\":$dur,\"bits\":$bits}"
    multivox_send "$msg"
}

# Send facial state (for visualization)
multivox_send_state() {
    [[ "$MULTIVOX_ENABLED" != "1" ]] && return 0

    local jaw="${ESTOVOX_JAW_OPENNESS:-0.5}"
    local lips="${ESTOVOX_LIP_ROUNDING:-0.5}"
    local tongue_h="${ESTOVOX_TONGUE_HEIGHT:-0.5}"

    local msg="{\"t\":\"st\",\"jaw\":$jaw,\"lips\":$lips,\"tongue_h\":$tongue_h}"
    multivox_send "$msg"
}

# Send a sequence of phonemes
# Usage: multivox_say "a" "e" "i" "o" "u"
# Or:    multivox_say a e i o u
multivox_say() {
    [[ "$MULTIVOX_ENABLED" != "1" ]] && return 0

    for phoneme in "$@"; do
        multivox_send_formants "$phoneme" 200
        sleep 0.25
    done
}

# Test connection
multivox_test() {
    local old_enabled="$MULTIVOX_ENABLED"
    MULTIVOX_ENABLED=1

    echo "Testing connection to ${MULTIVOX_URL}..."

    if ! multivox_check; then
        return 1
    fi

    echo "Sending test message..."
    echo '{"t":"test","msg":"hello from estovox"}' | websocat -n1 "$MULTIVOX_URL" 2>/dev/null

    if [[ $? -eq 0 ]]; then
        echo "Connection OK!"
        echo "Sending vowel sequence: a e i o u"
        for v in a e i o u; do
            echo "  $v"
            multivox_send_formants "$v" 300 120 8
            sleep 0.35
        done
        echo "Done!"
    else
        echo "Connection failed. Is multivox running?"
        echo "  Start with: cd tetra/bash/multivox && ./multivox.sh start"
    fi

    MULTIVOX_ENABLED="$old_enabled"
}

# Print formant table
multivox_list_phonemes() {
    echo "IPA Phoneme to Formant Mapping:"
    echo "================================"
    printf "%-8s %-6s %-6s %-6s %-5s\n" "IPA" "F1" "F2" "F3" "Noise"
    echo "--------------------------------"
    for ipa in "${!ESTOVOX_FORMANT_TABLE[@]}"; do
        IFS=':' read -r f1 f2 f3 bw1 bw2 bw3 noise <<< "${ESTOVOX_FORMANT_TABLE[$ipa]}"
        printf "%-8s %-6s %-6s %-6s %-5s\n" "$ipa" "$f1" "$f2" "$f3" "$noise"
    done | sort
}

# Help
multivox_help() {
    cat <<EOF
Estovox → Multivox WebSocket Sender

Commands:
  multivox_enable           Enable sending (checks for websocat)
  multivox_disable          Disable sending
  multivox_test             Test connection and play vowels
  multivox_send <json>      Send raw JSON message
  multivox_send_formants <ipa> [dur] [f0] [bits]
                            Send phoneme formants
  multivox_say <p1> <p2>... Send sequence of phonemes
  multivox_list_phonemes    Show IPA → formant table

Examples:
  multivox_enable
  multivox_send_formants "a" 200 120 8
  multivox_say a e i o u
  multivox_send '{"t":"fm","f1":800,"f2":1200,"f3":2500}'

Environment:
  MULTIVOX_URL    WebSocket URL (default: ws://localhost:1982)
EOF
}
