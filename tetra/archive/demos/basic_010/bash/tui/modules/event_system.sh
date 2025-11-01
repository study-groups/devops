#!/usr/bin/env bash

# Event System - Pure Pub/Sub for TUI Components
# Simple, lightweight event system for decoupled component communication
# Single responsibility: Event publishing and subscription management

# Event handler storage: event_name -> "handler1;handler2;handler3"
declare -A EVENT_HANDLERS

# Debug mode for event tracing
declare -g EVENT_DEBUG="${EVENT_DEBUG:-false}"

# Subscribe a handler function to an event
# Usage: subscribe "env_changed" "update_top_bar"
subscribe() {
    local event_name="$1"
    local handler_function="$2"

    # Validate parameters
    if [[ -z "$event_name" || -z "$handler_function" ]]; then
        echo "Error: subscribe requires event_name and handler_function" >&2
        return 1
    fi

    # Check if handler function exists
    if ! command -v "$handler_function" >/dev/null 2>&1; then
        if [[ "$EVENT_DEBUG" == "true" ]]; then
            echo "Warning: Handler function '$handler_function' not found (yet)" >&2
        fi
    fi

    # Add handler to event (semicolon-separated list)
    local existing_handlers="${EVENT_HANDLERS[$event_name]}"
    if [[ -n "$existing_handlers" ]]; then
        # Avoid duplicates
        if [[ "$existing_handlers" != *"$handler_function"* ]]; then
            EVENT_HANDLERS["$event_name"]="$existing_handlers;$handler_function"
        fi
    else
        EVENT_HANDLERS["$event_name"]="$handler_function"
    fi

    if [[ "$EVENT_DEBUG" == "true" ]]; then
        echo "Event: Subscribed '$handler_function' to '$event_name'" >&2
    fi
}

# Unsubscribe a handler from an event
# Usage: unsubscribe "env_changed" "update_top_bar"
unsubscribe() {
    local event_name="$1"
    local handler_function="$2"

    local existing_handlers="${EVENT_HANDLERS[$event_name]}"
    if [[ -n "$existing_handlers" ]]; then
        # Remove the specific handler
        local new_handlers="${existing_handlers//$handler_function/}"
        # Clean up extra semicolons
        new_handlers="${new_handlers//;;/;}"
        new_handlers="${new_handlers#;}"
        new_handlers="${new_handlers%;}"

        if [[ -n "$new_handlers" ]]; then
            EVENT_HANDLERS["$event_name"]="$new_handlers"
        else
            unset EVENT_HANDLERS["$event_name"]
        fi

        if [[ "$EVENT_DEBUG" == "true" ]]; then
            echo "Event: Unsubscribed '$handler_function' from '$event_name'" >&2
        fi
    fi
}

# Publish an event to all subscribers
# Usage: publish "env_changed" "TEST" "2"
publish() {
    local event_name="$1"
    shift  # Remaining arguments are event data

    local handlers="${EVENT_HANDLERS[$event_name]}"
    if [[ -z "$handlers" ]]; then
        if [[ "$EVENT_DEBUG" == "true" ]]; then
            echo "Event: No handlers for '$event_name'" >&2
        fi
        return 0
    fi

    if [[ "$EVENT_DEBUG" == "true" ]]; then
        echo "Event: Publishing '$event_name' with data: $*" >&2
    fi

    # Call each handler with the event data
    local IFS=';'
    for handler in $handlers; do
        [[ -n "$handler" ]] || continue

        if command -v "$handler" >/dev/null 2>&1; then
            if [[ "$EVENT_DEBUG" == "true" ]]; then
                echo "Event: Calling handler '$handler'" >&2
            fi
            "$handler" "$@"
        else
            if [[ "$EVENT_DEBUG" == "true" ]]; then
                echo "Event: Handler '$handler' not found, skipping" >&2
            fi
        fi
    done
}

# List all event subscriptions (for debugging)
# Usage: list_event_subscriptions
list_event_subscriptions() {
    echo "Event System Subscriptions:"
    echo "=========================="

    if [[ ${#EVENT_HANDLERS[@]} -eq 0 ]]; then
        echo "  No subscriptions"
        return 0
    fi

    for event_name in "${!EVENT_HANDLERS[@]}"; do
        echo "  $event_name:"
        local handlers="${EVENT_HANDLERS[$event_name]}"
        local IFS=';'
        for handler in $handlers; do
            [[ -n "$handler" ]] && echo "    - $handler"
        done
    done
}

# Clear all event subscriptions
# Usage: clear_event_subscriptions
clear_event_subscriptions() {
    EVENT_HANDLERS=()
    if [[ "$EVENT_DEBUG" == "true" ]]; then
        echo "Event: Cleared all subscriptions" >&2
    fi
}

# Enable/disable event debug mode
# Usage: set_event_debug true/false
set_event_debug() {
    local debug_mode="$1"
    EVENT_DEBUG="$debug_mode"
    echo "Event debug mode: $EVENT_DEBUG"
}

# Initialize event system
init_event_system() {
    # Event system ready
    if [[ "$EVENT_DEBUG" == "true" ]]; then
        echo "Event: Pure pub/sub event system initialized" >&2
    fi
    return 0
}

# Auto-initialize
init_event_system