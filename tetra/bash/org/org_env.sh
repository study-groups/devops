#!/usr/bin/env bash
# org_env.sh - Environment viewing and SSH connectivity
#
# SSH key management handled by tkm and ~/.ssh/config
# org just provides host/user from tetra.toml
#
# Environment format:
#    [env.dev]
#    host = "1.2.3.4"
#    auth_user = "root"      # SSH login user (has keys)
#    work_user = "dev"       # App user (owns /var/www)

# =============================================================================
# HOST/USER EXTRACTION
# =============================================================================

# Extract a key's value from section content
_org_extract_key() {
    local content="$1" key="$2"
    echo "$content" | grep "^${key} *=" | head -1 | sed 's/[^=]*= *"*//;s/"*$//'
}

# Get section content for [env.<name>]
_org_get_env_section() {
    local env="${1#@}"  # Remove @ prefix if present
    local toml=$(org_toml_path 2>/dev/null) || return 1

    awk -v sect="env.$env" '
        /^\[/ { if (p) exit; p = ($0 == "[" sect "]") }
        p { print }
    ' "$toml"
}

# Get host for an environment
_org_get_host() {
    local env="$1"
    local content=$(_org_get_env_section "$env") || return 1

    local val=$(_org_extract_key "$content" "host")
    [[ -n "$val" && "$val" != "127.0.0.1" ]] && echo "$val"
}

# Get SSH auth user for an environment (who you SSH as)
_org_get_user() {
    local env="$1"
    local content=$(_org_get_env_section "$env") || return 1

    local val=$(_org_extract_key "$content" "auth_user")
    echo "${val:-root}"
}

# Get work user (who runs the app, owns /var/www)
_org_get_work_user() {
    local env="$1"
    local content=$(_org_get_env_section "$env") || return 1

    local val=$(_org_extract_key "$content" "work_user")
    echo "${val:-$env}"
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
# Only returns [env.*] entries - actual SSH-capable targets
org_env_names() {
    local toml=$(org_toml_path 2>/dev/null) || return

    # Only env section - these are the SSH-capable targets
    grep -E '^\[env\.[^]]+\]' "$toml" 2>/dev/null | sed 's/.*\.//;s/\]//' | sort -u
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

export -f _org_extract_key _org_get_env_section _org_get_host _org_get_user _org_get_work_user
export -f org_env_list org_env_show org_env_names org_env_export org_env_vars
