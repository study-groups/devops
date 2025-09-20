#!/usr/bin/env bash

# TKM Status Display Module
# Generates status.json and HTML display for organization environments

# Source utilities
TKM_SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$TKM_SRC_DIR/tkm_utils.sh"

# Generate comprehensive status JSON for environments
tkm_generate_status_json() {
    local output_file="${1:-${TKM_DIR}/status.json}"
    
    tkm_log "Generating status JSON for TKM environments" "INFO"
    
    # Validate output directory exists
    local output_dir="$(dirname "$output_file")"
    if ! tkm_mkdir_safe "$output_dir"; then
        tkm_log "Failed to create output directory: $output_dir" "ERROR"
        return 1
    fi
    
    # Get current organization name dynamically
    local org_name
    if ! org_name=$(tkm_get_current_org_name); then
        tkm_log "Failed to get current organization name" "ERROR"
        return 1
    fi
    
    # Build base JSON structure using jq if available, fallback to manual
    local base_json
    if command -v jq >/dev/null 2>&1; then
        base_json=$(jq -n \
            --arg org_name "$org_name" \
            --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
            --arg tetra_dir "${TETRA_DIR:-unknown}" \
            '{
                organization: {
                    name: $org_name,
                    timestamp: $timestamp,
                    tetra_dir: $tetra_dir,
                    tkm_version: "1.0.0"
                },
                environments: {},
                system_info: {},
                summary: {
                    total_environments: 0,
                    healthy_environments: 0,
                    warning_environments: 0,
                    error_environments: 0
                }
            }')
    else
        # Fallback to manual JSON construction
        base_json='{
    "organization": {
        "name": "'"$org_name"'",
        "timestamp": "'"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'",
        "tetra_dir": "'"${TETRA_DIR:-unknown}"'",
        "tkm_version": "1.0.0"
    },
    "environments": {},
    "system_info": {},
    "summary": {
        "total_environments": 0,
        "healthy_environments": 0,
        "warning_environments": 0,
        "error_environments": 0
    }
}'
    fi
    
    # Create temporary file for building JSON
    local temp_json
    if ! temp_json=$(tkm_mktemp "tkm_status.XXXXXX.json"); then
        tkm_log "Failed to create temporary file" "ERROR"
        return 1
    fi
    
    # Write base JSON to temp file
    echo "$base_json" > "$temp_json"
    
    # Process environments and add to JSON
    local env_count=0
    local healthy_count=0
    local warning_count=0
    local error_count=0
    
    # Get environments using unified configuration
    while IFS=: read -r env_name public_ip private_ip floating_ip user privileges specs; do
        [[ -z "$env_name" ]] && continue
        
        tkm_log "Processing environment: $env_name" "INFO"
        
        # Generate environment status
        local env_status_json
        if ! env_status_json=$(_tkm_generate_env_status_json "$env_name" "$public_ip" "$private_ip" "$floating_ip" "$user" "$privileges" "$specs"); then
            tkm_log "Failed to generate status for environment: $env_name" "ERROR"
            continue
        fi
        
        # Add environment to JSON using jq if available
        if command -v jq >/dev/null 2>&1; then
            local updated_json
            if updated_json=$(jq --argjson env_data "$env_status_json" \
                '.environments[$env_data.name] = $env_data' "$temp_json"); then
                echo "$updated_json" > "$temp_json"
            else
                tkm_log "Failed to add environment $env_name to JSON" "ERROR"
                continue
            fi
        fi
        
        # Count environment health status
        local health
        health=$(echo "$env_status_json" | jq -r '.system.health' 2>/dev/null || echo "unknown")
        case "$health" in
            "healthy") ((healthy_count++)) ;;
            "warning") ((warning_count++)) ;;
            "error") ((error_count++)) ;;
        esac
        
        ((env_count++))
    done < <(tkm_get_environments detailed)
    
    # Add system info and summary using jq if available
    if command -v jq >/dev/null 2>&1; then
        local final_json
        final_json=$(jq \
            --arg tetra_dir "${TETRA_DIR:-unknown}" \
            --arg user "$(whoami)" \
            --arg hostname "$(hostname)" \
            --arg os "$(uname -s)" \
            --arg arch "$(uname -m)" \
            --arg ssh_config "${HOME}/.ssh/config" \
            --arg known_hosts "${HOME}/.ssh/known_hosts" \
            --argjson agent_running "$(ssh-add -l >/dev/null 2>&1 && echo "true" || echo "false")" \
            --argjson keys_loaded "$(ssh-add -l 2>/dev/null | wc -l)" \
            --arg tkm_base "${TKM_DIR}" \
            --arg tkm_keys "${TKM_KEYS_DIR}" \
            --arg tkm_logs "${TKM_LOGS_DIR}" \
            --argjson active_keys "$(find "${TKM_KEYS_DIR}/active" -name "*.pub" 2>/dev/null | wc -l)" \
            --argjson archived_keys "$(find "${TKM_KEYS_DIR}/archived" -name "*.pub" 2>/dev/null | wc -l)" \
            --argjson total_envs "$env_count" \
            --argjson healthy_envs "$healthy_count" \
            --argjson warning_envs "$warning_count" \
            --argjson error_envs "$error_count" \
            '.
            | .system_info = {
                tetra: {
                    dir: $tetra_dir,
                    user: $user,
                    hostname: $hostname,
                    os: $os,
                    arch: $arch
                },
                ssh: {
                    config_file: $ssh_config,
                    known_hosts: $known_hosts,
                    agent_running: $agent_running,
                    keys_loaded: $keys_loaded
                },
                tkm: {
                    base_dir: $tkm_base,
                    keys_dir: $tkm_keys,
                    logs_dir: $tkm_logs,
                    active_keys: $active_keys,
                    archived_keys: $archived_keys
                }
            }
            | .summary = {
                total_environments: $total_envs,
                healthy_environments: $healthy_envs,
                warning_environments: $warning_envs,
                error_environments: $error_envs
            }' "$temp_json")
        
        if [[ -n "$final_json" ]]; then
            echo "$final_json" > "$temp_json"
        fi
    fi
    
    # Safely update the output file
    if tkm_safe_file_update "$output_file" "$(cat "$temp_json")"; then
        tkm_log "Status JSON generated successfully: $output_file" "INFO"
        rm -f "$temp_json"
        return 0
    else
        tkm_log "Failed to update status JSON file: $output_file" "ERROR"
        rm -f "$temp_json"
        return 1
    fi
}

