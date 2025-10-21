#!/usr/bin/env bash
# prompt_manager.sh - Prompt mode management for RAG REPL
# Supports three modes: minimal, normal, twoline

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"
: "${TETRA_SRC:=$HOME/tetra}"
: "${TETRA_DIR:=$HOME/.tetra}"

# Source dependencies
if [[ -f "$RAG_SRC/core/stats_manager.sh" ]]; then
    source "$RAG_SRC/core/stats_manager.sh"
fi

if [[ -f "$RAG_SRC/core/flow_manager_ttm.sh" ]]; then
    source "$RAG_SRC/core/flow_manager_ttm.sh"
elif [[ -f "$RAG_SRC/core/flow_manager.sh" ]]; then
    source "$RAG_SRC/core/flow_manager.sh"
fi

# Default prompt mode
RAG_PROMPT_MODE="${RAG_PROMPT_MODE:-normal}"

# Get current prompt mode
# Priority: flow state > global config > default
get_prompt_mode() {
    local flow_dir="$(get_active_flow_dir 2>/dev/null)"

    # Check flow-specific setting first
    if [[ -n "$flow_dir" ]] && [[ -f "$flow_dir/state.json" ]]; then
        if command -v jq >/dev/null 2>&1; then
            local mode=$(jq -r '.prompt_mode // ""' "$flow_dir/state.json" 2>/dev/null)
            if [[ -n "$mode" ]]; then
                echo "$mode"
                return
            fi
        fi
    fi

    # Check global setting
    local global_config="${TETRA_DIR}/rag/config/prompt_mode"
    if [[ -f "$global_config" ]]; then
        local mode=$(cat "$global_config" 2>/dev/null)
        if [[ -n "$mode" ]]; then
            echo "$mode"
            return
        fi
    fi

    # Default
    echo "normal"
}

# Set prompt mode
# Args: mode (minimal|normal|twoline), scope (flow|global)
set_prompt_mode() {
    local mode="$1"
    local scope="${2:-flow}"

    # Validate mode
    case "$mode" in
        minimal|normal|twoline) ;;
        *)
            echo "Error: Invalid mode '$mode'. Use: minimal, normal, twoline" >&2
            return 1
            ;;
    esac

    if [[ "$scope" == "global" ]]; then
        # Set globally
        local config_dir="${TETRA_DIR}/rag/config"
        mkdir -p "$config_dir"
        echo "$mode" > "$config_dir/prompt_mode"
        echo "✓ Set global prompt mode: $mode"
    else
        # Set for current flow
        local flow_dir="$(get_active_flow_dir 2>/dev/null)"
        if [[ -z "$flow_dir" ]]; then
            echo "Error: No active flow. Use 'global' scope for global setting." >&2
            return 1
        fi

        if command -v jq >/dev/null 2>&1; then
            jq --arg mode "$mode" '.prompt_mode = $mode' "$flow_dir/state.json" > "$flow_dir/state.json.tmp" 2>/dev/null
            mv "$flow_dir/state.json.tmp" "$flow_dir/state.json"
            echo "✓ Set flow prompt mode: $mode"
        else
            echo "Warning: jq not available, cannot update flow state" >&2
        fi
    fi

    # Update current session variable
    export RAG_PROMPT_MODE="$mode"
}

# Toggle through modes: minimal → normal → twoline → minimal
toggle_prompt_mode() {
    local current=$(get_prompt_mode)
    local next=""

    case "$current" in
        minimal) next="normal" ;;
        normal) next="twoline" ;;
        twoline) next="minimal" ;;
        *) next="normal" ;;
    esac

    set_prompt_mode "$next"
    echo "Prompt mode: $current → $next"

    # Force prompt refresh by simulating empty command
    # This makes the new prompt appear immediately
    echo ""
}

# Main prompt builder - dispatches to mode-specific builders
build_prompt() {
    local mode=$(get_prompt_mode)

    case "$mode" in
        minimal)
            build_minimal_prompt
            ;;
        normal)
            build_normal_prompt
            ;;
        twoline)
            build_twoline_prompt
            ;;
        *)
            build_normal_prompt
            ;;
    esac
}

# Minimal mode: just >
build_minimal_prompt() {
    if [[ ${COLOR_ENABLED:-0} -eq 1 ]]; then
        echo "$(text_color "6699CC")>$(reset_color) "
    else
        echo "> "
    fi
}

