#!/usr/bin/env bash
# chroma_complete.sh - Tab completion for chroma command
#
# Provides dynamic completion for:
#   - chroma subcommands
#   - parser names (discovered from parsers/*.sh)
#   - theme names (discovered from tds/themes/*.sh)
#   - format flags and options
#   - file completion for supported types

# =============================================================================
# COMPLETION DATA
# =============================================================================

# All chroma subcommands
_CHROMA_COMMANDS="cst doctor hooks parser plugins status reload table help"

# Help topics
_CHROMA_HELP_TOPICS="render parser format doctor options plugins hooks"

# Format flags (shortcuts)
_CHROMA_FORMATS="--toml --json --md --markdown --claude --ansi"

# Options
_CHROMA_OPTIONS="-p --pager -n --no-pager -w --width -m --margin -t --theme -f --format --preset --rule --list-rules --clear-rules -h --help"

# Parser subcommands
_CHROMA_PARSER_COMMANDS="list info reload"

# Doctor options
_CHROMA_DOCTOR_OPTIONS="-v --verbose --check --fix"

# =============================================================================
# DYNAMIC HELPER FUNCTIONS
# =============================================================================

# List registered parser names (scan parsers directory)
_chroma_complete_parsers() {
    # Try registry first
    if [[ -n "${CHROMA_PARSER_ORDER[*]+x}" ]]; then
        printf '%s\n' "${CHROMA_PARSER_ORDER[@]}"
        return
    fi

    # Scan parsers directory
    local chroma_src="${CHROMA_SRC:-$TETRA_SRC/bash/chroma}"
    if [[ -d "$chroma_src/parsers" ]]; then
        for f in "$chroma_src/parsers"/*.sh; do
            [[ -f "$f" ]] || continue
            basename "$f" .sh
        done
    fi
}

# List available themes (scan tds/themes directory)
_chroma_complete_themes() {
    # Try registry first
    if [[ -n "${TDS_THEME_REGISTRY[*]+x}" ]]; then
        printf '%s\n' "${!TDS_THEME_REGISTRY[@]}"
        return
    fi

    # Scan themes directory
    local tds_src="${TDS_SRC:-$TETRA_SRC/bash/tds}"
    if [[ -d "$tds_src/themes" ]]; then
        for f in "$tds_src/themes"/*.sh; do
            [[ -f "$f" ]] || continue
            local name=$(basename "$f" .sh)
            # Skip registry file
            [[ "$name" != "theme_registry" ]] && echo "$name"
        done
    fi
}

# List available presets (scan config or use defaults)
_chroma_complete_presets() {
    # Check for preset config
    local chroma_src="${CHROMA_SRC:-$TETRA_SRC/bash/chroma}"
    if [[ -f "$chroma_src/presets.conf" ]]; then
        grep -oE '^[a-z_]+=' "$chroma_src/presets.conf" 2>/dev/null | tr -d '='
        return
    fi

    # Default presets
    echo "markers"
    echo "bookmarks"
    echo "sections"
    echo "headers"
    echo "all"
}

# List doctor check names (discover from doctor.sh or fallback)
_chroma_complete_checks() {
    local chroma_src="${CHROMA_SRC:-$TETRA_SRC/bash/chroma}"

    # Try to extract check names from doctor.sh
    if [[ -f "$chroma_src/doctor.sh" ]]; then
        # Look for function names like _chroma_doctor_check_*
        grep -oE '_chroma_doctor_check_[a-z_]+' "$chroma_src/doctor.sh" 2>/dev/null | \
            sed 's/_chroma_doctor_check_//' | sort -u
        return
    fi

    # Fallback checks
    echo "dependencies"
    echo "tds"
    echo "parsers"
    echo "themes"
    echo "tokens"
    echo "plugins"
}

# List available plugins
_chroma_complete_plugins() {
    local chroma_src="${CHROMA_SRC:-$TETRA_SRC/bash/chroma}"
    if [[ -d "$chroma_src/plugins" ]]; then
        for f in "$chroma_src/plugins"/*.plugin.sh; do
            [[ -f "$f" ]] || continue
            basename "$f" .plugin.sh
        done
    fi
}

# List available hook points (from CHROMA_HOOK_POINTS or scan plugins.sh)
_chroma_complete_hooks() {
    # Try registry first
    if [[ -n "${CHROMA_HOOK_POINTS[*]+x}" ]]; then
        printf '%s\n' "${CHROMA_HOOK_POINTS[@]}"
        return
    fi

    # Fallback: scan plugins.sh for hook points
    local chroma_src="${CHROMA_SRC:-$TETRA_SRC/bash/chroma}"
    if [[ -f "$chroma_src/core/plugins.sh" ]]; then
        grep -oE '"[a-z_]+"' "$chroma_src/core/plugins.sh" 2>/dev/null | \
            tr -d '"' | grep -E '^(pre_|post_|render_|transform_)' | sort -u
        return
    fi

    # Hardcoded fallback
    echo "pre_render"
    echo "post_render"
    echo "pre_line"
    echo "post_line"
    echo "transform_content"
    echo "render_heading"
    echo "render_code"
    echo "render_quote"
    echo "render_list"
    echo "render_table"
    echo "render_hr"
}

# List supported file extensions
_chroma_supported_extensions() {
    echo "md"
    echo "markdown"
    echo "toml"
    echo "json"
    echo "tex"
    echo "claude"
}

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_chroma_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # First argument - could be subcommand, option, or file
    if [[ $COMP_CWORD -eq 1 ]]; then
        if [[ "$cur" == -* ]]; then
            # Option
            COMPREPLY=($(compgen -W "$_CHROMA_OPTIONS $_CHROMA_FORMATS" -- "$cur"))
        elif [[ "$cur" == . || "$cur" == ./* || "$cur" == /* || "$cur" == ~/* ]]; then
            # Explicit path - show all files and directories for navigation
            COMPREPLY=($(compgen -f -- "$cur"))
            compopt -o filenames 2>/dev/null
        else
            # Subcommand or file
            COMPREPLY=($(compgen -W "$_CHROMA_COMMANDS" -- "$cur"))
            # Also complete files (md, toml, json)
            COMPREPLY+=($(compgen -f -X '!*.@(md|toml|json|markdown|tex|claude)' -- "$cur"))
            compopt -o filenames 2>/dev/null
        fi
        return
    fi

    # Handle based on previous word
    case "$prev" in
        # Theme completion
        -t|--theme)
            COMPREPLY=($(compgen -W "$(_chroma_complete_themes)" -- "$cur"))
            return
            ;;

        # Width - suggest common values
        -w|--width)
            COMPREPLY=($(compgen -W "80 100 120 140 160" -- "$cur"))
            return
            ;;

        # Margin - suggest common values
        -m|--margin)
            COMPREPLY=($(compgen -W "0 2 4 8" -- "$cur"))
            return
            ;;

        # Format completion (parser name)
        -f|--format)
            COMPREPLY=($(compgen -W "$(_chroma_complete_parsers) auto" -- "$cur"))
            return
            ;;

        # Preset completion
        --preset)
            COMPREPLY=($(compgen -W "$(_chroma_complete_presets)" -- "$cur"))
            return
            ;;

        # Rule - no completion (expects sed pattern)
        --rule)
            return
            ;;

        # Doctor --check completion
        --check)
            COMPREPLY=($(compgen -W "$(_chroma_complete_checks)" -- "$cur"))
            return
            ;;
    esac

    # Handle subcommand arguments
    case "$cmd" in
        # Parser subcommand
        parser|parsers)
            if [[ $COMP_CWORD -eq 2 ]]; then
                # Second word: parser subcommand
                COMPREPLY=($(compgen -W "$_CHROMA_PARSER_COMMANDS" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                local subcmd="${COMP_WORDS[2]}"
                case "$subcmd" in
                    info)
                        # Third word after "parser info": parser name
                        COMPREPLY=($(compgen -W "$(_chroma_complete_parsers)" -- "$cur"))
                        ;;
                esac
            fi
            return
            ;;

        # Doctor subcommand
        doctor)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "$_CHROMA_DOCTOR_OPTIONS" -- "$cur"))
            else
                # After flags, offer check names
                COMPREPLY=($(compgen -W "$(_chroma_complete_checks)" -- "$cur"))
            fi
            return
            ;;

        # CST (Chroma Style Table) takes theme or options
        cst)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--compact --full --export" -- "$cur"))
            else
                COMPREPLY=($(compgen -W "$(_chroma_complete_themes)" -- "$cur"))
            fi
            return
            ;;

        # Table subcommand
        table)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "--style --border --no-header" -- "$cur"))
            fi
            return
            ;;

        # Help subcommand - complete topics
        help)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "$_CHROMA_HELP_TOPICS" -- "$cur"))
            fi
            return
            ;;

        # Hooks subcommand
        hooks)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "list info" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                local subcmd="${COMP_WORDS[2]}"
                case "$subcmd" in
                    info)
                        COMPREPLY=($(compgen -W "$(_chroma_complete_hooks)" -- "$cur"))
                        ;;
                esac
            fi
            return
            ;;

        # Plugins subcommand
        plugins)
            if [[ $COMP_CWORD -eq 2 ]]; then
                COMPREPLY=($(compgen -W "list info load" -- "$cur"))
            elif [[ $COMP_CWORD -eq 3 ]]; then
                local subcmd="${COMP_WORDS[2]}"
                case "$subcmd" in
                    info)
                        COMPREPLY=($(compgen -W "$(_chroma_complete_plugins)" -- "$cur"))
                        ;;
                esac
            fi
            return
            ;;

        # Status/reload - no additional completion
        status|reload)
            return
            ;;
    esac

    # Default: options or file completion
    if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "$_CHROMA_OPTIONS $_CHROMA_FORMATS" -- "$cur"))
    elif [[ "$cur" == . || "$cur" == ./* || "$cur" == /* || "$cur" == ~/* ]]; then
        # Explicit path - show all files and directories for navigation
        COMPREPLY=($(compgen -f -- "$cur"))
        compopt -o filenames 2>/dev/null
    else
        # File completion for supported formats
        COMPREPLY=($(compgen -f -X '!*.@(md|toml|json|markdown|tex|claude)' -- "$cur"))
        compopt -o filenames 2>/dev/null
    fi
}

# =============================================================================
# REGISTER COMPLETION
# =============================================================================

complete -F _chroma_complete chroma

# Completion functions are local - no exports (TETRA convention)
