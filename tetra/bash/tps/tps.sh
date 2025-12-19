#!/usr/bin/env bash
# tps.sh - Tetra Prompt System
# Main module with PROMPT_COMMAND dispatcher and tps command

# =============================================================================
# CONFIGURATION
# =============================================================================

export TPS_STYLE="${TPS_STYLE:-default}"
export TPS_MULTILINE="${TPS_MULTILINE:-false}"

# Section toggles (empty=auto, "0"=off, "1"=on)
export TPS_GIT="${TPS_GIT:-}"
export TPS_PYTHON="${TPS_PYTHON:-}"
export TPS_NODE="${TPS_NODE:-}"
export TPS_LOGTIME="${TPS_LOGTIME:-}"

# Backward compatibility exports
export TETRA_PROMPT_STYLE="$TPS_STYLE"
export TETRA_PROMPT_MULTILINE="$TPS_MULTILINE"
export TETRA_PROMPT_GIT="$TPS_GIT"
export TETRA_PROMPT_PYTHON="$TPS_PYTHON"
export TETRA_PROMPT_NODE="$TPS_NODE"
export TETRA_PROMPT_LOGTIME="$TPS_LOGTIME"

# =============================================================================
# INITIALIZATION
# =============================================================================

_tps_init() {
    _tps_colors_init
    _tps_metrics_init
    _tps_register_duration_segment
}

# =============================================================================
# SECTION GENERATORS
# =============================================================================

_tps_git_info() {
    [[ "$TPS_GIT" == "0" || "$TPS_STYLE" == "tiny" ]] && return
    # Prefer symbolic-ref for branch name, fall back to short SHA for detached HEAD
    git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null
}

_tps_python_info() {
    [[ "$TPS_PYTHON" == "0" ]] && return
    [[ "$TPS_STYLE" == "tiny" ]] && return

    if [[ "$TPS_PYTHON" == "1" ]] || command -v python >/dev/null 2>&1; then
        if [[ "$(which python)" == *"tetra"* ]]; then
            echo "p"
        else
            echo "~p"
        fi
    fi
}

_tps_node_info() {
    [[ "$TPS_NODE" == "0" ]] && return
    [[ "$TPS_STYLE" == "tiny" ]] && return

    if [[ "$TPS_NODE" == "1" ]] || command -v node >/dev/null 2>&1; then
        if [[ "$(which node)" == *"tetra"* ]]; then
            echo "n"
        else
            echo "~n"
        fi
    fi
}

_tps_logtime_info() {
    [[ "$TPS_LOGTIME" == "0" ]] && return
    [[ "$TPS_STYLE" == "tiny" ]] && return
    [[ "$TPS_LOGTIME" == "1" ]] || command -v _logtime-elapsed-hms >/dev/null 2>&1 && _logtime-elapsed-hms
}

# =============================================================================
# STYLE RENDERERS
# =============================================================================

_tps_render_tiny() {
    PS1="${_TPS_C_USER}\u${_TPS_C_RESET}@\h: "
}

_tps_render_compact() {
    local git_branch
    [[ "$TPS_GIT" != "0" ]] && git_branch=$(_tps_git_info)

    local git_info=""
    [[ -n "$git_branch" ]] && git_info="${_TPS_C_GIT}($git_branch)${_TPS_C_RESET}"

    PS1="${_TPS_C_RESET}${_TPS_C_USER}\u${_TPS_C_RESET}@\h:[\W]${git_info}: "
}

