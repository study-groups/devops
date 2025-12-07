#!/usr/bin/env bash
# TUT Output Helpers - TDS-powered CLI output
# Provides colored, formatted output with graceful fallback

# =============================================================================
# COLOR HELPERS (graceful degradation if TDS not loaded)
# =============================================================================

_tut_color() {
    local token="$1"
    [[ $TUT_HAS_TDS -eq 1 ]] && tds_text_color "$token"
}

_tut_reset() {
    [[ $TUT_HAS_TDS -eq 1 ]] && reset_color
}

# =============================================================================
# HEADINGS
# =============================================================================

_tut_heading() {
    local level="$1"
    local text="$2"

    if [[ $TUT_HAS_TDS -eq 1 ]]; then
        tds_render_heading "$level" "$text"
    else
        case "$level" in
            1) echo "=== $text ===" ;;
            2) echo "--- $text ---" ;;
            3) echo "$text:" ;;
            *) echo "$text" ;;
        esac
    fi
}

# =============================================================================
# STATUS MESSAGES
# =============================================================================

_tut_success() {
    local msg="$1"
    if [[ $TUT_HAS_TDS -eq 1 ]]; then
        tds_text_color "status.success"
        printf "✓ %s\n" "$msg"
        reset_color
    else
        printf "✓ %s\n" "$msg"
    fi
}

_tut_error() {
    local msg="$1"
    if [[ $TUT_HAS_TDS -eq 1 ]]; then
        tds_text_color "status.error"
        printf "✗ %s\n" "$msg"
        reset_color
    else
        printf "✗ %s\n" "$msg" >&2
    fi
}

_tut_warn() {
    local msg="$1"
    if [[ $TUT_HAS_TDS -eq 1 ]]; then
        tds_text_color "status.warning"
        printf "! %s\n" "$msg"
        reset_color
    else
        printf "! %s\n" "$msg"
    fi
}

_tut_info() {
    local msg="$1"
    if [[ $TUT_HAS_TDS -eq 1 ]]; then
        tds_text_color "status.info"
        printf "→ %s\n" "$msg"
        reset_color
    else
        printf "→ %s\n" "$msg"
    fi
}

# =============================================================================
# FORMATTED OUTPUT
# =============================================================================

_tut_label() {
    local label="$1"
    local value="$2"
    local width="${3:-14}"

    if [[ $TUT_HAS_TDS -eq 1 ]]; then
        tds_text_color "text.secondary"
        printf "%-${width}s" "$label"
        reset_color
        tds_text_color "text.primary"
        printf "%s\n" "$value"
        reset_color
    else
        printf "%-${width}s%s\n" "$label" "$value"
    fi
}

_tut_item() {
    local text="$1"
    local indent="${2:-0}"
    local prefix="  "

    for ((i=0; i<indent; i++)); do prefix+="  "; done

    if [[ $TUT_HAS_TDS -eq 1 ]]; then
        tds_text_color "text.secondary"
        printf "%s• " "$prefix"
        reset_color
        tds_text_color "text.primary"
        printf "%s\n" "$text"
        reset_color
    else
        printf "%s• %s\n" "$prefix" "$text"
    fi
}

_tut_code() {
    local code="$1"
    if [[ $TUT_HAS_TDS -eq 1 ]]; then
        tds_text_color "content.code.inline"
        printf "%s" "$code"
        reset_color
    else
        printf "%s" "$code"
    fi
}

_tut_dim() {
    local text="$1"
    if [[ $TUT_HAS_TDS -eq 1 ]]; then
        tds_text_color "text.muted"
        printf "%s" "$text"
        reset_color
    else
        printf "%s" "$text"
    fi
}

_tut_path_verbose() {
    local path="$1"
    # Entire path in dim gray
    if [[ $TUT_HAS_TDS -eq 1 ]]; then
        printf "  \e[38;5;240m%s\e[0m\n" "$path"
    else
        printf "  %s\n" "$path"
    fi
}

_tut_accent() {
    local text="$1"
    if [[ $TUT_HAS_TDS -eq 1 ]]; then
        tds_text_color "interactive.link"
        printf "%s" "$text"
        reset_color
    else
        printf "%s" "$text"
    fi
}

# =============================================================================
# SECTION HEADERS
# =============================================================================

_tut_section() {
    local title="$1"
    echo
    if [[ $TUT_HAS_TDS -eq 1 ]]; then
        tds_text_color "content.heading.h3"
        printf "%s\n" "$title"
        reset_color
    else
        printf "%s\n" "$title"
    fi
}

# =============================================================================
# TABLE-LIKE OUTPUT
# =============================================================================

_tut_row() {
    local col1="$1"
    local col2="$2"
    local col3="$3"
    local w1="${4:-25}"
    local w2="${5:-12}"

    if [[ $TUT_HAS_TDS -eq 1 ]]; then
        printf "  "
        printf "\e[38;5;255m%-${w1}s\e[0m" "$col1"  # brightest for filename
        tds_text_color "text.secondary"
        printf "%-${w2}s" "$col2"
        tds_text_color "text.muted"
        printf "%s\n" "$col3"
        reset_color
    else
        printf "  %-${w1}s%-${w2}s%s\n" "$col1" "$col2" "$col3"
    fi
}

# =============================================================================
# PATH/FILE OUTPUT
# =============================================================================

_tut_path() {
    local label="$1"
    local path="$2"
    local exists=""

    if [[ -e "$path" ]]; then
        exists="ok"
    else
        exists="missing"
    fi

    if [[ $TUT_HAS_TDS -eq 1 ]]; then
        tds_text_color "text.secondary"
        printf "  %-12s" "$label:"
        tds_text_color "content.code.inline"
        printf "%s " "$path"
        if [[ "$exists" == "ok" ]]; then
            tds_text_color "status.success"
            printf "(ok)"
        else
            tds_text_color "status.error"
            printf "(missing)"
        fi
        reset_color
        echo
    else
        printf "  %-12s%s (%s)\n" "$label:" "$path" "$exists"
    fi
}

# =============================================================================
# URL OPENER
# =============================================================================

_tut_open_url() {
    local url="$1"
    if command -v open >/dev/null 2>&1; then
        open "$url"
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url"
    else
        echo "Open manually: $url"
    fi
}
