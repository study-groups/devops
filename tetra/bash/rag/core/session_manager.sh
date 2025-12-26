#!/usr/bin/env bash
# session_manager.sh - RAG Session Management
# A session is a workspace containing related flows and chats

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"
: "${TTM_DIR:=$TETRA_DIR/ttm}"

# Get sessions directory based on scope
get_sessions_dir() {
    local scope="${RAG_SCOPE:-local}"
    if [[ "$scope" == "global" ]]; then
        echo "$TETRA_DIR/rag/sessions"
    else
        echo "$PWD/rag/sessions"
    fi
}

# Get current session ID
session_active() {
    local sessions_dir="$(get_sessions_dir)"
    if [[ -L "$sessions_dir/current" ]]; then
        basename "$(readlink -f "$sessions_dir/current" 2>/dev/null || readlink "$sessions_dir/current")"
    fi
}

# Generate session ID
generate_session_id() {
    local description="$1"
    local slug=$(echo "$description" | tr '[:upper:]' '[:lower:]' | \
                 sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | \
                 cut -c1-30 | sed 's/-$//')
    local timestamp=$(date '+%Y%m%dT%H%M%S')
    echo "${slug}-${timestamp}"
}

# Create new session
session_create() {
    local description="${1:?Description required}"
    local sessions_dir="$(get_sessions_dir)"

    # Create sessions directory if it doesn't exist
    mkdir -p "$sessions_dir"

    local session_id="$(generate_session_id "$description")"
    local session_path="$sessions_dir/$session_id"

    # Create session directory
    mkdir -p "$session_path"

    # Create session.json
    cat > "$session_path/session.json" <<EOF
{
  "session_id": "$session_id",
  "description": "$description",
  "flows": [],
  "created_at": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "last_active": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "tags": []
}
EOF

    # Set as current session
    ln -sf "$session_path" "$sessions_dir/current"

    echo "Session created: $session_id"
    echo "Description: $description"
    echo ""
    echo "Next steps:"
    echo "  /flow create \"your inquiry\"    Create a flow in this session"
    echo "  /session status                 View session details"

    echo "$session_id"
}

# Get session state
session_state() {
    local session_id="${1:-}"

    if [[ -z "$session_id" ]]; then
        session_id=$(session_active)
    fi

    if [[ -z "$session_id" ]]; then
        echo "Error: No active session" >&2
        return 1
    fi

    local sessions_dir="$(get_sessions_dir)"
    local session_file="$sessions_dir/$session_id/session.json"

    if [[ ! -f "$session_file" ]]; then
        echo "Error: Session not found: $session_id" >&2
        return 1
    fi

    cat "$session_file"
}

# Add flow to session
session_add_flow() {
    local flow_id="${1:?Flow ID required}"
    local session_id="${2:-}"

    if [[ -z "$session_id" ]]; then
        session_id=$(session_active)
    fi

    if [[ -z "$session_id" ]]; then
        echo "Error: No active session" >&2
        return 1
    fi

    local sessions_dir="$(get_sessions_dir)"
    local session_file="$sessions_dir/$session_id/session.json"

    if [[ ! -f "$session_file" ]]; then
        echo "Error: Session not found: $session_id" >&2
        return 1
    fi

    # Add flow ID to flows array and update last_active
    local temp_file=$(mktemp)
    jq --arg flow_id "$flow_id" \
       --arg timestamp "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
       '.flows += [$flow_id] | .flows |= unique | .last_active = $timestamp' \
       "$session_file" > "$temp_file" && mv "$temp_file" "$session_file"
}

