#!/usr/bin/env bash
# Tetra Game Protocol (TGP) v1.0
# Bash Implementation

# TGP Message Types
declare -g TGP_CMD_INIT=0x01
declare -g TGP_CMD_SPAWN=0x02
declare -g TGP_CMD_SET=0x03
declare -g TGP_CMD_KILL=0x04
declare -g TGP_CMD_QUERY=0x05
declare -g TGP_CMD_RUN=0x06
declare -g TGP_CMD_STOP=0x07
declare -g TGP_CMD_QUIT=0x09

declare -g TGP_RESP_OK=0x10
declare -g TGP_RESP_ERROR=0x11
declare -g TGP_RESP_ID=0x12
declare -g TGP_RESP_VALUE=0x13

declare -g TGP_FRAME_FULL=0x20
declare -g TGP_EVENT_LOG=0x35

# TGP Session State
declare -g TGP_SESSION=""
declare -g TGP_CMD_SOCK=""
declare -g TGP_RESP_SOCK=""
declare -g TGP_FRAME_SOCK=""
declare -g TGP_EVENT_SOCK=""
declare -g TGP_SEQ=0

# ============================================================================
# INITIALIZATION
# ============================================================================

# Initialize TGP client
# Usage: tgp_init <session_name>
tgp_init() {
    local session="$1"

    TGP_SESSION="$session"
    TGP_CMD_SOCK="/tmp/tgp_${session}_cmd.sock"
    TGP_RESP_SOCK="/tmp/tgp_${session}_resp.sock"
    TGP_FRAME_SOCK="/tmp/tgp_${session}_frame.sock"
    TGP_EVENT_SOCK="/tmp/tgp_${session}_event.sock"
    TGP_SEQ=0

    # Wait for sockets to exist (engine must be started first)
    local timeout=5
    local elapsed=0
    while [[ ! -S "$TGP_CMD_SOCK" ]] && [[ $elapsed -lt $timeout ]]; do
        sleep 0.1
        ((elapsed++))
    done

    if [[ ! -S "$TGP_CMD_SOCK" ]]; then
        echo "ERROR: TGP session '$session' not found" >&2
        return 1
    fi

    return 0
}

# Cleanup TGP client
tgp_cleanup() {
    TGP_SESSION=""
    TGP_CMD_SOCK=""
    TGP_RESP_SOCK=""
    TGP_FRAME_SOCK=""
    TGP_EVENT_SOCK=""
}

# ============================================================================
# MESSAGE BUILDING
# ============================================================================

# Build TGP header
# Usage: tgp_build_header <type> <flags> <payload_len>
# Output: 8-byte header (hex string)
tgp_build_header() {
    local type=$1
    local flags=${2:-0}
    local payload_len=$3

    # Header: type(1) flags(1) seq(2) len(4)
    printf "%02x%02x%04x%08x" "$type" "$flags" "$TGP_SEQ" "$payload_len"

    ((TGP_SEQ++))
}

# Convert hex string to binary
# Usage: hex_to_bin <hex_string>
hex_to_bin() {
    echo -n "$1" | xxd -r -p
}

# Convert binary to hex
# Usage: bin_to_hex
bin_to_hex() {
    xxd -p | tr -d '\n'
}

# ============================================================================
# CLIENT API - COMMANDS
# ============================================================================

# Send INIT command
# Usage: tgp_send_init <cols> <rows> <fps>
tgp_send_init() {
    local cols=$1
    local rows=$2
    local fps=${3:-60}

    # Payload: cols(2) rows(2) fps(1) flags(1) = 6 bytes
    local payload=$(printf "%04x%04x%02x%02x" "$cols" "$rows" "$fps" 0)
    local header=$(tgp_build_header $TGP_CMD_INIT 0 6)

    echo -n "${header}${payload}" | hex_to_bin | nc -U "$TGP_CMD_SOCK"
}

