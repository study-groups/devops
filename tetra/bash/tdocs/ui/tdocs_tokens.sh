#!/usr/bin/env bash

# TDOCS TDS Token System
# Design tokens for TDOCS UI elements

# TDOCS-specific color tokens map semantic elements to palette references
# NOTE: Simplified single-color-per-category design
# Each category uses palette[0] for consistent, simple visual grammar
declare -gA TDS_TDOCS_TOKENS=(
    # Scope tokens (ENV palette[0] - green) - Application reach
    [tdocs.scope]="env:0"                      # Default scope color
    [tdocs.scope.system]="env:0"               # System-wide documents
    [tdocs.scope.module]="env:0"               # Module-specific documents
    [tdocs.scope.feature]="env:0"              # Feature-level documents
    [tdocs.scope.temporal]="env:0"             # Time-bound documents

    # Type tokens (MODE palette[0] - blue) - Document type
    [tdocs.type]="mode:0"                      # Default type color
    [tdocs.type.spec]="mode:0"                 # Specifications
    [tdocs.type.guide]="mode:0"                # How-to guides
    [tdocs.type.investigation]="mode:0"        # Investigations/analysis
    [tdocs.type.reference]="mode:0"            # Reference material
    [tdocs.type.plan]="mode:0"                 # Plans/roadmaps
    [tdocs.type.summary]="mode:0"              # Summaries/reports
    [tdocs.type.scratch]="mode:0"              # Scratch/temporary notes
    [tdocs.type.bug-fix]="verbs:0"             # Bug fixes - red
    [tdocs.type.refactor]="verbs:3"            # Refactoring - orange
    [tdocs.type.tdocs]="mode:0"                # TDOCS module docs - blue

    # Module tokens (VERBS palette[0] - red/orange) - Module ownership
    [tdocs.module]="verbs:0"                   # All modules use same color

    # Grade tokens (NOUNS palette[0] - purple) - Reliability/authority
    [tdocs.grade]="nouns:0"                    # Default grade color
    [tdocs.grade.A]="nouns:0"                  # Grade A - Canonical
    [tdocs.grade.B]="nouns:0"                  # Grade B - Established
    [tdocs.grade.C]="nouns:0"                  # Grade C - Working
    [tdocs.grade.X]="nouns:0"                  # Grade X - Ephemeral

    # Lifecycle tokens (foreground-only colors)
    [tdocs.lifecycle.C]="nouns:0"              # Canonical - purple
    [tdocs.lifecycle.S]="mode:0"               # Stable - blue
    [tdocs.lifecycle.W]="verbs:3"              # Working - orange
    [tdocs.lifecycle.D]="env:6"                # Draft - gray
    [tdocs.lifecycle.X]="verbs:0"              # Archived - red

    # List display tokens
    [tdocs.list.path]="mode:7"                 # Light text - file paths (text.primary)
    [tdocs.list.count]="mode:6"                # Medium text - count (text.secondary)
    [tdocs.list.separator]="env:6"             # Subtle text - separators (text.tertiary)

    # Completeness level tokens (L0-L4)
    [tdocs.level.0]="verbs:0"                  # Red - no docs (status.error)
    [tdocs.level.1]="verbs:3"                  # Orange - minimal (status.warning)
    [tdocs.level.2]="env:2"                    # Yellow-green - working
    [tdocs.level.3]="mode:0"                   # Blue - complete
    [tdocs.level.4]="env:1"                    # Green - exemplar (status.success)

    # REPL prompt tokens (256 colors matching prompt.png)
    [tdocs.prompt.bracket]="118"          # Green brackets [ ]
    [tdocs.prompt.paren]="244"            # Gray parentheses ( )
    [tdocs.prompt.arrow]="170"            # Purple arrow >
    [tdocs.prompt.arrow.pipe]="118"       # Green arrow -> or →
    [tdocs.prompt.separator]="118"        # Green | separator
    [tdocs.prompt.label]="118"            # Green label
    [tdocs.prompt.count]="170"            # Purple count (92)
    [tdocs.prompt.filter.all]="214"       # Orange "all"
    [tdocs.prompt.filter.core]="214"      # Orange - core filter
    [tdocs.prompt.filter.other]="214"     # Orange - other filter
    [tdocs.prompt.module]="244"           # Gray module name
    [tdocs.prompt.topic1]="118"           # Green - first topic (for {})
    [tdocs.prompt.topic2]="214"           # Orange - second topic (for *)
    [tdocs.prompt.level]="226"            # Yellow - level indicator (for W:92)
    [tdocs.prompt.temporal]="226"         # Yellow - temporal filter
    [tdocs.prompt.state]="170"            # Purple - current state

    # Help/info tokens
    [tdocs.help.header]="content.heading.h2"
    [tdocs.help.command]="content.code.inline"
    [tdocs.help.description]="text.secondary"
)

