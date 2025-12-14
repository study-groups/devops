#!/usr/bin/env bash
# tds_complete.sh - Dynamic multi-layer tab completion for tds command
#
# Noun-first (doctl-style) completion:
#   tds <resource> <action> [args]
#   tds theme list
#   tds token get status.error

# =============================================================================
# COMPLETION DATA
# =============================================================================

# Resources (nouns)
_TDS_RESOURCES="theme palette token hex"

# Tools (top-level commands)
_TDS_TOOLS="doctor repl guide guide-compact help"

# Actions by resource
_TDS_THEME_ACTIONS="list get set create delete copy edit path save validate"
_TDS_PALETTE_ACTIONS="list get set"
_TDS_TOKEN_ACTIONS="list get set validate"

# Palette names
_TDS_PALETTES="env mode verbs nouns"

# =============================================================================
# DYNAMIC HELPERS
# =============================================================================

# List available theme names from registry
_tds_complete_themes() {
    if [[ -n "${TDS_THEME_REGISTRY[*]+x}" ]]; then
        printf '%s\n' "${!TDS_THEME_REGISTRY[@]}"
    else
        local tds_src="${TDS_SRC:-$TETRA_SRC/bash/tds}"
        if [[ -d "$tds_src/themes" ]]; then
            for f in "$tds_src/themes"/*.sh; do
                [[ -f "$f" ]] || continue
                local name=$(basename "$f" .sh)
                [[ "$name" != "theme_registry" ]] && echo "$name"
            done
        fi
    fi
}

# List custom themes only (excludes built-in)
_tds_complete_custom_themes() {
    local tds_src="${TDS_SRC:-$TETRA_SRC/bash/tds}"
    if [[ -d "$tds_src/themes" ]]; then
        for f in "$tds_src/themes"/*.sh; do
            [[ -f "$f" ]] || continue
            local name=$(basename "$f" .sh)
            case "$name" in
                theme_registry|default|warm|cool|neutral|electric|arctic) continue ;;
                *) echo "$name" ;;
            esac
        done
    fi
}

# List token categories (top-level before the dot)
_tds_complete_token_categories() {
    echo "status"
    echo "action"
    echo "text"
    echo "env"
    echo "structural"
    echo "interactive"
    echo "content"
    echo "marker"
}

# List tokens in a category
_tds_complete_tokens_in_category() {
    local category="$1"

    # Get tokens from TDS_COLOR_TOKENS array if available
    if [[ -n "${TDS_COLOR_TOKENS[*]+x}" ]]; then
        for key in "${!TDS_COLOR_TOKENS[@]}"; do
            if [[ "$key" == "$category."* ]]; then
                echo "$key"
            fi
        done
    else
        # Fallback: common tokens by category
        case "$category" in
            status)
                echo "status.error" "status.warning" "status.success" "status.info"
                echo "status.error.dim" "status.warning.dim" "status.success.dim" "status.info.dim"
                ;;
            action)
                echo "action.primary" "action.secondary" "action.destructive" "action.constructive"
                echo "action.accent" "action.highlight" "action.focus" "action.muted"
                ;;
            text)
                echo "text.darkest" "text.dark" "text.dim" "text.muted"
                echo "text.subtle" "text.light" "text.pale" "text.brightest"
                echo "text.primary" "text.secondary" "text.tertiary"
                ;;
            env)
                echo "env.a.primary" "env.b.primary" "env.a.light" "env.b.light"
                echo "env.a.muted" "env.b.muted" "env.a.dim" "env.b.dim"
                ;;
            structural)
                echo "structural.primary" "structural.secondary" "structural.accent"
                echo "structural.muted" "structural.separator"
                echo "structural.bg.primary" "structural.bg.secondary" "structural.bg.tertiary"
                ;;
            interactive)
                echo "interactive.link" "interactive.active" "interactive.hover"
                echo "interactive.focus" "interactive.selected" "interactive.disabled"
                ;;
            content)
                echo "content.heading.h1" "content.heading.h2" "content.heading.h3" "content.heading.h4"
                echo "content.code.inline" "content.code.block"
                echo "content.quote" "content.list" "content.link" "content.hr"
                echo "content.emphasis.bold" "content.emphasis.italic"
                ;;
            marker)
                echo "marker.primary" "marker.active"
                ;;
        esac
    fi
}

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_tds_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local resource="${COMP_WORDS[1]:-}"
    local action="${COMP_WORDS[2]:-}"

    COMPREPLY=()

    # Word 1: Complete resources and tools
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_TDS_RESOURCES $_TDS_TOOLS" -- "$cur"))
        return
    fi

    # Word 2: Complete actions based on resource
    if [[ $COMP_CWORD -eq 2 ]]; then
        case "$resource" in
            theme)   COMPREPLY=($(compgen -W "$_TDS_THEME_ACTIONS" -- "$cur")) ;;
            palette) COMPREPLY=($(compgen -W "$_TDS_PALETTE_ACTIONS" -- "$cur")) ;;
            token)   COMPREPLY=($(compgen -W "$_TDS_TOKEN_ACTIONS" -- "$cur")) ;;
            # Tools don't have actions
            hex|doctor|repl|guide|guide-compact|help) return ;;
        esac
        return
    fi

    # Word 3+: Complete args based on resource+action
    if [[ $COMP_CWORD -ge 3 ]]; then
        case "$resource $action" in
            # Theme actions
            "theme get"|"theme set"|"theme validate"|"theme edit"|"theme path")
                COMPREPLY=($(compgen -W "$(_tds_complete_themes)" -- "$cur"))
                ;;
            "theme delete")
                COMPREPLY=($(compgen -W "$(_tds_complete_custom_themes)" -- "$cur"))
                ;;
            "theme copy")
                if [[ $COMP_CWORD -eq 3 ]]; then
                    # Source theme
                    COMPREPLY=($(compgen -W "$(_tds_complete_themes)" -- "$cur"))
                fi
                # Word 4 is destination (user types new name)
                ;;

            # Palette actions
            "palette get"|"palette set")
                if [[ $COMP_CWORD -eq 3 ]]; then
                    COMPREPLY=($(compgen -W "$_TDS_PALETTES" -- "$cur"))
                elif [[ $COMP_CWORD -eq 4 ]]; then
                    # Index 0-7
                    COMPREPLY=($(compgen -W "0 1 2 3 4 5 6 7" -- "$cur"))
                fi
                # Word 5 is hex color (user types)
                ;;

            # Token actions
            "token get"|"token set")
                # Dynamic dotted path completion
                if [[ "$cur" == *.* ]]; then
                    # Has dots - could be partial category or full token
                    local prefix="${cur%.*}"
                    local category="${prefix%%.*}"
                    # Complete tokens in this category
                    COMPREPLY=($(compgen -W "$(_tds_complete_tokens_in_category "$category")" -- "$cur"))
                else
                    # No dot yet - complete categories
                    local categories=$(_tds_complete_token_categories)
                    COMPREPLY=($(compgen -W "$categories" -- "$cur"))
                    # Add dot suffix if single match
                    if [[ ${#COMPREPLY[@]} -eq 1 ]]; then
                        COMPREPLY=("${COMPREPLY[0]}.")
                        compopt -o nospace
                    fi
                fi
                ;;
        esac
        return
    fi
}

# Register completion
complete -F _tds_complete tds

# =============================================================================
# EXPORTS
# =============================================================================

export -f _tds_complete
export -f _tds_complete_themes _tds_complete_custom_themes
export -f _tds_complete_token_categories _tds_complete_tokens_in_category
