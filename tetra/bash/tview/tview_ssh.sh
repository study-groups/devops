#!/usr/bin/env bash

# TView SSH Command Execution - Remote command execution with tetra syntax
# Single responsibility: Execute commands on remote environments via SSH

# SSH configuration for environments
declare -gA SSH_CONFIG=(
    ["DEV"]="tetra@dev.pixeljamarcade.com"
    ["STAGING"]="tetra@staging.pixeljamarcade.com"
    ["PROD"]="tetra@prod.pixeljamarcade.com"
    ["QA"]="tetra@qa.pixeljamarcade.com"
)

# Environment to tetra prefix mapping
declare -gA TETRA_PREFIXES=(
    ["DEV"]="source ~/tetra/tetra.sh &&"
    ["STAGING"]="source /opt/tetra/tetra.sh &&"
    ["PROD"]="source /opt/tetra/tetra.sh &&"
    ["QA"]="source ~/tetra/tetra.sh &&"
)

# Execute SSH command and return formatted result (silent execution)
execute_ssh_command() {
    local env="$1"
    local command="$2"
    local user_host="${SSH_CONFIG[$env]}"
    local tetra_prefix="${TETRA_PREFIXES[$env]}"

    if [[ -z "$user_host" ]]; then
        echo "❌ No SSH configuration for environment: $env"
        return 1
    fi

    # Show execution header
    echo "🔍 Executing on $env ($user_host):"
    echo "$ $command"
    echo ""
    echo "⏳ Connecting... (this may take a few seconds)"
    echo ""

    # Execute the SSH command silently with tetra prefix
    local full_command="ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o BatchMode=yes $user_host '$tetra_prefix $command'"
    echo "DEBUG: Executing: $full_command" >> /tmp/tview_debug.log

    local result
    local exit_code

    # Execute silently and capture all output
    result=$(eval "$full_command" 2>&1)
    exit_code=$?

    # Only show results after command completes
    if [[ $exit_code -eq 0 ]]; then
        echo "✅ Command completed successfully:"
        echo "────────────────────────────────────"
        echo "$result"
    elif [[ $exit_code -eq 124 ]]; then
        echo "⏰ Command timed out after 10 seconds"
        echo "────────────────────────────────────"
        echo "Connection to $env may be slow or unavailable"
        echo "Try again later or check network connectivity"
    elif [[ $exit_code -eq 255 ]]; then
        echo "🔐 SSH connection failed"
        echo "────────────────────────────────────"
        echo "Could not connect to $user_host"
        echo "Check SSH keys, network, or server status"
    else
        echo "❌ Command failed (exit code: $exit_code)"
        echo "────────────────────────────────────"
        echo "$result"
    fi
}

# Test SSH connectivity to environment (silent)
test_ssh_connection() {
    local env="$1"
    local user_host="${SSH_CONFIG[$env]}"

    if [[ -z "$user_host" ]]; then
        echo "❌ No SSH configuration for $env"
        return 1
    fi

    echo "🔍 Testing $env ($user_host)..."

    # Silent test with timeout
    if timeout 5 ssh -o ConnectTimeout=3 -o StrictHostKeyChecking=no -o BatchMode=yes "$user_host" "echo 'Connected'" >/dev/null 2>&1; then
        echo "✅ $env: Connection successful"
        return 0
    else
        echo "❌ $env: Connection failed or timed out"
        return 1
    fi
}

# Test all environment connections
test_all_ssh_connections() {
    echo "SSH Connection Test - All Environments"
    echo "═══════════════════════════════════════"
    echo ""

    for env in DEV STAGING PROD QA; do
        test_ssh_connection "$env"
    done
}