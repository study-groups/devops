#!/usr/bin/env bash

# TSM Doctor - Shared Utility Functions
# Color helpers, text formatting, and dependency checks

# Load color module
if [[ -f "$TETRA_SRC/bash/color/color_core.sh" ]]; then
    source "$TETRA_SRC/bash/color/color_core.sh"
    source "$TETRA_SRC/bash/color/color_palettes.sh"
fi

# Helper functions using tetra color palette
doctor_log() {
    text_color "0088FF"
    printf "[DOCTOR] %s" "$1"
    reset_color
    echo
}
doctor_warn() {
    text_color "FFAA00"
    printf "%s" "$1"
    reset_color
    echo
}
doctor_error() {
    text_color "FF0044"
    printf "%s" "$1"
    reset_color
    echo
}
doctor_success() {
    text_color "00AA00"
    printf "%s" "$1"
    reset_color
    echo
}
doctor_info() {
    text_color "00AAAA"
    printf "%s" "$1"
    reset_color
    echo
}

# Truncate string with ellipsis in middle to fit width
doctor_truncate_middle() {
    local str="$1"
    local max_width="${2:-40}"

    # If string fits, return as-is
    if [[ ${#str} -le $max_width ]]; then
        echo "$str"
        return
    fi

    # Calculate how much to show on each side (leave 3 chars for "...")
    local side_width=$(( (max_width - 3) / 2 ))
    local start_width=$side_width
    local end_width=$side_width

    # If odd number, give extra char to end
    if [[ $(( (max_width - 3) % 2 )) -eq 1 ]]; then
        end_width=$((end_width + 1))
    fi

    # Extract start and end, join with ellipsis
    local start="${str:0:$start_width}"
    local end="${str: -$end_width}"
    echo "${start}...${end}"
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
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if ! command -v flock >/dev/null 2>&1 || ! command -v setsid >/dev/null 2>&1; then
            doctor_warn "⚠ util-linux not in PATH (provides flock, setsid for better process management)"
            echo "  Install with: brew install util-linux"
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
