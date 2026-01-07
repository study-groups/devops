#!/usr/bin/env bash
# TSM Colors - Uses TDS (Tetra Design System)
#
# Provides color functions for TSM output using TDS semantic tokens.
# Gracefully degrades to plain text if TDS unavailable.
#
# TDS Tokens used:
#   status.success  - online/running
#   status.error    - failed/error
#   status.warning  - warning/unknown
#   text.muted      - stopped/dim
#   text.primary    - names/primary text
#   text.tertiary   - secondary info (pid, port, uptime)
#   structural.primary - headings/labels

[[ -n "${_TSM_COLORS_LOADED:-}" ]] && return 0
_TSM_COLORS_LOADED=1

# =============================================================================
# TDS INITIALIZATION
# =============================================================================

_TSM_HAS_TDS=false

_tsm_init_tds() {
    # Already loaded?
    if declare -F tds_text_color &>/dev/null; then
        _TSM_HAS_TDS=true
        return 0
    fi

    # Try to load TDS
    local tds_path="${TETRA_SRC}/bash/tds/tds.sh"
    if [[ -f "$tds_path" ]]; then
        source "$tds_path" 2>/dev/null && _TSM_HAS_TDS=true
    fi
}

# Initialize on load
_tsm_init_tds

# =============================================================================
# COLOR ESCAPE HELPERS
# =============================================================================

# Get ANSI escape for a TDS token (for embedding in printf)
# Usage: local c=$(tsm_esc "status.success")
tsm_esc() {
    local token="$1"
    if [[ "$_TSM_HAS_TDS" == true ]] && [[ -t 1 ]]; then
        tds_text_color "$token"
    fi
}

# Reset escape
tsm_reset() {
    if [[ "$_TSM_HAS_TDS" == true ]] && [[ -t 1 ]]; then
        reset_color
    fi
}

# =============================================================================
# STATUS COLORIZATION
# =============================================================================

# Map status value to TDS token
# Uses TDS pattern registry for consistent colorization across tetra
_tsm_status_token() {
    # Use pattern registry if available
    if declare -F tds_pattern_match &>/dev/null; then
        tds_pattern_match "$1" "status" 2>/dev/null || echo "status.warning"
    else
        # Fallback if TDS not loaded
        case "$1" in
            online|running|active|up|success|ok|enabled|yes|true)
                echo "status.success" ;;
            stopped|down|inactive|offline|disabled|no|false)
                echo "text.muted" ;;
            error|failed|critical|dead)
                echo "status.error" ;;
            *)
                echo "status.warning" ;;
        esac
    fi
}

# Print colored status value
# Usage: tsm_colorize_status "online"
tsm_colorize_status() {
    local status="$1"
    if [[ "$_TSM_HAS_TDS" == true ]] && [[ -t 1 ]]; then
        local token=$(_tsm_status_token "$status")
        tds_color "$token" "$status"
    else
        printf '%s' "$status"
    fi
}

# Get status color escape (for embedding)
# Usage: printf "%s%s%s" "$(tsm_status_esc online)" "online" "$(tsm_reset_esc)"
tsm_status_esc() {
    local token=$(_tsm_status_token "$1")
    tsm_esc "$token"
}

# =============================================================================
# MESSAGE FUNCTIONS
# =============================================================================

# Print header/title
tsm_header() {
    if [[ "$_TSM_HAS_TDS" == true ]] && [[ -t 1 ]]; then
        tds_color "structural.primary" "$1"
        echo
    else
        echo "$1"
    fi
}

# Print success message
tsm_success() {
    if [[ "$_TSM_HAS_TDS" == true ]] && [[ -t 1 ]]; then
        tds_status "success" "$1"
    else
        echo "$1"
    fi
}

# Print error message
tsm_error() {
    if [[ "$_TSM_HAS_TDS" == true ]] && [[ -t 2 ]]; then
        tds_status "error" "tsm: $1" >&2
    else
        echo "tsm: $1" >&2
    fi
}

# Print warning message
tsm_warn() {
    if [[ "$_TSM_HAS_TDS" == true ]] && [[ -t 2 ]]; then
        tds_status "warning" "tsm: $1" >&2
    else
        echo "tsm: warning - $1" >&2
    fi
}

# Print info message (named tsm_msg_info to avoid CLI conflict)
tsm_msg_info() {
    if [[ "$_TSM_HAS_TDS" == true ]] && [[ -t 1 ]]; then
        tds_status "info" "$1"
    else
        echo "$1"
    fi
}

# =============================================================================
# TABLE COLUMN HELPERS
# =============================================================================

# Standard column tokens for tsm list output
declare -gA TSM_COL_TOKEN=(
    [id]="text.muted"
    [name]="text.primary"
    [name_port]="status.success"       # port suffix in name (green)
    [pid]="text.tertiary"
    [port]="text.tertiary"
    [status]=""  # handled by tsm_colorize_status
    [uptime]="text.muted"
    [label]="structural.primary"
    [separator]="text.dim"
)

# Get column color escape
tsm_col_esc() {
    local col="$1"
    local token="${TSM_COL_TOKEN[$col]:-text.primary}"
    tsm_esc "$token"
}

# Format process name with port suffix highlighted
# Usage: tsm_format_name "gamma-8085" 20
# Output: "gamma-" in text.primary, "8085" in action.secondary (orange)
# Note: Caller is responsible for TTY check (use inside use_color block)
tsm_format_name() {
    local name="$1"
    local width="${2:-0}"

    # No TDS = no color
    if [[ "$_TSM_HAS_TDS" != true ]]; then
        printf "%-${width}s" "$name"
        return
    fi

    # Match name-port pattern (e.g., "gamma-8085", "tetra-4444")
    if [[ "$name" =~ ^(.+-)([0-9]+)$ ]]; then
        local prefix="${BASH_REMATCH[1]}"
        local port="${BASH_REMATCH[2]}"
        local total_len=${#name}
        local pad=$((width - total_len))

        tds_text_color "text.primary"
        printf '%s' "$prefix"
        tds_text_color "status.success"
        printf '%s' "$port"
        reset_color

        # Add padding if width specified
        ((pad > 0)) && printf '%*s' "$pad" ""
    else
        # No port suffix, just colorize normally
        tds_text_color "text.primary"
        printf "%-${width}s" "$name"
        reset_color
    fi
}

# =============================================================================
# EXPORTS
# =============================================================================

export _TSM_HAS_TDS
export -f tsm_esc tsm_reset
export -f tsm_colorize_status tsm_status_esc _tsm_status_token
export -f tsm_format_name
export -f tsm_header tsm_success tsm_error tsm_warn tsm_msg_info
export -f tsm_col_esc