# Generate environment status as JSON object
_tkm_generate_env_status_json() {
    local env_name="$1"
    local public_ip="$2"
    local private_ip="$3"
    local floating_ip="$4"
    local user="$5"
    local privileges="$6"
    local specs="$7"
    
    # Validate environment name
    if ! tkm_validate_env_name "$env_name"; then
        return 1
    fi
    
    # Validate IPs if provided
    if [[ -n "$public_ip" && "$public_ip" != "-" ]]; then
        if ! tkm_validate_ip "$public_ip" true; then
            tkm_log "Invalid public IP for $env_name: $public_ip" "ERROR"
            public_ip=""
        fi
    fi
    
    # Test SSH connection safely
    local ssh_status="unknown"
    local ssh_latency=0
    if [[ -n "$public_ip" && "$public_ip" != "-" && -n "$user" ]]; then
        local start_time=$(date +%s%3N 2>/dev/null || date +%s)
        if timeout 5 ssh -o ConnectTimeout=3 -o BatchMode=yes -o StrictHostKeyChecking=no "$user@$public_ip" "exit" >/dev/null 2>&1; then
            local end_time=$(date +%s%3N 2>/dev/null || date +%s)
            ssh_status="connected"
            ssh_latency=$((end_time - start_time))
        else
            ssh_status="failed"
        fi
    fi
    
    # Check key status safely
    local active_keys=0
    local key_status="none"
    local latest_key=""
    local key_deployed=false
    
    if [[ -d "$TKM_KEYS_DIR/active" ]]; then
        active_keys=$(find "$TKM_KEYS_DIR/active" -name "${env_name}_deploy_*.pub" -type f 2>/dev/null | wc -l)
        
        if [[ $active_keys -gt 0 ]]; then
            key_status="active"
            latest_key=$(find "$TKM_KEYS_DIR/active" -name "${env_name}_deploy_*.pub" -type f 2>/dev/null | sort | tail -1)
            if [[ -n "$latest_key" && -f "$latest_key" ]]; then
                local meta_file="${latest_key%.pub}.meta"
                if [[ -f "$meta_file" ]]; then
                    local deployed_value
                    deployed_value=$(grep '"deployed"' "$meta_file" 2>/dev/null | cut -d':' -f2 | tr -d ' ,')
                    if [[ "$deployed_value" == "true" ]]; then
                        key_deployed=true
                    fi
                fi
            fi
        fi
    fi
    
    # Determine overall health
    local health="unknown"
    if [[ "$ssh_status" == "connected" && "$key_status" == "active" && "$key_deployed" == "true" ]]; then
        health="healthy"
    elif [[ "$ssh_status" == "connected" || "$key_status" == "active" ]]; then
        health="warning"
    else
        health="error"
    fi
    
    # Generate JSON using jq if available, fallback to manual
    if command -v jq >/dev/null 2>&1; then
        jq -n \
            --arg name "$env_name" \
            --arg public_ip "${public_ip:-}" \
            --arg private_ip "${private_ip:-}" \
            --arg floating_ip "${floating_ip:-}" \
            --arg user "${user:-tetra}" \
            --arg privileges "${privileges:-deploy}" \
            --arg ssh_status "$ssh_status" \
            --argjson ssh_latency "$ssh_latency" \
            --arg key_status "$key_status" \
            --argjson active_count "$active_keys" \
            --argjson deployed "$key_deployed" \
            --arg latest_key "$(basename "${latest_key:-}" .pub)" \
            --arg specs "${specs:-unknown}" \
            --arg health "$health" \
            --arg last_checked "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
            '{
                name: $name,
                network: {
                    public_ip: (if $public_ip == "" then null else $public_ip end),
                    private_ip: (if $private_ip == "" then null else $private_ip end),
                    floating_ip: (if $floating_ip == "" then null else $floating_ip end)
                },
                access: {
                    user: $user,
                    privileges: $privileges,
                    ssh_status: $ssh_status,
                    ssh_latency_ms: $ssh_latency
                },
                keys: {
                    status: $key_status,
                    active_count: $active_count,
                    deployed: $deployed,
                    latest_key: $latest_key
                },
                system: {
                    specs: $specs,
                    health: $health
                },
                last_checked: $last_checked
            }'
    else
        # Fallback to manual JSON construction
        cat <<EOF
{
    "name": "$env_name",
    "network": {
        "public_ip": $(if [[ -n "$public_ip" ]]; then echo "\"$public_ip\""; else echo "null"; fi),
        "private_ip": $(if [[ -n "$private_ip" ]]; then echo "\"$private_ip\""; else echo "null"; fi),
        "floating_ip": $(if [[ -n "$floating_ip" ]]; then echo "\"$floating_ip\""; else echo "null"; fi)
    },
    "access": {
        "user": "${user:-tetra}",
        "privileges": "${privileges:-deploy}",
        "ssh_status": "$ssh_status",
        "ssh_latency_ms": $ssh_latency
    },
    "keys": {
        "status": "$key_status",
        "active_count": $active_keys,
        "deployed": $key_deployed,
        "latest_key": "$(basename "${latest_key:-}" .pub)"
    },
    "system": {
        "specs": "${specs:-unknown}",
        "health": "$health"
    },
    "last_checked": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
    fi
}

