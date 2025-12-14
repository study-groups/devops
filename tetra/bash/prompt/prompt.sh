# Simple, fast prompt system for tetra
# Environment variables control behavior - no complex state management

# Prompt style: tiny, compact, default, verbose
export TETRA_PROMPT_STYLE="${TETRA_PROMPT_STYLE:-default}"

# Multiline toggle
export TETRA_PROMPT_MULTILINE="${TETRA_PROMPT_MULTILINE:-false}"

# Individual section toggles (empty = auto-detect, "0" = force off, "1" = force on)
export TETRA_PROMPT_GIT="${TETRA_PROMPT_GIT:-}"
export TETRA_PROMPT_PYTHON="${TETRA_PROMPT_PYTHON:-}"
export TETRA_PROMPT_NODE="${TETRA_PROMPT_NODE:-}"
export TETRA_PROMPT_LOGTIME="${TETRA_PROMPT_LOGTIME:-}"
export TETRA_PROMPT_ORG="${TETRA_PROMPT_ORG:-}"
export TETRA_PROMPT_DEPLOY="${TETRA_PROMPT_DEPLOY:-}"

# Colors - defaults (overridden by TDS theme when available)
_C_RESET='\[\e[0m\]'
_C_USER='\[\e[0;38;5;228m\]'      # username (was yellow)
_C_GIT='\[\e[0;38;5;51m\]'        # git branch (was cyan)
_C_PATH='\[\e[0;38;5;250m\]'      # path (was gray, now brighter)
_C_PATH_DIM='\[\e[0;38;5;240m\]'  # dimmed path elements
_C_GREEN='\[\e[0;38;5;46m\]'
_C_PURPLE='\[\e[0;38;5;129m\]'
_C_GRAY='\[\e[0;38;5;240m\]'

# Legacy aliases
_C_YELLOW="$_C_USER"
_C_CYAN="$_C_GIT"
_C_BRIGHT_CYAN="$_C_GIT"

