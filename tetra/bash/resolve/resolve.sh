#!/usr/bin/env bash
# bash/resolve/resolve.sh
# Main entry point for TES (Tetra Endpoint Specification) resolution module
# Implements progressive resolution: Symbol → Address → Channel → Connector → Handle → Locator → Binding → Plan

# Module globals (following TETRA conventions)
MOD_SRC="${MOD_SRC:-$TETRA_SRC/bash/resolve}"
MOD_DIR="${MOD_DIR:-$TETRA_DIR/resolve}"

# TES version tracking
RESOLVE_TES_VERSION="2.1"

# Resolution cache directory
RESOLVE_CACHE="$MOD_DIR/cache"

# Source sub-modules
source "$MOD_SRC/symbol.sh"
source "$MOD_SRC/connector.sh"
source "$MOD_SRC/binding.sh"
source "$MOD_SRC/plan.sh"
source "$MOD_SRC/validate.sh"

# Initialize module
resolve_init() {
    mkdir -p "$MOD_DIR"
    mkdir -p "$RESOLVE_CACHE"
}

# Main resolution function: Symbol → Plan (all 8 levels)
# Usage: resolve_symbol "@staging" "~/.ssh/authorized_keys" "write"
resolve_symbol() {
    local symbol=$1
    local resource_path=${2:-""}
    local operation=${3:-"read"}

    # Level 0 → 1: Symbol → Address
    local address
    address=$(resolve_symbol_to_address "$symbol") || return 1

    # Level 1 → 2: Address → Channel
    local channel
    channel=$(resolve_address_to_channel "$address" "$symbol") || return 1

    # Level 2 → 3: Channel → Connector
    local connector
    connector=$(resolve_channel_to_connector "$channel" "$symbol") || return 1

    # Level 3 → 4: Connector → Handle (validation)
    if ! validate_connector "$connector"; then
        echo "ERROR: Connector validation failed: $connector" >&2
        return 1
    fi

    # Level 4 → 5: Handle → Locator
    local locator
    locator=$(resolve_handle_to_locator "$connector" "$resource_path") || return 1

    # Level 5 → 6: Locator → Binding
    local binding
    binding=$(resolve_locator_to_binding "$locator" "$operation") || return 1

    # Level 6 → 7: Binding → Plan
    local plan
    plan=$(resolve_binding_to_plan "$binding") || return 1

    echo "$plan"
}

# Partial resolution: resolve to a specific level
# Usage: resolve_to_level "@staging" 3 result_array
resolve_to_level() {
    local symbol=$1
    local target_level=$2
    local -n result=$3

    result[symbol]="$symbol"
    result[level]=0

    if [[ $target_level -ge 1 ]]; then
        result[address]=$(resolve_symbol_to_address "$symbol") || return 1
        result[level]=1
    fi

    if [[ $target_level -ge 2 ]]; then
        result[channel]=$(resolve_address_to_channel "${result[address]}" "$symbol") || return 1
        result[level]=2
    fi

    if [[ $target_level -ge 3 ]]; then
        result[connector]=$(resolve_channel_to_connector "${result[channel]}" "$symbol") || return 1
        result[level]=3
    fi

    if [[ $target_level -ge 4 ]]; then
        if validate_connector "${result[connector]}"; then
            result[handle_status]="validated"
            result[level]=4
        else
            result[handle_status]="failed"
            return 1
        fi
    fi

    if [[ $target_level -ge 5 ]]; then
        # For demo purposes, use a default resource path if not provided
        local resource_path="${result[resource_path]:-~/.ssh/authorized_keys}"
        result[locator]=$(resolve_handle_to_locator "${result[connector]}" "$resource_path") || return 1
        result[level]=5
    fi

    if [[ $target_level -ge 6 ]]; then
        local operation="${result[operation]:-read}"
        result[binding]=$(resolve_locator_to_binding "${result[locator]}" "$operation") || return 1
        result[level]=6
    fi

    if [[ $target_level -ge 7 ]]; then
        result[plan]=$(resolve_binding_to_plan "${result[binding]}") || return 1
        result[level]=7
    fi

    return 0
}

# Check if a symbol is fully qualified (all inputs resolved and validated)
is_fully_qualified() {
    local symbol=$1
    local resource_path=$2
    local operation=$3

    # Must have all required parameters
    [[ -z "$symbol" || -z "$resource_path" || -z "$operation" ]] && return 1

    # Must be able to resolve through validation (level 4)
    local -A check_result
    resolve_to_level "$symbol" 4 check_result
    [[ "${check_result[handle_status]}" == "validated" ]]
}

# Get resolution level name
get_level_name() {
    local level=$1
    case $level in
        0) echo "Symbol" ;;
        1) echo "Address" ;;
        2) echo "Channel" ;;
        3) echo "Connector" ;;
        4) echo "Handle" ;;
        5) echo "Locator" ;;
        6) echo "Binding" ;;
        7) echo "Plan" ;;
        *) echo "Unknown" ;;
    esac
}

# Explain what happens at each level
explain_level() {
    local level=$1
    case $level in
        0)
            echo "Symbol: Human-readable semantic label (e.g., @staging)"
            echo "  Specifies: Deployment stage or environment"
            echo "  Missing: Host, user, auth, path, operation"
            ;;
        1)
            echo "Address: Network location (IP or hostname)"
            echo "  Adds: Machine-findable location"
            echo "  Missing: User, auth, path, operation"
            ;;
        2)
            echo "Channel: User + Address (user@host)"
            echo "  Adds: User identity"
            echo "  Missing: Auth method, validation, path, operation"
            ;;
        3)
            echo "Connector: Authenticated channel (auth_user:work_user@host -i key)"
            echo "  Adds: Authentication credentials and dual-role syntax"
            echo "  Missing: Validation status, resource path"
            ;;
        4)
            echo "Handle: Validated connector (pre-flight check passed)"
            echo "  Adds: Reachability confirmation"
            echo "  Missing: Resource path, operation"
            ;;
        5)
            echo "Locator: Handle + resource path (user@host:~/.ssh/authorized_keys)"
            echo "  Adds: Specific file or resource location"
            echo "  Missing: Operation type (read/write)"
            ;;
        6)
            echo "Binding: Locator + operation (read/write)"
            echo "  Adds: I/O operation intent"
            echo "  Missing: Execution context"
            ;;
        7)
            echo "Plan: Complete executable command"
            echo "  Adds: Full command with all context"
            echo "  Ready to execute"
            ;;
    esac
}

# Initialize on source
resolve_init

