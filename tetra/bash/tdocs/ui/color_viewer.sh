#!/usr/bin/env bash

# TDOCS Color Viewer
# Shows all design tokens and their colors

# Source TDS and TDOCS token systems
TDOCS_SRC="${TDOCS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
TDS_SRC="${TDS_SRC:-$TETRA_SRC/bash/tds}"

# Load TDS core
if [[ -f "$TDS_SRC/chroma.sh" ]]; then
    source "$TDS_SRC/chroma.sh"
else
    echo "Error: TDS not found at $TDS_SRC" >&2
    exit 1
fi

# Load TDOCS tokens
if [[ -f "$TDOCS_SRC/ui/tdocs_tokens.sh" ]]; then
    source "$TDOCS_SRC/ui/tdocs_tokens.sh"
else
    echo "Error: TDOCS tokens not found" >&2
    exit 1
fi

# Get terminal width (default to 80)
TERM_WIDTH="${COLUMNS:-80}"

# Calculate padding for centered headers
_center_text() {
    local text="$1"
    local width="${2:-$TERM_WIDTH}"
    local text_len=${#text}
    local padding=$(( (width - text_len) / 2 ))
    printf "%*s%s\n" $padding "" "$text"
}

# Display header
echo
if [[ $TERM_WIDTH -ge 80 ]]; then
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    _center_text "TDOCS Design Token Viewer" 80
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
else
    echo "════════════════════════════════════════════════════════════════"
    echo "TDOCS Design Token Viewer"
    echo "════════════════════════════════════════════════════════════════"
fi
echo

# Compact token display function
_show_token_compact() {
    local token="$1"
    local palette_ref="${TDS_COLOR_TOKENS[$token]}"
    local hex=$(tds_resolve_color "$token" 2>/dev/null)

    # Convert hex to 256 color (more compatible than RGB)
    if [[ -n "$hex" && ${#hex} -eq 6 ]]; then
        local color256
        if declare -f hex_to_256 >/dev/null 2>&1; then
            color256=$(hex_to_256 "$hex" 2>/dev/null)
        else
            color256=7  # fallback to white
        fi
        printf "\033[38;5;%dm██\033[0m" "$color256"
    else
        # Fallback if hex is invalid
        printf "░░"
    fi

    # Show token name and mapping (compact)
    printf " %-28s %s\n" "$token" "→ $hex"
}

# Show TDOCS-specific tokens (compact 80-col format)
echo "TDOCS Tokens"
echo "════════════════════════════════════════════════════════════════════════════════"
echo

echo "Scope (ENV - green):"
for key in tdocs.scope.system tdocs.scope.module tdocs.scope.feature tdocs.scope.temporal; do
    printf "  "
    _show_token_compact "$key"
done
echo

echo "Type (MODE - blue, exceptions red/orange):"
for key in tdocs.type.spec tdocs.type.guide tdocs.type.investigation tdocs.type.reference; do
    printf "  "
    _show_token_compact "$key"
done
for key in tdocs.type.plan tdocs.type.summary tdocs.type.scratch; do
    printf "  "
    _show_token_compact "$key"
done
for key in tdocs.type.bug-fix tdocs.type.refactor tdocs.type.tdocs; do
    printf "  "
    _show_token_compact "$key"
done
echo

echo "Module (VERBS - red/orange):"
printf "  "
_show_token_compact "tdocs.module"
echo

echo "Grade (NOUNS - purple):"
for key in tdocs.grade.A tdocs.grade.B tdocs.grade.C tdocs.grade.X; do
    printf "  "
    _show_token_compact "$key"
done
echo

echo "Lifecycle (mixed colors by stage):"
for key in tdocs.lifecycle.C tdocs.lifecycle.S tdocs.lifecycle.W tdocs.lifecycle.D tdocs.lifecycle.X; do
    printf "  "
    _show_token_compact "$key"
done
echo

echo "Completeness Levels:"
for level in {0..4}; do
    key="tdocs.level.$level"
    printf "  "
    _show_token_compact "$key"
done

echo
echo "════════════════════════════════════════════════════════════════"
echo

# Show palette colors (compact 2-column for 80-col)
echo "Palettes (4 colors × 8 slots each)"
echo "════════════════════════════════════════════════════════════════════════════════"
echo

_show_palette_row() {
    local palette="$1"
    local idx1="$2"
    local idx2="$3"

    # Get array name (e.g., ENV_PRIMARY)
    local arr_name
    case "$palette" in
        env) arr_name="ENV_PRIMARY" ;;
        mode) arr_name="MODE_PRIMARY" ;;
        verbs) arr_name="VERBS_PRIMARY" ;;
        nouns) arr_name="NOUNS_PRIMARY" ;;
    esac

    # Get hex values using indirect reference
    local -n palette_arr="$arr_name"
    local hex1="${palette_arr[$idx1]}"
    local hex2="${palette_arr[$idx2]}"

    # Convert hex to 256 color (more compatible)
    local color1 color2
    if declare -f hex_to_256 >/dev/null 2>&1; then
        color1=$(hex_to_256 "$hex1" 2>/dev/null)
        color2=$(hex_to_256 "$hex2" 2>/dev/null)
    else
        color1=7; color2=7  # fallback to white
    fi

    # Left column
    printf "  "
    printf "\033[38;5;%dm██\033[0m" "$color1"
    printf " %-7s #%-6s" "[${idx1}]" "$hex1"

    # Right column
    printf "   "
    printf "\033[38;5;%dm██\033[0m" "$color2"
    printf " %-7s #%-6s\n" "[${idx2}]" "$hex2"
}

