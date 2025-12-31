#!/usr/bin/env bash

# QA REPL - Interactive Question & Answer system (v2)
# Now with channel awareness and selector syntax

# Load shared REPL utilities
source "${TETRA_SRC:-$HOME/src/devops/tetra}/bash/utils/repl_utils.sh"

# Current channel for REPL queries (default: db)
QA_REPL_CHANNEL="${QA_REPL_CHANNEL:-db}"

qa_repl() {
    echo "QA Interactive REPL (v2) - Question & Answer System"
    echo "Commands: channels, query, search, browse, help, status, exit"
    echo "Current engine: $(_get_qa_engine)"
    echo "Current channel: $QA_REPL_CHANNEL"
    echo "Tip: Type your question directly to query the current channel"
    echo "     Use 'channels' for channel help, 'channel <name>' to switch"
    echo

    while true; do
        # Show current channel in prompt
        local prompt="qa"
        [[ "$QA_REPL_CHANNEL" != "db" ]] && prompt="qa[$QA_REPL_CHANNEL]"
        read -e -p "$prompt> " input

        # Handle empty input
        [[ -z "$input" ]] && continue

        # Add to history
        history -s "$input"

        # Parse command and arguments
        read -r cmd args <<< "$input"

        case "$cmd" in
            "exit"|"quit"|"q")
                echo "Exiting QA REPL"
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
                    echo "Querying: $args"
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
            "channel"|"ch")
                if [[ -n "$args" ]]; then
                    QA_REPL_CHANNEL="$args"
                    echo "Switched to channel: $QA_REPL_CHANNEL"
                else
                    echo "Current channel: $QA_REPL_CHANNEL"
                    echo "Usage: channel <name|number|db>"
                fi
                ;;
            "channels")
                qa_channels
                ;;
            "last"|"a")
                # Show last answer from current channel
                if [[ -n "$args" ]]; then
                    _a_channel "$QA_REPL_CHANNEL" "$args"
                else
                    _a_channel "$QA_REPL_CHANNEL"
                fi
                ;;
            "search")
                if [[ -n "$args" ]]; then
                    echo "Searching: $args"
                    qa_search "$args"
                else
                    echo "Usage: search <term>"
                fi
                ;;
            "browse")
                # Optional viewer argument: browse [chroma|raw]
                if [[ -n "$args" ]]; then
                    qa_browse "$args"
                else
                    qa_browse
                fi
                ;;
            "browse-raw")
                qa_browse raw
                ;;
            "viewer")
                if [[ -n "$args" ]]; then
                    export QA_VIEWER="$args"
                    echo "Viewer set to: $args"
                else
                    echo "Current viewer: $(_qa_get_viewer)"
                    echo "Available: chroma (default), raw"
                    echo "Usage: viewer <name>"
                fi
                ;;
            "test")
                echo "Running test query..."
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
                # Treat as direct query - route through current channel
                echo "Querying [$QA_REPL_CHANNEL]: $input"
                _qq_channel "$QA_REPL_CHANNEL" "$input"
                ;;
        esac
    done
}

_qa_repl_help() {
    local topic="$1"

    case "$topic" in
        "engines")
            cat <<EOF
Available QA Engines:

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
        "channels")
            cat <<EOF
QA Channel System:

STRUCTURE
  db/               Main database (on the record)
  channels/1-4      Numbered scratch channels
  channels/<name>   Named channels (tags)

REPL CHANNEL COMMANDS
  channel           Show current channel
  channel db        Switch to main database
  channel 2         Switch to channel 2
  channel git       Switch to channel "git"
  channels          List all channels with counts

SHELL COMMANDS
  qq :git question  Ask, write to channel "git"
  qq :2 question    Ask, write to channel 2
  q git             View last question from "git"
  q git 5           View 5th back from "git"
  a git             View last answer from "git"

CHANNEL MANAGEMENT
  qa channels       List channels
  qa promote 2 foo  Move channel 2 → foo
  qa clear 2        Archive channel 2
  qa export git md  Export as markdown
EOF
            ;;
        "commands")
            cat <<EOF
QA REPL Commands:

Channel Commands:
  channel [name]       - Show or switch channel (db, 1-4, name)
  channels             - List all channels with counts

Query Commands:
  <question>           - Query current channel directly
  query <question>     - Query explicitly
  search <term>        - Search through answers
  last [n]             - Last answer from current channel
  browse [viewer]      - Browse answers (chroma or raw)
  test                 - Run test query

Configuration:
  set-engine <name>    - Set AI engine (gpt-4, claude, etc.)
  set-context <text>   - Set default context
  set-apikey <key>     - Set API key
  viewer [name]        - Show or set viewer
  status               - Show system status

System:
  help [topic]         - Show help (channels, commands, engines)
  clear                - Clear screen
  exit, quit, q        - Exit REPL

Note: Questions go to the current channel (shown in prompt)
EOF
            ;;
        *)
            cat <<EOF
QA Interactive REPL Help:

Quick Start:
  Type your question directly - goes to current channel.
  Prompt shows: qa> (db) or qa[2]> (channel 2)

Channel Workflow:
  channel db        Switch to main db (on the record)
  channel git       Switch to channel "git"
  channels          List all channels

Examples:
  What is the capital of France?
  channel git                    # switch to git channel
  How do I use git rebase?       # goes to channel git

Browse History:
  last              - Last answer from current channel
  search <term>     - Find previous answers
  browse            - Interactive browser

Help Topics:
  help channels     - Channel system explained
  help commands     - All REPL commands
  help engines      - Available AI engines

Type 'exit' to quit the REPL.
EOF
            ;;
    esac
}

_qa_repl_status() {
    echo "QA System Status:"
    echo "================"
    echo "Current channel: $QA_REPL_CHANNEL"
    echo "Engine: $(_get_qa_engine)"
    echo "Context: $(_get_qa_context)"
    echo "Viewer: $(_qa_get_viewer)"
    echo ""
    echo "Directory structure:"
    echo "  QA_DIR: ${QA_DIR:-<not set>}"
    local base="${QA_DIR:-$TETRA_DIR/qa}"
    [[ -d "$base/db" ]] && echo "  ✓ db/ (main database)" || echo "  ○ db/ (not created)"
    [[ -d "$base/channels" ]] && echo "  ✓ channels/ (working channels)" || echo "  ○ channels/ (not created)"
    [[ -d "$base/views" ]] && echo "  ✓ views/ (RAG collections)" || echo "  ○ views/ (not created)"
    echo ""
    echo "Configuration:"
    [[ -f "$QA_ENGINE_FILE" ]] && echo "  ✓ Engine: $QA_ENGINE_FILE" || echo "  ○ Engine: (default)"
    [[ -f "$QA_CONTEXT_FILE" ]] && echo "  ✓ Context: $QA_CONTEXT_FILE" || echo "  ○ Context: (none)"
    [[ -f "$OPENAI_API_FILE" ]] && echo "  ✓ API key: configured" || echo "  ✗ API key: missing ($OPENAI_API_FILE)"
    echo ""
    echo "Channels:"
    if type -t qa_channels &>/dev/null; then
        qa_channels 2>/dev/null | head -10
    else
        echo "  (qa_channels not loaded)"
    fi
}

# REPL function available when module is loaded