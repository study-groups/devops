#!/usr/bin/env bash

# TSM Doctor - Shared Utility Functions
# Color helpers, text formatting, and dependency checks

# Load color module
if [[ -f "$TETRA_SRC/bash/color/color_core.sh" ]]; then
    source "$TETRA_SRC/bash/color/color_core.sh"
    source "$TETRA_SRC/bash/color/color_palettes.sh"
fi

# Load TDS utilities for ANSI-aware text manipulation
if [[ -f "$TETRA_SRC/bash/tds/core/ansi.sh" ]]; then
    source "$TETRA_SRC/bash/tds/core/ansi.sh"
fi

# Helper functions using tetra color palette
# Uses TSM color tokens if available, otherwise falls back to hardcoded colors
doctor_log() {
    if declare -f tsm_color_apply >/dev/null 2>&1; then
        tsm_color_apply "doctor.log"
    else
        text_color "0088FF"
    fi
    printf "[DOCTOR] %s" "$1"
    reset_color
    echo
}
doctor_warn() {
    if declare -f tsm_color_apply >/dev/null 2>&1; then
        tsm_color_apply "doctor.warn"
    else
        text_color "FFAA00"
    fi
    printf "%s" "$1"
    reset_color
    echo
}
doctor_error() {
    if declare -f tsm_color_apply >/dev/null 2>&1; then
        tsm_color_apply "doctor.error"
    else
        text_color "FF0044"
    fi
    printf "%s" "$1"
    reset_color
    echo
}
doctor_success() {
    if declare -f tsm_color_apply >/dev/null 2>&1; then
        tsm_color_apply "doctor.success"
    else
        text_color "00AA00"
    fi
    printf "%s" "$1"
    reset_color
    echo
}
doctor_info() {
    if declare -f tsm_color_apply >/dev/null 2>&1; then
        tsm_color_apply "doctor.info"
    else
        text_color "00AAAA"
    fi
    printf "%s" "$1"
    reset_color
    echo
}

# Truncate string with ellipsis in middle to fit width
# Delegates to TDS tds_truncate_middle (ANSI-aware) or uses simple fallback
doctor_truncate_middle() {
    local str="$1"
    local max_width="${2:-40}"

    # TDS is sourced above, use it directly
    if declare -f tds_truncate_middle >/dev/null 2>&1; then
        tds_truncate_middle "$str" "$max_width"
        return
    fi

    # Simple fallback if TDS not available
    if [[ ${#str} -le $max_width ]]; then
        echo "$str"
    else
        local side=$(( (max_width - 3) / 2 ))
        echo "${str:0:$side}...${str: -$side}"
    fi
}

# Check if lsof is available
doctor_check_dependencies() {
    local missing=()

    # Check required dependencies
    if ! command -v lsof >/dev/null 2>&1; then
        doctor_error "✗ lsof not found (required for port scanning)"
        missing+=("lsof")
    else
        doctor_success "✓ lsof available"
    fi

    # Check optional but recommended dependencies (macOS)
    # Use platform abstraction if available (handles keg-only Homebrew paths)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        local util_missing=()
        local has_flock=false has_setsid=false

        # Use platform layer if loaded, otherwise fall back to command -v
        if declare -f tsm_has_flock >/dev/null 2>&1; then
            tsm_has_flock && has_flock=true
            tsm_has_setsid && has_setsid=true
        else
            command -v flock >/dev/null 2>&1 && has_flock=true
            command -v setsid >/dev/null 2>&1 && has_setsid=true
        fi

        [[ "$has_flock" == "false" ]] && util_missing+=("flock")
        [[ "$has_setsid" == "false" ]] && util_missing+=("setsid")

        if [[ ${#util_missing[@]} -gt 0 ]]; then
            doctor_warn "⚠ util-linux not in PATH (provides flock, setsid for better process management)"
            echo "  Missing: ${util_missing[*]}"
            echo "  Install with: brew install util-linux"
            echo "  Then add to PATH: export PATH=\"\$HOMEBREW_PREFIX/opt/util-linux/bin:\$PATH\""
            echo "  TSM will work without it but with reduced functionality"
        else
            doctor_success "✓ util-linux available (flock, setsid)"
        fi
    fi

    [[ ${#missing[@]} -eq 0 ]] && return 0

    echo
    doctor_error "Missing required dependencies: ${missing[*]}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "Install with: brew install ${missing[*]}"
    fi
    return 1
}

# Export functions
export -f doctor_log doctor_warn doctor_error doctor_success doctor_info
export -f doctor_truncate_middle
export -f doctor_check_dependencies
