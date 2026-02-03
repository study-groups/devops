#!/usr/bin/env bash
# bash/resolve/connector.sh
# TES Level 2-4: Channel → Connector → Handle
# Handles dual-role authentication: auth_user:work_user@host -i key
#
# Auth data comes from [env.*] sections via org_env.sh (single source of truth)

# Resolve channel to connector (with authentication)
# Level 2 → 3: dev@143.198.45.123 → root:dev@143.198.45.123 -i ~/.ssh/id_rsa
resolve_channel_to_connector() {
    local channel=$1
    local symbol=$2

    # Strip @ prefix if present
    symbol="${symbol#@}"

    # Parse channel: user@host
    local work_user="${channel%%@*}"
    local host="${channel##*@}"

    # For localhost, no auth needed
    if [[ "$host" == "localhost" || "$host" == "127.0.0.1" ]]; then
        echo "$channel"
        return 0
    fi

    # Look up connector details from [env.$symbol] via org_env functions
    local auth_user auth_key

    # Get auth details from environment section (single source of truth)
    auth_user=$(_org_get_user "$symbol" 2>/dev/null)
    auth_key=$(_org_get_auth_key "$symbol" 2>/dev/null)

    # Expand tilde in auth_key
    auth_key="${auth_key/#\~/$HOME}"

    # Build connector string
    if [[ -z "$auth_user" ]]; then
        # No auth_user specified, assume single-user mode
        echo "${work_user}@${host}"
    elif [[ "$auth_user" == "$work_user" ]]; then
        # Same user for auth and work
        if [[ -n "$auth_key" ]]; then
            echo "${auth_user}@${host} -i ${auth_key}"
        else
            echo "${auth_user}@${host}"
        fi
    else
        # Dual-role: auth_user:work_user@host -i key
        if [[ -n "$auth_key" ]]; then
            echo "${auth_user}:${work_user}@${host} -i ${auth_key}"
        else
            echo "${auth_user}:${work_user}@${host}"
        fi
    fi
}

# Parse connector into components
# Input: "root:dev@143.198.45.123 -i ~/.ssh/id_rsa"
# Output: Sets auth_user, work_user, host, auth_key variables
parse_connector() {
    local connector=$1
    local -n result=$2

    # Extract SSH key if present
    if [[ "$connector" =~ -i[[:space:]]+([^[:space:]]+) ]]; then
        result[auth_key]="${BASH_REMATCH[1]}"
        # Remove the -i part from connector for further parsing
        connector="${connector%% -i*}"
    fi

    # Parse user@host portion
    local user_part="${connector%%@*}"
    local host="${connector##*@}"

    result[host]="$host"

    # Check for dual-role syntax (auth_user:work_user)
    if [[ "$user_part" =~ : ]]; then
        result[auth_user]="${user_part%%:*}"
        result[work_user]="${user_part##*:}"
    else
        # Single user
        result[auth_user]="$user_part"
        result[work_user]="$user_part"
    fi
}

# Build SSH command from connector
# Returns the SSH command prefix for executing commands
build_ssh_command() {
    local connector=$1
    local command=${2:-""}

    declare -A conn_parts
    parse_connector "$connector" conn_parts

    local ssh_cmd="ssh"

    # Add key if specified
    if [[ -n "${conn_parts[auth_key]}" ]]; then
        ssh_cmd="$ssh_cmd -i ${conn_parts[auth_key]}"
    fi

    # Add standard options
    ssh_cmd="$ssh_cmd -o BatchMode=yes -o ConnectTimeout=5"

    # Add user@host
    ssh_cmd="$ssh_cmd ${conn_parts[auth_user]}@${conn_parts[host]}"

    # If dual-role and command specified, wrap with sudo
    if [[ "${conn_parts[auth_user]}" != "${conn_parts[work_user]}" ]] && [[ -n "$command" ]]; then
        ssh_cmd="$ssh_cmd \"sudo -u ${conn_parts[work_user]} $command\""
    elif [[ -n "$command" ]]; then
        ssh_cmd="$ssh_cmd \"$command\""
    fi

    echo "$ssh_cmd"
}

# Resolve handle to locator (add resource path)
# Level 4 → 5: validated connector → user@host:~/.ssh/authorized_keys
resolve_handle_to_locator() {
    local connector=$1
    local resource_path=$2

    declare -A conn_parts
    parse_connector "$connector" conn_parts

    # For localhost
    if [[ "${conn_parts[host]}" == "localhost" || "${conn_parts[host]}" == "127.0.0.1" ]]; then
        # Expand tilde for local paths
        resource_path="${resource_path/#\~/$HOME}"
        echo "$resource_path"
        return 0
    fi

    # For remote: channel:path format
    echo "${conn_parts[work_user]}@${conn_parts[host]}:${resource_path}"
}
