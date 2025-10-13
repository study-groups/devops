#!/usr/bin/env bash

# TES Resolution Helpers
# Symbol → Address → Channel → Connector → Handle → Locator → Binding → Plan
# Implements Tetra Endpoint Specification (TES) v2.1 progressive resolution

# Requires: TOML parser
# Usage: source tes_resolve.sh

# TES Level 0→1: Symbol to Address
# @dev → 137.184.226.163
tes_resolve_symbol() {
    local symbol="$1"
    local org_toml="${2:-$TETRA_DIR/config/tetra.toml}"

    if [[ ! -f "$org_toml" ]]; then
        echo "Error: TOML not found: $org_toml" >&2
        return 1
    fi

    # Load TOML
    source "$TETRA_SRC/bash/deploy/toml.sh"
    toml_parse "$org_toml" "TES" 2>/dev/null

    # Get symbol data (TOML parser stores inline tables as strings)
    local symbol_str="${TES_symbols[$symbol]}"

    if [[ -z "$symbol_str" ]]; then
        echo "Error: Symbol '$symbol' not found in TOML" >&2
        return 1
    fi

    # Extract address from inline table: { address = "1.2.3.4", ... }
    local address
    address=$(echo "$symbol_str" | grep -o 'address = "[^"]*"' | cut -d'"' -f2)

    if [[ -z "$address" ]]; then
        echo "Error: No address in symbol '$symbol'" >&2
        return 1
    fi

    echo "$address"
}

# TES Level 1→2: Address to Channel
# 137.184.226.163 → dev@137.184.226.163
tes_resolve_channel() {
    local symbol="$1"
    local org_toml="${2:-$TETRA_DIR/config/tetra.toml}"

    if [[ ! -f "$org_toml" ]]; then
        echo "Error: TOML not found: $org_toml" >&2
        return 1
    fi

    # Load TOML
    source "$TETRA_SRC/bash/deploy/toml.sh"
    toml_parse "$org_toml" "TES" 2>/dev/null

    # Get connector data
    local connector_str="${TES_connectors[$symbol]}"

    if [[ -z "$connector_str" ]]; then
        echo "Error: Connector for '$symbol' not found" >&2
        return 1
    fi

    # Extract work_user and host
    local work_user host
    work_user=$(echo "$connector_str" | grep -o 'work_user = "[^"]*"' | cut -d'"' -f2)
    host=$(echo "$connector_str" | grep -o 'host = "[^"]*"' | cut -d'"' -f2)

    if [[ -z "$work_user" || -z "$host" ]]; then
        echo "Error: Incomplete connector for '$symbol'" >&2
        return 1
    fi

    echo "${work_user}@${host}"
}

# TES Level 2→3: Channel to Connector (dual-role)
# dev@137.184.226.163 → root:dev@137.184.226.163 -i ~/.ssh/id_rsa
tes_resolve_connector() {
    local symbol="$1"
    local org_toml="${2:-$TETRA_DIR/config/tetra.toml}"

    if [[ ! -f "$org_toml" ]]; then
        echo "Error: TOML not found: $org_toml" >&2
        return 1
    fi

    # Load TOML
    source "$TETRA_SRC/bash/deploy/toml.sh"
    toml_parse "$org_toml" "TES" 2>/dev/null

    # Get connector data
    local connector_str="${TES_connectors[$symbol]}"

    if [[ -z "$connector_str" ]]; then
        echo "Error: Connector for '$symbol' not found" >&2
        return 1
    fi

    # Extract fields
    local auth_user work_user host auth_key
    auth_user=$(echo "$connector_str" | grep -o 'auth_user = "[^"]*"' | cut -d'"' -f2)
    work_user=$(echo "$connector_str" | grep -o 'work_user = "[^"]*"' | cut -d'"' -f2)
    host=$(echo "$connector_str" | grep -o 'host = "[^"]*"' | cut -d'"' -f2)
    auth_key=$(echo "$connector_str" | grep -o 'auth_key = "[^"]*"' | cut -d'"' -f2)
    auth_key="${auth_key:-~/.ssh/id_rsa}"

    if [[ -z "$auth_user" || -z "$work_user" || -z "$host" ]]; then
        echo "Error: Incomplete connector for '$symbol'" >&2
        return 1
    fi

    # Dual-role format: auth_user:work_user@host -i key
    echo "${auth_user}:${work_user}@${host} -i ${auth_key}"
}

# TES Level 3→4: Connector to Handle (validated)
# Validates SSH connectivity before returning connector
tes_validate_connector() {
    local symbol="$1"
    local org_toml="${2:-$TETRA_DIR/config/tetra.toml}"
    local timeout="${3:-5}"

    local connector
    connector=$(tes_resolve_connector "$symbol" "$org_toml") || return 1

    # Extract auth user and host
    local auth_part="${connector%% -i*}"
    local auth_user="${auth_part%%:*}"
    local host="${auth_part##*@}"
    local auth_key="${connector##* -i }"

    # Test SSH connectivity
    if timeout "$timeout" ssh -o BatchMode=yes -o ConnectTimeout="$timeout" \
        -i "$auth_key" "${auth_user}@${host}" "echo ok" &>/dev/null; then
        echo "$connector"
        return 0
    else
        echo "Error: SSH connection failed: ${auth_user}@${host}" >&2
        return 1
    fi
}

# TES Level 4→5: Handle to Locator
# root:dev@137.184.226.163 + path → dev@137.184.226.163:~/tetra/orgs/foo/tetra.toml
tes_resolve_locator() {
    local symbol="$1"
    local remote_path="$2"
    local org_toml="${3:-$TETRA_DIR/config/tetra.toml}"

    if [[ -z "$remote_path" ]]; then
        echo "Error: Remote path required" >&2
        return 1
    fi

    # Get channel (work_user@host)
    local channel
    channel=$(tes_resolve_channel "$symbol" "$org_toml") || return 1

    # Locator format: work_user@host:path
    echo "${channel}:${remote_path}"
}