_tps_render_default() {
    local git_branch info=""

    # Git info
    [[ "$TPS_GIT" != "0" ]] && git_branch=$(_tps_git_info)

    # Runtime indicators
    local python_status node_status
    python_status=$(_tps_python_info)
    node_status=$(_tps_node_info)

    local status_indicators=()
    [[ -n "$python_status" ]] && status_indicators+=("$python_status")
    [[ -n "$node_status" ]] && status_indicators+=("$node_status")

    if [[ ${#status_indicators[@]} -gt 0 ]]; then
        local joined
        IFS=',' joined="${status_indicators[*]}"
        info+="${_TPS_C_PATH_DIM}($joined)${_TPS_C_RESET}"
    fi

    # Info area segments (includes duration when > threshold)
    local info_line
    info_line=$(tps_render_area info)
    [[ -n "$info_line" ]] && info+="$info_line "

    # Git display
    local git_info=""
    [[ -n "$git_branch" ]] && git_info=" ${_TPS_C_GIT}($git_branch)${_TPS_C_RESET}"

    # Context lines (may be multiple from different modules)
    local context_lines
    context_lines=$(_tps_build_all_context_lines)

    # Build PS1
    if [[ -n "$context_lines" ]]; then
        # Each context line on its own line, then prompt
        local ctx_block=""
        while IFS= read -r line; do
            ctx_block+="${line}\n"
        done <<< "$context_lines"
        PS1="${ctx_block}${info}${_TPS_C_USER}\u${_TPS_C_RESET}@\h:[\W]${git_info}: "
    else
        PS1="${info}${_TPS_C_USER}\u${_TPS_C_RESET}@\h:[\W]${git_info}: "
    fi
}

_tps_render_verbose() {
    local git_branch info=""

    # Git info
    [[ "$TPS_GIT" != "0" ]] && git_branch=$(_tps_git_info)

    # Runtime indicators
    local python_status node_status logtime_info
    python_status=$(_tps_python_info)
    node_status=$(_tps_node_info)
    logtime_info=$(_tps_logtime_info)

    local status_indicators=()
    [[ -n "$python_status" ]] && status_indicators+=("$python_status")
    [[ -n "$node_status" ]] && status_indicators+=("$node_status")

    if [[ ${#status_indicators[@]} -gt 0 ]]; then
        local joined
        IFS=',' joined="${status_indicators[*]}"
        info+="${_TPS_C_PATH_DIM}($joined)${_TPS_C_RESET}"
    fi

    [[ -n "$logtime_info" ]] && info+="${_TPS_C_PURPLE}[$logtime_info]${_TPS_C_RESET}"

    # Info area segments
    local info_line
    info_line=$(tps_render_area info)
    [[ -n "$info_line" ]] && info+="$info_line "

    # Git display
    local git_info=""
    [[ -n "$git_branch" ]] && git_info=" ${_TPS_C_GIT}($git_branch)${_TPS_C_RESET}"

    # Context lines (may be multiple from different modules)
    local context_lines
    context_lines=$(_tps_build_all_context_lines)

    # Build PS1 (always multi-line in verbose)
    if [[ -n "$context_lines" ]]; then
        local ctx_block=""
        while IFS= read -r line; do
            ctx_block+="${line}\n"
        done <<< "$context_lines"
        PS1="${ctx_block}${_TPS_C_PATH}\w${_TPS_C_RESET}${git_info}\n"
    else
        PS1="${_TPS_C_PATH}\w${_TPS_C_RESET}${git_info}\n"
    fi
    PS1+="${info}${_TPS_C_USER}\u${_TPS_C_RESET}@\h: "
}

# =============================================================================
# MAIN PROMPT FUNCTION (PROMPT_COMMAND)
# =============================================================================

tps_prompt() {
    # Capture exit code first (before any commands)
    TPS_LAST_EXIT_CODE=$?

    # Run post_command hooks (metrics capture)
    tps_hook_run post_command

    # Run pre_prompt hooks (color updates, state)
    tps_hook_run pre_prompt

    # Select style renderer
    case "$TPS_STYLE" in
        tiny)    _tps_render_tiny ;;
        compact) _tps_render_compact ;;
        verbose) _tps_render_verbose ;;
        *)       _tps_render_default ;;
    esac

    # Prepend OSC escape sequences (working directory / document)
    local osc_prefix
    osc_prefix=$(_tps_osc_emit)
    PS1="${osc_prefix}${PS1}"
}

# Backward compat alias
tetra_prompt() { tps_prompt; }

# =============================================================================
# TPS COMMAND INTERFACE
# =============================================================================

_tps_style() {
    case "$1" in
        tiny|compact|default|verbose)
            export TPS_STYLE="$1"
            export TETRA_PROMPT_STYLE="$1"
            ;;
        "")
            echo "Current: $TPS_STYLE"
            echo "Options: tiny, compact, default, verbose"
            ;;
        *)
            echo "Unknown style: $1" >&2
            return 1
            ;;
    esac
}

_tps_toggle() {
    local section="$1"
    local state="$2"

    case "$section" in
        git|python|node|logtime)
            local var_name="TPS_${section^^}"
            local tetra_var="TETRA_PROMPT_${section^^}"

            case "$state" in
                on|1)  export "$var_name"="1"; export "$tetra_var"="1" ;;
                off|0) export "$var_name"="0"; export "$tetra_var"="0" ;;
                auto|"")
                    local current
                    current=$(eval echo "\$$var_name")
                    if [[ "$current" == "0" ]]; then
                        export "$var_name"=""
                        export "$tetra_var"=""
                    else
                        export "$var_name"="0"
                        export "$tetra_var"="0"
                    fi
                    ;;
            esac
            ;;
        *)
            echo "Usage: tps toggle {git|python|node|logtime} [on|off]" >&2
            return 1
            ;;
    esac
}

