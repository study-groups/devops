#!/usr/bin/env bash
# core/render.sh - Common rendering utilities for TPS styles
# Extracts shared logic from default and verbose renderers
#
# PERFORMANCE: All functions in this file are in the hot path.
# Use nameref (_ref) versions to avoid subshell forking.

# =============================================================================
# STATUS INDICATORS
# =============================================================================

# Build status indicators array (python, node)
# Uses nameref to populate caller's array
# NOTE: _tps_python_info and _tps_node_info still fork (check external binaries)
_tps_build_status_indicators() {
    local -n result=$1
    local python_status node_status

    python_status=$(_tps_python_info)
    node_status=$(_tps_node_info)

    [[ -n "$python_status" ]] && result+=("$python_status")
    [[ -n "$node_status" ]] && result+=("$node_status")
}

# Format status indicators - nameref version (no subshell)
# Usage: _tps_format_status_line_ref <output_var>
_tps_format_status_line_ref() {
    local -n _status_out="$1"
    _status_out=""

    local -a indicators=()
    _tps_build_status_indicators indicators

    [[ ${#indicators[@]} -eq 0 ]] && return

    local joined
    printf -v joined '%s,' "${indicators[@]}"
    _status_out="${_TPS_C_PATH_DIM}(${joined%,})${_TPS_C_RESET}"
}

# Legacy wrapper (for non-hot-path code)
_tps_format_status_line() {
    local result
    _tps_format_status_line_ref result
    [[ -n "$result" ]] && echo "$result"
}

# =============================================================================
# INFO AREA
# =============================================================================

# Get formatted info area segments with trailing space
_tps_format_info_area() {
    local info_line
    info_line=$(tps_render_area info)
    [[ -n "$info_line" ]] && echo "$info_line "
}

# =============================================================================
# GIT DISPLAY
# =============================================================================

# Format git branch for display
# Returns " (branch)" with colors, or empty string
_tps_format_git_branch() {
    local git_branch="$1"
    [[ -z "$git_branch" ]] && return
    echo " ${_TPS_C_GIT}($git_branch)${_TPS_C_RESET}"
}

# =============================================================================
# CONTEXT BLOCK
# =============================================================================

# Build context lines block with newlines
# Returns formatted block or empty string
_tps_format_context_block() {
    local context_lines
    context_lines=$(_tps_build_all_context_lines)

    [[ -z "$context_lines" ]] && return

    local ctx_block=""
    while IFS= read -r line; do
        ctx_block+="${line}\n"
    done <<< "$context_lines"

    echo "$ctx_block"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _tps_build_status_indicators _tps_format_status_line
export -f _tps_format_info_area _tps_format_git_branch _tps_format_context_block