# Convert hex to PS1 256-color escape sequence
_hex_to_ps1() {
    local hex="${1#\#}"
    [[ ${#hex} -ne 6 ]] && { echo '\[\e[0m\]'; return; }

    local r=$((16#${hex:0:2}))
    local g=$((16#${hex:2:2}))
    local b=$((16#${hex:4:2}))

    # Convert to 256-color (6x6x6 cube)
    local c256=$(( 16 + 36*(r/51) + 6*(g/51) + (b/51) ))
    printf '\[\e[0;38;5;%dm\]' "$c256"
}

# Update all prompt colors from TDS theme
_update_prompt_colors() {
    if [[ -n "${ENV_PRIMARY[0]:-}" ]]; then
        # TDS theme available - use palette colors

        # Main prompt colors
        _C_USER=$(_hex_to_ps1 "${ENV_PRIMARY[0]}")         # username: theme primary
        _C_GIT=$(_hex_to_ps1 "${ENV_PRIMARY[1]}")          # git: theme secondary
        _C_PATH=$(_hex_to_ps1 "${NOUNS_PRIMARY[6]:-e4e4e7}") # path: pale/bright
        _C_PATH_DIM=$(_hex_to_ps1 "${NOUNS_PRIMARY[3]:-71717a}") # path dim: muted

        # Deploy context colors
        _C_ORG=$(_hex_to_ps1 "${ENV_PRIMARY[0]}")          # org: theme primary
        _C_TARGET=$(_hex_to_ps1 "${VERBS_PRIMARY[4]}")     # target: accent (cyan)
        _C_ENV=$(_hex_to_ps1 "${MODE_PRIMARY[2]}")         # env: semantic good
        _C_SEP=$(_hex_to_ps1 "${NOUNS_PRIMARY[3]:-666666}")    # separator: muted
        _C_BRACKET=$(_hex_to_ps1 "${NOUNS_PRIMARY[4]:-888888}") # brackets: subtle

        # Status colors
        _C_GRAY=$(_hex_to_ps1 "${NOUNS_PRIMARY[3]:-71717a}")   # general gray
        _C_PURPLE=$(_hex_to_ps1 "${VERBS_PRIMARY[6]:-8E24AA}")  # logtime purple

        # Legacy aliases
        _C_YELLOW="$_C_USER"
        _C_CYAN="$_C_GIT"
        _C_BRIGHT_CYAN="$_C_GIT"
    else
        # Fallback defaults (no TDS theme)
        _C_USER='\[\e[0;38;5;228m\]'
        _C_GIT='\[\e[0;38;5;51m\]'
        _C_PATH='\[\e[0;38;5;250m\]'
        _C_PATH_DIM='\[\e[0;38;5;240m\]'
        _C_ORG='\[\e[0;38;5;51m\]'
        _C_TARGET='\[\e[0;38;5;220m\]'
        _C_ENV='\[\e[0;38;5;82m\]'
        _C_SEP='\[\e[0;38;5;240m\]'
        _C_BRACKET='\[\e[0;38;5;245m\]'
        _C_GRAY='\[\e[0;38;5;240m\]'
        _C_PURPLE='\[\e[0;38;5;129m\]'
        _C_YELLOW="$_C_USER"
        _C_CYAN="$_C_GIT"
        _C_BRIGHT_CYAN="$_C_GIT"
    fi
}

# Legacy alias
_update_deploy_colors() { _update_prompt_colors; }

# Initialize colors
_update_deploy_colors

# Fast section generators - no function calls in main prompt
_tetra_git_info() {
    [[ "$TETRA_PROMPT_GIT" == "0" ]] && return
    [[ "$TETRA_PROMPT_STYLE" == "tiny" ]] && return
    git branch 2>/dev/null | grep "^\* " | colrm 1 2
}

_tetra_python_info() {
    [[ "$TETRA_PROMPT_PYTHON" == "0" ]] && return
    [[ "$TETRA_PROMPT_STYLE" == "tiny" ]] && return
    
    if [[ "$TETRA_PROMPT_PYTHON" == "1" ]] || command -v python >/dev/null 2>&1; then
        # Check if tetra is in the python path/source
        if [[ "$(which python)" == *"tetra"* ]]; then
            echo "p"
        else
            echo "~p"
        fi
    fi
}

_tetra_node_info() {
    [[ "$TETRA_PROMPT_NODE" == "0" ]] && return
    [[ "$TETRA_PROMPT_STYLE" == "tiny" ]] && return
    
    if [[ "$TETRA_PROMPT_NODE" == "1" ]] || command -v node >/dev/null 2>&1; then
        # Check if tetra is in the node path/source
        if [[ "$(which node)" == *"tetra"* ]]; then
            echo "n"
        else
            echo "~n"
        fi
    fi
}

_tetra_logtime_info() {
    [[ "$TETRA_PROMPT_LOGTIME" == "0" ]] && return
    [[ "$TETRA_PROMPT_STYLE" == "tiny" ]] && return
    [[ "$TETRA_PROMPT_LOGTIME" == "1" ]] || command -v _logtime-elapsed-hms >/dev/null 2>&1 && _logtime-elapsed-hms
}

_tetra_org_info() {
    [[ "$TETRA_PROMPT_ORG" == "0" ]] && return
    [[ "$TETRA_PROMPT_STYLE" == "tiny" ]] && return

    if [[ "$TETRA_PROMPT_ORG" == "1" ]] && command -v org_active >/dev/null 2>&1; then
        local org
        org=$(org_active 2>/dev/null)
        [[ -n "$org" && "$org" != "none" ]] && echo "$org"
    fi
}

_tetra_deploy_ctx_info() {
    [[ "$TETRA_PROMPT_DEPLOY" == "0" ]] && return
    [[ "$TETRA_PROMPT_STYLE" == "tiny" ]] && return

    # Use deploy's info function if available
    if command -v _tetra_deploy_info >/dev/null 2>&1; then
        _tetra_deploy_info
    fi
}

# Build unified context line: [org:target:env] with distinct colors
# Always shows all three parts when any context is set
_tetra_context_line() {
    [[ "$TETRA_PROMPT_STYLE" == "tiny" ]] && return

    # Get deploy context (all three from DEPLOY_CTX_*)
    local org="${DEPLOY_CTX_ORG:-}"
    local target="${DEPLOY_CTX_TARGET:-}"
    local env="${DEPLOY_CTX_ENV:-}"

    # Nothing to show
    [[ -z "$org" && -z "$target" && -z "$env" ]] && return

    # Build colored context string: [org:target:env]
    local ctx=""
    ctx+="${_C_BRACKET}[${_C_RESET}"

    # Org part
    if [[ -n "$org" ]]; then
        ctx+="${_C_ORG}${org}${_C_RESET}"
    else
        ctx+="${_C_SEP}?${_C_RESET}"
    fi

    ctx+="${_C_SEP}:${_C_RESET}"

    # Target part
    if [[ -n "$target" ]]; then
        ctx+="${_C_TARGET}${target}${_C_RESET}"
    else
        ctx+="${_C_SEP}?${_C_RESET}"
    fi

    ctx+="${_C_SEP}:${_C_RESET}"

    # Env part
    if [[ -n "$env" ]]; then
        ctx+="${_C_ENV}${env}${_C_RESET}"
    else
        ctx+="${_C_SEP}?${_C_RESET}"
    fi

    ctx+="${_C_BRACKET}]${_C_RESET}"
    echo "$ctx"
}

# Main prompt function - optimized for speed
tetra_prompt() {
    # Update all colors from TDS theme (if theme changed)
    _update_prompt_colors

    local info=""
    local git_branch python_status node_status logtime_info

    case "$TETRA_PROMPT_STYLE" in
        tiny)
            PS1="${_C_USER}\u${_C_RESET}@\h: "
            return
            ;;
        compact)
            git_branch="$(_tetra_git_info)"
            local git_info=""
            [[ -n "$git_branch" ]] && git_info="${_C_GIT}($git_branch)${_C_RESET}"
            PS1="${_C_RESET}${_C_USER}\u${_C_RESET}@\h:[\W]${git_info}: "
            ;;
        verbose)
            git_branch="$(_tetra_git_info)"
            python_status="$(_tetra_python_info)"
            node_status="$(_tetra_node_info)"
            logtime_info="$(_tetra_logtime_info)"
            local context_line="$(_tetra_context_line)"

            # Collect all status indicators
            local status_indicators=()
            [[ -n "$python_status" ]] && status_indicators+=("$python_status")
            [[ -n "$node_status" ]] && status_indicators+=("$node_status")

            # Join indicators with commas in single bracket
            if [[ ${#status_indicators[@]} -gt 0 ]]; then
                local joined_status
                local old_ifs="$IFS"
                IFS=',' joined_status="${status_indicators[*]}"
                IFS="$old_ifs"
                info+="${_C_PATH_DIM}($joined_status)${_C_RESET}"
            fi

            [[ -n "$logtime_info" ]] && info+="${_C_PURPLE}[$logtime_info]${_C_RESET}"

            local git_info=""
            [[ -n "$git_branch" ]] && git_info=" ${_C_GIT}($git_branch)${_C_RESET}"

            # Two-line prompt: context + path on top, user@host on bottom
            if [[ -n "$context_line" ]]; then
                PS1="${context_line} ${_C_PATH}\w${_C_RESET}${git_info}\n${info}${_C_USER}\u${_C_RESET}@\h: "
            else
                PS1="${_C_PATH}\w${_C_RESET}${git_info}\n${info}${_C_USER}\u${_C_RESET}@\h: "
            fi
            ;;
        *)  # default
            git_branch="$(_tetra_git_info)"
            python_status="$(_tetra_python_info)"
            node_status="$(_tetra_node_info)"
            local context_line="$(_tetra_context_line)"

            # Collect all status indicators
            local status_indicators=()
            [[ -n "$python_status" ]] && status_indicators+=("$python_status")
            [[ -n "$node_status" ]] && status_indicators+=("$node_status")

            # Join indicators with commas in single bracket
            if [[ ${#status_indicators[@]} -gt 0 ]]; then
                local joined_status
                local old_ifs="$IFS"
                IFS=',' joined_status="${status_indicators[*]}"
                IFS="$old_ifs"
                info+="${_C_PATH_DIM}($joined_status)${_C_RESET}"
            fi

            local git_info=""
            [[ -n "$git_branch" ]] && git_info=" ${_C_GIT}($git_branch)${_C_RESET}"

            # Two-line prompt when context is set
            if [[ -n "$context_line" ]]; then
                PS1="${context_line} ${_C_PATH}\W${_C_RESET}${git_info}\n${info}${_C_USER}\u${_C_RESET}@\h: "
            else
                # Single line when no context
                PS1="${info}${_C_USER}\u${_C_RESET}@\h:[\W]${git_info}: "
            fi
            ;;
    esac
}

# Internal control functions
_tetra_prompt_style() {
    case "$1" in
        tiny|compact|default|verbose)
            export TETRA_PROMPT_STYLE="$1"
            ;;
        *)
            echo "Usage: tp style {tiny|compact|default|verbose}"
            echo "Current: $TETRA_PROMPT_STYLE"
            ;;
    esac
}

_tetra_prompt_multiline() {
    case "$1" in
        on|true|1) export TETRA_PROMPT_MULTILINE="true" ;;
        off|false|0) export TETRA_PROMPT_MULTILINE="false" ;;
        *) 
            if [[ "$TETRA_PROMPT_MULTILINE" == "true" ]]; then
                export TETRA_PROMPT_MULTILINE="false"
            else
                export TETRA_PROMPT_MULTILINE="true"
            fi
            ;;
    esac
}

_tetra_prompt_toggle() {
    local section="$1"
    local state="$2"

    case "$section" in
        git|python|node|logtime|org|deploy)
            local var_name="TETRA_PROMPT_${section^^}"
            case "$state" in
                on|1) export "$var_name"="1" ;;
                off|0) export "$var_name"="0" ;;
                auto|"") export "$var_name"="" ;;
                *)
                    local current_val
                    current_val=$(eval echo "\$$var_name")
                    if [[ "$current_val" == "0" ]]; then
                        export "$var_name"=""
                    else
                        export "$var_name"="0"
                    fi
                    ;;
            esac
            ;;
        *)
            echo "Usage: tp toggle {git|python|node|logtime|org|deploy} [on|off|auto]"
            ;;
    esac
}

