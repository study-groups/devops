#!/usr/bin/env bash

# QA REPL - Interactive Question & Answer system

# Load shared REPL utilities
source "${TETRA_SRC:-$HOME/src/devops/tetra}/bash/utils/repl_utils.sh"

qa_repl() {
    echo "🤖 QA Interactive REPL - Question & Answer System"
    echo "Commands: query, set-engine, set-context, search, browse, help, status, exit"
    echo "Current engine: $(_get_qa_engine)"
    echo "Current context: $(_get_qa_context)"
    echo "Tip: Just type your question directly to query!"
    echo

    while true; do
        read -e -p "qa> " input

        # Handle empty input
        [[ -z "$input" ]] && continue

        # Add to history
        history -s "$input"

        # Parse command and arguments
        read -r cmd args <<< "$input"

        case "$cmd" in
            "exit"|"quit"|"q")
                echo "Thanks for using QA! Happy learning!"
                break
                ;;
            "help"|"h")
                _qa_repl_help "$args"
                ;;
            "status"|"s")
                _qa_repl_status
                ;;
            "query"|"q"|"ask")
                if [[ -n "$args" ]]; then
                    echo "🔍 Querying: $args"
                    qq "$args"
                else
                    echo "Usage: query <your question>"
                fi
                ;;
            "set-engine")
                if [[ -n "$args" ]]; then
                    qa_set_engine "$args"
                    echo "✓ Engine set to: $args"
                else
                    echo "Current engine: $(_get_qa_engine)"
                    echo "Available engines: gpt-4, gpt-3.5-turbo, claude"
                fi
                ;;
            "set-context")
                if [[ -n "$args" ]]; then
                    qa_set_context "$args"
                    echo "✓ Context set to: $args"
                else
                    echo "Current context: $(_get_qa_context)"
                fi
                ;;
            "set-apikey")
                if [[ -n "$args" ]]; then
                    qa_set_apikey "$args"
                    echo "✓ API key updated"
                else
                    echo "Current API key file: $OPENAI_API_FILE"
                fi
                ;;
            "last"|"a")
                if [[ -n "$args" ]]; then
                    a "$args"
                else
                    a
                fi
                ;;
            "search")
                if [[ -n "$args" ]]; then
                    echo "🔍 Searching: $args"
                    qa_search "$args"
                else
                    echo "Usage: search <term>"
                fi
                ;;
            "browse")
                echo "📖 Browsing answers..."
                qa_browse
                ;;
            "browse-glow")
                echo "📖 Browsing with glow..."
                qa_browse_glow
                ;;
            "test")
                echo "🧪 Running test query..."
                qa_test
                ;;
            "clear")
                clear
                ;;
            "pwd")
                pwd
                ;;
            "ls")
                ls $args
                ;;
            "")
                # Empty input, continue
                ;;
            *)
                # Treat as direct query
                echo "🔍 Querying: $input"
                qq "$input"
                ;;
        esac
    done
}

_qa_repl_help() {
    local topic="$1"

    case "$topic" in
        "engines")
            cat <<EOF
🤖 Available QA Engines:

OpenAI Models:
  gpt-4              - Most capable, slower, more expensive
  gpt-3.5-turbo      - Fast and efficient, good for most queries
  gpt-4-turbo        - Faster GPT-4 variant

Anthropic Models:
  claude             - Claude AI assistant
  claude-3           - Latest Claude model

Usage:
  set-engine gpt-4
  set-engine claude
EOF
            ;;
        "commands")
            cat <<EOF
🤖 QA REPL Commands:

Query Commands:
  query <question>     - Ask a question explicitly
  search <term>        - Search through previous answers
  last [n]             - Show last answer (or nth from last)
  browse               - Browse all answers interactively
  browse-glow          - Browse answers with glow preview
  test                 - Run test query

Configuration:
  set-engine <name>    - Set AI engine (gpt-4, claude, etc.)
  set-context <text>   - Set default context for queries
  set-apikey <key>     - Set API key
  status               - Show system status

System:
  help [topic]         - Show help (engines, commands)
  clear                - Clear screen
  pwd                  - Show current directory
  ls [args]            - List files
  exit, quit, q        - Exit REPL

Note: You can also just type your question directly!
EOF
            ;;
        *)
            cat <<EOF
🤖 QA Interactive REPL Help:

Quick Start:
  Just type your question! No need for 'query' command.

Examples:
  What is the capital of France?
  How do I use git rebase?
  Explain quantum computing

Configuration:
  set-engine gpt-4     - Use GPT-4 for responses
  set-context "Python developer" - Set context for all queries

Browse History:
  last                 - Show last answer
  search <term>        - Find previous answers
  browse               - Interactive answer browser

Help Topics:
  help commands        - All available commands
  help engines         - Available AI engines

Type 'exit' to quit the REPL.
EOF
            ;;
    esac
}

_qa_repl_status() {
    echo "🤖 QA System Status:"
    echo "=================="
    echo "Engine: $(_get_qa_engine)"
    echo "Context: $(_get_qa_context)"
    echo ""
    echo "Directories:"
    echo "  QA_DIR: ${QA_DIR:-<not set>}"
    echo "  DB Dir: ${QA_DB_DIR:-<not set>}"
    echo "  Config Dir: ${QA_CONFIG_DIR:-<not set>}"
    echo ""
    echo "Configuration files:"
    [[ -f "$QA_ENGINE_FILE" ]] && echo "  ✓ Engine file: $QA_ENGINE_FILE" || echo "  ○ Engine file: $QA_ENGINE_FILE (default)"
    [[ -f "$QA_CONTEXT_FILE" ]] && echo "  ✓ Context file: $QA_CONTEXT_FILE" || echo "  ○ Context file: $QA_CONTEXT_FILE (default)"
    [[ -f "$OPENAI_API_FILE" ]] && echo "  ✓ API key file: $OPENAI_API_FILE" || echo "  ✗ API key file: $OPENAI_API_FILE (missing)"
    echo ""
    echo "Storage directories:"
    [[ -d "$QA_DB_DIR" ]] && echo "  ✓ $QA_DB_DIR" || echo "  ✗ $QA_DB_DIR (missing)"
    [[ -d "$QA_CONFIG_DIR" ]] && echo "  ✓ $QA_CONFIG_DIR" || echo "  ✗ $QA_CONFIG_DIR (missing)"
    [[ -d "$QA_LOGS_DIR" ]] && echo "  ✓ $QA_LOGS_DIR" || echo "  ✗ $QA_LOGS_DIR (missing)"
}

# REPL function available when module is loaded