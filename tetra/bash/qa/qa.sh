#!/usr/bin/env bash

# QA Module - Question & Answer System for Tetra
# Main entry point with command interface like TSM/TKM

# QA Module Environment Variables with proper override guards
: "${QA_SRC:=$TETRA_SRC/bash/qa}"
: "${QA_DIR:=$TETRA_DIR/qa}"

# QA Directory Convention under TETRA_DIR
QA_DB_DIR="${QA_DIR}/db"
QA_CONFIG_DIR="${QA_DIR}/config"
QA_LOGS_DIR="${QA_DIR}/logs"

# Engine / context / API key files live under QA_DIR
: "${QA_ENGINE_FILE:=$QA_DIR/engine}"
: "${QA_CONTEXT_FILE:=$QA_DIR/context}"
: "${OPENAI_API_FILE:=$QA_DIR/api_key}"

# QA Module Management
QA_MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# QA modules to source (v2 - added qa_selector.sh)
QA_MODULES=(
    "$QA_MODULE_DIR/qa_core.sh"
    "$QA_MODULE_DIR/qa_channels.sh"
    "$QA_MODULE_DIR/qa_selector.sh"
    "$QA_MODULE_DIR/qa_views.sh"
    "$QA_MODULE_DIR/qa_doctor.sh"
    "$QA_MODULE_DIR/qa_repl.sh"
    "$QA_MODULE_DIR/qa_search.sh"
)

# Source QA modules
qa_source_modules() {
    local verbose="${1:-false}"
    
    for module in "${QA_MODULES[@]}"; do
        if [[ -f "$module" ]]; then
            source "$module"
            [[ "$verbose" == "true" ]] && echo "✓ Sourced: $(basename "$module")"
        else
            echo "Warning: Module not found: $(basename "$module")" >&2
        fi
    done
}

# Initialize QA environment
qa_init() {
    # Validate TETRA_DIR first
    if [[ -z "$TETRA_DIR" ]]; then
        echo "Error: TETRA_DIR environment variable not set" >&2
        return 1
    fi
    
    # Create necessary directories
    mkdir -p "$QA_DB_DIR" "$QA_CONFIG_DIR" "$QA_LOGS_DIR"
    
    # Source modules
    qa_source_modules
}

# Main qa command interface
qa() {
    # Lazy load QA modules on first invocation
    if [[ "${QA_MODULES_LOADED:-false}" != "true" ]]; then
        qa_source_modules
        export QA_MODULES_LOADED=true
    fi

    local action="${1:-}"

    if [[ -z "$action" ]]; then
        cat <<'EOF'
qa - Question/Answer Knowledge Base

FIRST USE
  config apikey <key>   Set OpenAI API key
  config engine gpt-4o  Set model
  qq "test query"       Verify it works

STRUCTURE
  $TETRA_DIR/qa/
  ├── db/               Main database (on the record)
  ├── channels/         Named channels (tags)
  │   ├── 1,2,3,4/      Scratch channels
  │   └── my-project/   Named channels
  └── views/            TOML-configured views for RAG

ASK QUESTIONS (qq writes)
  qq "question"         Ask, write to db
  qq :git "question"    Ask, write to channel "git"
  qq :2 "question"      Ask, write to channel 2
  qq1, qq2, qqq         Shortcuts for numbered channels

VIEW (q and a read)
  q                     Last question from db
  q 5                   5th question back
  q git                 Last question from channel "git"
  q git 5               5th question back from "git"
  a / a 5 / a git       Same pattern for answers

CHANNEL MANAGEMENT
  channels              List all channels
  channel create foo    Create named channel
  promote 2 myproj      Rename channel 2 → myproj
  merge git             Copy channel "git" → db
  clear 2               Archive channel 2

EXPORT
  export                Export db as jsonl
  export git md         Export channel as markdown
  export --all jsonl    Export everything

TOOLS
  summary [channel]     LLM summary of channel
  doctor                Health check
  browse                Interactive browser
  repl                  Interactive shell

VIEWS (RAG)
  view create <name>    Create view with TOML config
  view add <name> <id>  Add entries to view
EOF
        return 0
    fi
    
    # Initialize if not already done
    qa_init
    
    shift || true
    
    case "$action" in
        "query"|"q")
            qa_query "$@"
            ;;
        "status"|"s")
            qa_status
            ;;
        "help"|"h")
            qa
            ;;

        # Config commands
        "config"|"cfg")
            local subcmd="${1:-show}"
            shift 2>/dev/null || true
            case "$subcmd" in
                show)
                    qa_status
                    ;;
                engine)
                    qa_set_engine "$1"
                    ;;
                apikey|key)
                    qa_set_apikey "$1"
                    ;;
                context)
                    qa_set_context "$1"
                    ;;
                *)
                    echo "Config commands: show, engine, apikey, context"
                    ;;
            esac
            ;;
        "set-engine")
            qa_set_engine "$1"
            ;;
        "set-apikey")
            qa_set_apikey "$1"
            ;;
        "set-context")
            qa_set_context "$1"
            ;;

        # Answer/retrieval
        "last"|"a")
            a "$1"
            ;;
        "list"|"ls")
            qa_list "$@"
            ;;
        "fa")
            fa "$@"
            ;;

        # Search
        "search")
            qa_search "$@"
            ;;
        "browse")
            qa_browse "$1"
            ;;
        "browse-raw")
            qa_browse raw
            ;;
        "viewer")
            if [[ -n "$1" ]]; then
                export QA_VIEWER="$1"
                echo "Viewer set to: $1"
            else
                source "$QA_SRC/qa_search.sh"
                echo "Current viewer: $(_qa_get_viewer)"
                echo "Available: chroma (default), raw"
            fi
            ;;

        # Channel commands
        "channels"|"ch")
            qa_channels "$@"
            ;;
        "channel")
            local subcmd="${1:-}"
            shift 2>/dev/null || true
            case "$subcmd" in
                create)
                    qa_channel_create "$@"
                    ;;
                delete|rm)
                    qa_channel_delete "$@"
                    ;;
                rename|mv)
                    qa_channel_rename "$@"
                    ;;
                ""|list)
                    qa_channels
                    ;;
                *)
                    echo "Channel commands: create, delete, rename, list"
                    ;;
            esac
            ;;
        "export")
            qa_export "$@"
            ;;
        "promote")
            qa_promote_channel "$@"
            ;;
        "merge")
            qa_merge_channel "$@"
            ;;
        "move"|"mv")
            qa_move "$@"
            ;;
        "clear")
            qa_clear "$@"
            ;;

        # View commands (symlink collections for RAG)
        "view"|"views")
            qa_view "$@"
            ;;

        # Diagnostic tools
        "doctor"|"doc")
            qa_doctor
            ;;
        "summary"|"stats")
            qa_summary "$@"
            ;;
        "gc")
            qa_gc "$@"
            ;;

        # Other tools
        "test")
            qa_test
            ;;
        "repl")
            qa_repl
            ;;
        "init")
            qa_init
            echo "QA system initialized"
            ;;

        *)
            echo "Unknown command: $action"
            echo "Run 'qa' for help"
            return 1
            ;;
    esac
}

