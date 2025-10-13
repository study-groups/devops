#!/usr/bin/env bash
# bash/resolve/connector.sh
# TES Level 2-4: Channel → Connector → Handle
# Handles dual-role authentication: auth_user:work_user@host -i key

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

    # Look up connector details from org TOML
    local org_toml
    if [[ -n "$TETRA_ORG" ]]; then
        org_toml="$TETRA_DIR/orgs/$TETRA_ORG/$TETRA_ORG.toml"
    else
        org_toml=$(find "$TETRA_DIR/orgs" -name "*.toml" -type f 2>/dev/null | head -1)
    fi

    if [[ ! -f "$org_toml" ]]; then
        echo "ERROR: No organization TOML found" >&2
        return 1
    fi

    # Parse [connectors] section to get auth_user and auth_key
    local auth_user auth_key
    local in_block=0

    while IFS= read -r line; do
        # Check if we're entering the connectors section
        if [[ "$line" =~ ^\[connectors\] ]]; then
            in_section=1
            continue
        fi

        # Check if we're entering a different section
        if [[ "$line" =~ ^\[.*\] ]] && [[ ! "$line" =~ ^\[connectors ]]; then
            in_section=0
            in_block=0
            continue
        fi

        # Check if this is our symbol's block
        if [[ $in_section -eq 1 ]] && [[ "$line" =~ ^\"@$symbol\" ]]; then
            in_block=1
            continue
        fi

        # Check if we're starting a new block
        if [[ $in_section -eq 1 ]] && [[ "$line" =~ ^\"@ ]]; then
            in_block=0
        fi

        # Parse values if we're in the right block
        if [[ $in_block -eq 1 ]]; then
            if [[ "$line" =~ auth_user[[:space:]]*=[[:space:]]*\"([^\"]+)\" ]]; then
                auth_user="${BASH_REMATCH[1]}"
            fi
            if [[ "$line" =~ auth_key[[:space:]]*=[[:space:]]*\"([^\"]+)\" ]]; then
                auth_key="${BASH_REMATCH[1]}"
            fi

            # If we have both, we're done
            if [[ -n "$auth_user" ]] && [[ -n "$auth_key" ]]; then
                break
            fi
        fi
    done < "$org_toml"

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
