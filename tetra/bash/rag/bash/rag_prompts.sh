#!/usr/bin/env bash
# rag_prompts.sh - RAG REPL prompt builders
# Registers prompt builders with bash/repl system

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"

# Source dependencies
source "$RAG_SRC/core/flow_manager_ttm.sh"
source "$RAG_SRC/core/stats_manager.sh" 2>/dev/null || true

# Check if color system is available
if [[ -f "$TETRA_SRC/bash/color/color_core.sh" ]]; then
    source "$TETRA_SRC/bash/color/color_core.sh"
    COLOR_ENABLED=1
else
    COLOR_ENABLED=0
fi

# RAG prompt mode (minimal, normal, twoline)
RAG_PROMPT_MODE="${RAG_PROMPT_MODE:-normal}"

# Get prompt mode from config or flow state
get_rag_prompt_mode() {
    # Check flow state first
    local flow_dir="$(get_active_flow_dir 2>/dev/null)"
    if [[ -n "$flow_dir" ]] && [[ -f "$flow_dir/state.json" ]] && command -v jq >/dev/null 2>&1; then
        local flow_mode=$(jq -r '.prompt_mode // empty' "$flow_dir/state.json" 2>/dev/null)
        if [[ -n "$flow_mode" ]]; then
            echo "$flow_mode"
            return
        fi
    fi

    # Check global config
    if [[ -f "$TETRA_DIR/rag/config/prompt_mode" ]]; then
        cat "$TETRA_DIR/rag/config/prompt_mode"
        return
    fi

    # Default
    echo "${RAG_PROMPT_MODE:-normal}"
}

# Main RAG prompt builder (registered with bash/repl)
rag_build_prompt() {
    local mode=$(get_rag_prompt_mode)

    case "$mode" in
        minimal)
            _rag_prompt_minimal
            ;;
        normal)
            _rag_prompt_normal
            ;;
        twoline)
            _rag_prompt_twoline
            ;;
        *)
            _rag_prompt_normal
            ;;
    esac
}

# Minimal prompt: just >
_rag_prompt_minimal() {
    if [[ ${COLOR_ENABLED:-0} -eq 1 ]]; then
        echo "$(text_color "6699CC")>$(reset_color) "
    else
        echo "> "
    fi
}

# Normal prompt: [flow:stage] rag>
_rag_prompt_normal() {
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

    # Check for background job and completion notification
    if [[ -f "$flow_dir/build/.submit_complete" ]]; then
        # Show completion notification once, then remove marker
        local completion_info=$(cat "$flow_dir/build/.submit_complete")
        local comp_stage=$(echo "$completion_info" | cut -d: -f2)
        if [[ ${COLOR_ENABLED:-0} -eq 1 ]]; then
            if [[ "$comp_stage" == "DONE" ]]; then
                >&2 echo "$(text_color "9ECE6A")✓$(reset_color) QA complete! Use $(text_color "7AA2F7")/r$(reset_color) to view answer"
            else
                >&2 echo "$(text_color "F7768E")✗$(reset_color) QA failed - check logs"
            fi
        else
            if [[ "$comp_stage" == "DONE" ]]; then
                >&2 echo "✓ QA complete! Use /r to view answer"
            else
                >&2 echo "✗ QA failed - check logs"
            fi
        fi
        rm "$flow_dir/build/.submit_complete"
    fi

    # Check if background job is running
    local bg_indicator=""
    if [[ -f "$flow_dir/build/.submit_pid" ]]; then
        local bg_pid=$(cat "$flow_dir/build/.submit_pid")
        if kill -0 "$bg_pid" 2>/dev/null; then
            bg_indicator="⏳"
        else
            # Job finished, remove stale PID
            rm "$flow_dir/build/.submit_pid"
        fi
    fi

    # Build colored prompt
    if [[ ${COLOR_ENABLED:-0} -eq 1 ]]; then
        # Stage-specific colors
        local stage_color
        case "$stage" in
            NEW) stage_color="6699CC" ;;
            SELECT) stage_color="9988BB" ;;
            ASSEMBLE) stage_color="8877AA" ;;
            EXECUTE) stage_color="CC9966" ;;  # TTM EXECUTE stage
            SUBMIT) stage_color="CC9966" ;;   # RAG legacy
            APPLY) stage_color="DD8855" ;;    # RAG legacy
            VALIDATE) stage_color="CC6677" ;;
            DONE) stage_color="88BB66" ;;
            FAIL) stage_color="CC6677" ;;
            *) stage_color="7788AA" ;;
        esac

        echo "$(text_color "7788AA")[$(text_color "66AA99")$short_flow$(text_color "7788AA"):$(text_color "$stage_color")$stage$(text_color "7788AA")]$(reset_color)$bg_indicator $(text_color "6699CC")rag>$(reset_color) "
    else
        echo "[$short_flow:$stage]$bg_indicator rag> "
    fi
}