# TES Level 5→6: Locator to Binding (operation + validation)
# Binding = { operation: "write", locator: "...", validated: true }
tes_create_binding() {
    local operation="$1"  # read, write, execute
    local symbol="$2"
    local remote_path="$3"
    local org_toml="${4:-$TETRA_DIR/config/tetra.toml}"

    case "$operation" in
        read|write|execute) ;;
        *)
            echo "Error: Invalid operation '$operation'. Must be: read, write, execute" >&2
            return 1
            ;;
    esac

    local locator
    locator=$(tes_resolve_locator "$symbol" "$remote_path" "$org_toml") || return 1

    # Validate connector
    if ! tes_validate_connector "$symbol" "$org_toml" >/dev/null 2>&1; then
        echo "Error: Connector validation failed for $symbol" >&2
        return 1
    fi

    # Return binding as key=value format
    cat << EOF
operation=$operation
symbol=$symbol
locator=$locator
validated=true
EOF
}

# TES Level 6→7: Binding to Plan (executable command)
# Complete SSH/SCP command ready to execute
tes_create_plan() {
    local operation="$1"
    local symbol="$2"
    local local_path="$3"
    local remote_path="$4"
    local org_toml="${5:-$TETRA_DIR/config/tetra.toml}"

    # Get connector
    local connector
    connector=$(tes_resolve_connector "$symbol" "$org_toml") || return 1

    # Parse connector
    local auth_part="${connector%% -i*}"
    local auth_user="${auth_part%%:*}"
    local work_user="${auth_part#*:}"
    work_user="${work_user%%@*}"
    local host="${auth_part##*@}"
    local auth_key="${connector##* -i }"

    # Expand tilde in auth_key
    auth_key="${auth_key/#\~/$HOME}"

    case "$operation" in
        write)
            if [[ "$auth_user" == "$work_user" ]]; then
                # Single-user: direct SCP
                local remote_dir="$(dirname "$remote_path")"
                cat << EOF
# Single-user write
ssh -i "$auth_key" "${work_user}@${host}" "mkdir -p ${remote_dir}" && \\
scp -i "$auth_key" "$local_path" "${work_user}@${host}:${remote_path}"
EOF
            else
                # Dual-role: copy to /tmp, then move as work_user
                local tmp_file="/tmp/$(basename "$local_path")"
                cat << EOF
# Dual-role write (auth_user: $auth_user, work_user: $work_user)
scp -i "$auth_key" "$local_path" "${auth_user}@${host}:${tmp_file}" && \\
ssh -i "$auth_key" "${auth_user}@${host}" \\
  "sudo -u ${work_user} mkdir -p \$(dirname ${remote_path}) && \\
   sudo -u ${work_user} cp ${tmp_file} ${remote_path} && \\
   rm ${tmp_file}"
EOF
            fi
            ;;
        read)
            if [[ "$auth_user" == "$work_user" ]]; then
                # Single-user: direct SCP
                echo "scp -i \"$auth_key\" \"${work_user}@${host}:${remote_path}\" \"$local_path\""
            else
                # Dual-role: copy to /tmp as work_user, then fetch
                local tmp_file="/tmp/$(basename "$remote_path")"
                cat << EOF
ssh -i "$auth_key" "${auth_user}@${host}" \\
  "sudo -u ${work_user} cp ${remote_path} ${tmp_file} && chmod 644 ${tmp_file}" && \\
scp -i "$auth_key" "${auth_user}@${host}:${tmp_file}" "$local_path" && \\
ssh -i "$auth_key" "${auth_user}@${host}" "rm ${tmp_file}"
EOF
            fi
            ;;
        execute)
            local cmd="$local_path"  # Reuse local_path param for command
            if [[ "$auth_user" == "$work_user" ]]; then
                echo "ssh -i \"$auth_key\" \"${work_user}@${host}\" \"$cmd\""
            else
                echo "ssh -i \"$auth_key\" \"${auth_user}@${host}\" \"sudo -u ${work_user} $cmd\""
            fi
            ;;
    esac
}

# Full resolution trace (debugging)
tes_trace_resolution() {
    local symbol="$1"
    local org_toml="${2:-$TETRA_DIR/config/tetra.toml}"

    echo "═══ TES Resolution Trace ═══"
    echo ""
    echo "Level 0 (Symbol):    $symbol"

    local address
    address=$(tes_resolve_symbol "$symbol" "$org_toml" 2>&1)
    echo "Level 1 (Address):   $address"

    local channel
    channel=$(tes_resolve_channel "$symbol" "$org_toml" 2>&1)
    echo "Level 2 (Channel):   $channel"

    local connector
    connector=$(tes_resolve_connector "$symbol" "$org_toml" 2>&1)
    echo "Level 3 (Connector): $connector"

    echo ""
    echo "Validating connector..."
    if tes_validate_connector "$symbol" "$org_toml" 5 >/dev/null 2>&1; then
        echo "Level 4 (Handle):    ✓ Validated"
    else
        echo "Level 4 (Handle):    ✗ Validation failed"
        return 1
    fi

    echo ""
    echo "Example locator: ${channel}:~/tetra/orgs/example/tetra.toml"
}

# Export functions
export -f tes_resolve_symbol
export -f tes_resolve_channel
export -f tes_resolve_connector
export -f tes_validate_connector
export -f tes_resolve_locator
export -f tes_create_binding
export -f tes_create_plan
export -f tes_trace_resolution
