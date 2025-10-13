#!/usr/bin/env bash
# bash/resolve/validate.sh
# Pre-flight validation for TES resolution
# Tests connectivity and permissions before execution

# Validate a connector (Level 3 → 4: Connector → Handle)
# Tests SSH connectivity and authentication
validate_connector() {
    local connector=$1

    declare -A conn_parts
    parse_connector "$connector" conn_parts || return 1

    local host="${conn_parts[host]}"
    local auth_user="${conn_parts[auth_user]}"
    local auth_key="${conn_parts[auth_key]}"

    # For localhost, always valid
    if [[ "$host" == "localhost" || "$host" == "127.0.0.1" ]]; then
        return 0
    fi

    # Build SSH test command
    local ssh_cmd="ssh -o BatchMode=yes -o ConnectTimeout=5"

    if [[ -n "$auth_key" ]]; then
        # Check if key exists
        if [[ ! -f "$auth_key" ]]; then
            echo "ERROR: SSH key not found: $auth_key" >&2
            return 1
        fi
        ssh_cmd="$ssh_cmd -i $auth_key"
    fi

    ssh_cmd="$ssh_cmd ${auth_user}@${host} 'echo ok'"

    # Test connection
    local result
    result=$(timeout 5 eval "$ssh_cmd" 2>&1)
    local exit_code=$?

    if [[ $exit_code -eq 0 ]] && [[ "$result" == "ok" ]]; then
        return 0
    else
        echo "ERROR: SSH connection failed to ${auth_user}@${host}" >&2
        echo "ERROR: $result" >&2
        return 1
    fi
}

# Validate a binding (Level 5 → 6: with operation check)
# Tests if the specified operation is feasible
validate_binding() {
    local binding=$1

    declare -A bind_parts
    parse_binding "$binding" bind_parts || return 1

    local operation="${bind_parts[operation]}"
    local locator="${bind_parts[locator]}"

    # Check if remote or local
    if [[ "$locator" =~ @ ]]; then
        # Remote validation
        validate_remote_binding "$operation" "$locator"
    else
        # Local validation
        validate_local_binding "$operation" "$locator"
    fi
}

# Validate local binding
validate_local_binding() {
    local operation=$1
    local path=$2

    case "$operation" in
        read)
            if [[ ! -r "$path" ]]; then
                echo "ERROR: Cannot read from $path" >&2
                return 1
            fi
            ;;
        write|append)
            if [[ -e "$path" ]]; then
                # File exists, check writable
                if [[ ! -w "$path" ]]; then
                    echo "ERROR: Cannot write to $path" >&2
                    return 1
                fi
            else
                # File doesn't exist, check directory writable
                local dir=$(dirname "$path")
                if [[ ! -w "$dir" ]]; then
                    echo "ERROR: Cannot create $path (directory not writable)" >&2
                    return 1
                fi
            fi
            ;;
        delete)
            if [[ ! -e "$path" ]]; then
                echo "ERROR: Cannot delete $path (does not exist)" >&2
                return 1
            fi
            if [[ ! -w "$path" ]]; then
                echo "ERROR: Cannot delete $path (not writable)" >&2
                return 1
            fi
            ;;
    esac

    return 0
}

# Validate remote binding
validate_remote_binding() {
    local operation=$1
    local locator=$2

    # Parse locator: user@host:path
    if [[ ! "$locator" =~ ^([^@]+)@([^:]+):(.+)$ ]]; then
        echo "ERROR: Invalid remote locator: $locator" >&2
        return 1
    fi

    local user="${BASH_REMATCH[1]}"
    local host="${BASH_REMATCH[2]}"
    local path="${BASH_REMATCH[3]}"

    # Build test command based on operation
    local test_cmd
    case "$operation" in
        read)
            test_cmd="test -r '$path' && echo ok"
            ;;
        write|append)
            # Check if file is writable or directory is writable
            test_cmd="(test -w '$path' || test -w \$(dirname '$path')) && echo ok"
            ;;
        delete)
            test_cmd="test -e '$path' && test -w '$path' && echo ok"
            ;;
    esac

    # Execute remote test
    local result
    result=$(timeout 5 ssh -o BatchMode=yes -o ConnectTimeout=5 "${user}@${host}" "$test_cmd" 2>&1)
    local exit_code=$?

    if [[ $exit_code -eq 0 ]] && [[ "$result" == "ok" ]]; then
        return 0
    else
        echo "ERROR: Remote validation failed for $operation on $locator" >&2
        return 1
    fi
}