# Send SPAWN command
# Usage: tgp_send_spawn <type> <valence> <x> <y> <p1> <p2> <fp1> <fp2>
tgp_send_spawn() {
    local ent_type=$1
    local valence=$2
    local x=$3
    local y=$4
    local p1=$5
    local p2=$6
    local fp1=$7
    local fp2=$8

    # Build payload (36 bytes)
    # type(1) valence(1) reserved(2) x(4) y(4) p1(4) p2(4) fp1(4) fp2(4)
    local payload=$(printf "%02x%02x%04x" "$ent_type" "$valence" 0)
    payload+=$(printf "%08x%08x%08x%08x" "$x" "$y" "$p1" "$p2")

    # Float encoding (simplified - just use integer representation)
    local fp1_int=$(awk "BEGIN {printf \"%d\", $fp1 * 1000}")
    local fp2_int=$(awk "BEGIN {printf \"%d\", $fp2 * 1000}")
    payload+=$(printf "%08x%08x" "$fp1_int" "$fp2_int")

    local header=$(tgp_build_header $TGP_CMD_SPAWN 0 36)

    echo -n "${header}${payload}" | hex_to_bin | nc -U "$TGP_CMD_SOCK"
}

# Send KILL command
# Usage: tgp_send_kill <entity_id>
tgp_send_kill() {
    local entity_id=$1

    local payload=$(printf "%08x" "$entity_id")
    local header=$(tgp_build_header $TGP_CMD_KILL 0 4)

    echo -n "${header}${payload}" | hex_to_bin | nc -U "$TGP_CMD_SOCK"
}

# Send RUN command
# Usage: tgp_send_run [fps]
tgp_send_run() {
    local fps=${1:-60}

    local payload=$(printf "%02x%02x%04x" "$fps" 0 0)
    local header=$(tgp_build_header $TGP_CMD_RUN 0 4)

    echo -n "${header}${payload}" | hex_to_bin | nc -U "$TGP_CMD_SOCK"
}

# Send STOP command
tgp_send_stop() {
    local header=$(tgp_build_header $TGP_CMD_STOP 0 0)
    echo -n "${header}" | hex_to_bin | nc -U "$TGP_CMD_SOCK"
}

# Send QUIT command
tgp_send_quit() {
    local header=$(tgp_build_header $TGP_CMD_QUIT 0 0)
    echo -n "${header}" | hex_to_bin | nc -U "$TGP_CMD_SOCK"
}

# ============================================================================
# CLIENT API - RESPONSES
# ============================================================================

# Receive response
# Usage: tgp_recv_response [timeout_ms]
# Returns: response data in global TGP_RESP_* variables
declare -g TGP_RESP_TYPE=""
declare -g TGP_RESP_SEQ=""
declare -g TGP_RESP_DATA=""

tgp_recv_response() {
    local timeout_ms=${1:-1000}
    local timeout_sec=$(awk "BEGIN {printf \"%.1f\", $timeout_ms / 1000}")

    # Read from response socket with timeout
    local data=$(timeout "$timeout_sec" nc -U "$TGP_RESP_SOCK" 2>/dev/null | bin_to_hex)

    if [[ -z "$data" ]]; then
        return 1
    fi

    # Parse header
    TGP_RESP_TYPE="0x${data:0:2}"
    local flags="0x${data:2:2}"
    TGP_RESP_SEQ="0x${data:4:4}"
    local len="0x${data:8:8}"

    # Parse payload (starts at byte 16 in hex string)
    TGP_RESP_DATA="${data:16}"

    return 0
}

# ============================================================================
# CLIENT API - FRAMES
# ============================================================================

# Receive frame (non-blocking)
# Usage: tgp_recv_frame
# Returns: frame data to stdout
tgp_recv_frame() {
    # Non-blocking read from frame socket
    nc -U -w 0 "$TGP_FRAME_SOCK" 2>/dev/null
}

# ============================================================================
# CLIENT API - EVENTS
# ============================================================================

# Receive event (non-blocking)
# Usage: tgp_recv_event
tgp_recv_event() {
    nc -U -w 0 "$TGP_EVENT_SOCK" 2>/dev/null | bin_to_hex
}

# ============================================================================
# EXPORTS
# ============================================================================

export -f tgp_init
export -f tgp_cleanup
export -f tgp_build_header
export -f hex_to_bin
export -f bin_to_hex
export -f tgp_send_init
export -f tgp_send_spawn
export -f tgp_send_kill
export -f tgp_send_run
export -f tgp_send_stop
export -f tgp_send_quit
export -f tgp_recv_response
export -f tgp_recv_frame
export -f tgp_recv_event
