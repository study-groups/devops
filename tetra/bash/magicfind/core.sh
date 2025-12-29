#!/usr/bin/env bash
# magicfind core - main entry point

# Generate command from query using LLM
_magicfind_generate() {
    local query="$1"
    local context="${2:-}"
    local use_rules="${3:-true}"

    local prompt="Generate a single bash command to: $query

Requirements:
- Output ONLY the bash command, no explanation
- Use find, grep, rg, or similar standard tools
- Work in current directory unless path specified
- Handle errors gracefully (use 2>/dev/null if needed)"

    # Add rules if enabled
    if [[ "$use_rules" == "true" ]]; then
        local rules=$(_magicfind_rules_all)
        [[ -n "$rules" ]] && prompt+="

$rules"
    fi

    # Add error context for retries
    [[ -n "$context" ]] && prompt+="

Previous error to fix: $context"

    # Call LLM via qq
    local response
    response=$(qq "$prompt" 2>/dev/null)

    # Extract bash code block if present
    if [[ "$response" =~ \`\`\` ]]; then
        echo "$response" | sed -n '/```/,/```/p' | sed '1d;$d' | head -1
    else
        echo "$response" | head -1
    fi
}

# Main magicfind function
magicfind() {
    local dry_run=false
    local verbose=false
    local use_rules=true
    local use_cache=true
    local max_attempts=5

    # Initialize
    _magicfind_rules_init

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -n|--dry-run)   dry_run=true; shift ;;
            -v|--verbose)   verbose=true; shift ;;
            --no-rules)     use_rules=false; shift ;;
            --no-cache)     use_cache=false; shift ;;
            --threshold)    MAGICFIND_SIMILARITY_THRESHOLD="$2"; shift 2 ;;
            --attempts)     max_attempts="$2"; shift 2 ;;
            --)             shift; break ;;
            -*)
                echo "Unknown option: $1" >&2
                _magicfind_help
                return 1
                ;;
            *)              break ;;
        esac
    done

    # Subcommands
    case "$1" in
        rules)    shift; _magicfind_rules "$@"; return ;;
        db)       shift; _magicfind_db_cmd "$@"; return ;;
        spec|specs) shift; _magicfind_spec "$@"; return ;;
        list)     shift; _magicfind_db_list "$@"; return ;;
        show)     shift; _magicfind_db_show "$@"; return ;;
        replay)   shift; _magicfind_db_replay "$@"; return ;;
        search)   shift; _magicfind_db_search "$@"; return ;;
        similar)  shift; _magicfind_db_similar "$@"; return ;;
        doctor)   shift; _magicfind_doctor "$@"; return ;;
        help|-h)  _magicfind_help; return ;;
    esac

    local query="$*"
    if [[ -z "$query" ]]; then
        _magicfind_help
        return 1
    fi

    # Check for matching scanspec first (fast, deterministic)
    local spec_file
    spec_file=$(scanspec_match "$query" 2>/dev/null)
    if [[ -n "$spec_file" ]]; then
        $verbose && echo "Using scanspec: $spec_file" >&2
        scanspec_run "$spec_file"
        return $?
    fi

    # Pre-flight check for LLM backend
    if ! _magicfind_preflight; then
        echo "Error: LLM backend not ready" >&2
        echo "  Run: magicfind doctor" >&2
        echo "  Or use scanspecs: magicfind spec list" >&2
        return 1
    fi
    $verbose && echo "LLM backend ready" >&2

    # Check cache for similar query
    if $use_cache; then
        local cached_ts=$(_magicfind_db_find_similar "$query")
        if [[ -n "$cached_ts" ]]; then
            $verbose && echo "Cache hit: $cached_ts" >&2
            local cached_cmd=$(_magicfind_db_get "$cached_ts" "cmd")

            if $dry_run; then
                echo "$cached_cmd"
                return 0
            fi

            # Create new record linked to cached
            local ts=$(_magicfind_db_new "$query")
            _magicfind_db_save_cmd "$ts" "$cached_cmd"
            _magicfind_db_save_meta "$ts" "cached=true" "source=$cached_ts"

            # Execute
            local output
            output=$(bash -c "$cached_cmd" 2>&1)
            local exit_code=$?

            _magicfind_db_save_result "$ts" "$exit_code" "$output"
            _magicfind_db_append_meta "$ts" "status=$( (( exit_code == 0 )) && echo success || echo fail )"

            if [[ -n "$output" ]]; then
                echo "$output"
            else
                echo "(no results)" >&2
            fi
            return $exit_code
        fi
    fi

    # Create record for this session
    local session_ts=$(_magicfind_db_new "$query")
    $verbose && echo "Session: $session_ts" >&2

    local attempt=1
    local error_context=""
    local prev_ts=""

    while ((attempt <= max_attempts)); do
        $verbose && echo "Attempt $attempt..." >&2

        # Create attempt record (first attempt uses session ts)
        local ts
        if ((attempt == 1)); then
            ts="$session_ts"
        else
            ts=$(_magicfind_db_new "$query (retry $attempt: $error_context)")
            _magicfind_db_save_meta "$ts" "prev=$prev_ts" "attempt=$attempt"
        fi

        # Generate command
        local cmd=$(_magicfind_generate "$query" "$error_context" "$use_rules")

        if [[ -z "$cmd" ]]; then
            echo "Error: LLM returned empty response" >&2
            error_context="LLM returned empty response"
            prev_ts="$ts"
            ((attempt++))
            continue
        fi

        _magicfind_db_save_cmd "$ts" "$cmd"
        $verbose && echo "Generated: $cmd" >&2

        # Dry run mode
        if $dry_run; then
            _magicfind_db_save_meta "$ts" "status=dry_run"
            echo "$cmd"
            return 0
        fi

        # Execute
        local output
        output=$(bash -c "$cmd" 2>&1)
        local exit_code=$?

        _magicfind_db_save_result "$ts" "$exit_code" "$output"

        if ((exit_code == 0)); then
            _magicfind_db_append_meta "$ts" "status=success" "attempts=$attempt"
            $verbose && echo "Success on attempt $attempt" >&2

            if [[ -n "$output" ]]; then
                echo "$output"
            else
                echo "(no results)" >&2
            fi
            return 0
        else
            _magicfind_db_append_meta "$ts" "status=fail"
            $verbose && echo "Failed: $output" >&2

            error_context="Command: $cmd
Error: $output
Exit: $exit_code"
            prev_ts="$ts"
            ((attempt++))
        fi
    done

    echo "Failed after $max_attempts attempts" >&2
    echo "Session: $session_ts" >&2
    return 1
}

# Database subcommand handler
_magicfind_db_cmd() {
    local action="${1:-stats}"
    shift 2>/dev/null || true

    case "$action" in
        stats)   _magicfind_db_stats ;;
        clean)   _magicfind_db_clean "$@" ;;
        path)    echo "$MAGICFIND_DIR/db" ;;
        *)       echo "Unknown: $action (try: stats, clean, path)" >&2; return 1 ;;
    esac
}

# Help
_magicfind_help() {
    cat << 'HELPTEXT'
magicfind - LLM-assisted file search

USAGE:
    magicfind [options] <query>        Search with natural language
    magicfind spec [name]              Run/list scanspec patterns
    magicfind list [N]                 List recent queries
    magicfind show <ts>                Show record details
    magicfind replay <ts> [var=val]    Replay a command
    magicfind search <pattern>         Search queries (grep)
    magicfind similar <query>          Find similar past queries (ranked)
    magicfind rules [action]           Manage rules
    magicfind db [action]              Database operations
    magicfind doctor [--test]          Check configuration and LLM backend
    magicfind help                     Show this help

OPTIONS:
    -n, --dry-run    Show command without executing
    -v, --verbose    Show progress
    --no-rules       Skip rules
    --no-cache       Skip cache lookup
    --threshold N    Similarity threshold 0-100 (default: 70)
    --attempts N     Max retry attempts (default: 5)

SCANSPEC:
    magicfind spec                     List available specs
    magicfind spec <name>              Run a spec by name
    magicfind spec show <name>         Show spec details
    magicfind spec match <query>       Find matching spec

EXAMPLES:
    magicfind "find all .md files sorted by date"
    magicfind -n "count lines in shell scripts"
    magicfind similar "find markdown files"     # show similar past queries
    magicfind --threshold 50 "find scripts"     # lower threshold for cache
    magicfind spec tds-old             Run tds-old scanspec
    magicfind replay 1735412345 ext=py
    magicfind rules add "prefer rg over grep"

TEMPLATE VARIABLES:
    Use {{var}} in queries for reusable templates:
    magicfind "find all {{ext}} files"
    magicfind replay 1735412345 ext=sh
HELPTEXT
}