_tetra_prompt_status() {
    echo "Prompt Style: $TETRA_PROMPT_STYLE"
    echo "Multiline: $TETRA_PROMPT_MULTILINE"
    echo "Git: ${TETRA_PROMPT_GIT:-auto}"
    echo "Python: ${TETRA_PROMPT_PYTHON:-auto}"
    echo "Node: ${TETRA_PROMPT_NODE:-auto}"
    echo "Logtime: ${TETRA_PROMPT_LOGTIME:-auto}"
    echo "Org: ${TETRA_PROMPT_ORG:-auto}"
    echo "Deploy: ${TETRA_PROMPT_DEPLOY:-auto}"
}

# Show prompt color mapping with live theme colors
_tetra_prompt_colors() {
    local theme="${TDS_ACTIVE_THEME:-default}"

    # Helper to print colored swatch
    _swatch() {
        local hex="${1#\#}"
        [[ ${#hex} -ne 6 ]] && { printf "      "; return; }
        local r=$((16#${hex:0:2}))
        local g=$((16#${hex:2:2}))
        local b=$((16#${hex:4:2}))
        local c256=$(( 16 + 36*(r/51) + 6*(g/51) + (b/51) ))
        printf "\e[48;5;%dm  \e[0m \e[38;5;%dm%s\e[0m" "$c256" "$c256" "$hex"
    }

    echo
    printf "  \e[1mPrompt Colors\e[0m (theme: %s)\n" "$theme"
    echo
    printf "  %-12s %-18s %s\n" "Element" "Source" "Color"
    printf "  %s\n" "─────────────────────────────────────────────"

    printf "  %-12s %-18s " "Username" "ENV_PRIMARY[0]"
    _swatch "${ENV_PRIMARY[0]:-}"
    echo

    printf "  %-12s %-18s " "Git branch" "ENV_PRIMARY[1]"
    _swatch "${ENV_PRIMARY[1]:-}"
    echo

    printf "  %-12s %-18s " "Path" "NOUNS_PRIMARY[6]"
    _swatch "${NOUNS_PRIMARY[6]:-}"
    echo

    printf "  %-12s %-18s " "Status/dim" "NOUNS_PRIMARY[3]"
    _swatch "${NOUNS_PRIMARY[3]:-}"
    echo

    printf "  %-12s %-18s " "Deploy env" "MODE_PRIMARY[2]"
    _swatch "${MODE_PRIMARY[2]:-}"
    echo

    printf "  %-12s %-18s " "Separator" "NOUNS_PRIMARY[3]"
    _swatch "${NOUNS_PRIMARY[3]:-}"
    echo

    printf "  %-12s %-18s " "Logtime" "VERBS_PRIMARY[6]"
    _swatch "${VERBS_PRIMARY[6]:-}"
    echo
    echo
}

# Command dispatcher
tp() {
    case "$1" in
        style|s)
            shift
            _tetra_prompt_style "$@"
            ;;
        multiline|ml|m)
            shift
            _tetra_prompt_multiline "$@"
            ;;
        toggle|t)
            shift
            _tetra_prompt_toggle "$@"
            ;;
        status|st)
            _tetra_prompt_status
            ;;
        colors|c)
            _tetra_prompt_colors
            ;;
        help|h|"")
            cat <<EOF
tp - Tetra Prompt Control

Usage:
  tp style {tiny|compact|default|verbose}  - Set prompt style
  tp multiline [on|off]                    - Toggle multiline prompt
  tp toggle {git|python|node|...} [on|off] - Toggle sections
  tp colors                                - Show theme color mapping
  tp status                                - Show current settings

Shortcuts: tp s, tp m, tp t, tp c, tp st

Deploy context shown as [org:target:env] when set.
EOF
            ;;
        *)
            echo "Unknown command: $1"
            echo "Use 'tp help' for usage"
            ;;
    esac
}

PROMPT_COMMAND="tetra_prompt"