# Merge TDOCS tokens into main TDS token map
# This allows tds_text_color() and tds_resolve_color() to work with TDOCS tokens
# Ensure TDS_COLOR_TOKENS exists (TDS should have created it, but just in case)
if [[ -z "${TDS_COLOR_TOKENS+x}" ]]; then
    declare -gA TDS_COLOR_TOKENS
fi

# DEBUG: Count tokens before merge
if [[ "${TDOCS_DEBUG_TOKENS:-0}" == "1" ]]; then
    >&2 echo "DEBUG: TDS_TDOCS_TOKENS has ${#TDS_TDOCS_TOKENS[@]} keys"
    >&2 echo "DEBUG: TDS_COLOR_TOKENS has ${#TDS_COLOR_TOKENS[@]} keys before merge"
fi

for key in "${!TDS_TDOCS_TOKENS[@]}"; do
    TDS_COLOR_TOKENS["$key"]="${TDS_TDOCS_TOKENS[$key]}"
    if [[ "${TDOCS_DEBUG_TOKENS:-0}" == "1" ]] && [[ "$key" == "tdocs.prompt.bracket" ]]; then
        >&2 echo "DEBUG: Merged $key = ${TDS_TDOCS_TOKENS[$key]}"
    fi
done

if [[ "${TDOCS_DEBUG_TOKENS:-0}" == "1" ]]; then
    >&2 echo "DEBUG: TDS_COLOR_TOKENS has ${#TDS_COLOR_TOKENS[@]} keys after merge"
    >&2 echo "DEBUG: TDS_COLOR_TOKENS[tdocs.prompt.bracket] = ${TDS_COLOR_TOKENS[tdocs.prompt.bracket]:-EMPTY}"
fi

# Get TDS color with readline markers for prompts
# Usage: tdocs_prompt_color "token"
# NOTE: Just use tds_text_color directly - readline handles unwrapped codes fine
tdocs_prompt_color() {
    local token="$1"

    # Get color from source array DIRECTLY (bypass TDS_COLOR_TOKENS which gets cleared)
    local color_ref="${TDS_TDOCS_TOKENS[$token]:-}"

    # If RGB format (rgb:R;G;B), use 24-bit color
    if [[ "$color_ref" =~ ^rgb:([0-9]+)\;([0-9]+)\;([0-9]+)$ ]]; then
        local r="${BASH_REMATCH[1]}"
        local g="${BASH_REMATCH[2]}"
        local b="${BASH_REMATCH[3]}"
        printf "\033[38;2;%d;%d;%dm" "$r" "$g" "$b"
        return 0
    fi

    # If it's a 256 color number (all digits), use it
    if [[ "$color_ref" =~ ^[0-9]+$ ]]; then
        printf "\033[38;5;%dm" "$color_ref"
        return 0
    fi

    # Otherwise try TDS resolution
    if declare -f tds_text_color >/dev/null 2>&1; then
        tds_text_color "$token" 2>/dev/null
        return 0
    fi

    # Fallback: return empty (no color)
    printf ""
}