# Validate full resolution chain
# Tests all levels from symbol to binding
validate_full_chain() {
    local symbol=$1
    local resource_path=$2
    local operation=$3

    echo "Validating resolution chain for $symbol..."

    # Level 0 → 1: Symbol → Address
    local address
    address=$(resolve_symbol_to_address "$symbol") || {
        echo "✗ Failed at Level 1 (Symbol → Address)"
        return 1
    }
    echo "✓ Level 1: $symbol → $address"

    # Level 1 → 2: Address → Channel
    local channel
    channel=$(resolve_address_to_channel "$address" "$symbol") || {
        echo "✗ Failed at Level 2 (Address → Channel)"
        return 1
    }
    echo "✓ Level 2: $address → $channel"

    # Level 2 → 3: Channel → Connector
    local connector
    connector=$(resolve_channel_to_connector "$channel" "$symbol") || {
        echo "✗ Failed at Level 3 (Channel → Connector)"
        return 1
    }
    echo "✓ Level 3: $channel → $connector"

    # Level 3 → 4: Connector → Handle (validation)
    if ! validate_connector "$connector"; then
        echo "✗ Failed at Level 4 (Connector validation)"
        return 1
    fi
    echo "✓ Level 4: Connector validated"

    # Level 4 → 5: Handle → Locator
    local locator
    locator=$(resolve_handle_to_locator "$connector" "$resource_path") || {
        echo "✗ Failed at Level 5 (Handle → Locator)"
        return 1
    }
    echo "✓ Level 5: Locator → $locator"

    # Level 5 → 6: Locator → Binding
    local binding
    binding=$(resolve_locator_to_binding "$locator" "$operation") || {
        echo "✗ Failed at Level 6 (Locator → Binding)"
        return 1
    }
    echo "✓ Level 6: Binding → $binding"

    # Validate binding
    if ! validate_binding "$binding"; then
        echo "✗ Failed binding validation"
        return 1
    fi
    echo "✓ Binding validated"

    echo "✓ Full chain validation successful"
    return 0
}

# Quick validation (just connectivity)
validate_quick() {
    local symbol=$1

    local address
    address=$(resolve_symbol_to_address "$symbol" 2>/dev/null) || return 1

    local channel
    channel=$(resolve_address_to_channel "$address" "$symbol" 2>/dev/null) || return 1

    local connector
    connector=$(resolve_channel_to_connector "$channel" "$symbol" 2>/dev/null) || return 1

    validate_connector "$connector" 2>/dev/null
}

# Get validation status (for display)
get_validation_status() {
    local symbol=$1

    if validate_quick "$symbol"; then
        echo "✓ Reachable"
    else
        echo "✗ Unreachable"
    fi
}

# Cache validation results
cache_validation() {
    local symbol=$1
    local status=$2

    mkdir -p "$RESOLVE_CACHE"
    local cache_file="$RESOLVE_CACHE/${symbol#@}.status"
    echo "$status:$(date +%s)" > "$cache_file"
}

# Check cached validation (with TTL)
check_cached_validation() {
    local symbol=$1
    local ttl=${2:-300}  # 5 minutes default

    local cache_file="$RESOLVE_CACHE/${symbol#@}.status"

    if [[ ! -f "$cache_file" ]]; then
        return 1
    fi

    local cached_status cached_time
    IFS=':' read -r cached_status cached_time < "$cache_file"

    local now=$(date +%s)
    local age=$((now - cached_time))

    if [[ $age -gt $ttl ]]; then
        # Cache expired
        return 1
    fi

    [[ "$cached_status" == "valid" ]]
}
