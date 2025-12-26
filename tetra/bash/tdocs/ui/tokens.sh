#!/usr/bin/env bash

# TDOCS Token System
# Unified color tokens and semantic color functions
# Consolidates: colors.sh + tdocs_tokens.sh

# ============================================================================
# TOKEN DEFINITIONS
# ============================================================================

# TDOCS-specific color tokens map semantic elements to palette references
# NOTE: Simplified single-color-per-category design
declare -gA TDS_TDOCS_TOKENS=(
    # Scope tokens (ENV palette[0] - green) - Application reach
    [tdocs.scope]="env:0"
    [tdocs.scope.system]="env:0"
    [tdocs.scope.module]="env:0"
    [tdocs.scope.feature]="env:0"
    [tdocs.scope.temporal]="env:0"

    # Type tokens (MODE palette[0] - blue) - Document type
    [tdocs.type]="mode:0"
    [tdocs.type.spec]="mode:0"
    [tdocs.type.guide]="mode:0"
    [tdocs.type.investigation]="mode:0"
    [tdocs.type.reference]="mode:0"
    [tdocs.type.plan]="mode:0"
    [tdocs.type.summary]="mode:0"
    [tdocs.type.scratch]="mode:0"
    [tdocs.type.bug-fix]="verbs:0"
    [tdocs.type.refactor]="verbs:3"
    [tdocs.type.tdocs]="mode:0"

    # Module tokens (VERBS palette[0] - red/orange)
    [tdocs.module]="verbs:0"

    # Grade tokens (NOUNS palette[0] - purple)
    [tdocs.grade]="nouns:0"
    [tdocs.grade.A]="nouns:0"
    [tdocs.grade.B]="nouns:0"
    [tdocs.grade.C]="nouns:0"
    [tdocs.grade.X]="nouns:0"

    # Lifecycle tokens
    [tdocs.lifecycle.C]="nouns:0"
    [tdocs.lifecycle.S]="mode:0"
    [tdocs.lifecycle.W]="verbs:3"
    [tdocs.lifecycle.D]="env:6"
    [tdocs.lifecycle.X]="verbs:0"

    # List display tokens
    [tdocs.list.path]="mode:7"
    [tdocs.list.count]="mode:6"
    [tdocs.list.separator]="env:6"

    # Completeness level tokens (L0-L4)
    [tdocs.level.0]="verbs:0"
    [tdocs.level.1]="verbs:3"
    [tdocs.level.2]="env:2"
    [tdocs.level.3]="mode:0"
    [tdocs.level.4]="env:1"

    # REPL prompt tokens (256 colors)
    [tdocs.prompt.bracket]="118"
    [tdocs.prompt.paren]="244"
    [tdocs.prompt.arrow]="170"
    [tdocs.prompt.arrow.pipe]="118"
    [tdocs.prompt.separator]="118"
    [tdocs.prompt.label]="118"
    [tdocs.prompt.count]="170"
    [tdocs.prompt.filter.all]="214"
    [tdocs.prompt.filter.core]="214"
    [tdocs.prompt.filter.other]="214"
    [tdocs.prompt.module]="244"
    [tdocs.prompt.topic1]="118"
    [tdocs.prompt.topic2]="214"
    [tdocs.prompt.level]="226"
    [tdocs.prompt.temporal]="226"
    [tdocs.prompt.state]="170"

    # Help/info tokens
    [tdocs.help.header]="content.heading.h2"
    [tdocs.help.command]="content.code.inline"
    [tdocs.help.description]="text.secondary"

    # Command category tokens (for hierarchical completion)
    [tdocs.cmd.doc]="env:0"         # Document ops (green)
    [tdocs.cmd.find]="mode:0"       # Query ops (blue)
    [tdocs.cmd.scan]="verbs:3"      # Discovery/audit (orange)
    [tdocs.cmd.mod]="nouns:0"       # Module docs (purple)
    [tdocs.cmd.chuck]="verbs:0"     # LLM capture (red)
    [tdocs.cmd.pub]="mode:6"        # Publishing (cyan)
    [tdocs.cmd.ui]="env:2"          # Interface (green)
)

# Merge TDOCS tokens into main TDS token map
if [[ -z "${TDS_COLOR_TOKENS+x}" ]]; then
    declare -gA TDS_COLOR_TOKENS
fi

for key in "${!TDS_TDOCS_TOKENS[@]}"; do
    TDS_COLOR_TOKENS["$key"]="${TDS_TDOCS_TOKENS[$key]}"
done

