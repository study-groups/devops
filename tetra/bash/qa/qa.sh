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

# QA modules to source
QA_MODULES=(
    "$QA_MODULE_DIR/qa_core.sh"
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
            echo "⚠ Module not found: $(basename "$module")" >&2
        fi
    done
}

# Initialize QA environment
qa_init() {
    # Validate TETRA_DIR first
    if [[ -z "$TETRA_DIR" ]]; then
        echo "❌ Error: TETRA_DIR environment variable not set" >&2
        return 1
    fi
    
    # Create necessary directories
    mkdir -p "$QA_DB_DIR" "$QA_CONFIG_DIR" "$QA_LOGS_DIR"
    
    # Source modules
    qa_source_modules
}

# Main qa command interface
qa() {
    local action="${1:-}"
    
    if [[ -z "$action" ]]; then
        cat <<'EOF'
Usage: qa <command> [args]

Commands:
  query|q <text>        Ask a question
  status|s              Show system status
  help|h                Show help
  set-engine <engine>   Set the AI engine
  set-apikey <key>      Set API key
  set-context <text>    Set default context
  last|a [index]        Show last answer (or nth from last)
  search <term>         Search through previous answers
  browse                Browse all answers interactively
  browse-glow           Browse answers with glow preview
  test                  Run test query
  repl                  Start interactive REPL
  init                  Initialize QA system

Examples:
  qa query "What is the capital of France?"
  qa search "capital"
  qa browse
  qa set-engine gpt-4
  qa last
  qa repl
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
            qa_help
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
        "last"|"a")
            a "$1"
            ;;
        "search")
            qa_search "$@"
            ;;
        "browse")
            qa_browse
            ;;
        "browse-glow")
            qa_browse_glow
            ;;
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
            echo "Use 'qa help' for available commands"
            return 1
            ;;
    esac
}

# Shortcut command
qq() { qa_query "$@"; }

# Source modules immediately when this file is loaded
qa_source_modules

# Export essential module variables
export QA_SRC QA_DIR