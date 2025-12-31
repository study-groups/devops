#!/usr/bin/env bash
# magicfind.sh - MagicFind integration for RAG evidence discovery
#
# Bridges the mf (magicfind) LLM-assisted search with RAG evidence selection.
# Allows natural language queries to find and add files as evidence.

# Prevent double-sourcing
[[ -n "${RAG_MF_LOADED:-}" ]] && return 0
RAG_MF_LOADED=1

: "${TETRA_SRC:=$HOME/tetra}"
: "${MF_SRC:=$TETRA_SRC/bash/magicfind}"

# =============================================================================
# MAGICFIND AVAILABILITY
# =============================================================================

# Check if magicfind is available
mf_available() {
    [[ -f "$MF_SRC/core.sh" ]] && command -v mf >/dev/null 2>&1
}

# Initialize magicfind if not loaded
mf_init() {
    if ! command -v mf >/dev/null 2>&1; then
        if [[ -f "$MF_SRC/includes.sh" ]]; then
            source "$MF_SRC/includes.sh"
            return 0
        else
            echo "Error: MagicFind not found at $MF_SRC" >&2
            return 1
        fi
    fi
    return 0
}

# =============================================================================
# EVIDENCE DISCOVERY
# =============================================================================

# Find files using natural language and optionally add as evidence
# Usage: mf_find_evidence "query" [--add] [--dry-run]
mf_find_evidence() {
    local query=""
    local add_evidence=false
    local dry_run=false
    local verbose=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --add|-a)
                add_evidence=true
                shift
                ;;
            --dry-run|-n)
                dry_run=true
                shift
                ;;
            --verbose|-v)
                verbose=true
                shift
                ;;
            *)
                query="$1"
                shift
                ;;
        esac
    done

    if [[ -z "$query" ]]; then
        echo "Usage: mf_find_evidence \"<query>\" [--add] [--dry-run]" >&2
        echo "" >&2
        echo "Examples:" >&2
        echo "  mf_find_evidence \"find all shell scripts\"" >&2
        echo "  mf_find_evidence \"error handling code\" --add" >&2
        echo "  mf_find_evidence \"test files for auth\" --add --dry-run" >&2
        return 1
    fi

    # Ensure magicfind is available
    if ! mf_init; then
        return 1
    fi

    # Build mf command
    local mf_args=()
    [[ "$dry_run" == true ]] && mf_args+=("-n")
    [[ "$verbose" == true ]] && mf_args+=("-v")

    # Run magicfind
    local result
    if [[ "$dry_run" == true ]]; then
        echo "Query: $query"
        echo "Command that would run:"
        mf "${mf_args[@]}" "$query"
        return 0
    fi

    result=$(mf "${mf_args[@]}" "$query" 2>/dev/null)
    local exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        echo "MagicFind query failed" >&2
        return 1
    fi

    # Parse results (assume one file per line)
    local files=()
    while IFS= read -r line; do
        # Skip empty lines and non-file output
        [[ -z "$line" ]] && continue
        [[ -f "$line" ]] && files+=("$line")
    done <<< "$result"

    if [[ ${#files[@]} -eq 0 ]]; then
        echo "No files found matching: $query"
        return 0
    fi

    echo "Found ${#files[@]} files:"
    for f in "${files[@]}"; do
        echo "  $f"
    done

    # Add as evidence if requested
    if [[ "$add_evidence" == true ]]; then
        echo ""
        _mf_add_files_as_evidence "${files[@]}"
    fi
}

# Add files as evidence (internal helper)
_mf_add_files_as_evidence() {
    local files=("$@")

    # Check for active flow
    if ! command -v get_active_flow_dir >/dev/null 2>&1; then
        source "$RAG_SRC/core/flow_manager_ttm.sh" 2>/dev/null
    fi

    local flow_dir=$(get_active_flow_dir 2>/dev/null)
    if [[ -z "$flow_dir" ]]; then
        echo "No active flow. Create one with: rag flow create \"description\"" >&2
        return 1
    fi

    # Source evidence functions
    if ! command -v evidence_add >/dev/null 2>&1; then
        source "$RAG_SRC/core/evidence_selector.sh" 2>/dev/null
    fi

    echo "Adding ${#files[@]} files as evidence..."
    local added=0
    for file in "${files[@]}"; do
        if evidence_add "$file" 2>/dev/null; then
            ((added++))
        else
            echo "  Failed: $file" >&2
        fi
    done

    echo "Added $added/${#files[@]} files as evidence"

    # Refresh evidence variables
    if command -v init_evidence_vars >/dev/null 2>&1; then
        init_evidence_vars "$flow_dir"
    fi
}

# =============================================================================
# QUERY HISTORY FOR EVIDENCE
# =============================================================================

# List recent mf queries
mf_list_queries() {
    local limit="${1:-10}"

    if ! mf_init; then
        return 1
    fi

    mf list "$limit"
}

# Show a specific query and its results
mf_show_query() {
    local ts="$1"

    if [[ -z "$ts" ]]; then
        echo "Usage: mf_show_query <timestamp>" >&2
        return 1
    fi

    if ! mf_init; then
        return 1
    fi

    mf show "$ts"
}

# Replay a query and optionally add results as evidence
mf_replay_query() {
    local ts="$1"
    local add_evidence=false
    shift || true

    # Check for --add flag
    if [[ "$1" == "--add" || "$1" == "-a" ]]; then
        add_evidence=true
        shift
    fi

    if [[ -z "$ts" ]]; then
        echo "Usage: mf_replay_query <timestamp> [--add] [var=val ...]" >&2
        return 1
    fi

    if ! mf_init; then
        return 1
    fi

    # Replay the query
    local result
    result=$(mf replay "$ts" "$@" 2>/dev/null)
    local exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        echo "Replay failed" >&2
        return 1
    fi

    # Parse and optionally add as evidence
    local files=()
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        [[ -f "$line" ]] && files+=("$line")
    done <<< "$result"

    echo "$result"

    if [[ "$add_evidence" == true && ${#files[@]} -gt 0 ]]; then
        echo ""
        _mf_add_files_as_evidence "${files[@]}"
    fi
}

# Find similar queries
mf_similar_queries() {
    local query="$1"

    if [[ -z "$query" ]]; then
        echo "Usage: mf_similar_queries \"<query>\"" >&2
        return 1
    fi

    if ! mf_init; then
        return 1
    fi

    mf similar "$query"
}

# =============================================================================
# REPL COMMAND HANDLERS
# =============================================================================

# Handle /mf commands in REPL
rag_mf_command() {
    local subcmd="${1:-}"
    shift || true

    case "$subcmd" in
        find|"")
            # Default: natural language search
            mf_find_evidence "$@"
            ;;
        list)
            mf_list_queries "$@"
            ;;
        show)
            mf_show_query "$@"
            ;;
        replay)
            mf_replay_query "$@"
            ;;
        similar)
            mf_similar_queries "$@"
            ;;
        help|h)
            cat <<'EOF'
MagicFind Integration for RAG

Commands:
  /mf "<query>"              Find files using natural language
  /mf find "<query>" --add   Find and add results as evidence
  /mf list [N]               List recent queries
  /mf show <ts>              Show query details
  /mf replay <ts> [--add]    Re-run a query
  /mf similar "<query>"      Find similar past queries

Examples:
  /mf "find all test files"
  /mf find "error handling in auth" --add
  /mf replay 20251229-153045 --add
EOF
            ;;
        *)
            # Treat as query
            mf_find_evidence "$subcmd $*"
            ;;
    esac
}

# Handle /find command (shortcut for /mf find --add)
rag_find_command() {
    mf_find_evidence "$@" --add
}

# =============================================================================
# EXPORTS
# =============================================================================

export RAG_MF_LOADED
export -f mf_available
export -f mf_init
export -f mf_find_evidence
export -f mf_list_queries
export -f mf_show_query
export -f mf_replay_query
export -f mf_similar_queries
export -f rag_mf_command
export -f rag_find_command
