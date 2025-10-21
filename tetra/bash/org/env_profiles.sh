#!/usr/bin/env bash

# Environment Profiles
# Defines how to transform local.toml for each target environment

# Apply environment-specific transformations
apply_env_profile() {
    local env="$1"
    local config_file="$2"

    case "$env" in
        dev)
            apply_dev_profile "$config_file"
            ;;
        staging)
            apply_staging_profile "$config_file"
            ;;
        prod)
            apply_prod_profile "$config_file"
            ;;
        *)
            echo "❌ Unknown environment: $env"
            return 1
            ;;
    esac
}

# Development environment (@dev) - root:root, /root paths
apply_dev_profile() {
    local file="$1"

    # Environment metadata
    sed -i.bak 's/^name = "local"/name = "dev"/' "$file"
    sed -i.bak '/^type =/c\type = "development"' "$file"
    sed -i.bak '/^description =/c\description = "Development server (@dev)"' "$file"

    # Deployment paths (root user setup)
    sed -i.bak 's|tetra_src = ".*"|tetra_src = "/root/src/devops/tetra"|' "$file"
    sed -i.bak 's|tetra_dir = ".*"|tetra_dir = "/root/tetra"|' "$file"
    sed -i.bak 's/user = ".*"/user = "root"/' "$file"
    sed -i.bak 's/group = ".*"/group = "root"/' "$file"
    sed -i.bak 's/domain = ".*"/domain = "dev.example.com"/' "$file"

    # System config
    sed -i.bak 's/os = ".*"/os = "linux"/' "$file"
    sed -i.bak 's/init_system = ".*"/init_system = "systemd"/' "$file"
    sed -i.bak 's/auto_start = false/auto_start = true/' "$file"

    # Service: add --env dev flag
    sed -i.bak 's|command = "node server/server.js"|command = "node server/server.js --env dev"|' "$file"
    sed -i.bak 's/env_file = "env\/local.env"/env_file = "env\/dev.env"/' "$file"
    sed -i.bak 's/auto_restart = false/auto_restart = true/' "$file"

    # Resources (moderate for dev)
    sed -i.bak 's/memory_max = 0/memory_max = 1024/' "$file"
    sed -i.bak 's/nofile = 1024/nofile = 65536/' "$file"
    sed -i.bak 's/nproc = 512/nproc = 4096/' "$file"

    # Security (relaxed for dev)
    sed -i.bak 's/firewall_enabled = false/firewall_enabled = true/' "$file"
    sed -i.bak 's/allowed_ips = \["127.0.0.1"\]/allowed_ips = ["0.0.0.0\/0"]  # Open for development/' "$file"

    # Logging (json for systemd)
    sed -i.bak 's/level = "debug"/level = "debug"/' "$file"  # Keep debug in dev
    sed -i.bak 's/format = "pretty"/format = "json"/' "$file"
    sed -i.bak 's/destination = "file"/destination = "syslog"/' "$file"
    sed -i.bak 's/retention_days = 7/retention_days = 14/' "$file"

    # Monitoring (enabled)
    sed -i.bak 's/enabled = false  *# prod: true/enabled = true/' "$file"

    # Backup (optional for dev)
    sed -i.bak '/\[backup\]/,/retention_days/ s/enabled = false/enabled = false  # Optional for dev/' "$file"

    rm -f "${file}.bak"
}

# Staging environment - dedicated user, /opt paths
apply_staging_profile() {
    local file="$1"

    # Environment metadata
    sed -i.bak 's/^name = "local"/name = "staging"/' "$file"
    sed -i.bak '/^type =/c\type = "staging"' "$file"
    sed -i.bak '/^description =/c\description = "Staging environment"' "$file"

    # Deployment paths (dedicated tetra user)
    sed -i.bak 's|tetra_src = ".*"|tetra_src = "/opt/tetra"|' "$file"
    sed -i.bak 's|tetra_dir = ".*"|tetra_dir = "/var/lib/tetra"|' "$file"
    sed -i.bak 's/user = ".*"/user = "tetra"/' "$file"
    sed -i.bak 's/group = ".*"/group = "tetra"/' "$file"
    sed -i.bak 's/domain = ".*"/domain = "staging.example.com"/' "$file"

    # System config
    sed -i.bak 's/os = ".*"/os = "linux"/' "$file"
    sed -i.bak 's/init_system = ".*"/init_system = "systemd"/' "$file"
    sed -i.bak 's/auto_start = false/auto_start = true/' "$file"

    # Service: add --env staging flag
    sed -i.bak 's|command = "node server/server.js"|command = "node server/server.js --env staging"|' "$file"
    sed -i.bak 's/env_file = "env\/local.env"/env_file = "env\/staging.env"/' "$file"
    sed -i.bak 's/auto_restart = false/auto_restart = true/' "$file"

    # Resources (higher for staging)
    sed -i.bak 's/memory_max = 0/memory_max = 2048/' "$file"
    sed -i.bak 's/nofile = 1024/nofile = 65536/' "$file"
    sed -i.bak 's/nproc = 512/nproc = 4096/' "$file"

    # Security (tighter than dev)
    sed -i.bak 's/firewall_enabled = false/firewall_enabled = true/' "$file"
    sed -i.bak 's/allowed_ips = \["127.0.0.1"\]/allowed_ips = ["10.0.0.0\/8"]  # Internal network/' "$file"
    sed -i.bak 's/ssl_enabled = false/ssl_enabled = true/' "$file"

    # Logging (info level)
    sed -i.bak 's/level = "debug"/level = "info"/' "$file"
    sed -i.bak 's/format = "pretty"/format = "json"/' "$file"
    sed -i.bak 's/destination = "file"/destination = "syslog"/' "$file"
    sed -i.bak 's/retention_days = 7/retention_days = 30/' "$file"

    # Monitoring (full monitoring)
    sed -i.bak 's/enabled = false  *# prod: true/enabled = true/' "$file"
    sed -i.bak 's/alert_on_failure = false/alert_on_failure = true/' "$file"

    # Backup (enabled for staging)
    sed -i.bak '/\[backup\]/,/retention_days/ s/enabled = false/enabled = true/' "$file"
    sed -i.bak 's/schedule = ""/schedule = "0 3 * * *"  # 3 AM daily/' "$file"
    sed -i.bak '/\[backup\]/,/retention_days/ s/retention_days = 7/retention_days = 14/' "$file"

    rm -f "${file}.bak"
}

