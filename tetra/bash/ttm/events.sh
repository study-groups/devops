#!/usr/bin/env bash
# events.sh - Event publishing for TTM
# Wraps pubsub system if available, otherwise no-op

: "${TETRA_SRC:=~/tetra}"

# Check if pubsub is available
_pubsub_available() {
    if [[ -f "$TETRA_SRC/bash/tui/events/pubsub.sh" ]]; then
        return 0
    fi
    return 1
}

# Publish TTM event
# Args: event_name txn_id [data]
ttm_publish() {
    local event_name="$1"
    local txn_id="$2"
    local data="${3:-}"

    if _pubsub_available; then
        source "$TETRA_SRC/bash/tui/events/pubsub.sh" 2>/dev/null

        if declare -f publish >/dev/null 2>&1; then
            publish "$event_name" "$txn_id" "$data"
        fi
    fi

    # Always succeed even if pubsub not available
    return 0
}

# Subscribe to TTM event
# Args: event_name callback_function
ttm_subscribe() {
    local event_name="$1"
    local callback="$2"

    if _pubsub_available; then
        source "$TETRA_SRC/bash/tui/events/pubsub.sh" 2>/dev/null

        if declare -f subscribe >/dev/null 2>&1; then
            subscribe "$event_name" "$callback"
        fi
    fi

    return 0
}

# Unsubscribe from TTM event
# Args: event_name callback_function
ttm_unsubscribe() {
    local event_name="$1"
    local callback="$2"

    if _pubsub_available; then
        source "$TETRA_SRC/bash/tui/events/pubsub.sh" 2>/dev/null

        if declare -f unsubscribe >/dev/null 2>&1; then
            unsubscribe "$event_name" "$callback"
        fi
    fi

    return 0
}

# Export functions
export -f ttm_publish
export -f ttm_subscribe
export -f ttm_unsubscribe
