#!/usr/bin/env bash
# org_env.sh - Environment viewing and SSH connectivity
#
# SSH key management handled by tkm and ~/.ssh/config
# org just provides host/user from tetra.toml
#
# Connectors format:
#    [connectors]
#    "@dev" = { auth_user = "root", work_user = "dev", host = "1.2.3.4" }
#
# Environments format:
#    [environments.dev]
#    host = "1.2.3.4"
#    user = "dev"

# =============================================================================
# HOST/USER EXTRACTION (unified for both formats)
# =============================================================================

# Extract value from inline table: key = "value"
_org_extract_value() {
    local line="$1" key="$2"
    # Match: key = "value" or key="value"
    echo "$line" | sed -n "s/.*${key} *= *\"\([^\"]*\)\".*/\1/p"
}

# Get host for an environment
_org_get_host() {
    local env="${1#@}"  # Remove @ prefix if present
    local toml=$(org_toml_path 2>/dev/null) || return 1

    # Try inline connectors: "@dev" = { host = "..." }
    # Must match the assignment pattern, not symbol = "@dev"
    local line=$(grep "\"@$env\" *=" "$toml" 2>/dev/null | head -1)
    if [[ -n "$line" && "$line" == *"{"* ]]; then
        _org_extract_value "$line" "host"
        return
    fi

    # Use environments section
    local section="environments.$env"
    local content=$(awk -v sect="$section" '
        /^\[/ { if (p) exit; p = ($0 == "[" sect "]") }
        p { print }
    ' "$toml")

    for key in host ssh_host server_ip address; do
        local val=$(echo "$content" | grep "^${key} *=" | head -1 | sed 's/[^=]*= *"*//;s/"*$//')
        if [[ -n "$val" && "$val" != "127.0.0.1" ]]; then
            echo "$val"
            return
        fi
    done
}

# Get SSH user for an environment (auth_user for login)
_org_get_user() {
    local env="${1#@}"
    local toml=$(org_toml_path 2>/dev/null) || return 1

    # Try inline connectors: "@dev" = { auth_user = "..." }
    local line=$(grep "\"@$env\" *=" "$toml" 2>/dev/null | head -1)
    if [[ -n "$line" && "$line" == *"{"* ]]; then
        local user=$(_org_extract_value "$line" "auth_user")
        [[ -z "$user" ]] && user=$(_org_extract_value "$line" "work_user")
        [[ -n "$user" ]] && echo "$user" && return
    fi

    # Use environments section
    local section="environments.$env"
    local content=$(awk -v sect="$section" '
        /^\[/ { if (p) exit; p = ($0 == "[" sect "]") }
        p { print }
    ' "$toml")

    for key in ssh_auth_user auth_user ssh_user user; do
        local val=$(echo "$content" | grep "^${key} *=" | head -1 | sed 's/[^=]*= *"*//;s/"*$//')
        [[ -n "$val" ]] && echo "$val" && return
    done

    echo "root"
}

# Get work user (the user you switch to after login)
_org_get_work_user() {
    local env="${1#@}"
    local toml=$(org_toml_path 2>/dev/null) || return 1

    # Try inline connectors: "@dev" = { work_user = "..." }
    local line=$(grep "\"@$env\" *=" "$toml" 2>/dev/null | head -1)
    if [[ -n "$line" && "$line" == *"{"* ]]; then
        _org_extract_value "$line" "work_user"
        return
    fi

    # Use environments section
    local section="environments.$env"
    local content=$(awk -v sect="$section" '
        /^\[/ { if (p) exit; p = ($0 == "[" sect "]") }
        p { print }
    ' "$toml")

    for key in ssh_work_user work_user; do
        local val=$(echo "$content" | grep "^${key} *=" | head -1 | sed 's/[^=]*= *"*//;s/"*$//')
        [[ -n "$val" ]] && echo "$val" && return
    done
}

# =============================================================================
# ENVIRONMENT LISTING
# =============================================================================

# List all environments with their connection info
org_env_list() {
    org_toml_path &>/dev/null || { echo "No active org"; return 1; }

    echo "Environments for: $(org_active)"
    echo ""

    for env in $(org_env_names); do
        local host=$(_org_get_host "$env")
        local user=$(_org_get_user "$env")

        if [[ -n "$host" ]]; then
            printf "  %-12s %s@%s\n" "$env" "$user" "$host"
        else
            printf "  %-12s (local)\n" "$env"
        fi
    done
}

# Show details for a specific environment
org_env_show() {
    local env="${1#@}"

    [[ -z "$env" ]] && { echo "Usage: org env <name>"; org_env_list; return 1; }

    local host=$(_org_get_host "$env")
    local user=$(_org_get_user "$env")
    local work_user=$(_org_get_work_user "$env")

    if [[ -z "$host" ]]; then
        echo "Not found: $env"
        return 1
    fi

    echo "Environment: $env"
    echo ""
    echo "  Host: $host"
    echo "  User: $user"
    [[ -n "$work_user" && "$work_user" != "$user" ]] && echo "  Work user: $work_user"
    echo ""
    echo "  Connect: ssh $user@$host"
    [[ -n "$work_user" && "$work_user" != "$user" ]] && echo "  Then: su - $work_user"
}

# List environment names only (for completion)
# Only returns [environments.*] entries - actual SSH-capable targets
org_env_names() {
    local toml=$(org_toml_path 2>/dev/null) || return

    # Only environments section - these are the SSH-capable targets
    # Publishing targets (tau, games) and storage (spaces) are not SSH environments
    grep -E '^\[environments\.[^]]+\]' "$toml" 2>/dev/null | sed 's/.*\.//;s/\]//' | sort -u
}

# =============================================================================
# ENVIRONMENT VARIABLES
# =============================================================================

# Export $dev, $staging, $prod variables with host IPs
# Call this after org switch or in shell init
org_env_export() {
    local toml=$(org_toml_path 2>/dev/null) || return

    for env in $(org_env_names); do
        [[ "$env" == "local" ]] && continue
        local host=$(_org_get_host "$env")
        [[ -n "$host" ]] && export "$env=$host"
    done
}

# Show current environment variables
org_env_vars() {
    for env in $(org_env_names 2>/dev/null); do
        [[ "$env" == "local" ]] && continue
        local val="${!env:-}"
        if [[ -n "$val" ]]; then
            echo "$env=$val"
        else
            echo "$env=(not set)"
        fi
    done
}

# Auto-export on source if org is active
org_toml_path &>/dev/null && org_env_export

# =============================================================================
# EXPORTS
# =============================================================================

export -f _org_extract_value _org_get_host _org_get_user _org_get_work_user
export -f org_env_list org_env_show org_env_names org_env_export org_env_vars
