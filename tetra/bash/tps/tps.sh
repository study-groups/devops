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
        if [[ -n "$VIRTUAL_ENV" && "$VIRTUAL_ENV" == *"tetra"* ]]; then
            echo "vp"    # tetra venv
        elif [[ "$(command -v python)" == *"pyenv"* ]]; then
            echo "p"     # pyenv
        elif command -v python >/dev/null 2>&1; then
            echo "sp"    # system python
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

    # Runtime indicators (python, node)
    local status_line
    status_line=$(_tps_format_status_line)
    [[ -n "$status_line" ]] && info+="$status_line"

    # Info area segments (includes duration when > threshold)
    info+=$(_tps_format_info_area)

    # Git display
    local git_info
    git_info=$(_tps_format_git_branch "$git_branch")

    # Context block
    local ctx_block
    ctx_block=$(_tps_format_context_block)

    # Build PS1
    PS1="${ctx_block}${info}${_TPS_C_USER}\u${_TPS_C_RESET}@\h:[\W]${git_info}: "
}

_tps_render_verbose() {
    local git_branch info=""

    # Git info
    [[ "$TPS_GIT" != "0" ]] && git_branch=$(_tps_git_info)

    # Runtime indicators (python, node)
    local status_line
    status_line=$(_tps_format_status_line)
    [[ -n "$status_line" ]] && info+="$status_line"

    # Logtime (verbose-only)
    local logtime_info
    logtime_info=$(_tps_logtime_info)
    [[ -n "$logtime_info" ]] && info+="${_TPS_C_PURPLE}[$logtime_info]${_TPS_C_RESET}"

    # Info area segments
    info+=$(_tps_format_info_area)

    # Git display
    local git_info
    git_info=$(_tps_format_git_branch "$git_branch")

    # Context block
    local ctx_block
    ctx_block=$(_tps_format_context_block)

    # Build PS1 (always multi-line in verbose)
    PS1="${ctx_block}${_TPS_C_PATH}\w${_TPS_C_RESET}${git_info}\n"
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

# =============================================================================
# TPS COMMAND INTERFACE
# =============================================================================

_tps_style() {
    case "$1" in
        tiny|compact|default|verbose)
            export TPS_STYLE="$1"
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
            case "$state" in
                on|1)  export "$var_name"="1" ;;
                off|0) export "$var_name"="0" ;;
                auto|"")
                    local current
                    current=$(eval echo "\$$var_name")
                    if [[ "$current" == "0" ]]; then
                        export "$var_name"=""
                    else
                        export "$var_name"="0"
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
        on|true|1)  export TPS_MULTILINE="true" ;;
        off|false|0) export TPS_MULTILINE="false" ;;
        *)
            if [[ "$TPS_MULTILINE" == "true" ]]; then
                export TPS_MULTILINE="false"
            else
                export TPS_MULTILINE="true"
            fi
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

Hook Commands:
  tps hook                        List registered hooks
  tps hook debug [on|off]         Toggle hook debug mode
  tps hook log [tail|stats|clear] View/manage debug log

Hook API:
  tps_hook_register <event> <func> [priority]
  Events: pre_prompt, post_command

Context API:
  tps_register_context <slot> <func>
  Slots: org, project, subject

Segment API:
  tps_register_segment <area> <priority> <name> <func>
  Areas: info, right
EOF
}

# Hook subcommand dispatcher
_tps_hook() {
    case "${1:-}" in
        debug)   shift; tps_hook_debug "$@" ;;
        log)     shift; tps_hook_log "$@" ;;
        list|"") tps_hook_list ;;
        *)
            echo "Unknown: tps hook $1" >&2
            echo "Use: tps hook [list|debug|log]" >&2
            return 1
            ;;
    esac
}

# Main command dispatcher
tps() {
    case "$1" in
        style|s)      shift; _tps_style "$@" ;;
        toggle|t)     shift; _tps_toggle "$@" ;;
        multiline|m)  shift; _tps_multiline "$@" ;;
        color|c)      shift; tps_color "$@" ;;
        osc|o)        shift; tps_osc "$@" ;;
        hook)         shift; _tps_hook "$@" ;;
        providers|p)  tps_context_providers ;;
        hooks)        tps_hook_list ;;
        segments)     tps_segment_list ;;
        colors)       tps_color list ;;
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


# =============================================================================
# EXPORTS
# =============================================================================

export -f tps tps_prompt
export -f _tps_style _tps_toggle _tps_multiline _tps_status _tps_help _tps_hook
export -f _tps_render_tiny _tps_render_compact _tps_render_default _tps_render_verbose
export -f _tps_git_info _tps_python_info _tps_node_info _tps_logtime_info
export -f _tps_init

# =============================================================================
# INITIALIZE
# =============================================================================

_tps_init