# Ask a question - writes to db or specified channel
# Usage:
#   qq my question          - Query to db (on the record)
#   qq :git my question     - Query to channel "git"
#   qq :2 my question       - Query to channel 2
#   qq @foo my question     - Query to channel "foo" (@ prefix)
#
# To VIEW entries, use q (questions) or a (answers):
#   q / q 5 / q git / q git 5
#   a / a 5 / a git / a git 5
qq() {
    # Ensure modules are loaded before using shortcut
    if [[ "${QA_MODULES_LOADED:-false}" != "true" ]]; then
        qa_source_modules
        export QA_MODULES_LOADED=true
    fi

    # Check for :channel syntax (write to named channel)
    if [[ "$1" =~ ^: ]]; then
        local channel="${1#:}"
        shift
        if [[ -z "$*" ]]; then
            echo "Usage: qq :channel your question here" >&2
            return 1
        fi
        _qq_channel "$channel" "$@"
    # Check for @channel syntax (alternate prefix)
    elif [[ "$1" =~ ^@ ]]; then
        local channel="${1#@}"
        shift
        _qq_channel "$channel" "$@"
    # Check for numeric channel
    elif [[ "$1" =~ ^[0-9]+$ ]] && [[ -n "$2" ]]; then
        local channel="$1"
        shift
        _qq_channel "$channel" "$@"
    else
        # Default: write to db (on the record)
        _qq_channel db "$@"
    fi
}

# One-off query shortcut - now uses channel 2
qqq() {
    # Ensure modules are loaded
    if [[ "${QA_MODULES_LOADED:-false}" != "true" ]]; then
        qa_source_modules
        export QA_MODULES_LOADED=true
    fi
    qq2 "$@"
}

# =============================================================================
# CHANNEL SHORTCUTS (defined here, implementations in qa_channels.sh)
# =============================================================================

# Note: qq1-4, a1-4, q1-4 are defined in qa_channels.sh
# These wrappers handle @channel syntax for a and q

# Answer retrieval with @channel support
# Usage: a [@channel] [index]
_a_with_channel() {
    if [[ "${QA_MODULES_LOADED:-false}" != "true" ]]; then
        qa_source_modules
        export QA_MODULES_LOADED=true
    fi

    if [[ "$1" =~ ^@ ]]; then
        _a_channel "$@"
    else
        # Use original a() from qa_core.sh
        a "$@"
    fi
}

# Question retrieval with @channel support
# Usage: qa_q [@channel] [index]
_q_with_channel() {
    if [[ "${QA_MODULES_LOADED:-false}" != "true" ]]; then
        qa_source_modules
        export QA_MODULES_LOADED=true
    fi

    if [[ "$1" =~ ^@ ]]; then
        _q_channel "$@"
    else
        # Use original q() from qa_core.sh
        q "$@"
    fi
}

# Export essential module variables and functions
export QA_SRC QA_DIR

export -f qa qa_init qa_source_modules
export -f qq qqq _a_with_channel _q_with_channel

# Note: QA sub-modules are now lazy-loaded on first use of 'qa' or 'qq' commands