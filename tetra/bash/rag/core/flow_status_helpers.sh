#!/usr/bin/env bash

# Flow Status Helper Functions
# Extracted from flow_manager_ttm.sh for maintainability

# Get flow stage color
_flow_get_stage_color() {
    local stage="$1"
    local c_stage_done="${TC_SUCCESS:-\033[38;5;83m}"
    local c_stage_exec="${TC_INFO:-\033[38;5;75m}"
    local c_stage_work="${TC_WARNING:-\033[38;5;222m}"
    local c_stage_fail="${TC_ERROR:-\033[38;5;204m}"

    case "$stage" in
        DONE) echo "$c_stage_done" ;;
        EXECUTE) echo "$c_stage_exec" ;;
        FAIL) echo "$c_stage_fail" ;;
        *) echo "$c_stage_work" ;;
    esac
}

# Get outcome badge and color
_flow_get_outcome_badge() {
    local outcome="$1"
    local c_dim="${TC_MUTED:-\033[38;5;240m}"
    local c_done="${TC_SUCCESS:-\033[38;5;83m}"
    local c_warn="${TC_WARNING:-\033[38;5;222m}"
    local c_fail="${TC_ERROR:-\033[38;5;204m}"

    case "$outcome" in
        success)  echo "$c_done| ✓" ;;
        partial)  echo "$c_warn| ⚠" ;;
        abandoned) echo "$c_dim| ○" ;;
        failed)   echo "$c_fail| ✗" ;;
        *) echo "$c_dim|" ;;
    esac
}

# Count evidence files in a flow
_flow_count_evidence() {
    local flow_dir="$1"
    local evidence_count=0
    if [[ -d "$flow_dir/ctx/evidence" ]]; then
        evidence_count=$(find "$flow_dir/ctx/evidence" -name "*.evidence.md" -type f 2>/dev/null | wc -l | tr -d ' ')
    fi
    echo "$evidence_count"
}

# Estimate token count from prompt file
_flow_estimate_tokens() {
    local flow_dir="$1"
    local token_estimate="0"
    if [[ -f "$flow_dir/build/prompt.mdctx" ]]; then
        local word_count=$(wc -w < "$flow_dir/build/prompt.mdctx" | tr -d ' ')
        token_estimate=$(awk "BEGIN {printf \"%.0f\", $word_count / 0.75}")
    fi
    echo "$token_estimate"
}

# Get relative path for display
_flow_relative_path() {
    local flow_dir="$1"
    local rel_path="${flow_dir#$PWD/}"
    [[ "$rel_path" == "$flow_dir" ]] && rel_path="${flow_dir/#$HOME/~}"
    echo "$rel_path"
}

# Parse state JSON into variables (sets global vars for caller)
_flow_parse_state() {
    local state="$1"

    FLOW_DESCRIPTION=$(echo "$state" | jq -r '.description')
    FLOW_STAGE=$(echo "$state" | jq -r '.stage')
    FLOW_ITERATION=$(echo "$state" | jq -r '.iteration')
    FLOW_AGENT=$(echo "$state" | jq -r '.agent')
    FLOW_TARGET=$(echo "$state" | jq -r '.target')
    FLOW_CTX_DIGEST=$(echo "$state" | jq -r '.ctx_digest // "none"')
    FLOW_LAST_CHECKPOINT=$(echo "$state" | jq -r '.last_checkpoint')
    FLOW_QA_ID=$(echo "$state" | jq -r '.qa_id // "none"')
    FLOW_OUTCOME=$(echo "$state" | jq -r '.outcome // "none"')
    FLOW_TAGS=$(echo "$state" | jq -r '.tags // []' | jq -r 'join(", ")' 2>/dev/null)
    FLOW_EFFORT=$(echo "$state" | jq -r '.effort_minutes // 0')
    FLOW_TOKEN_USAGE=$(echo "$state" | jq -r '.token_usage // 0')
}

# Print flow header
_flow_print_header() {
    local flow_id="$1"
    local outcome="$2"
    local stage="$3"

    local c_flow="${TC_TITLE:-\033[38;5;117m}"
    local c_value="${TC_BRIGHT_WHITE:-\033[38;5;255m}"
    local c_dim="${TC_MUTED:-\033[38;5;240m}"
    local c_reset="${TC_RESET:-\033[0m}"

    # Get outcome badge
    local badge_data
    badge_data=$(_flow_get_outcome_badge "$outcome")
    local outcome_color="${badge_data%%|*}"
    local outcome_badge="${badge_data#*|}"

    [[ "$stage" != "DONE" ]] && outcome_badge=""

    echo -e "${c_flow}Flow:${c_reset} ${c_value}$flow_id${c_reset} ${c_dim}(active)${c_reset}${outcome_color}${outcome_badge}${c_reset}"
}

