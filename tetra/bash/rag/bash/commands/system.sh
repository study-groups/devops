#!/usr/bin/env bash
# system.sh - System status and configuration commands

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"

# ============================================================================
# STATUS COMMAND
# ============================================================================

rag_cmd_status() {
    echo "RAG System Status"
    echo "════════════════════════════════════════"
    echo ""

    # Flow status
    flow_status
    echo ""

    # Evidence count
    if command -v evidence_list >/dev/null 2>&1; then
        local flow_dir="$(get_active_flow_dir 2>/dev/null)"
        if [[ -n "$flow_dir" ]] && [[ -d "$flow_dir/ctx/evidence" ]]; then
            local evidence_count=$(find "$flow_dir/ctx/evidence" -name "*.evidence.md" 2>/dev/null | wc -l | tr -d ' ')
            echo "Evidence files: $evidence_count"
        fi
    fi

    # Stats if available
    if command -v get_context_stats >/dev/null 2>&1; then
        local flow_dir="$(get_active_flow_dir 2>/dev/null)"
        if [[ -n "$flow_dir" ]]; then
            echo ""
            get_context_stats "$flow_dir"
        fi
    fi
}

# ============================================================================
# PROMPT/CLI COMMAND (backwards compat)
# ============================================================================

rag_cmd_cli() {
    local subcmd="$1"
    local scope="${2:-flow}"

    if [[ -z "$subcmd" ]]; then
        # Show current mode
        local mode=$(get_rag_prompt_mode)
        echo "Current prompt mode: $mode"
        echo ""
        echo "Available modes:"
        echo "  minimal  - Simple > prompt"
        echo "  normal   - [flow:stage] rag> prompt"
        echo "  twoline  - Stats meters + flow prompt"
        echo ""
        echo "Usage: /cli <mode> [global]"
        echo "       /cli toggle"
        return
    fi

    case "$subcmd" in
        minimal|normal|twoline)
            rag_set_prompt_mode "$subcmd" "$scope"
            return 2  # Signal prompt rebuild
            ;;
        toggle)
            rag_toggle_prompt_mode
            return 2  # Signal prompt rebuild
            ;;
        *)
            echo "Unknown prompt mode: $subcmd"
            echo "Use: minimal, normal, twoline, toggle"
            ;;
    esac
}

# Export functions
export -f rag_cmd_status
export -f rag_cmd_cli