if [[ -n "${ENV_PRIMARY[0]}" ]]; then
    echo "ENV (greens):"
    for i in 0 2 4 6; do
        _show_palette_row "env" "$i" "$((i+1))"
    done
    echo
fi

if [[ -n "${MODE_PRIMARY[0]}" ]]; then
    echo "MODE (blues):"
    for i in 0 2 4 6; do
        _show_palette_row "mode" "$i" "$((i+1))"
    done
    echo
fi

if [[ -n "${VERBS_PRIMARY[0]}" ]]; then
    echo "VERBS (reds/oranges):"
    for i in 0 2 4 6; do
        _show_palette_row "verbs" "$i" "$((i+1))"
    done
    echo
fi

if [[ -n "${NOUNS_PRIMARY[0]}" ]]; then
    echo "NOUNS (purples):"
    for i in 0 2 4 6; do
        _show_palette_row "nouns" "$i" "$((i+1))"
    done
    echo
fi

echo
echo "════════════════════════════════════════════════════════════════════════════════"
echo

# Show sample tags as they would appear in the UI
echo "Sample Tag Rendering"
echo "════════════════════════════════════════════════════════════════════════════════"
echo

# Source tags rendering
if [[ -f "$TDOCS_SRC/ui/tags.sh" ]]; then
    source "$TDOCS_SRC/ui/tags.sh"

    echo "Type tags:"
    printf "  "
    for tag in spec guide investigation reference plan summary scratch; do
        tdoc_render_tag "$tag" false
        printf " "
    done
    echo
    printf "  "
    for tag in bug-fix refactor tdocs; do
        tdoc_render_tag "$tag" false
        printf " "
    done
    echo
    echo

    echo "Lifecycle tags:"
    printf "  "
    for code in C S W D X; do
        case "$code" in
            C) name="Canon" ;;
            S) name="Stable" ;;
            W) name="Work" ;;
            D) name="Draft" ;;
            X) name="Arch" ;;
        esac
        tds_text_color "tdocs.lifecycle.$code"
        printf "%s " "$name"
        reset_color
    done
    echo
fi

echo
echo "════════════════════════════════════════════════════════════════════════════════"
echo "All tokens use FOREGROUND-ONLY colors (no background)"
echo "If you see unexpected backgrounds, check for color leaks or terminal state"
echo
