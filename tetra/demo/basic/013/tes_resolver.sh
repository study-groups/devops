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

# Show 8-phase TES resolution for an action
# Usage: show_tes_resolution "status:tsm" "@dev"
show_tes_resolution() {
    local action="$1"
    local symbol="$2"
    local command="$3"

    echo "═══════════════════════════════════════════════════════════"
    echo "TES Resolution Pipeline (8 Phases)"
    echo "Action: $action → $symbol"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    # Phase 0: Symbol
    echo "Phase 0: Symbol (Logical Name)"
    echo "  symbol = \"$symbol\""
    echo "  type   = remote"
    echo ""

    # Phase 1: Address (from toml)
    local toml_path=$(get_toml_path)
    local address=$(grep "\"$symbol\"" "$toml_path" | grep -o 'address = "[^"]*"' | cut -d'"' -f2 | head -1)
    local droplet=$(grep "\"$symbol\"" "$toml_path" | grep -o 'droplet = "[^"]*"' | cut -d'"' -f2 | head -1)

    echo "Phase 1: Address (IP/Hostname)"
    echo "  address = \"$address\""
    echo "  droplet = \"$droplet\""
    echo ""

    # Phase 2: Channel (not used directly in our impl, but conceptually user@host)
    echo "Phase 2: Channel (User@Host combo)"
    echo "  (Resolved in Phase 3 connector)"
    echo ""

    # Phase 3: Connector (authentication info)
    local connector_data=$(resolve_connector "$symbol")
    IFS='|' read -r auth_user work_user host auth_key <<< "$connector_data"

    echo "Phase 3: Connector (Dual-role auth)"
    echo "  auth_user = \"$auth_user\"  # SSH authentication user"
    echo "  work_user = \"$work_user\"  # Working user (su target)"
    echo "  host      = \"$host\""
    echo "  auth_key  = \"${auth_key/$HOME/~}\""
    echo ""

    # Phase 4: Handle (validated connector - test connection)
    echo "Phase 4: Handle (Validated connector)"
    echo "  Testing connection to ${auth_user}@${host}..."
    if test_connector "$symbol" 2>/dev/null; then
        echo "  ✓ Connection validated"
    else
        echo "  ⚠ Connection not tested (use test_connector)"
    fi
    echo ""

    # Phase 5: Locator (full resource path)
    local remote_path="~/tetra"
    echo "Phase 5: Locator (Full resource path)"
    echo "  locator = \"${work_user}@${host}:${remote_path}\""
    echo ""

    # Phase 6: Binding (operation + locator + validation)
    echo "Phase 6: Binding (Operation + Locator)"
    echo "  operation = execute"
    echo "  command   = \"$command\""
    echo "  requires  = source ~/tetra/tetra.sh"
    echo ""

    # Phase 7: Plan (executable command)
    local ssh_cmd=$(build_ssh_command "$symbol" "$command")
    echo "Phase 7: Plan (Executable command)"
    echo "  Full SSH command:"
    echo ""
    echo "  $ssh_cmd"
    echo ""

    echo "═══════════════════════════════════════════════════════════"
}
