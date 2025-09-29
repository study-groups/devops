#!/usr/bin/env bash

# TKM Provider for TView - Data generation from tetra.toml + live SSH status
# Provides unified data source for TKM visualization in tview

# Source TKM core for utilities
TKM_MODULE_DIR="$(dirname "${BASH_SOURCE[0]}")"
TKM_CORE_DIR="$(dirname "$TKM_MODULE_DIR")"
[[ -f "$TKM_CORE_DIR/tkm.sh" ]] && source "$TKM_CORE_DIR/tkm.sh" && tkm_source_modules >/dev/null 2>&1

# TKM Data structures
declare -A TKM_AMIGOS_DATA
declare -A TKM_SSH_STATUS
declare -A TKM_KEY_STATUS

# Load TKM configuration from tetra.toml
tkm_load_config() {
    local config_file="${1:-$TETRA_DIR/tetra.toml}"

    if [[ ! -f "$config_file" ]]; then
        echo "Warning: tetra.toml not found at $config_file" >&2
        return 1
    fi

    # Parse TOML using simple bash parsing (could be enhanced with proper TOML parser)
    local current_section=""
    while IFS= read -r line; do
        # Skip comments and empty lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ "$line" =~ ^[[:space:]]*$ ]] && continue

        # Track current section
        if [[ "$line" =~ ^\[(.*)\]$ ]]; then
            current_section="${BASH_REMATCH[1]}"
            continue
        fi

        # Parse key-value pairs for environments
        if [[ "$current_section" =~ ^environments\.(local|dev|staging|prod)$ ]]; then
            local env="${current_section#environments.}"
            if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
                local key="${BASH_REMATCH[1]// /}"
                local value="${BASH_REMATCH[2]}"
                # Remove quotes from value
                value="${value#\"}"
                value="${value%\"}"
                TKM_AMIGOS_DATA["${env}_${key}"]="$value"
            fi
        fi

        # Parse TKM-specific config
        if [[ "$current_section" =~ ^tkm\.environments\.(local|dev|staging|prod)$ ]]; then
            local env="${current_section#tkm.environments.}"
            if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
                local key="${BASH_REMATCH[1]// /}"
                local value="${BASH_REMATCH[2]}"
                # Remove quotes and brackets for arrays
                value="${value#\"}"
                value="${value%\"}"
                value="${value#\[}"
                value="${value%\]}"
                TKM_AMIGOS_DATA["tkm_${env}_${key}"]="$value"
            fi
        fi
    done < "$config_file"
}

# Get SSH connection status for environment
tkm_get_ssh_status() {
    local env="$1"
    local user="${2:-$(tkm_get_env_user "$env")}"
    local host="$(tkm_get_env_host "$env")"

    if [[ "$env" == "local" ]]; then
        TKM_SSH_STATUS["${env}_status"]="local"
        TKM_SSH_STATUS["${env}_latency"]="0ms"
        return 0
    fi

    if [[ -z "$host" ]]; then
        TKM_SSH_STATUS["${env}_status"]="error"
        TKM_SSH_STATUS["${env}_error"]="Host not configured"
        return 1
    fi

    # Test SSH connectivity with timeout
    local start_time=$(date +%s%N)
    if timeout 5 ssh -o ConnectTimeout=3 -o BatchMode=yes -o StrictHostKeyChecking=no \
       "${user}@${host}" "echo 'test'" >/dev/null 2>&1; then
        local end_time=$(date +%s%N)
        local latency=$(( (end_time - start_time) / 1000000 ))
        TKM_SSH_STATUS["${env}_status"]="connected"
        TKM_SSH_STATUS["${env}_latency"]="${latency}ms"
    else
        TKM_SSH_STATUS["${env}_status"]="disconnected"
        TKM_SSH_STATUS["${env}_error"]="Connection failed"
    fi
}

# Get SSH key status for environment
tkm_get_key_status() {
    local env="$1"
    local user="${2:-env}"  # Default to env user

    local key_path
    case "$user" in
        "env") key_path="~/.ssh/tetra_${env}_key" ;;
        "root") key_path="~/.ssh/tetra_${env}_root_key" ;;
        *) key_path="~/.ssh/tetra_${env}_${user}_key" ;;
    esac

    # Expand tilde
    key_path="${key_path/#\~/$HOME}"

    if [[ -f "$key_path" ]]; then
        # Check key age and permissions
        local key_age=$(( $(date +%s) - $(stat -f%m "$key_path" 2>/dev/null || stat -c%Y "$key_path" 2>/dev/null || echo 0) ))
        local key_days=$(( key_age / 86400 ))

        if [[ $key_days -gt 30 ]]; then
            TKM_KEY_STATUS["${env}_${user}_status"]="expired"
            TKM_KEY_STATUS["${env}_${user}_age"]="${key_days}d"
        elif [[ $key_days -gt 25 ]]; then
            TKM_KEY_STATUS["${env}_${user}_status"]="expiring"
            TKM_KEY_STATUS["${env}_${user}_age"]="${key_days}d"
        else
            TKM_KEY_STATUS["${env}_${user}_status"]="valid"
            TKM_KEY_STATUS["${env}_${user}_age"]="${key_days}d"
        fi

        # Check permissions (should be 600)
        local perms=$(stat -f%A "$key_path" 2>/dev/null || stat -c%a "$key_path" 2>/dev/null)
        TKM_KEY_STATUS["${env}_${user}_perms"]="$perms"
        [[ "$perms" != "600" ]] && TKM_KEY_STATUS["${env}_${user}_perm_warning"]="true"
    else
        TKM_KEY_STATUS["${env}_${user}_status"]="missing"
    fi
}