# Legacy function for backward compatibility
_tkm_generate_env_status() {
    _tkm_generate_env_status_json "$@"
}

# Generate HTML status display
tkm_generate_status_html() {
    local status_json="${1:-${TKM_DIR}/status.json}"
    local output_file="${2:-${TKM_DIR}/status.html}"
    
    if [[ ! -f "$status_json" ]]; then
        echo "Status JSON not found: $status_json"
        echo "Run 'tkm status json' first to generate it"
        return 1
    fi
    
    echo "Generating HTML status display..."
    
    # Create HTML file
    cat > "$output_file" <<'HTML_EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><org> Infrastructure</title>
    <style>
        /* Light Theme (Default) */
        :root {
            --bg-primary: #f5f5f5;
            --bg-secondary: #ffffff;
            --bg-tertiary: #f5f5f5;
            --text-primary: #212121;
            --text-secondary: #9e9e9e;
            --text-accent: #0d47a1;

            --color-primary-100: #e3f2fd;
            --color-primary-500: #2196f3;
            --color-primary-900: #0d47a1;

            --color-gray-100: #f5f5f5;
            --color-gray-500: #9e9e9e;
            --color-gray-900: #212121;

            --color-green-100: #e8f5e8;
            --color-green-500: #4caf50;
            --color-green-900: #1b5e20;

            --color-yellow-100: #fff8e1;
            --color-yellow-500: #ff9800;
            --color-yellow-900: #e65100;

            --color-red-100: #ffebee;
            --color-red-500: #f44336;
            --color-red-900: #b71c1c;
            
            --spacing-xs: 4px;
            --spacing-sm: 8px;
            --spacing-md: 16px;
            --spacing-lg: 24px;
            --spacing-xl: 32px;
            
            --border-radius-sm: 4px;
            --border-radius-md: 8px;
            --border-radius-lg: 12px;
            
            --font-size-sm: 12px;
            --font-size-md: 14px;
            --font-size-lg: 16px;
            --font-size-xl: 20px;
            
            --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
            --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
        }

        /* Dark Theme */
        [data-theme="dark"] {
            --bg-primary: #121212;
            --bg-secondary: #1e1e1e;
            --bg-tertiary: #2d2d2d;
            --text-primary: #ffffff;
            --text-secondary: #b0b0b0;
            --text-accent: #64b5f6;

            --color-gray-100: #2d2d2d;
            --color-gray-500: #b0b0b0;
            --color-gray-900: #ffffff;

            --color-primary-100: #0d47a1;
            --color-primary-900: #64b5f6;

            --color-green-100: #1b5e20;
            --color-green-900: #81c784;

            --color-yellow-100: #e65100;
            --color-yellow-900: #ffb74d;

            --color-red-100: #b71c1c;
            --color-red-900: #e57373;

            --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
            --shadow-md: 0 4px 6px rgba(0,0,0,0.3);
        }
        
        /* Base Styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-primary);
            padding: var(--spacing-lg);
            line-height: 1.5;
            transition: background-color 0.3s ease, color 0.3s ease;
        }
        
        /* Layout */
        .status-container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .org-header {
            text-align: center;
            margin-bottom: var(--spacing-xl);
            padding: var(--spacing-lg);
            background: var(--bg-secondary);
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-sm);
            transition: background-color 0.3s ease;
        }
        
        .org-title {
            font-size: var(--font-size-xl);
            font-weight: 600;
            color: var(--text-accent);
            margin-bottom: var(--spacing-sm);
        }

        .org-subtitle {
            font-size: var(--font-size-md);
            color: var(--text-secondary);
        }
        
        /* Grid Layout */
        .environments-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: var(--spacing-lg);
            margin-bottom: var(--spacing-xl);
        }
        
        .env-square {
            background: var(--bg-secondary);
            border-radius: var(--border-radius-md);
            padding: var(--spacing-lg);
            box-shadow: var(--shadow-md);
            border-left: 4px solid var(--color-gray-500);
            transition: transform 0.2s ease, background-color 0.3s ease;
        }
        
        .env-square:hover {
            transform: translateY(-2px);
        }
        
        .env-square.healthy {
            border-left-color: var(--color-green-500);
        }
        
        .env-square.warning {
            border-left-color: var(--color-yellow-500);
        }
        
        .env-square.error {
            border-left-color: var(--color-red-500);
        }
        
        .env-name {
            font-size: var(--font-size-lg);
            font-weight: 600;
            margin-bottom: var(--spacing-md);
            text-transform: capitalize;
        }
        
        .env-info {
            display: grid;
            gap: var(--spacing-sm);
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: var(--font-size-sm);
        }
        
        .info-label {
            color: var(--text-secondary);
            font-weight: 500;
        }
        
        .info-value {
            font-family: 'SF Mono', Monaco, monospace;
            font-size: var(--font-size-sm);
        }
        
        .status-badge {
            display: inline-block;
            padding: var(--spacing-xs) var(--spacing-sm);
            border-radius: var(--border-radius-sm);
            font-size: var(--font-size-sm);
            font-weight: 500;
            text-transform: uppercase;
        }
        
        .status-badge.healthy {
            background-color: var(--color-green-100);
            color: var(--color-green-900);
        }
        
        .status-badge.warning {
            background-color: var(--color-yellow-100);
            color: var(--color-yellow-900);
        }
        
        .status-badge.error {
            background-color: var(--color-red-100);
            color: var(--color-red-900);
        }
        
        /* System Info */
        .system-info {
            background: var(--bg-secondary);
            border-radius: var(--border-radius-md);
            padding: var(--spacing-lg);
            box-shadow: var(--shadow-sm);
            transition: background-color 0.3s ease;
        }

        .system-title {
            font-size: var(--font-size-lg);
            font-weight: 600;
            margin-bottom: var(--spacing-md);
            color: var(--text-accent);
        }
        
        .system-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: var(--spacing-lg);
        }
        
        .system-section {
            padding: var(--spacing-md);
            background-color: var(--bg-tertiary);
            border-radius: var(--border-radius-sm);
            transition: background-color 0.3s ease;
        }
        
        .section-title {
            font-weight: 600;
            margin-bottom: var(--spacing-sm);
            color: var(--text-primary);
        }

        /* Theme Toggle Button */
        .theme-toggle {
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: var(--color-primary-500);
            border: none;
            cursor: pointer;
            box-shadow: var(--shadow-md);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            color: white;
            transition: transform 0.2s ease, background-color 0.3s ease;
            z-index: 1000;
        }

        .theme-toggle:hover {
            transform: scale(1.1);
        }

        .theme-toggle:active {
            transform: scale(0.95);
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .environments-grid {
                grid-template-columns: 1fr;
            }
            
            .system-grid {
                grid-template-columns: 1fr;
            }
            
            body {
                padding: var(--spacing-md);
            }
        }
    </style>