# Get reset color (no readline markers needed)
tdocs_prompt_reset() {
    # Use reset_color directly (works like org)
    if declare -f reset_color >/dev/null 2>&1; then
        reset_color 2>/dev/null
    else
        printf "\033[0m"
    fi
}

# Show TDOCS-specific tokens with their resolved colors
tds_show_tdocs_tokens() {
    echo "TDS TDOCS Token System (Simplified)"
    echo "===================================="
    echo

    echo "Scope Tokens (ENV palette[0] - all same color):"
    for key in tdocs.scope.system tdocs.scope.module tdocs.scope.feature tdocs.scope.temporal; do
        printf "  %-30s " "$key"
        if command -v tds_color_swatch >/dev/null 2>&1; then
            tds_color_swatch "$key"
        fi
        printf " %s → %s\n" "${TDS_COLOR_TOKENS["$key"]}" "$(tds_resolve_color "$key" 2>/dev/null || echo 'N/A')"
        reset_color 2>/dev/null || true
    done
    echo

    echo "Type Tokens (MODE palette[0] - mostly same color):"
    for key in tdocs.type.spec tdocs.type.guide tdocs.type.investigation \
               tdocs.type.reference tdocs.type.plan tdocs.type.summary tdocs.type.scratch \
               tdocs.type.bug-fix tdocs.type.refactor tdocs.type.tdocs; do
        printf "  %-30s " "$key"
        if command -v tds_color_swatch >/dev/null 2>&1; then
            tds_color_swatch "$key"
        fi
        printf " %s → %s\n" "${TDS_COLOR_TOKENS["$key"]}" "$(tds_resolve_color "$key" 2>/dev/null || echo 'N/A')"
        reset_color 2>/dev/null || true
    done
    echo

    echo "Module Token (VERBS palette[0]):"
    printf "  %-30s " "tdocs.module"
    if command -v tds_color_swatch >/dev/null 2>&1; then
        tds_color_swatch "tdocs.module"
    fi
    printf " %s → %s\n" "${TDS_COLOR_TOKENS["tdocs.module"]}" "$(tds_resolve_color "tdocs.module" 2>/dev/null || echo 'N/A')"
    reset_color 2>/dev/null || true
    echo

    echo "Grade Tokens (NOUNS palette[0] - all same color):"
    for key in tdocs.grade.A tdocs.grade.B tdocs.grade.C tdocs.grade.X; do
        printf "  %-30s " "$key"
        if command -v tds_color_swatch >/dev/null 2>&1; then
            tds_color_swatch "$key"
        fi
        printf " %s → %s\n" "${TDS_COLOR_TOKENS["$key"]}" "$(tds_resolve_color "$key" 2>/dev/null || echo 'N/A')"
        reset_color 2>/dev/null || true
    done
    echo

    echo "Lifecycle Tokens (different colors per stage):"
    for key in tdocs.lifecycle.C tdocs.lifecycle.S tdocs.lifecycle.W tdocs.lifecycle.D tdocs.lifecycle.X; do
        printf "  %-30s " "$key"
        if command -v tds_color_swatch >/dev/null 2>&1; then
            tds_color_swatch "$key"
        fi
        printf " %s → %s\n" "${TDS_COLOR_TOKENS["$key"]}" "$(tds_resolve_color "$key" 2>/dev/null || echo 'N/A')"
        reset_color 2>/dev/null || true
    done
    echo

    echo "Completeness Level Tokens:"
    for level in {0..4}; do
        key="tdocs.level.$level"
        printf "  %-30s " "$key"
        if command -v tds_color_swatch >/dev/null 2>&1; then
            tds_color_swatch "$key"
        fi
        printf " %s → %s\n" "${TDS_COLOR_TOKENS["$key"]}" "$(tds_resolve_color "$key" 2>/dev/null || echo 'N/A')"
        reset_color 2>/dev/null || true
    done
    echo
}

# Export functions for use in subshells and REPL
export -f tdocs_prompt_color
export -f tdocs_prompt_reset
export -f tds_show_tdocs_tokens