_tps_multiline() {
    case "$1" in
        on|true|1)  export TPS_MULTILINE="true"; export TETRA_PROMPT_MULTILINE="true" ;;
        off|false|0) export TPS_MULTILINE="false"; export TETRA_PROMPT_MULTILINE="false" ;;
        *)
            if [[ "$TPS_MULTILINE" == "true" ]]; then
                export TPS_MULTILINE="false"
            else
                export TPS_MULTILINE="true"
            fi
            export TETRA_PROMPT_MULTILINE="$TPS_MULTILINE"
            ;;
    esac
}

_tps_status() {
    echo "TPS Status"
    echo "=========="
    echo ""
    echo "Style:     $TPS_STYLE"
    echo "Multiline: $TPS_MULTILINE"
    echo ""
    echo "Sections:"
    echo "  Git:     ${TPS_GIT:-auto}"
    echo "  Python:  ${TPS_PYTHON:-auto}"
    echo "  Node:    ${TPS_NODE:-auto}"
    echo "  Logtime: ${TPS_LOGTIME:-auto}"
    echo ""
    echo "Metrics:"
    echo "  Last exit:  $TPS_LAST_EXIT_CODE"
    echo "  Duration:   ${TPS_LAST_DURATION}s"
    echo "  Threshold:  ${TPS_DURATION_THRESHOLD}s"
}

_tps_help() {
    cat <<'EOF'
tps - Tetra Prompt System

Usage:
  tps style {tiny|compact|default|verbose}   Set prompt style
  tps toggle {git|python|node|logtime} [on|off]  Toggle sections
  tps multiline [on|off]                     Toggle multiline
  tps color [list|set|reset]                 Manage prompt colors
  tps osc [on|off|status]                    OSC escape sequences (pwd/document)
  tps providers                              Show context providers
  tps hooks                                  Show registered hooks
  tps segments                               Show registered segments
  tps status                                 Show current settings
  tps metrics                                Show command metrics
  tps help                                   This help

Color Commands:
  tps color list                Show all colors with current values
  tps color set <elem> <hex>    Set a color (e.g., tps color set user ff5500)
  tps color reset [elem|all]    Reset to theme defaults

OSC Commands (terminal integration):
  tps osc on                    Enable OSC 7 (working directory) in prompt
  tps osc off                   Disable OSC sequences
  tps_set_document <path>       Set OSC 6 document (for editor integrations)
  tps_clear_document            Clear document, revert to pwd

Hook API:
  tps_hook_register <event> <func> [priority]
  Events: pre_prompt, post_command

Context API:
  tps_register_context <slot> <func>
  Slots: org, target, env

Segment API:
  tps_register_segment <area> <priority> <name> <func>
  Areas: info, right

Shortcuts: tps s, tps t, tps m, tps c, tps o, tps p, tps h, tps st
Alias: tp (backward compat)
EOF
}

# Main command dispatcher
tps() {
    case "$1" in
        style|s)      shift; _tps_style "$@" ;;
        toggle|t)     shift; _tps_toggle "$@" ;;
        multiline|m)  shift; _tps_multiline "$@" ;;
        color|c)      shift; tps_color "$@" ;;
        osc|o)        shift; tps_osc "$@" ;;
        providers|p)  tps_context_providers ;;
        hooks)        tps_hook_list ;;
        segments)     tps_segment_list ;;
        colors)       tps_color list ;;  # Backward compat
        status|st)    _tps_status ;;
        metrics)      tps_get_metrics ;;
        help|h|"")    _tps_help ;;
        *)
            echo "Unknown: tps $1" >&2
            echo "Use 'tps help' for usage" >&2
            return 1
            ;;
    esac
}

# Backward compat alias
tp() { tps "$@"; }

# =============================================================================
# EXPORTS
# =============================================================================

export -f tps tp tps_prompt tetra_prompt
export -f _tps_style _tps_toggle _tps_multiline _tps_status _tps_help
export -f _tps_render_tiny _tps_render_compact _tps_render_default _tps_render_verbose
export -f _tps_git_info _tps_python_info _tps_node_info _tps_logtime_info
export -f _tps_init

# =============================================================================
# INITIALIZE
# =============================================================================

_tps_init