</head>
<body>
    <div class="status-container">
        <div class="org-header">
            <div class="org-title" id="orgName">Loading...</div>
            <div class="org-subtitle" id="orgTimestamp">Checking status...</div>
        </div>
        
        <div class="environments-grid" id="environmentsGrid">
            <!-- Environment squares will be populated by JavaScript -->
        </div>
        
        <div class="system-info">
            <div class="system-title">System Information</div>
            <div class="system-grid" id="systemGrid">
                <!-- System info will be populated by JavaScript -->
            </div>
        </div>
    </div>

    <!-- Theme Toggle Button -->
    <button id="themeToggle" class="theme-toggle" aria-label="Toggle theme">🌙</button>

    <script>
        // Theme management
        function initializeTheme() {
            const savedTheme = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', savedTheme);
            updateThemeToggleIcon(savedTheme);
        }

        function toggleTheme() {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';

            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeToggleIcon(newTheme);
        }

        function updateThemeToggleIcon(theme) {
            const toggleButton = document.getElementById('themeToggle');
            if (toggleButton) {
                toggleButton.textContent = theme === 'light' ? '🌙' : '☀️';
                toggleButton.setAttribute('aria-label', `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`);
            }
        }

        // Embedded status data
        const statusData = STATUS_DATA_PLACEHOLDER;

        // Load and display status data
        function loadStatus() {
            try {
                displayStatus(statusData);
            } catch (error) {
                console.error('Failed to load status:', error);
                const orgName = document.getElementById('orgName');
                const orgTimestamp = document.getElementById('orgTimestamp');
                if (orgName) orgName.textContent = 'Error Loading Status';
                if (orgTimestamp) orgTimestamp.textContent = error.message;
            }
        }
        
        function displayStatus(data) {
            // Update header
            document.getElementById('orgName').textContent = data.organization.name;
            document.getElementById('orgTimestamp').textContent = 
                `Last updated: ${new Date(data.organization.timestamp).toLocaleString()}`;
            
            // Display environments
            const grid = document.getElementById('environmentsGrid');
            grid.innerHTML = '';
            
            // Order environments: prod, staging on top; local, dev on bottom
            const envOrder = ['production', 'prod', 'staging', 'local', 'dev'];
            const sortedEnvs = Object.entries(data.environments).sort(([a], [b]) => {
                const aIndex = envOrder.findIndex(env => a.toLowerCase().includes(env));
                const bIndex = envOrder.findIndex(env => b.toLowerCase().includes(env));
                return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
            });
            
            sortedEnvs.forEach(([envName, env]) => {
                const square = createEnvironmentSquare(envName, env);
                grid.appendChild(square);
            });
            
            // Display system info
            displaySystemInfo(data.system_info);
        }
        
        function createEnvironmentSquare(envName, env) {
            const square = document.createElement('div');
            square.className = `env-square ${env.system.health}`;
            
            square.innerHTML = `
                <div class="env-name">${envName}</div>
                <div class="env-info">
                    <div class="info-row">
                        <span class="info-label">Host IP:</span>
                        <span class="info-value">${env.network.public_ip || 'N/A'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">User:</span>
                        <span class="info-value">${env.access.user}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">SSH:</span>
                        <span class="status-badge ${env.access.ssh_status === 'connected' ? 'healthy' : 'error'}">
                            ${env.access.ssh_status}
                        </span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Keys:</span>
                        <span class="status-badge ${env.keys.deployed === 'true' ? 'healthy' : 'warning'}">
                            ${env.keys.active_count} active
                        </span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Status:</span>
                        <span class="status-badge ${env.system.health}">
                            ${env.system.health}
                        </span>
                    </div>
                </div>
            `;
            
            return square;
        }
        
        function displaySystemInfo(systemInfo) {
            const grid = document.getElementById('systemGrid');
            grid.innerHTML = '';
            
            // TETRA section
            const tetraSection = document.createElement('div');
            tetraSection.className = 'system-section';
            tetraSection.innerHTML = `
                <div class="section-title">TETRA</div>
                <div class="info-row">
                    <span class="info-label">Directory:</span>
                    <span class="info-value">${systemInfo.tetra.dir}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">User:</span>
                    <span class="info-value">${systemInfo.tetra.user}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Host:</span>
                    <span class="info-value">${systemInfo.tetra.hostname}</span>
                </div>
            `;
            grid.appendChild(tetraSection);
            
            // SSH section
            const sshSection = document.createElement('div');
            sshSection.className = 'system-section';
            sshSection.innerHTML = `
                <div class="section-title">SSH</div>
                <div class="info-row">
                    <span class="info-label">Agent:</span>
                    <span class="status-badge ${systemInfo.ssh.agent_running ? 'healthy' : 'warning'}">
                        ${systemInfo.ssh.agent_running ? 'Running' : 'Stopped'}
                    </span>
                </div>
                <div class="info-row">
                    <span class="info-label">Keys:</span>
                    <span class="info-value">${systemInfo.ssh.keys_loaded} loaded</span>
                </div>
            `;
            grid.appendChild(sshSection);
            
            // TKM section
            const tkmSection = document.createElement('div');
            tkmSection.className = 'system-section';
            tkmSection.innerHTML = `
                <div class="section-title">TKM</div>
                <div class="info-row">
                    <span class="info-label">Active Keys:</span>
                    <span class="info-value">${systemInfo.tkm.active_keys}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Archived:</span>
                    <span class="info-value">${systemInfo.tkm.archived_keys}</span>
                </div>
            `;
            grid.appendChild(tkmSection);
        }
        
        // Initialize theme and load status on page load
        initializeTheme();
        loadStatus();

        // Add theme toggle event listener
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
        }

        // Refresh every 30 seconds
        setInterval(loadStatus, 30000);
    </script>