# Helper functions to extract data
tkm_get_env_host() {
    local env="$1"
    echo "${TKM_AMIGOS_DATA[${env}_host]:-}"
}

tkm_get_env_user() {
    local env="$1"
    case "$env" in
        "local") echo "$(whoami)" ;;
        "dev") echo "tetra" ;;
        "staging"|"prod") echo "deploy" ;;
        *) echo "ubuntu" ;;
    esac
}

tkm_get_env_name() {
    local env="$1"
    echo "${TKM_AMIGOS_DATA[${env}_name]:-${env^}}"
}

# Generate comprehensive TKM data for tview
tkm_generate_tview_data() {
    local env="${1:-all}"

    # Load configuration
    tkm_load_config

    # Environments to check
    local environments=("local" "dev" "staging" "prod")
    [[ "$env" != "all" ]] && environments=("$env")

    echo "=== TKM Data Generation for TView ===" >&2

    # Collect data for each environment
    for environment in "${environments[@]}"; do
        echo "Checking $environment environment..." >&2

        # Get SSH status
        tkm_get_ssh_status "$environment"

        # Get key statuses for different users
        tkm_get_key_status "$environment" "env"
        tkm_get_key_status "$environment" "root"

        # Environment-specific users
        case "$environment" in
            "dev")
                tkm_get_key_status "$environment" "ubuntu"
                ;;
            "staging"|"prod")
                tkm_get_key_status "$environment" "ubuntu"
                ;;
        esac
    done

    echo "TKM data generation complete" >&2
}

# Export data for use by tview
tkm_export_tview_data() {
    local format="${1:-json}"

    case "$format" in
        "json")
            {
                echo "{"
                echo '  "timestamp": "'"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'",'
                echo '  "environments": {'

                local env_count=0
                for env in local dev staging prod; do
                    [[ $env_count -gt 0 ]] && echo ","
                    echo '    "'"$env"'": {'
                    echo '      "name": "'"$(tkm_get_env_name "$env")"'",'
                    echo '      "host": "'"$(tkm_get_env_host "$env")"'",'
                    echo '      "ssh_status": "'"${TKM_SSH_STATUS[${env}_status]:-unknown}"'",'
                    echo '      "ssh_latency": "'"${TKM_SSH_STATUS[${env}_latency]:-}"'",'
                    echo '      "keys": {'
                    echo '        "env": { "status": "'"${TKM_KEY_STATUS[${env}_env_status]:-unknown}"'", "age": "'"${TKM_KEY_STATUS[${env}_env_age]:-}"'" },'
                    echo '        "root": { "status": "'"${TKM_KEY_STATUS[${env}_root_status]:-unknown}"'", "age": "'"${TKM_KEY_STATUS[${env}_root_age]:-}"'" }'
                    echo '      }'
                    echo -n '    }'
                    ((env_count++))
                done
                echo ""
                echo "  }"
                echo "}"
            }
            ;;
        "bash")
            # Export as bash arrays for direct consumption
            echo "# TKM Data Export ($(date))"
            for key in "${!TKM_SSH_STATUS[@]}"; do
                echo "TKM_SSH_STATUS['$key']='${TKM_SSH_STATUS[$key]}'"
            done
            for key in "${!TKM_KEY_STATUS[@]}"; do
                echo "TKM_KEY_STATUS['$key']='${TKM_KEY_STATUS[$key]}'"
            done
            for key in "${!TKM_AMIGOS_DATA[@]}"; do
                echo "TKM_AMIGOS_DATA['$key']='${TKM_AMIGOS_DATA[$key]}'"
            done
            ;;
    esac
}

# Main data refresh function for tview
tkm_refresh_data() {
    tkm_generate_tview_data "$@"
    tkm_export_tview_data "bash"
}

# If called directly, generate data
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    tkm_generate_tview_data "$@"
    tkm_export_tview_data "json"
fi