#!/usr/bin/env bash
# bash/resolve/binding.sh
# TES Level 5-6: Locator → Binding
# Combines resource location with operation intent (read/write)

# Resolve locator to binding (add operation)
# Level 5 → 6: dev@host:~/.ssh/authorized_keys → write(dev@host:~/.ssh/authorized_keys)
resolve_locator_to_binding() {
    local locator=$1
    local operation=${2:-"read"}

    # Validate operation
    case "$operation" in
        read|write|append|delete)
            # Valid operations
            ;;
        *)
            echo "ERROR: Invalid operation '$operation'. Must be: read, write, append, delete" >&2
            return 1
            ;;
    esac

    # Return binding structure as JSON-like format for easy parsing
    echo "${operation}(${locator})"
}

# Parse binding into components
# Input: "write(dev@host:~/.ssh/authorized_keys)"
# Output: Sets operation, locator variables
parse_binding() {
    local binding=$1
    local -n result=$2

    if [[ "$binding" =~ ^([a-z]+)\((.+)\)$ ]]; then
        result[operation]="${BASH_REMATCH[1]}"
        result[locator]="${BASH_REMATCH[2]}"
    else
        echo "ERROR: Invalid binding format: $binding" >&2
        return 1
    fi
}

# Validate binding (check if operation is feasible)
validate_binding_operation() {
    local binding=$1

    declare -A bind_parts
    parse_binding "$binding" bind_parts || return 1

    local operation="${bind_parts[operation]}"
    local locator="${bind_parts[locator]}"

    # Check if locator is local or remote
    if [[ "$locator" =~ @ ]]; then
        # Remote locator: user@host:path
        local channel="${locator%%:*}"
        local path="${locator##*:}"
        local user="${channel%%@*}"
        local host="${channel##*@}"

        # For remote operations, we'd need to test via SSH
        # This is handled by validate_connector in validate.sh
        return 0
    else
        # Local locator: check file system permissions
        case "$operation" in
            read)
                if [[ ! -r "$locator" ]]; then
                    echo "ERROR: Cannot read from $locator (not readable)" >&2
                    return 1
                fi
                ;;
            write|append)
                local dir=$(dirname "$locator")
                if [[ -e "$locator" ]]; then
                    # File exists, check if writable
                    if [[ ! -w "$locator" ]]; then
                        echo "ERROR: Cannot write to $locator (not writable)" >&2
                        return 1
                    fi
                else
                    # File doesn't exist, check if directory is writable
                    if [[ ! -w "$dir" ]]; then
                        echo "ERROR: Cannot create $locator (directory not writable)" >&2
                        return 1
                    fi
                fi
                ;;
            delete)
                if [[ ! -e "$locator" ]]; then
                    echo "ERROR: Cannot delete $locator (does not exist)" >&2
                    return 1
                fi
                if [[ ! -w "$locator" ]]; then
                    echo "ERROR: Cannot delete $locator (not writable)" >&2
                    return 1
                fi
                ;;
        esac
    fi

    return 0
}

# Get operation type from binding
get_operation_type() {
    local binding=$1

    if [[ "$binding" =~ ^([a-z]+)\( ]]; then
        echo "${BASH_REMATCH[1]}"
    else
        echo "unknown"
    fi
}

# Get locator from binding
get_locator() {
    local binding=$1

    if [[ "$binding" =~ \((.+)\)$ ]]; then
        echo "${BASH_REMATCH[1]}"
    else
        echo ""
    fi
}

# Check if binding is for a remote resource
is_remote_binding() {
    local binding=$1
    local locator
    locator=$(get_locator "$binding")

    [[ "$locator" =~ @ ]]
}

# Check if binding is for a local resource
is_local_binding() {
    local binding=$1
    ! is_remote_binding "$binding"
}

# Extract channel from remote binding
get_binding_channel() {
    local binding=$1
    local locator
    locator=$(get_locator "$binding")

    if [[ "$locator" =~ ^([^:]+)@([^:]+): ]]; then
        echo "${BASH_REMATCH[1]}@${BASH_REMATCH[2]}"
    else
        echo ""
    fi
}

# Extract path from binding
get_binding_path() {
    local binding=$1
    local locator
    locator=$(get_locator "$binding")

    if [[ "$locator" =~ :(.+)$ ]]; then
        # Remote: extract path after colon
        echo "${BASH_REMATCH[1]}"
    else
        # Local: entire locator is the path
        echo "$locator"
    fi
}