</body>
</html>
HTML_EOF
    
    # Replace placeholder with JSON data using Python for proper escaping
    python3 -c "
import json
import sys
with open('$status_json', 'r') as f:
    data = f.read()
with open('$output_file', 'r') as f:
    html = f.read()
html = html.replace('STATUS_DATA_PLACEHOLDER', data)
with open('$output_file', 'w') as f:
    f.write(html)
"
    
    echo "HTML status display generated: $output_file"
}

# Main status command dispatcher
tkm_status_display() {
    local command="${1:-grid}"
    [[ $# -gt 0 ]] && shift
    
    case "$command" in
        json)
            tkm_generate_status_json "$@"
            ;;
        html)
            tkm_generate_status_html "$@"
            ;;
        grid|display)
            # Generate both JSON and HTML
            if tkm_generate_status_json; then
                tkm_generate_status_html
                echo
                echo "Status display ready:"
                echo "  JSON: ${TKM_DIR}/status.json"
                echo "  HTML: ${TKM_DIR}/status.html"
                echo
                echo "Open status.html in a browser to view the display"
            fi
            ;;
        *)
            echo "Usage: status [json|html|grid] [org_name]"
            echo "  json  - Generate status.json only"
            echo "  html  - Generate HTML display (requires status.json)"
            echo "  grid  - Generate both JSON and HTML (default)"
            return 1
            ;;
    esac
}

