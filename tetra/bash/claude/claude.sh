#!/usr/bin/env bash

# Claude Code Module - Claude Code integration functions

# Environment variables
: "${CLAUDE_SESSION_DIR:=$TETRA_DIR/claude/sessions}"
: "${CLAUDE_CONTEXT_DIR:=$TETRA_DIR/claude/context}"

# Initialize claude directories
claude_init() {
    mkdir -p "$CLAUDE_SESSION_DIR" "$CLAUDE_CONTEXT_DIR"
}

# Send content to Claude Code
tetra_cc_send() {
    local content="$1"
    local session_name="${2:-default}"

    if [[ -z "$content" ]]; then
        echo "Usage: tetra_cc_send <content> [session_name]"
        return 1
    fi

    claude_init

    # Save content to session file
    local session_file="$CLAUDE_SESSION_DIR/${session_name}.txt"
    echo "$content" > "$session_file"

    echo "Content sent to Claude session: $session_name"
    echo "Session file: $session_file"
}

# Interactive loop with Claude Code
tetra_cc_loop() {
    local session_name="${1:-interactive}"

    claude_init

    echo "Starting Claude Code interactive loop (session: $session_name)"
    echo "Type 'exit' to quit, 'save' to save current context"

    local input
    while true; do
        read -p "claude> " input

        case "$input" in
            exit|quit)
                echo "Exiting Claude loop"
                break
                ;;
            save)
                tetra_cc_save "$session_name"
                ;;
            load)
                tetra_cc_load "$session_name"
                ;;
            *)
                tetra_cc_send "$input" "$session_name"
                ;;
        esac
    done
}

# Save current context
tetra_cc_save() {
    local session_name="${1:-default}"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local context_file="$CLAUDE_CONTEXT_DIR/${session_name}_${timestamp}.ctx"

    claude_init

    # Save current working directory and environment
    {
        echo "# Claude context saved at $(date)"
        echo "# Working directory: $(pwd)"
        echo "# Session: $session_name"
        echo ""
        echo "PWD=$(pwd)"
        echo "SESSION_NAME=$session_name"

        # Save recent git status if in git repo
        if git rev-parse --git-dir >/dev/null 2>&1; then
            echo ""
            echo "# Git status:"
            git status --porcelain | sed 's/^/# /'
        fi
    } > "$context_file"

    echo "Context saved to: $context_file"
}

# Load saved context
tetra_cc_load() {
    local session_name="${1:-default}"

    if [[ -z "$session_name" ]]; then
        echo "Available contexts:"
        ls -1 "$CLAUDE_CONTEXT_DIR"/*.ctx 2>/dev/null | xargs -I {} basename {} .ctx || echo "No saved contexts found"
        return 0
    fi

    local context_file="$CLAUDE_CONTEXT_DIR/${session_name}.ctx"
    if [[ -f "$context_file" ]]; then
        echo "Loading context from: $context_file"
        source "$context_file"
        echo "Context loaded for session: $session_name"
    else
        echo "Context file not found: $context_file"
        return 1
    fi
}

# List Claude sessions
tetra_cc_sessions() {
    claude_init

    echo "Claude Code Sessions:"
    echo "===================="

    echo "Active sessions:"
    if ls -1 "$CLAUDE_SESSION_DIR"/*.txt >/dev/null 2>&1; then
        ls -1 "$CLAUDE_SESSION_DIR"/*.txt | xargs -I {} basename {} .txt | sed 's/^/  /'
    else
        echo "  (none)"
    fi

    echo ""
    echo "Saved contexts:"
    if ls -1 "$CLAUDE_CONTEXT_DIR"/*.ctx >/dev/null 2>&1; then
        ls -1 "$CLAUDE_CONTEXT_DIR"/*.ctx | xargs -I {} basename {} .ctx | sed 's/^/  /'
    else
        echo "  (none)"
    fi
}

# Show where Claude files are stored
tetra_cc_where() {
    claude_init

    _tetra_status_header "Claude Code"

    # Only show environment issues if they exist
    _tetra_status_validate_env "TETRA_DIR" "CLAUDE_SESSION_DIR" "CLAUDE_CONTEXT_DIR"

    # Storage locations (compact)
    echo "Sessions: $(_tetra_format_path "${CLAUDE_SESSION_DIR:-<not set>}")"
    echo "Contexts: $(_tetra_format_path "${CLAUDE_CONTEXT_DIR:-<not set>}")"

    # File counts (only if directories exist and have files)
    local session_count=0
    local context_count=0

    if [[ -d "$CLAUDE_SESSION_DIR" ]]; then
        session_count=$(find "$CLAUDE_SESSION_DIR" -name "*.txt" 2>/dev/null | wc -l | tr -d ' ')
    fi

    if [[ -d "$CLAUDE_CONTEXT_DIR" ]]; then
        context_count=$(find "$CLAUDE_CONTEXT_DIR" -name "*.ctx" 2>/dev/null | wc -l | tr -d ' ')
    fi

    if [[ $session_count -gt 0 || $context_count -gt 0 ]]; then
        echo "Files: $session_count sessions, $context_count contexts"
    fi
}

# Main claude command interface
claude() {
    local action="${1:-help}"
    shift || true

    case "$action" in
        send|s)
            tetra_cc_send "$@"
            ;;
        loop|l)
            tetra_cc_loop "$@"
            ;;
        save)
            tetra_cc_save "$@"
            ;;
        load)
            tetra_cc_load "$@"
            ;;
        sessions|ls)
            tetra_cc_sessions
            ;;
        where|w)
            tetra_cc_where
            ;;
        help|h|*)
            cat <<'EOF'
claude - Claude Code Integration

Usage: claude <command> [args]

Commands:
  send|s <content> [session]   Send content to Claude session
  loop|l [session]             Start interactive Claude loop
  save [session]               Save current context with timestamp
  load [session]               Load saved context
  sessions|ls                  List all sessions and contexts
  where|w                      Show storage locations
  help|h                       Show this help

Examples:
  claude send "analyze this code" main
  claude loop development
  claude save current_work
  claude load current_work
  claude sessions
EOF
            ;;
    esac
}