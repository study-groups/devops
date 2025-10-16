#!/usr/bin/env bash

# TES (Tetra Endpoint Specification) Resolver
# Parses tetra.toml and builds SSH connectors for remote execution

# Get TOML file path
get_toml_path() {
    local toml_path="${TETRA_DIR}/org/pixeljam-arcade/tetra.toml"
    if [[ -f "$toml_path" ]]; then
        echo "$toml_path"
        return 0
    else
        return 1
    fi
}

# Parse TOML value (simple grep-based parser for our use case)
# Usage: get_toml_value "connectors.@dev" "auth_user"
get_toml_value() {
    local section="$1"
    local key="$2"
    local toml_path=$(get_toml_path)

    [[ -z "$toml_path" ]] && return 1

    # Extract section (e.g., [connectors])
    local section_name="${section%%.*}"
    local subsection="${section#*.}"

    # Find the line in the section
    awk -v section="[$section_name]" -v subsection="\"$subsection\"" -v key="$key" '
        $0 == section { in_section=1; next }
        in_section && $0 ~ /^\[/ { exit }
        in_section && $0 ~ "^" subsection {
            in_subsection=1
            line = $0
            # Extract value for key from the line
            if (match(line, key " = \"([^\"]+)\"", arr)) {
                print arr[1]
                exit
            }
        }
    ' "$toml_path"
}

# Resolve connector for a symbol (e.g., @dev)
# Returns: auth_user|work_user|host|auth_key
resolve_connector() {
    local symbol="$1"  # e.g., "@dev"
    local toml_path=$(get_toml_path)

    [[ -z "$toml_path" ]] && return 1

    # Parse connector line for the symbol
    # Format: "@dev" = { auth_user = "root", work_user = "dev", host = "137.184.226.163", auth_key = "~/.ssh/id_rsa" }

    # Find the line with this symbol
    local line=$(grep "^\"$symbol\"" "$toml_path")

    if [[ -z "$line" ]]; then
        return 1
    fi

    # Extract values using sed/awk
    local auth_user=$(echo "$line" | sed -n 's/.*auth_user = "\([^"]*\)".*/\1/p')
    local work_user=$(echo "$line" | sed -n 's/.*work_user = "\([^"]*\)".*/\1/p')
    local host=$(echo "$line" | sed -n 's/.*host = "\([^"]*\)".*/\1/p')
    local auth_key=$(echo "$line" | sed -n 's/.*auth_key = "\([^"]*\)".*/\1/p')

    # Expand tilde in auth_key
    auth_key="${auth_key/#\~/$HOME}"

    echo "$auth_user|$work_user|$host|$auth_key"
}

# Build SSH command for remote execution
# Usage: build_ssh_command "@dev" "command to run"
build_ssh_command() {
    local symbol="$1"
    local remote_command="$2"

    local connector_data=$(resolve_connector "$symbol")
    [[ -z "$connector_data" ]] && return 1

    IFS='|' read -r auth_user work_user host auth_key <<< "$connector_data"

    # Build SSH command with proper escaping
    # Use auth_user for SSH connection, then su to work_user
    local ssh_cmd="ssh -i \"$auth_key\" -o StrictHostKeyChecking=no -o ConnectTimeout=5"

    if [[ "$auth_user" != "$work_user" ]]; then
        # Dual-role: authenticate as auth_user, work as work_user
        echo "$ssh_cmd ${auth_user}@${host} \"su - $work_user -c '$remote_command'\""
    else
        # Single role
        echo "$ssh_cmd ${work_user}@${host} \"$remote_command\""
    fi
}

# Execute remote command and capture output
# Usage: execute_remote "@dev" "tsm ls"
execute_remote() {
    local symbol="$1"
    local remote_command="$2"

    local ssh_cmd=$(build_ssh_command "$symbol" "$remote_command")
    [[ -z "$ssh_cmd" ]] && {
        echo "Error: Failed to build SSH command for $symbol"
        return 1
    }

    # Execute and return output
    eval "$ssh_cmd" 2>&1
}

# Test if connector is valid (can connect)
# Usage: test_connector "@dev"
test_connector() {
    local symbol="$1"

    local result=$(execute_remote "$symbol" "echo 'Connected'" 2>&1)
    [[ "$result" == "Connected" ]]
}

# Get environment mapping
# Returns the symbol for an environment name
get_env_symbol() {
    local env="$1"  # e.g., "Dev", "Staging", "Prod"

    case "$env" in
        "Dev"|"dev")
            echo "@dev"
            ;;
        "Staging"|"staging")
            echo "@staging"
            ;;
        "Prod"|"prod"|"Production")
            echo "@prod"
            ;;
        "Local"|"local")
            echo "@local"
            ;;
        *)
            echo "@local"
            ;;
    esac
}