# Print flow metrics line
_flow_print_metrics() {
    local evidence_count="$1"
    local token_estimate="$2"

    local c_label="${TC_LABEL:-\033[38;5;244m}"
    local c_value="${TC_BRIGHT_WHITE:-\033[38;5;255m}"
    local c_dim="${TC_MUTED:-\033[38;5;240m}"
    local c_warn="${TC_WARNING:-\033[38;5;222m}"
    local c_fail="${TC_ERROR:-\033[38;5;204m}"
    local c_reset="${TC_RESET:-\033[0m}"

    local ev_color="$c_dim"
    [[ $evidence_count -gt 0 ]] && ev_color="$c_value"

    local tok_color="$c_value"
    [[ $token_estimate -gt 100000 ]] && tok_color="$c_fail"
    [[ $token_estimate -gt 50000 && $token_estimate -le 100000 ]] && tok_color="$c_warn"

    echo -e "${c_label}Evidence:${c_reset} ${ev_color}${evidence_count}${c_reset} file(s)  ${c_label}Tokens:${c_reset} ${tok_color}~${token_estimate}${c_reset} ${c_dim}(est)${c_reset}"
}

# Print separator line
_flow_print_separator() {
    local width="${1:-78}"
    local c_dim="${TC_MUTED:-\033[38;5;240m}"
    local c_reset="${TC_RESET:-\033[0m}"

    printf "\n${c_dim}"
    printf '─%.0s' $(seq 1 $width)
    printf "${c_reset}\n"
}

# Print answer summary
_flow_print_answer_summary() {
    local flow_dir="$1"
    local rel_path="$2"

    local c_label="${TC_LABEL:-\033[38;5;244m}"
    local c_dim="${TC_MUTED:-\033[38;5;240m}"
    local c_path="${TC_COMMAND:-\033[38;5;110m}"
    local c_reset="${TC_RESET:-\033[0m}"

    if [[ -f "$flow_dir/build/answer.md" ]]; then
        echo -e "${c_label}Answer${c_reset} ${c_dim}(first 5 lines):${c_reset}"
        head -n 5 "$flow_dir/build/answer.md" | while IFS= read -r line; do
            echo -e "  ${c_dim}$line${c_reset}"
        done
        echo -e "  ${c_dim}...${c_reset}"
        echo -e "  ${c_dim}(View full: ${c_path}/r${c_dim} or ${c_path}cat $rel_path/build/answer.md${c_dim})${c_reset}"
    fi
}

# Print artifacts list
_flow_print_artifacts() {
    local state="$1"

    local c_label="${TC_LABEL:-\033[38;5;244m}"
    local c_path="${TC_COMMAND:-\033[38;5;110m}"
    local c_reset="${TC_RESET:-\033[0m}"

    local artifacts=$(echo "$state" | jq -r '.artifacts // []' | jq -r '.[]' 2>/dev/null)
    if [[ -n "$artifacts" ]]; then
        echo ""
        echo -e "${c_label}Artifacts:${c_reset}"
        while IFS= read -r artifact; do
            [[ -z "$artifact" ]] && continue
            echo -e "  ${c_path}$artifact${c_reset}"
        done <<< "$artifacts"
    fi
}

# Print lessons learned
_flow_print_lessons() {
    local state="$1"

    local c_label="${TC_LABEL:-\033[38;5;244m}"
    local c_dim="${TC_MUTED:-\033[38;5;240m}"
    local c_reset="${TC_RESET:-\033[0m}"

    local lessons=$(echo "$state" | jq -r '.lessons // []' | jq -r '.[]' 2>/dev/null)
    if [[ -n "$lessons" ]]; then
        echo ""
        echo -e "${c_label}Lessons Learned:${c_reset}"
        while IFS= read -r lesson; do
            [[ -z "$lesson" ]] && continue
            echo -e "  ${c_dim}• $lesson${c_reset}"
        done <<< "$lessons"
    fi
}