# ============================================================================
# PROMPT COLOR FUNCTIONS
# ============================================================================

# Get TDS color for prompts
tdocs_prompt_color() {
    local token="$1"
    local color_ref="${TDS_TDOCS_TOKENS[$token]:-}"

    # RGB format
    if [[ "$color_ref" =~ ^rgb:([0-9]+)\;([0-9]+)\;([0-9]+)$ ]]; then
        printf "\033[38;2;%d;%d;%dm" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]}"
        return 0
    fi

    # 256 color number
    if [[ "$color_ref" =~ ^[0-9]+$ ]]; then
        printf "\033[38;5;%dm" "$color_ref"
        return 0
    fi

    # TDS resolution fallback
    if declare -f tds_text_color >/dev/null 2>&1; then
        tds_text_color "$token" 2>/dev/null
        return 0
    fi

    printf ""
}

# Reset color
tdocs_prompt_reset() {
    if declare -f reset_color >/dev/null 2>&1; then
        reset_color 2>/dev/null
    else
        printf "\033[0m"
    fi
}

# ============================================================================
# SEMANTIC COLOR FUNCTIONS
# ============================================================================

# Category colors
tdocs_color_category() {
    local category="$1"
    if ! command -v tds_text_color >/dev/null 2>&1; then
        return 0
    fi
    case "$category" in
        core)  tds_text_color "info" ;;
        other) tds_text_color "muted" ;;
        *)     tds_text_color "muted" ;;
    esac
}

# Status colors
tdocs_color_status() {
    local status="$1"
    if ! command -v tds_text_color >/dev/null 2>&1; then
        return 0
    fi
    case "$status" in
        draft)      tds_text_color "warning" ;;
        stable)     tds_text_color "success" ;;
        deprecated) tds_text_color "error" ;;
        *)          tds_text_color "muted" ;;
    esac
}

# Evidence weight colors
tdocs_color_evidence() {
    local weight="$1"
    if ! command -v tds_text_color >/dev/null 2>&1; then
        return 0
    fi
    case "$weight" in
        primary)   tds_text_color "success" ;;
        secondary) tds_text_color "info" ;;
        tertiary)  tds_text_color "muted" ;;
        *)         tds_text_color "muted" ;;
    esac
}

# Document type colors
tdocs_color_type() {
    local type="$1"
    if ! command -v tds_text_color >/dev/null 2>&1; then
        return 0
    fi
    case "$type" in
        spec|guide|reference)
            tds_text_color "info" ;;
        bug-fix|refactor)
            tds_text_color "warning" ;;
        *)
            tds_text_color "muted" ;;
    esac
}

# Reset color (alias for compatibility)
tdocs_reset_color() {
    tdocs_prompt_reset
}

# Render a colored badge
tdocs_render_badge() {
    local text="$1"
    local color_type="$2"
    local value="$3"
    local color_func="tdocs_color_${color_type}"

    if command -v "$color_func" >/dev/null 2>&1; then
        local color=$("$color_func" "$value")
        echo "${color}${text}$(tdocs_reset_color)"
    else
        echo "$text"
    fi
}

# ============================================================================
# TOKEN DISPLAY
# ============================================================================

# Show TDOCS tokens with resolved colors
tdocs_show_tokens() {
    echo "TDOCS Token System"
    echo "=================="
    echo

    local categories=(
        "Lifecycle:tdocs.lifecycle.C tdocs.lifecycle.S tdocs.lifecycle.W tdocs.lifecycle.D tdocs.lifecycle.X"
        "Type:tdocs.type.spec tdocs.type.guide tdocs.type.reference tdocs.type.bug-fix tdocs.type.refactor"
        "Level:tdocs.level.0 tdocs.level.1 tdocs.level.2 tdocs.level.3 tdocs.level.4"
    )

    for cat_line in "${categories[@]}"; do
        local cat_name="${cat_line%%:*}"
        local cat_tokens="${cat_line#*:}"
        echo "$cat_name Tokens:"
        for token in $cat_tokens; do
            printf "  %-30s " "$token"
            local ref="${TDS_TDOCS_TOKENS[$token]:-N/A}"
            printf "%s\n" "$ref"
        done
        echo
    done
}

# ============================================================================
# EXPORTS
# ============================================================================

export -f tdocs_prompt_color
export -f tdocs_prompt_reset
export -f tdocs_color_category
export -f tdocs_color_status
export -f tdocs_color_evidence
export -f tdocs_color_type
export -f tdocs_reset_color
export -f tdocs_render_badge
export -f tdocs_show_tokens
