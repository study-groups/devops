#!/usr/bin/env bash
# tdocs Color System - Uses TDS tokens for theme support

# Category colors
tdocs_color_category() {
    local category="$1"

    # Check if TDS is available
    if ! command -v tds_text_color >/dev/null 2>&1; then
        # Fallback: no color
        return 0
    fi

    case "$category" in
        core)  tds_text_color "info" ;;      # Theme's info color
        other) tds_text_color "muted" ;;     # Theme's muted/dim
        *)     tds_text_color "muted" ;;     # Default to muted
    esac
}

# Status colors
tdocs_color_status() {
    local status="$1"

    # Check if TDS is available
    if ! command -v tds_text_color >/dev/null 2>&1; then
        # Fallback: no color
        return 0
    fi

    case "$status" in
        draft)      tds_text_color "warning" ;;   # Theme's warning
        stable)     tds_text_color "success" ;;   # Theme's success
        deprecated) tds_text_color "error" ;;     # Theme's error
        *)          tds_text_color "muted" ;;     # Default to muted
    esac
}

# Evidence weight colors
tdocs_color_evidence() {
    local weight="$1"

    # Check if TDS is available
    if ! command -v tds_text_color >/dev/null 2>&1; then
        # Fallback: no color
        return 0
    fi

    case "$weight" in
        primary)   tds_text_color "success" ;;    # Bright
        secondary) tds_text_color "info" ;;       # Medium
        tertiary)  tds_text_color "muted" ;;      # Dim
        *)         tds_text_color "muted" ;;      # Default
    esac
}

# Document type colors
tdocs_color_type() {
    local type="$1"

    # Check if TDS is available
    if ! command -v tds_text_color >/dev/null 2>&1; then
        # Fallback: no color
        return 0
    fi

    case "$type" in
        spec|guide|reference)
            tds_text_color "info" ;;              # Core documentation
        bug-fix|refactor)
            tds_text_color "warning" ;;           # Work items
        plan|summary|investigation)
            tds_text_color "muted" ;;             # Meta/planning
        *)
            tds_text_color "muted" ;;             # Default
    esac
}

# Reset color
tdocs_reset_color() {
    if command -v tds_reset_color >/dev/null 2>&1; then
        tds_reset_color
    fi
}

# Render a colored badge
# Usage: tdocs_render_badge "CORE" "core"
tdocs_render_badge() {
    local text="$1"
    local color_type="$2"  # category, status, evidence, type
    local value="$3"       # actual value to color

    local color_func="tdocs_color_${color_type}"

    if command -v "$color_func" >/dev/null 2>&1; then
        local color=$("$color_func" "$value")
        echo "${color}${text}$(tdocs_reset_color)"
    else
        echo "$text"
    fi
}

export -f tdocs_color_category
export -f tdocs_color_status
export -f tdocs_color_evidence
export -f tdocs_color_type
export -f tdocs_reset_color
export -f tdocs_render_badge
