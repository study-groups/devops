#!/usr/bin/env bash
# udp_sender.sh - UDP sender for formant → multivox communication
# Non-blocking UDP datagrams to multivox server

MULTIVOX_HOST="${MULTIVOX_HOST:-localhost}"
MULTIVOX_PORT="${MULTIVOX_PORT:-1983}"  # UDP port (WS is on 1982)
MULTIVOX_ENABLED="${MULTIVOX_ENABLED:-0}"

# IPA phoneme to formant mapping
# Format: "f1:f2:f3:bw1:bw2:bw3:noise"
declare -gA FORMANT_FORMANT_TABLE=(
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

# Enable/disable multivox sending
multivox_enable() {
    MULTIVOX_ENABLED=1
    echo "Multivox enabled (${MULTIVOX_HOST}:${MULTIVOX_PORT})"
}

multivox_disable() {
    MULTIVOX_ENABLED=0
    echo "Multivox disabled"
}

multivox_is_enabled() {
    [[ "$MULTIVOX_ENABLED" == "1" ]]
}

# Non-blocking UDP send
# Usage: multivox_send '{"t":"fm","f1":800}'
multivox_send() {
    [[ "$MULTIVOX_ENABLED" != "1" ]] && return 0
    local msg="$1"
    # Fire and forget with nc
    echo "$msg" | nc -u -w0 "$MULTIVOX_HOST" "$MULTIVOX_PORT" 2>/dev/null &
}

# Get formant JSON for an IPA phoneme
# Usage: formant_get_formants "a"
# Returns: "f1":800,"f2":1200,"f3":2500,"bw1":60,"bw2":120,"bw3":180,"noise":0
formant_get_formants() {
    local ipa="$1"
    local data="${FORMANT_FORMANT_TABLE[$ipa]}"

    # Default to neutral if unknown
    [[ -z "$data" ]] && data="${FORMANT_FORMANT_TABLE[neutral]}"

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
    formants=$(formant_get_formants "$ipa")

    local msg="{\"t\":\"fm\",$formants,\"f0\":$f0,\"dur\":$dur,\"bits\":$bits}"
    multivox_send "$msg"
}

# Send facial state (for visualization)
# Usage: multivox_send_state
multivox_send_state() {
    [[ "$MULTIVOX_ENABLED" != "1" ]] && return 0

    # Read from formant state variables (if available)
    local jaw="${FORMANT_JAW_OPENNESS:-0.5}"
    local lips="${FORMANT_LIP_ROUNDING:-0.5}"
    local tongue_h="${FORMANT_TONGUE_HEIGHT:-0.5}"

    local msg="{\"t\":\"st\",\"jaw\":$jaw,\"lips\":$lips,\"tongue_h\":$tongue_h}"
    multivox_send "$msg"
}

# Send raw test message
multivox_test() {
    local old_enabled="$MULTIVOX_ENABLED"
    MULTIVOX_ENABLED=1

    echo "Sending test to ${MULTIVOX_HOST}:${MULTIVOX_PORT}..."
    multivox_send '{"t":"test","msg":"hello from formant"}'

    echo "Sending vowel 'a'..."
    multivox_send_formants "a" 200 120 8

    MULTIVOX_ENABLED="$old_enabled"
    echo "Done!"
}

# Print formant table
multivox_list_phonemes() {
    echo "IPA Phoneme to Formant Mapping:"
    echo "================================"
    printf "%-8s %-6s %-6s %-6s %-5s\n" "IPA" "F1" "F2" "F3" "Noise"
    echo "--------------------------------"
    for ipa in "${!FORMANT_FORMANT_TABLE[@]}"; do
        IFS=':' read -r f1 f2 f3 bw1 bw2 bw3 noise <<< "${FORMANT_FORMANT_TABLE[$ipa]}"
        printf "%-8s %-6s %-6s %-6s %-5s\n" "$ipa" "$f1" "$f2" "$f3" "$noise"
    done | sort
}