# List all sessions
session_list() {
    local sessions_dir="$(get_sessions_dir)"

    if [[ ! -d "$sessions_dir" ]]; then
        echo "No sessions found"
        return 0
    fi

    local current_session=$(session_active)

    echo "Sessions:"
    echo "────────────────────────────────────────────────────────"

    local index=0
    for session_path in "$sessions_dir"/*; do
        [[ ! -d "$session_path" ]] && continue
        local session_id=$(basename "$session_path")
        [[ "$session_id" == "current" ]] && continue

        ((index++))

        local session_file="$session_path/session.json"
        if [[ -f "$session_file" ]] && command -v jq >/dev/null 2>&1; then
            local description=$(jq -r '.description' "$session_file")
            local flow_count=$(jq -r '.flows | length' "$session_file")
            local last_active=$(jq -r '.last_active' "$session_file")
            local marker=" "
            [[ "$session_id" == "$current_session" ]] && marker="→"

            printf "%s%2d. %-40s  %d flows  %s\n" \
                "$marker" "$index" "$session_id" "$flow_count" "$last_active"
            printf "     %s\n" "$description"
        fi
    done

    echo ""
    echo "Tip: Use '/session resume <number>' to resume by index"
}

# Resume session
session_resume() {
    local input="${1:?Session ID or index required}"
    local sessions_dir="$(get_sessions_dir)"
    local session_id=""

    # Check if input is a number (index)
    if [[ "$input" =~ ^[0-9]+$ ]]; then
        # Convert index to session_id
        local index=0
        for session_path in "$sessions_dir"/*; do
            [[ ! -d "$session_path" ]] && continue
            local sid=$(basename "$session_path")
            [[ "$sid" == "current" ]] && continue
            ((index++))
            if [[ $index -eq $input ]]; then
                session_id="$sid"
                break
            fi
        done

        if [[ -z "$session_id" ]]; then
            echo "Error: No session at index $input" >&2
            echo "Use '/session list' to see available sessions" >&2
            return 1
        fi
    else
        # Use input as session_id directly
        session_id="$input"
    fi

    local session_path="$sessions_dir/$session_id"
    if [[ ! -d "$session_path" ]]; then
        echo "Error: Session not found: $session_id" >&2
        return 1
    fi

    # Set as current session
    ln -sf "$session_path" "$sessions_dir/current"

    # Update last_active
    local session_file="$session_path/session.json"
    if [[ -f "$session_file" ]]; then
        local temp_file=$(mktemp)
        jq --arg timestamp "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
           '.last_active = $timestamp' \
           "$session_file" > "$temp_file" && mv "$temp_file" "$session_file"
    fi

    echo "Resumed session: $session_id"
    session_status "$session_id"
}

# Show session status
session_status() {
    local session_id="${1:-}"

    if [[ -z "$session_id" ]]; then
        session_id=$(session_active)
    fi

    if [[ -z "$session_id" ]]; then
        echo "No active session"
        return 0
    fi

    local sessions_dir="$(get_sessions_dir)"
    local session_file="$sessions_dir/$session_id/session.json"

    if [[ ! -f "$session_file" ]] || ! command -v jq >/dev/null 2>&1; then
        echo "Session: $session_id"
        return 0
    fi

    local description=$(jq -r '.description' "$session_file")
    local flow_count=$(jq -r '.flows | length' "$session_file")
    local created=$(jq -r '.created_at' "$session_file")
    local last_active=$(jq -r '.last_active' "$session_file")
    local flows=$(jq -r '.flows[]' "$session_file" 2>/dev/null)

    echo "Session: $session_id"
    echo "Description: $description"
    echo "Flows: $flow_count"
    echo "Created: $created"
    echo "Last Active: $last_active"

    if [[ $flow_count -gt 0 ]]; then
        echo ""
        echo "Flows in this session:"
        local idx=0
        while IFS= read -r flow_id; do
            [[ -z "$flow_id" ]] && continue
            ((idx++))
            # Try to get flow description if available
            local flows_dir="${TTM_TXNS_DIR:-$PWD/rag/flows}"
            local flow_state="$flows_dir/$flow_id/state.json"
            if [[ -f "$flow_state" ]]; then
                local flow_desc=$(jq -r '.description' "$flow_state" 2>/dev/null)
                local flow_stage=$(jq -r '.stage' "$flow_state" 2>/dev/null)
                printf "  %d. %-40s  %s\n" "$idx" "$flow_id" "$flow_stage"
                printf "     %s\n" "$flow_desc"
            else
                printf "  %d. %s\n" "$idx" "$flow_id"
            fi
        done <<< "$flows"
    fi
}

# Export functions
export -f get_sessions_dir
export -f session_active
export -f generate_session_id
export -f session_create
export -f session_state
export -f session_add_flow
export -f session_list
export -f session_resume
export -f session_status