# Normal mode: [flow:stage] rag>
build_normal_prompt() {
    local flow_dir="$(get_active_flow_dir 2>/dev/null)"

    # No flow - simple prompt
    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        if [[ ${COLOR_ENABLED:-0} -eq 1 ]]; then
            echo "$(text_color "7AA2F7")rag>$(reset_color) "
        else
            echo "rag> "
        fi
        return
    fi

    # Get flow info
    local flow_id=$(basename "$flow_dir")
    local short_flow=$(echo "$flow_id" | cut -d'-' -f1-2 | cut -c1-20)
    local stage="NEW"

    if [[ -f "$flow_dir/state.json" ]] && command -v jq >/dev/null 2>&1; then
        stage=$(jq -r '.stage // "NEW"' "$flow_dir/state.json" 2>/dev/null)
    fi

    # Build colored prompt
    if [[ ${COLOR_ENABLED:-0} -eq 1 ]]; then
        # Stage-specific colors (darker muted tones, definitely not white)
        local stage_color
        case "$stage" in
            NEW) stage_color="6699CC" ;;           # Soft blue
            SELECT) stage_color="9988BB" ;;        # Soft purple
            ASSEMBLE) stage_color="8877AA" ;;      # Darker purple
            SUBMIT) stage_color="CC9966" ;;        # Soft orange
            APPLY) stage_color="DD8855" ;;         # Soft bright orange
            VALIDATE) stage_color="CC6677" ;;      # Soft red
            DONE) stage_color="88BB66" ;;          # Soft green
            FAIL) stage_color="CC6677" ;;          # Soft red
            *) stage_color="7788AA" ;;             # Soft gray-blue
        esac

        echo "$(text_color "7788AA")[$(text_color "66AA99")$short_flow$(text_color "7788AA"):$(text_color "$stage_color")$stage$(text_color "7788AA")]$(reset_color) $(text_color "6699CC")rag>$(reset_color) "
    else
        echo "[$short_flow:$stage] rag> "
    fi
}

# TwoLine mode: Two-line prompt with stats on first line, tree connector to second
build_twoline_prompt() {
    local flow_dir="$(get_active_flow_dir 2>/dev/null)"

    # No flow - fall back to normal
    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        build_normal_prompt
        return
    fi

    # Get stats
    local stats_result=$(get_context_stats "$flow_dir" 2>/dev/null)
    read pinned evidence selections external total_files total_lines total_chars <<< "$stats_result"

    # Format numbers
    local lines_fmt=$(format_size $total_lines)

    # Get flow info
    local flow_id=$(basename "$flow_dir")
    local short_flow=$(echo "$flow_id" | cut -d'-' -f1-2 | cut -c1-12)
    local stage="NEW"
    if [[ -f "$flow_dir/state.json" ]] && command -v jq >/dev/null 2>&1; then
        stage=$(jq -r '.stage // "NEW"' "$flow_dir/state.json" 2>/dev/null)
    fi

    # Build stats line
    local stats_line=""
    if [[ ${COLOR_ENABLED:-0} -eq 1 ]]; then
        # Stats meters (compact)
        stats_line+="$(get_symbol_brightness "CC9966" $pinned 2>/dev/null || text_color "CC9966")■$(reset_color)"
        stats_line+="$(text_color "CC9966")$(to_superscript $pinned 2>/dev/null || echo $pinned)$(reset_color) "
        stats_line+="$(get_symbol_brightness "6699CC" $evidence 2>/dev/null || text_color "6699CC")●$(reset_color)"
        stats_line+="$(text_color "6699CC")$(to_superscript $evidence 2>/dev/null || echo $evidence)$(reset_color) "
        stats_line+="$(get_symbol_brightness "9988BB" $selections 2>/dev/null || text_color "9988BB")◆$(reset_color)"
        stats_line+="$(text_color "9988BB")$(to_superscript $selections 2>/dev/null || echo $selections)$(reset_color) "
        stats_line+="$(get_symbol_brightness "66AA99" $external 2>/dev/null || text_color "66AA99")▲$(reset_color)"
        stats_line+="$(text_color "66AA99")$(to_superscript $external 2>/dev/null || echo $external)$(reset_color) "
        stats_line+="$(text_color "7788AA")${total_files}f ${lines_fmt}L$(reset_color)"
    else
        stats_line="■${pinned} ●${evidence} ◆${selections} ▲${external} ${total_files}f ${lines_fmt}L"
    fi

    # Get terminal width
    local term_width=${COLUMNS:-80}

    # Strip ANSI codes to get visible length of stats
    local stats_visible=$(echo -e "$stats_line" | sed 's/\x1b\[[0-9;]*m//g' | wc -c)
    stats_visible=$((stats_visible - 1))

    # Calculate spacing for right alignment
    local spaces=$((term_width - stats_visible))
    [[ $spaces -lt 0 ]] && spaces=0

    # Build flow/stage prompt
    local stage_color="6699CC"
    local flow_prompt=""

    if [[ ${COLOR_ENABLED:-0} -eq 1 ]]; then
        case "$stage" in
            NEW) stage_color="6699CC" ;;
            SELECT) stage_color="9988BB" ;;
            ASSEMBLE) stage_color="8877AA" ;;
            SUBMIT) stage_color="CC9966" ;;
            APPLY) stage_color="DD8855" ;;
            VALIDATE) stage_color="CC6677" ;;
            DONE) stage_color="88BB66" ;;
            FAIL) stage_color="CC6677" ;;
            *) stage_color="7788AA" ;;
        esac
        flow_prompt="$(text_color "7788AA")[$(text_color "66AA99")$short_flow$(text_color "7788AA"):$(text_color "$stage_color")$stage$(text_color "7788AA")]$(reset_color) $(text_color "7AA2F7")>$(reset_color) "
    else
        flow_prompt="[$short_flow:$stage] > "
    fi

    # Print first line to stderr, return second line as prompt
    >&2 printf "%${spaces}s%b\n" "" "$stats_line"
    printf "%s" "$flow_prompt"
}

# Export functions
export -f get_prompt_mode
export -f set_prompt_mode
export -f toggle_prompt_mode
export -f build_prompt
export -f build_minimal_prompt
export -f build_normal_prompt
export -f build_twoline_prompt
