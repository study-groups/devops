#!/usr/bin/env bash
# TDS Action Interface
# Provides action discovery and REPL processing for TDS module

# ============================================================================
# ACTION DISCOVERY
# ============================================================================

tds_get_actions() {
    local env="$1"
    local mode="$2"

    # TDS is available in Local:Inspect context
    case "$env:$mode" in
        "Local:Inspect")
            echo "show:themes show:palettes list:tokens show:temps"
            ;;
        *)
            echo ""
            ;;
    esac
}

# ============================================================================
# REPL PROCESSING
# ============================================================================

tds_repl_process() {
    local input="$1"

    # Forward to TDS REPL processor
    if declare -f _tds_repl_process_input >/dev/null; then
        _tds_repl_process_input "$input"
    else
        echo "TDS REPL not loaded"
        return 1
    fi
}

# ============================================================================
# EXPORT
# ============================================================================

export -f tds_get_actions
export -f tds_repl_process
