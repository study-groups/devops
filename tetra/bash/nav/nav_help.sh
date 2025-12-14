#!/usr/bin/env bash
# nav_help.sh - Help display for nav structures
#
# Optional layer for displaying help from nav-defined structures.
# Provides paginated, colorized help output.

NAV_HELP_SRC="${NAV_HELP_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

# Source nav core if needed
if ! declare -F nav_children >/dev/null 2>&1; then
    source "$NAV_HELP_SRC/nav.sh"
fi

# =============================================================================
# CONFIGURATION
# =============================================================================

NAV_HELP_MAX_LINES=18
NAV_HELP_INDENT="  "

# Colors (hex codes)
NAV_HELP_COLOR_TITLE="00AAFF"
NAV_HELP_COLOR_SECTION="FFAA00"
NAV_HELP_COLOR_COMMAND="00FF88"
NAV_HELP_COLOR_DIM="888888"
NAV_HELP_COLOR_BREADCRUMB="FFFF00"

# =============================================================================
# COLOR HELPERS
# =============================================================================

_nav_color() {
    local color="$1" text="$2"
    if declare -F text_color >/dev/null 2>&1; then
        text_color "$color" 2>/dev/null || true
        printf "%s" "$text"
        reset_color 2>/dev/null || true
    else
        printf "%s" "$text"
    fi
}

_nav_title() { _nav_color "$NAV_HELP_COLOR_TITLE" "$1"; }
_nav_section() { _nav_color "$NAV_HELP_COLOR_SECTION" "$1"; }
_nav_command() { _nav_color "$NAV_HELP_COLOR_COMMAND" "$1"; }
_nav_dim() { _nav_color "$NAV_HELP_COLOR_DIM" "$1"; }
_nav_breadcrumb() { _nav_color "$NAV_HELP_COLOR_BREADCRUMB" "$1"; }

# =============================================================================
# HELP DISPLAY
# =============================================================================

# Show help for a path
# Usage: nav_help <path> [--no-pagination]
nav_help() {
    local path=$(nav_normalize_path "$1")
    local no_pagination=0
    [[ "$2" == "--no-pagination" ]] && no_pagination=1

    if ! nav_exists "$path"; then
        echo "Not found: $path"
        return 1
    fi

    local lines=()
    _nav_help_build "$path" lines

    if [[ $no_pagination -eq 1 ]] || [[ ${#lines[@]} -le $NAV_HELP_MAX_LINES ]]; then
        printf '%s\n' "${lines[@]}"
    else
        _nav_help_paginate "${lines[@]}"
    fi
}

# Build help content
_nav_help_build() {
    local path="$1"
    local -n out="$2"

    local type=$(nav_type "$path")
    local title=$(nav_get "$path" "title")
    local help=$(nav_get "$path" "help")
    local synopsis=$(nav_get "$path" "synopsis")
    local detail=$(nav_get "$path" "detail")
    local examples=$(nav_get "$path" "examples")

    # Title
    out+=("$(_nav_title "■ ${title:-${path##*.}}")")
    [[ -n "$help" ]] && out+=("$help")
    out+=("")

    # Synopsis
    if [[ -n "$synopsis" ]]; then
        out+=("$(_nav_section "USAGE:")")
        out+=("$NAV_HELP_INDENT$synopsis")
        out+=("")
    fi

    # Detail
    if [[ -n "$detail" ]]; then
        out+=("$(_nav_section "DESCRIPTION:")")
        while IFS= read -r line; do
            out+=("$NAV_HELP_INDENT$line")
        done <<< "$detail"
        out+=("")
    fi

    # Examples
    if [[ -n "$examples" ]]; then
        out+=("$(_nav_section "EXAMPLES:")")
        while IFS= read -r line; do
            out+=("$NAV_HELP_INDENT$line")
        done <<< "$examples"
        out+=("")
    fi

    # Children grouped by type
    local children=$(nav_children "$path")
    if [[ -n "$children" ]]; then
        local -a commands=() flags=() options=() categories=() other=()

        for child in $children; do
            case "$(nav_type "$child")" in
                command)  commands+=("$child") ;;
                flag)     flags+=("$child") ;;
                option)   options+=("$child") ;;
                category) categories+=("$child") ;;
                *)        other+=("$child") ;;
            esac
        done

        _nav_help_section "TOPICS:" categories out
        _nav_help_section "COMMANDS:" commands out
        _nav_help_section "FLAGS:" flags out
        _nav_help_section "OPTIONS:" options out
        _nav_help_section "OTHER:" other out
    fi
}

# Add a section of children
_nav_help_section() {
    local header="$1"
    local -n items="$2"
    local -n output="$3"

    [[ ${#items[@]} -eq 0 ]] && return

    # Find max width for alignment
    local max_width=0
    for child in "${items[@]}"; do
        local leaf="${child##*.}"
        (( ${#leaf} > max_width )) && max_width=${#leaf}
    done
    (( max_width < 12 )) && max_width=12

    output+=("$(_nav_section "$header")")
    for child in "${items[@]}"; do
        local leaf="${child##*.}"
        local t=$(nav_get "$child" "title")
        local h=$(nav_get "$child" "help")
        # Use printf for alignment, then colorize
        local padded=$(printf "%-${max_width}s" "$leaf")
        output+=("$NAV_HELP_INDENT$(_nav_command "$padded")  $(_nav_dim "${t:-$h}")")
    done
    output+=("")
}

# Paginate output
_nav_help_paginate() {
    local lines=("$@")
    local total=${#lines[@]}
    local start=0

    while [[ $start -lt $total ]]; do
        local end=$((start + NAV_HELP_MAX_LINES))
        [[ $end -gt $total ]] && end=$total

        clear
        for ((i=start; i<end; i++)); do
            echo "${lines[$i]}"
        done

        local page=$(( (start / NAV_HELP_MAX_LINES) + 1 ))
        local pages=$(( (total + NAV_HELP_MAX_LINES - 1) / NAV_HELP_MAX_LINES ))
        echo ""
        echo "$(_nav_dim "Page $page/$pages")"

        if [[ $end -lt $total ]]; then
            echo -n "[Enter] next | [q] quit: "
            read -r -n 1 resp
            echo ""
            [[ "$resp" == "q" ]] && break
            start=$end
        else
            break
        fi
    done
}

# Interactive navigation
# Usage: nav_navigate [starting_path]
nav_navigate() {
    local current="${1:-help}"
    current=$(nav_normalize_path "$current")
    local history=()

    while true; do
        nav_help "$current" --no-pagination
        echo ""
        echo "Navigate: [topic] dive | [b]ack | [m]ain | [q]uit: "
        read -r input

        case "$input" in
            q|quit|exit) break ;;
            b|back)
                if [[ ${#history[@]} -gt 0 ]]; then
                    current="${history[-1]}"
                    unset 'history[-1]'
                fi
                ;;
            m|main) current="help"; history=() ;;
            "") continue ;;
            *)
                local child="$current.$input"
                if nav_exists "$child"; then
                    history+=("$current")
                    current="$child"
                else
                    echo "Not found: $input"
                    sleep 1
                fi
                ;;
        esac
    done
}

# =============================================================================
# TREE_* COMPATIBILITY SHIMS
# =============================================================================

tree_help_show() { nav_help "$@"; }
tree_help_navigate() { nav_navigate "$@"; }

# =============================================================================
# EXPORTS
# =============================================================================

export -f nav_help nav_navigate
export -f _nav_help_build _nav_help_section _nav_help_paginate
export -f _nav_color _nav_title _nav_section _nav_command _nav_dim _nav_breadcrumb
export -f tree_help_show tree_help_navigate
