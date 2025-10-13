#!/usr/bin/env bash
# bash/resolve/plan.sh
# TES Level 6-7: Binding → Plan
# Generates executable command strings from validated bindings

# Resolve binding to plan (generate executable command)
# Level 6 → 7: write(dev@host:~/.ssh/authorized_keys) → full SSH command
resolve_binding_to_plan() {
    local binding=$1

    declare -A bind_parts
    parse_binding "$binding" bind_parts || return 1

    local operation="${bind_parts[operation]}"
    local locator="${bind_parts[locator]}"

    # Check if local or remote
    if [[ "$locator" =~ @ ]]; then
        # Remote operation
        generate_remote_plan "$operation" "$locator"
    else
        # Local operation
        generate_local_plan "$operation" "$locator"
    fi
}

# Generate plan for local operations
generate_local_plan() {
    local operation=$1
    local path=$2

    case "$operation" in
        read)
            echo "cat '$path'"
            ;;
        write)
            # Assumes input will be piped in
            echo "cat > '$path'"
            ;;
        append)
            echo "cat >> '$path'"
            ;;
        delete)
            echo "rm -f '$path'"
            ;;
        *)
            echo "ERROR: Unknown operation: $operation" >&2
            return 1
            ;;
    esac
}

# Generate plan for remote operations
generate_remote_plan() {
    local operation=$1
    local locator=$2

    # Parse locator: user@host:path
    if [[ ! "$locator" =~ ^([^@]+)@([^:]+):(.+)$ ]]; then
        echo "ERROR: Invalid remote locator format: $locator" >&2
        return 1
    fi

    local user="${BASH_REMATCH[1]}"
    local host="${BASH_REMATCH[2]}"
    local path="${BASH_REMATCH[3]}"

    # Get connector details from symbol (if available)
    # For now, we'll build a basic SSH command
    # In a full implementation, this would look up auth details

    case "$operation" in
        read)
            # Read from remote file
            echo "ssh ${user}@${host} \"cat '${path}'\""
            ;;
        write)
            # Write to remote file (input from stdin)
            echo "ssh ${user}@${host} \"cat > '${path}'\""
            ;;
        append)
            # Append to remote file
            echo "ssh ${user}@${host} \"cat >> '${path}'\""
            ;;
        delete)
            # Delete remote file
            echo "ssh ${user}@${host} \"rm -f '${path}'\""
            ;;
        *)
            echo "ERROR: Unknown operation: $operation" >&2
            return 1
            ;;
    esac
}

# Generate plan with full connector details (dual-role support)
# This version uses connector information for proper authentication
generate_plan_with_connector() {
    local binding=$1
    local connector=$2

    declare -A bind_parts
    parse_binding "$binding" bind_parts || return 1

    local operation="${bind_parts[operation]}"
    local locator="${bind_parts[locator]}"

    # Parse connector for auth details
    declare -A conn_parts
    parse_connector "$connector" conn_parts || return 1

    # Extract path from locator
    local path
    if [[ "$locator" =~ :(.+)$ ]]; then
        path="${BASH_REMATCH[1]}"
    else
        path="$locator"
    fi

    # Build SSH command with auth
    local ssh_opts=""
    if [[ -n "${conn_parts[auth_key]}" ]]; then
        ssh_opts="-i ${conn_parts[auth_key]}"
    fi

    # Add standard options
    ssh_opts="$ssh_opts -o BatchMode=yes -o ConnectTimeout=5"

    # Build command based on operation
    local remote_cmd
    case "$operation" in
        read)
            remote_cmd="cat '${path}'"
            ;;
        write)
            remote_cmd="cat > '${path}'"
            ;;
        append)
            remote_cmd="cat >> '${path}'"
            ;;
        delete)
            remote_cmd="rm -f '${path}'"
            ;;
        *)
            echo "ERROR: Unknown operation: $operation" >&2
            return 1
            ;;
    esac

    # Wrap with sudo if dual-role
    if [[ "${conn_parts[auth_user]}" != "${conn_parts[work_user]}" ]]; then
        remote_cmd="sudo -u ${conn_parts[work_user]} $remote_cmd"
    fi

    # Build final SSH command
    echo "ssh $ssh_opts ${conn_parts[auth_user]}@${conn_parts[host]} \"$remote_cmd\""
}

# Execute a plan
execute_plan() {
    local plan=$1
    local input_data=${2:-""}

    if [[ -n "$input_data" ]]; then
        # Execute with input data
        echo "$input_data" | eval "$plan"
    else
        # Execute without input
        eval "$plan"
    fi
}

# Execute a plan with dry-run option
execute_plan_safe() {
    local plan=$1
    local dry_run=${2:-false}

    if [[ "$dry_run" == "true" ]]; then
        echo "[DRY RUN] Would execute: $plan"
        return 0
    else
        execute_plan "$plan"
    fi
}

# Generate a complete rekey plan (common TKM operation)
# Source: local public key, Target: remote authorized_keys
generate_rekey_plan() {
    local source_binding=$1  # read(~/.ssh/id_rsa.pub)
    local target_binding=$2  # write(dev@host:~/.ssh/authorized_keys)
    local connector=$3       # root:dev@host -i key

    # Get source plan (read local key)
    local source_plan
    source_plan=$(resolve_binding_to_plan "$source_binding") || return 1

    # Get target plan with connector (write remote key)
    local target_plan
    target_plan=$(generate_plan_with_connector "$target_binding" "$connector") || return 1

    # Combine: read source and pipe to target
    echo "$source_plan | $target_plan"
}

# Pretty-print a plan for display
format_plan() {
    local plan=$1
    local indent=${2:-"  "}

    # Break into logical steps if piped
    if [[ "$plan" =~ \| ]]; then
        echo "Multi-step plan:"
        local IFS='|'
        local step_num=1
        for step in $plan; do
            echo "${indent}${step_num}. $(echo "$step" | xargs)"
            ((step_num++))
        done
    else
        echo "Single-step plan:"
        echo "${indent}$plan"
    fi
}
