#!/usr/bin/env bash
# tps/core/context.sh - Context system (delegates to context_kv)
#
# This is a thin wrapper that provides the prompt rendering interface.
# All context management is handled by context_kv.sh (tps_ctx API).
#
# PERFORMANCE: This file is in the hot path (runs every prompt).

# =============================================================================
# PROMPT RENDERING
# =============================================================================

# Build all context lines for prompt display
# Delegates to tps_ctx_lines from context_kv.sh
_tps_build_all_context_lines() {
    if type tps_ctx_lines &>/dev/null; then
        tps_ctx_lines 2>/dev/null
    fi
}

# =============================================================================
# STATUS / DEBUG
# =============================================================================

# Show registered context modules
tps_context_providers() {
    if type tps_ctx &>/dev/null; then
        echo "Context Modules (tps_ctx)"
        echo "========================="
        echo ""
        tps_ctx show
        echo ""
        echo "Use 'tps_ctx dump' for full debug output"
    else
        echo "No context system loaded"
    fi
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _tps_build_all_context_lines
export -f tps_context_providers