# Show connector info for debugging
show_connector_info() {
    local symbol="$1"
    local connector_data=$(resolve_connector "$symbol")

    if [[ -z "$connector_data" ]]; then
        echo "No connector found for $symbol"
        return 1
    fi

    IFS='|' read -r auth_user work_user host auth_key <<< "$connector_data"

    echo "Connector: $symbol"
    echo "  Auth User: $auth_user"
    echo "  Work User: $work_user"
    echo "  Host: $host"
    echo "  Key: ${auth_key/$HOME/~}"
}

# Log TES resolution plan (internal use - goes to diagnostic log)
# Usage: log_tes_plan "status:tsm" "@dev" "tsm ls"
log_tes_plan() {
    local action="$1"
    local symbol="$2"
    local command="$3"

    # Build the plan data
    local toml_path=$(get_toml_path)
    local address=$(grep "\"$symbol\"" "$toml_path" | grep -o 'address = "[^"]*"' | cut -d'"' -f2 | head -1)
    local droplet=$(grep "\"$symbol\"" "$toml_path" | grep -o 'droplet = "[^"]*"' | cut -d'"' -f2 | head -1)
    local connector_data=$(resolve_connector "$symbol")
    IFS='|' read -r auth_user work_user host auth_key <<< "$connector_data"
    local ssh_cmd=$(build_ssh_command "$symbol" "$command")

    # Store in diagnostic buffer
    TUI_BUFFERS["@tui[diagnostic]"]="TES Resolution: $action → $symbol

Phase 0: Symbol = \"$symbol\" (type: remote)
Phase 1: Address = \"$address\" (droplet: $droplet)
Phase 2: Channel = ${work_user}@${host}
Phase 3: Connector = ${auth_user}:${work_user}@${host} -i ${auth_key/$HOME/~}
Phase 4: Handle = (validated)
Phase 5: Locator = ${work_user}@${host}:~/tetra
Phase 6: Binding = execute(\"$command\")
Phase 7: Plan = $ssh_cmd"

    # Also set status line to show we're using TES
    TUI_BUFFERS["@tui[status]"]="TES: $action → $symbol | Press 't' to view resolution plan"
}

# Show 8-phase TES resolution for an action (for display in content)
# Usage: show_tes_resolution "status:tsm" "@dev" "tsm ls"
show_tes_resolution() {
    local action="$1"
    local symbol="$2"
    local command="$3"

    # Log the plan to diagnostic
    log_tes_plan "$action" "$symbol" "$command"

    # Don't output to content - just log to diagnostic
    # The status line will show user can press 't' to see the plan
}

# Preview TES plan for current action (used during navigation)
# Usage: preview_tes_plan_for_action "status:tsm" "Dev"
preview_tes_plan_for_action() {
    local action="$1"
    local env="$2"

    # Get action metadata
    local action_name="${action//:/_}"
    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        return 1
    fi

    local -n _action="ACTION_${action_name}"
    local tes_target="${_action[tes_target]}"
    local tes_operation="${_action[tes_operation]}"

    # Skip if no TES metadata
    [[ -z "$tes_target" || -z "$tes_operation" ]] && return 1

    # Determine command based on action
    local command=""
    local verb="${action%%:*}"
    local noun="${action##*:}"

    case "$verb:$noun" in
        status:tsm)
            command="tsm list"
            ;;
        status:watchdog)
            command="pgrep -f 'tetra.*watchdog'"
            ;;
        start:tsm)
            command="tsm start"
            ;;
        stop:tsm)
            command="tsm stop"
            ;;
        start:watchdog)
            command="tetra watchdog start"
            ;;
        stop:watchdog)
            command="tetra watchdog stop"
            ;;
        deploy:*)
            command="cd ~/tetra && git pull && bash deploy.sh"
            ;;
        *)
            command="echo 'No command defined'"
            ;;
    esac

    # Generate the plan (without executing)
    log_tes_plan "$action" "$tes_target" "$command"
}