# Terminal-based 4-square grid display (for CLI use)
tkm_status_grid_terminal() {
    
    # Get terminal dimensions
    local cols=${COLUMNS:-80}
    local rows=${LINES:-24}
    
    # Calculate grid dimensions (leave space for title and margins)
    local grid_width=$((cols - 4))
    local grid_height=$((rows - 8))
    local square_width=$((grid_width / 2 - 2))
    local square_height=$((grid_height / 2 - 1))
    
    # Center the display
    local start_col=$(((cols - grid_width) / 2))
    
    clear
    
    # Title
    local title="TKM Status"
    local title_pos=$(((cols - ${#title}) / 2))
    printf "%*s%s\n" $title_pos "" "$title"
    printf "%*s%s\n" $title_pos "" "$(date '+%Y-%m-%d %H:%M:%S')"
    echo
    
    # Get environment data from basic config
    local envs=()
    
    if [[ -f "$TKM_CONFIG_DIR/environments.conf" ]]; then
        while IFS=: read -r env_name host user privileges; do
            echo "DEBUG: Reading env_name='${env_name}', host='${host}', user='${user}'" >&2
            [[ "$env_name" =~ ^#.*$ ]] && continue
            [[ -z "$env_name" ]] && continue
            envs+=("$env_name:$host:$user")
        done < "$TKM_CONFIG_DIR/environments.conf"
    fi
    
    # Ensure we have 4 environments (pad with placeholders if needed)
    while [[ ${#envs[@]} -lt 4 ]]; do
        envs+=("placeholder:-:-")
    done
    
    # Display grid: prod/staging on top, local/dev on bottom
    local top_envs=("${envs[0]}" "${envs[1]}")
    local bottom_envs=("${envs[2]}" "${envs[3]}")
    
    # Top row
    _tkm_draw_env_squares "${top_envs[@]}" "$square_width" "$square_height" "$start_col"
    echo
    
    # Bottom row  
    _tkm_draw_env_squares "${bottom_envs[@]}" "$square_width" "$square_height" "$start_col"
    
    # Shared status
    echo
    printf "%*s%s\n" $title_pos "" "Shared Status"
    printf "%*s%s\n" $title_pos "" "TETRA_DIR: ${TETRA_DIR:-unknown}"
    printf "%*s%s\n" $title_pos "" "TKM Keys: $(find "${TKM_KEYS_DIR}/active" -name "*.pub" 2>/dev/null | wc -l) active"
}

# Helper function to draw environment squares
_tkm_draw_env_squares() {
    local square_width="$1"
    local square_height="$2" 
    local start_col="$3"
    shift 3
    
    local env1="$1"
    local env2="$2"
    
    # Parse environment data
    IFS=: read -r env1_name env1_ip env1_user <<< "$env1"
    IFS=: read -r env2_name env2_ip env2_user <<< "$env2"
    
    # Draw squares side by side
    for ((i=0; i<square_height; i++)); do
        printf "%*s" $start_col ""
        
        # Left square
        if [[ $i -eq 0 || $i -eq $((square_height-1)) ]]; then
            printf "┌%*s┐" $((square_width-2)) "" | tr ' ' '─'
        elif [[ $i -eq 1 ]]; then
            printf "│ %-*s │" $((square_width-4)) "$env1_name"
        elif [[ $i -eq 2 ]]; then
            printf "│ IP: %-*s │" $((square_width-8)) "$env1_ip"
        elif [[ $i -eq 3 ]]; then
            printf "│ User: %-*s │" $((square_width-10)) "$env1_user"
        else
            printf "│%*s│" $((square_width-2)) ""
        fi
        
        printf "  "
        
        # Right square
        if [[ $i -eq 0 || $i -eq $((square_height-1)) ]]; then
            printf "┌%*s┐" $((square_width-2)) "" | tr ' ' '─'
        elif [[ $i -eq 1 ]]; then
            printf "│ %-*s │" $((square_width-4)) "$env2_name"
        elif [[ $i -eq 2 ]]; then
            printf "│ IP: %-*s │" $((square_width-8)) "$env2_ip"
        elif [[ $i -eq 3 ]]; then
            printf "│ User: %-*s │" $((square_width-10)) "$env2_user"
        else
            printf "│%*s│" $((square_width-2)) ""
        fi
        
        echo
    done
}