# Twoline prompt: Stats on first line, prompt on second
_rag_prompt_twoline() {
    local flow_dir="$(get_active_flow_dir 2>/dev/null)"

    # No flow - fall back to normal
    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        _rag_prompt_normal
        return
    fi

    # Get stats (if stats_manager available)
    local stats_result
    local pinned=0 evidence=0 selections=0 external=0 total_files=0 total_lines=0 total_chars=0

    if command -v get_context_stats >/dev/null 2>&1; then
        stats_result=$(get_context_stats "$flow_dir" 2>/dev/null)
        read pinned evidence selections external total_files total_lines total_chars <<< "$stats_result"
    fi

    # Format numbers
    local lines_fmt=$total_lines
    if command -v format_size >/dev/null 2>&1; then
        lines_fmt=$(format_size $total_lines)
    fi

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
        stats_line+="$(text_color "CC9966")■$(to_superscript $pinned 2>/dev/null || echo $pinned)$(reset_color) "
        stats_line+="$(text_color "6699CC")●$(to_superscript $evidence 2>/dev/null || echo $evidence)$(reset_color) "
        stats_line+="$(text_color "9988BB")◆$(to_superscript $selections 2>/dev/null || echo $selections)$(reset_color) "
        stats_line+="$(text_color "66AA99")▲$(to_superscript $external 2>/dev/null || echo $external)$(reset_color) "
        stats_line+="$(text_color "7788AA")${total_files}f ${lines_fmt}L$(reset_color)"
    else
        stats_line="■${pinned} ●${evidence} ◆${selections} ▲${external} ${total_files}f ${lines_fmt}L"
    fi

    # Get terminal width
    local term_width=${COLUMNS:-80}

    # Strip ANSI codes to get visible length
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
            EXECUTE) stage_color="CC9966" ;;
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

# Set RAG prompt mode
rag_set_prompt_mode() {
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
            local state_file="$flow_dir/state.json"
            local temp_file=$(mktemp)
            jq --arg mode "$mode" '.prompt_mode = $mode' "$state_file" > "$temp_file" 2>/dev/null
            mv "$temp_file" "$state_file"
            echo "✓ Set flow prompt mode: $mode"
        else
            echo "Warning: jq not available, cannot update flow state" >&2
        fi
    fi

    # Update current session
    export RAG_PROMPT_MODE="$mode"
}

# Toggle prompt mode
rag_toggle_prompt_mode() {
    local current=$(get_rag_prompt_mode)
    local next=""

    case "$current" in
        minimal) next="normal" ;;
        normal) next="twoline" ;;
        twoline) next="minimal" ;;
        *) next="normal" ;;
    esac

    rag_set_prompt_mode "$next"
    echo "Prompt mode: $current → $next"
}

# Register with bash/repl (called by rag.sh)
rag_register_prompts() {
    if command -v repl_register_prompt_builder >/dev/null 2>&1; then
        repl_register_prompt_builder "rag" rag_build_prompt
    fi
}

# Export functions
export -f rag_build_prompt
export -f rag_set_prompt_mode
export -f rag_toggle_prompt_mode
export -f rag_register_prompts
export -f get_rag_prompt_mode
