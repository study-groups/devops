#!/usr/bin/env bash
# tps/core/osc.sh - OSC escape sequences for terminal integration
#
# OSC (Operating System Command) escape sequences:
#   ESC ] Ps ; Pt BEL
#   Ps=6: Set document (current file)
#   Ps=7: Set working directory
#
# URL format: file://hostname/path (with percent-encoding)
# When both are set, document takes precedence per spec.

# Configuration
declare -g TPS_OSC_ENABLED="${TPS_OSC_ENABLED:-true}"
declare -g TPS_DOCUMENT=""

# URL-encode path (percent-encode special characters)
_tps_urlencode() {
    local path="$1"
    local i char encoded=""
    for ((i=0; i<${#path}; i++)); do
        char="${path:i:1}"
        case "$char" in
            [a-zA-Z0-9._~/-]) encoded+="$char" ;;
            *) printf -v encoded '%s%%%02X' "$encoded" "'$char" ;;
        esac
    done
    echo "$encoded"
}

# Emit OSC 7 (working directory)
_tps_osc_pwd() {
    [[ "$TPS_OSC_ENABLED" != "true" ]] && return
    local hostname="${HOSTNAME:-$(hostname)}"
    local encoded_path
    encoded_path=$(_tps_urlencode "$PWD")
    # \001..\002 are PS1-safe non-printing markers (equivalent to \[..\])
    printf '\001\e]7;file://%s%s\a\002' "$hostname" "$encoded_path"
}

# Emit OSC 6 (document) - only if TPS_DOCUMENT is set
_tps_osc_document() {
    [[ "$TPS_OSC_ENABLED" != "true" ]] && return
    [[ -z "$TPS_DOCUMENT" ]] && return
    local hostname="${HOSTNAME:-$(hostname)}"
    local encoded_path
    encoded_path=$(_tps_urlencode "$TPS_DOCUMENT")
    printf '\001\e]6;file://%s%s\a\002' "$hostname" "$encoded_path"
}

# Combined OSC output (document takes precedence per spec)
_tps_osc_emit() {
    [[ "$TPS_OSC_ENABLED" != "true" ]] && return
    if [[ -n "$TPS_DOCUMENT" ]]; then
        _tps_osc_document
    else
        _tps_osc_pwd
    fi
}

# =============================================================================
# PUBLIC API
# =============================================================================

# Set current document (for editor integrations)
tps_set_document() {
    TPS_DOCUMENT="$1"
}

# Clear current document
tps_clear_document() {
    TPS_DOCUMENT=""
}

# Enable/disable OSC output
tps_osc() {
    case "$1" in
        on|enable|true|1)
            TPS_OSC_ENABLED="true"
            echo "OSC escape sequences enabled"
            ;;
        off|disable|false|0)
            TPS_OSC_ENABLED="false"
            echo "OSC escape sequences disabled"
            ;;
        status|"")
            echo "OSC: ${TPS_OSC_ENABLED:-true}"
            [[ -n "$TPS_DOCUMENT" ]] && echo "Document: $TPS_DOCUMENT"
            echo "PWD: $PWD"
            ;;
        *)
            echo "Usage: tps osc [on|off|status]" >&2
            return 1
            ;;
    esac
}

export -f _tps_urlencode _tps_osc_pwd _tps_osc_document _tps_osc_emit
export -f tps_set_document tps_clear_document tps_osc
