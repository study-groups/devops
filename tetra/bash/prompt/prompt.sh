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

# Colors
_C_RESET='\[\e[0m\]'
_C_YELLOW='\[\e[0;38;5;228m\]'
_C_CYAN='\[\e[0;38;5;51m\]'
_C_GREEN='\[\e[0;38;5;46m\]'
_C_PURPLE='\[\e[0;38;5;129m\]'
_C_GRAY='\[\e[0;38;5;240m\]'

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

# Main prompt function - optimized for speed
tetra_prompt() {
    local info=""
    local git_branch python_status node_status logtime_info
    
    case "$TETRA_PROMPT_STYLE" in
        tiny)
            PS1="${_C_YELLOW}\u${_C_RESET}@\h: "
            return
            ;;
        compact)
            git_branch="$(_tetra_git_info)"
            local git_info=""
            [[ -n "$git_branch" ]] && git_info="${_C_CYAN}($git_branch)${_C_RESET}"
            PS1="${_C_RESET}${_C_YELLOW}\u${_C_RESET}@\h:[\W]${git_info}: "
            ;;
        verbose)
            git_branch="$(_tetra_git_info)"
            python_status="$(_tetra_python_info)"
            node_status="$(_tetra_node_info)"
            logtime_info="$(_tetra_logtime_info)"
            
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
                info+="${_C_GRAY}($joined_status)${_C_RESET}"
            fi
            
            [[ -n "$logtime_info" ]] && info+="${_C_PURPLE}[$logtime_info]${_C_RESET}"
            
            local git_info=""
            [[ -n "$git_branch" ]] && git_info="${_C_CYAN}($git_branch)${_C_RESET}"
            
            if [[ "$TETRA_PROMPT_MULTILINE" == "true" ]]; then
                PS1="${_C_GRAY}[\w]${git_info}${_C_RESET}\n${_C_RESET}${info}${_C_YELLOW}\u${_C_RESET}@\h: "
            else
                PS1="${_C_RESET}${info}${_C_YELLOW}\u${_C_RESET}@\h:[\w]${git_info}: "
            fi
            ;;
        *)  # default
            git_branch="$(_tetra_git_info)"
            python_status="$(_tetra_python_info)"
            node_status="$(_tetra_node_info)"
            
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
                info+="${_C_GRAY}($joined_status)${_C_RESET}"
            fi
            
            local git_info=""
            [[ -n "$git_branch" ]] && git_info="${_C_CYAN}($git_branch)${_C_RESET}"
            
            if [[ "$TETRA_PROMPT_MULTILINE" == "true" ]]; then
                PS1="${_C_GRAY}[\w]${git_info}${_C_RESET}\n${_C_RESET}${info}${_C_YELLOW}\u${_C_RESET}@\h: "
            else
                PS1="${_C_RESET}${info}${_C_YELLOW}\u${_C_RESET}@\h:[\W]${git_info}: "
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
        git|python|node|logtime)
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
            echo "Usage: tp toggle {git|python|node|logtime} [on|off|auto]"
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
        help|h|"")
            cat <<EOF
tp - Tetra Prompt Control

Usage:
  tp style {tiny|compact|default|verbose}  - Set prompt style
  tp multiline [on|off]                    - Toggle multiline prompt
  tp toggle {git|python|node|logtime} [on|off|auto] - Toggle sections
  tp status                                - Show current settings

Shortcuts:
  tp s {style}     - Set style
  tp m [on|off]    - Multiline
  tp t {section}   - Toggle section
  tp st            - Status
EOF
            ;;
        *)
            echo "Unknown command: $1"
            echo "Use 'tp help' for usage"
            ;;
    esac
}

PROMPT_COMMAND="tetra_prompt"