# Production environment - maximum security and resources
apply_prod_profile() {
    local file="$1"

    # Environment metadata
    sed -i.bak 's/^name = "local"/name = "prod"/' "$file"
    sed -i.bak '/^type =/c\type = "production"' "$file"
    sed -i.bak '/^description =/c\description = "Production environment - CRITICAL"' "$file"

    # Deployment paths (dedicated tetra user)
    sed -i.bak 's|tetra_src = ".*"|tetra_src = "/opt/tetra"|' "$file"
    sed -i.bak 's|tetra_dir = ".*"|tetra_dir = "/var/lib/tetra"|' "$file"
    sed -i.bak 's/user = ".*"/user = "tetra"/' "$file"
    sed -i.bak 's/group = ".*"/group = "tetra"/' "$file"
    sed -i.bak 's/domain = ".*"/domain = "example.com"/' "$file"

    # System config
    sed -i.bak 's/os = ".*"/os = "linux"/' "$file"
    sed -i.bak 's/init_system = ".*"/init_system = "systemd"/' "$file"
    sed -i.bak 's/auto_start = false/auto_start = true/' "$file"

    # Service: add --env production flag
    sed -i.bak 's|command = "node server/server.js"|command = "node server/server.js --env production"|' "$file"
    sed -i.bak 's/env_file = "env\/local.env"/env_file = "env\/prod.env"/' "$file"
    sed -i.bak 's/auto_restart = false/auto_restart = true/' "$file"

    # Resources (maximum for production)
    sed -i.bak 's/memory_max = 0/memory_max = 4096/' "$file"
    sed -i.bak 's/nofile = 1024/nofile = 131072/' "$file"
    sed -i.bak 's/nproc = 512/nproc = 8192/' "$file"

    # Security (STRICT)
    sed -i.bak 's/firewall_enabled = false/firewall_enabled = true/' "$file"
    sed -i.bak 's/allowed_ips = \["127.0.0.1"\]/allowed_ips = ["10.0.0.0\/8"]  # Internal only/' "$file"
    sed -i.bak 's/ssl_enabled = false/ssl_enabled = true  # REQUIRED/' "$file"

    # Logging (warnings only, long retention)
    sed -i.bak 's/level = "debug"/level = "warn"/' "$file"
    sed -i.bak 's/format = "pretty"/format = "json"/' "$file"
    sed -i.bak 's/destination = "file"/destination = "syslog"/' "$file"
    sed -i.bak 's/retention_days = 7/retention_days = 90  # Compliance/' "$file"

    # Monitoring (REQUIRED)
    sed -i.bak 's/enabled = false  *# prod: true/enabled = true  # REQUIRED/' "$file"
    sed -i.bak 's/alert_on_failure = false/alert_on_failure = true  # REQUIRED/' "$file"

    # Backup (REQUIRED for production)
    sed -i.bak '/\[backup\]/,/retention_days/ s/enabled = false/enabled = true  # REQUIRED/' "$file"
    sed -i.bak 's/schedule = ""/schedule = "0 1 * * *"  # 1 AM daily/' "$file"
    sed -i.bak '/\[backup\]/,/retention_days/ s/retention_days = 7/retention_days = 30/' "$file"

    rm -f "${file}.bak"
}

export -f apply_env_profile
export -f apply_dev_profile
export -f apply_staging_profile
export -f apply_prod_profile
