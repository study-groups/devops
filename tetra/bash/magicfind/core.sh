#!/usr/bin/env bash
# mf core - main entry point

# Generate command from query using LLM
_mf_generate() {
    local query="$1"
    local context="${2:-}"
    local use_rules="${3:-true}"

    local prompt="Generate a single bash command to: $query

Requirements:
- Output ONLY the bash command, no explanation
- Use rg (ripgrep), find, or grep (prefer rg for text search)
- Search RECURSIVELY from current directory unless path specified
- For case-insensitive search use -i flag
- Handle errors gracefully (use 2>/dev/null where appropriate)
- IMPORTANT: When piping rg/grep output to other commands, extract filenames first with cut -d: -f1 | sort -u
- IMPORTANT: Do NOT suppress stderr on the final output command -- only on intermediate steps
- Keep commands simple. Prefer 'rg -il pattern .' over complex pipelines when just finding files
- Only add sorting/stat if explicitly requested. Simple file lists are fine."

    # Add rules if enabled
    if [[ "$use_rules" == "true" ]]; then
        local rules=$(_mf_rules_all)
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
mf() {
    local dry_run=false
    local verbose=false
    local use_rules=true
    local use_cache=true
    local max_attempts=5

    # Initialize
    _mf_rules_init

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -n|--dry-run)   dry_run=true; shift ;;
            -v|--verbose)   verbose=true; shift ;;
            --no-rules)     use_rules=false; shift ;;
            --no-cache)     use_cache=false; shift ;;
            --threshold)    MF_SIMILARITY_THRESHOLD="$2"; shift 2 ;;
            --attempts)     max_attempts="$2"; shift 2 ;;
            --)             shift; break ;;
            -*)
                echo "Unknown option: $1" >&2
                _mf_help
                return 1
                ;;
            *)              break ;;
        esac
    done

    # Subcommands
    case "$1" in
        rules)    shift; _mf_rules "$@"; return ;;
        db)       shift; _mf_db_cmd "$@"; return ;;
        list)     shift; _mf_db_list "$@"; return ;;
        show)     shift; _mf_db_show "$@"; return ;;
        replay)   shift; _mf_db_replay "$@"; return ;;
        search)   shift; _mf_db_search "$@"; return ;;
        similar)  shift; _mf_db_similar "$@"; return ;;
        help|-h)  _mf_help; return ;;
    esac

    local query="$*"
    if [[ -z "$query" ]]; then
        _mf_help
        return 1
    fi

    # Check for qq function (LLM backend)
    if ! declare -f qq &>/dev/null; then
        echo "Error: qq function not found. Load qa module." >&2
        return 1
    fi

    # Check cache for similar query
    if $use_cache; then
        local cached_ts=$(_mf_db_find_similar "$query")
        if [[ -n "$cached_ts" ]]; then
            $verbose && echo "Cache hit: $cached_ts" >&2
            local cached_cmd=$(_mf_db_get "$cached_ts" "cmd")

            if $dry_run; then
                echo "$cached_cmd"
                return 0
            fi

            # Create new record linked to cached
            local ts=$(_mf_db_new "$query")
            _mf_db_save_cmd "$ts" "$cached_cmd"
            _mf_db_save_meta "$ts" "cached=true" "source=$cached_ts"

            # Execute
            local output
            output=$(bash -c "$cached_cmd" 2>&1)
            local exit_code=$?

            _mf_db_save_result "$ts" "$exit_code" "$output"

            if ((exit_code == 0)) && [[ -n "$output" ]]; then
                _mf_db_append_meta "$ts" "status=success"
                echo "$output"
                return 0
            elif ((exit_code == 0)); then
                _mf_db_append_meta "$ts" "status=empty"
                $verbose && echo "Cached command returned empty, falling through to generate..." >&2
                # Fall through to LLM generation below
            else
                _mf_db_append_meta "$ts" "status=fail"
                echo "(cached command failed, regenerating...)" >&2
                # Fall through to LLM generation below
            fi
        fi
    fi

    # Create record for this session
    local session_ts=$(_mf_db_new "$query")
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
            ts=$(_mf_db_new "$query (retry $attempt: $error_context)")
            _mf_db_save_meta "$ts" "prev=$prev_ts" "attempt=$attempt"
        fi

        # Generate command
        local cmd=$(_mf_generate "$query" "$error_context" "$use_rules")

        if [[ -z "$cmd" ]]; then
            echo "Error: LLM returned empty response" >&2
            error_context="LLM returned empty response"
            prev_ts="$ts"
            ((attempt++))
            continue
        fi

        _mf_db_save_cmd "$ts" "$cmd"
        $verbose && echo "Generated: $cmd" >&2

        # Dry run mode
        if $dry_run; then
            _mf_db_save_meta "$ts" "status=dry_run"
            echo "$cmd"
            return 0
        fi

        # Execute
        local output
        output=$(bash -c "$cmd" 2>&1)
        local exit_code=$?

        _mf_db_save_result "$ts" "$exit_code" "$output"

        if ((exit_code == 0)) && [[ -n "$output" ]]; then
            _mf_db_append_meta "$ts" "status=success" "attempts=$attempt"
            $verbose && echo "Success on attempt $attempt" >&2
            echo "$output"
            return 0
        elif ((exit_code == 0)); then
            # Command ran but found nothing -- treat as soft failure
            _mf_db_append_meta "$ts" "status=empty"
            $verbose && echo "Empty results on attempt $attempt, retrying..." >&2
            error_context="Command ran successfully but produced NO output. The search term likely exists but the pipeline lost the results. Try a simpler command. Previous command was: $cmd"
            prev_ts="$ts"
            ((attempt++))
            continue
        else
            _mf_db_append_meta "$ts" "status=fail"
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
_mf_db_cmd() {
    local action="${1:-stats}"
    shift 2>/dev/null || true

    case "$action" in
        stats)   _mf_db_stats ;;
        clean)   _mf_db_clean "$@" ;;
        path)    echo "$MF_DIR/db" ;;
        *)       echo "Unknown: $action (try: stats, clean, path)" >&2; return 1 ;;
    esac
}

# Help
_mf_help() {
    cat << 'HELPTEXT'
mf - LLM-assisted file search (magicfind)

USAGE:
    mf [options] <query>           Search with natural language
    mf list [N]                    List recent queries
    mf show <ts>                   Show record details
    mf replay <ts> [var=val]       Replay a command
    mf search <pattern>            Search queries (grep)
    mf similar <query>             Find similar past queries
    mf rules [action]              Manage rules
    mf db [action]                 Database operations
    mf help                        Show this help

OPTIONS:
    -n, --dry-run    Show command without executing
    -v, --verbose    Show progress
    --no-rules       Skip rules
    --no-cache       Skip cache lookup
    --threshold N    Similarity threshold 0-100 (default: 70)
    --attempts N     Max retry attempts (default: 5)

EXAMPLES:
    mf "find all .md files sorted by date"
    mf -n "count lines in shell scripts"
    mf similar "find markdown files"
    mf replay 1735412345 ext=py
    mf rules add "prefer rg over grep"

TEMPLATE VARIABLES:
    Use {{var}} in queries for reusable templates:
    mf "find all {{ext}} files"
    mf replay 1735412345 ext=sh

DATABASE:
    ~/tetra/magicfind/db/{ts}.query   Natural language query
    ~/tetra/magicfind/db/{ts}.cmd     Generated bash command
    ~/tetra/magicfind/db/{ts}.result  Execution result
    ~/tetra/magicfind/db/{ts}.meta    Metadata (status, prev, etc)
HELPTEXT
}
