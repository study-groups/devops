#!/usr/bin/env bash
# Tetra Tmux Session Manager
# Session naming: tetra-{org}-{proj}-{env}
# Example: tetra-pixeljam-api-local, tetra-tetra-dashboard-prod

TMUX_PREFIX="${TMUX_PREFIX:-tetra}"

# Build session name from components
# Usage: _tmux_session_name [org] [proj] [env]
_tmux_session_name() {
    local org="${1:-$TETRA_ORG}"
    local proj="${2:-default}"
    local env="${3:-local}"
    echo "${TMUX_PREFIX}-${org}-${proj}-${env}"
}

# Parse session name into components
# Usage: _tmux_parse_session <session_name>
# Sets: TMUX_ORG, TMUX_PROJ, TMUX_ENV
_tmux_parse_session() {
    local name="$1"
    name="${name#${TMUX_PREFIX}-}"  # Remove prefix
    IFS='-' read -r TMUX_ORG TMUX_PROJ TMUX_ENV <<< "$name"
}

# List all tetra sessions
# Usage: tmux_list [--json]
tmux_list() {
    local json=false
    [[ "$1" == "--json" ]] && json=true

    if $json; then
        tmux list-sessions -F '{"name":"#{session_name}","created":#{session_created},"attached":#{session_attached},"windows":#{session_windows}}' 2>/dev/null | \
            grep "\"name\":\"${TMUX_PREFIX}-" | \
            sed 's/attached":1/attached":true/g; s/attached":0/attached":false/g' | \
            jq -s '.' 2>/dev/null || echo '[]'
    else
        echo "TETRA SESSIONS:"
        tmux list-sessions 2>/dev/null | grep "^${TMUX_PREFIX}-" | while read -r line; do
            local sess="${line%%:*}"
            _tmux_parse_session "$sess"
            printf "  %-30s  org:%-10s proj:%-15s env:%s\n" "$sess" "$TMUX_ORG" "$TMUX_PROJ" "$TMUX_ENV"
        done
    fi
}

# Join (attach or create) a session
# Usage: tmux_join [org] [proj] [env]
#    or: tmux_join <full-session-name>
tmux_join() {
    local session_name

    # If single arg with dashes, treat as full session name
    if [[ $# -eq 1 && "$1" == *-*-* ]]; then
        session_name="$1"
        [[ "$session_name" != ${TMUX_PREFIX}-* ]] && session_name="${TMUX_PREFIX}-${session_name}"
    else
        session_name=$(_tmux_session_name "$1" "$2" "$3")
    fi

    if tmux has-session -t "$session_name" 2>/dev/null; then
        echo "Attaching to: $session_name"
        tmux attach-session -t "$session_name"
    else
        echo "Creating: $session_name"
        tmux new-session -s "$session_name"
    fi
}

# Create a new detached session
# Usage: tmux_new [org] [proj] [env] [--cmd "command"]
tmux_new() {
    local org="" proj="" env="" cmd=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --cmd|-c) cmd="$2"; shift 2 ;;
            *)
                [[ -z "$org" ]] && { org="$1"; shift; continue; }
                [[ -z "$proj" ]] && { proj="$1"; shift; continue; }
                [[ -z "$env" ]] && { env="$1"; shift; continue; }
                shift ;;
        esac
    done

    local session_name=$(_tmux_session_name "$org" "$proj" "$env")

    if tmux has-session -t "$session_name" 2>/dev/null; then
        echo "Session exists: $session_name"
        return 1
    fi

    echo "Creating: $session_name"
    tmux new-session -d -s "$session_name"

    # Source tetra.sh in the new session
    tmux send-keys -t "$session_name" "source \$HOME/tetra/tetra.sh" C-m

    # Run optional command
    [[ -n "$cmd" ]] && tmux send-keys -t "$session_name" "$cmd" C-m

    echo "Created (detached): $session_name"
}

# Kill a session
# Usage: tmux_kill [org] [proj] [env]
#    or: tmux_kill <full-session-name>
tmux_kill() {
    local session_name

    if [[ $# -eq 1 && "$1" == *-*-* ]]; then
        session_name="$1"
        [[ "$session_name" != ${TMUX_PREFIX}-* ]] && session_name="${TMUX_PREFIX}-${session_name}"
    else
        session_name=$(_tmux_session_name "$1" "$2" "$3")
    fi

    if tmux kill-session -t "$session_name" 2>/dev/null; then
        echo "Killed: $session_name"
    else
        echo "Not found: $session_name"
        return 1
    fi
}

# Kill all tetra sessions
# Usage: tmux_kill_all [--force]
tmux_kill_all() {
    local force=false
    [[ "$1" == "--force" || "$1" == "-f" ]] && force=true

    local sessions
    sessions=$(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep "^${TMUX_PREFIX}-")

    if [[ -z "$sessions" ]]; then
        echo "No tetra sessions found"
        return 0
    fi

    echo "Sessions to kill:"
    echo "$sessions" | sed 's/^/  /'

    if ! $force; then
        read -rp "Kill all? [y/N] " confirm
        [[ "$confirm" != [yY] ]] && { echo "Aborted"; return 1; }
    fi

    echo "$sessions" | while read -r sess; do
        tmux kill-session -t "$sess" && echo "Killed: $sess"
    done
}

# Send command to a session
# Usage: tmux_send <session> <command>
#    or: tmux_send <org> <proj> <env> <command>
tmux_send() {
    local session_name cmd

    if [[ $# -eq 2 ]]; then
        session_name="$1"
        cmd="$2"
        [[ "$session_name" != ${TMUX_PREFIX}-* ]] && session_name="${TMUX_PREFIX}-${session_name}"
    elif [[ $# -ge 4 ]]; then
        session_name=$(_tmux_session_name "$1" "$2" "$3")
        cmd="${*:4}"
    else
        echo "Usage: tmux_send <session> <cmd> OR tmux_send <org> <proj> <env> <cmd>"
        return 1
    fi

    if tmux has-session -t "$session_name" 2>/dev/null; then
        tmux send-keys -t "$session_name" "$cmd" C-m
        echo "Sent to $session_name: $cmd"
    else
        echo "Session not found: $session_name"
        return 1
    fi
}

# Capture output from a session's pane
# Usage: tmux_capture <session> [lines]
tmux_capture() {
    local session_name="$1"
    local lines="${2:-50}"

    [[ "$session_name" != ${TMUX_PREFIX}-* ]] && session_name="${TMUX_PREFIX}-${session_name}"

    tmux capture-pane -t "$session_name" -p -S "-${lines}"
}

# Quick session for current directory's project
# Uses: TETRA_ORG, directory name as proj, "local" as env
tmux_here() {
    local proj=$(basename "$PWD")
    local env="${1:-local}"
    tmux_join "${TETRA_ORG:-tetra}" "$proj" "$env"
}

# Export functions
export -f _tmux_session_name _tmux_parse_session
export -f tmux_list tmux_join tmux_new tmux_kill tmux_kill_all
export -f tmux_send tmux_capture tmux_here
