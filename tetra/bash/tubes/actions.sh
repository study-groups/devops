#!/usr/bin/env bash

# tubes/actions.sh - TUI integration for tubes module

# Action: Create a tube
tubes_action_create() {
    local tube_name="$1"
    local description="${2:-Terminal endpoint}"

    tetra_log_info "tubes" "create" "compact" "jsonl" "$tube_name"

    if tubes_create "$tube_name" "$description"; then
        tetra_log_success "tubes" "create" "compact" "jsonl" "$tube_name"
        return 0
    else
        tetra_log_error "tubes" "create" "compact" "jsonl" "$tube_name"
        return 1
    fi
}

# Action: Send message
tubes_action_send() {
    local tube_name="$1"
    local message="$2"

    tetra_log_info "tubes" "send" "compact" "jsonl" "$tube_name"

    if tubes_send "$tube_name" "$message"; then
        tetra_log_success "tubes" "send" "compact" "jsonl" "$tube_name"
        return 0
    else
        tetra_log_error "tubes" "send" "compact" "jsonl" "$tube_name"
        return 1
    fi
}

# Action: Start router
tubes_action_router_start() {
    tetra_log_info "tubes" "router_start" "compact" "jsonl"

    if tubes_router_start; then
        tetra_log_success "tubes" "router_start" "compact" "jsonl"
        return 0
    else
        tetra_log_error "tubes" "router_start" "compact" "jsonl"
        return 1
    fi
}

# Action: List tubes
tubes_action_list() {
    tetra_log_info "tubes" "list" "compact" "jsonl"

    tubes_list

    tetra_log_success "tubes" "list" "compact" "jsonl"
}

# Export actions
export -f tubes_action_create
export -f tubes_action_send
export -f tubes_action_router_start
export -f tubes_action_list
