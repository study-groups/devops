#!/usr/bin/env bash

# TSM Remote - Execute TSM commands on remote servers via tetra.toml endpoints
# Uses org system's TES (Tetra Endpoint Specification) resolution

# Remote TSM execution
tsm_remote() {
    local target="$1"    # @dev, @staging, @prod
    local action="$2"    # start, stop, status, list, logs, etc.

    if [[ -z "$target" || -z "$action" ]]; then
        tsm_remote_help
        return 64
    fi

    shift 2
    local service_args="$@"

    # Map target to TSM_ENV
    local tsm_env
    case "$target" in
        @local)
            echo "Use 'tsm $action $service_args' for local execution"
            return 0
            ;;
        @dev)
            tsm_env="dev"
            ;;
        @staging)
            tsm_env="staging"
            ;;
        @prod)
            tsm_env="prod"
            ;;
        *)
            echo "❌ Invalid target: $target"
            echo "   Valid targets: @dev, @staging, @prod"
            return 1
            ;;
    esac

    # Check if org system is available
    if ! declare -f org_tes_ssh_command >/dev/null 2>&1; then
        echo "❌ Org system not loaded"
        echo "   Run: tmod load org"
        return 1
    fi

    # Resolve target via org system's TES
    echo "🔍 Resolving target: $target → $tsm_env environment"
    local ssh_cmd=$(org_tes_ssh_command "$target" 2>/dev/null)

    if [[ -z "$ssh_cmd" ]]; then
        echo "❌ Failed to resolve target: $target"
        echo "   Check tetra.toml [environments.$tsm_env] configuration"
        echo "   File: $TETRA_DIR/orgs/\$ORG/tetra.toml"
        return 1
    fi

    echo "🌐 Executing on $target: TSM_ENV=$tsm_env tsm $action $service_args"
    echo ""

    # Build remote command
    # - Export TSM_ENV to use correct environment
    # - Source tetra to load TSM
    # - Execute TSM command
    local remote_cmd="export TSM_ENV=$tsm_env && source ~/tetra/tetra.sh 2>/dev/null && tsm $action $service_args"

    # Execute remotely
    $ssh_cmd "$remote_cmd"

    local exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        echo ""
        echo "✅ Remote command completed successfully on $target"
    else
        echo ""
        echo "❌ Remote command failed on $target (exit code: $exit_code)"
    fi

    return $exit_code
}

# Help function
tsm_remote_help() {
    cat <<'EOF'
TSM Remote - Execute TSM commands on remote servers

Usage:
  tsm-remote <target> <action> [args...]

Targets:
  @dev       Execute on dev environment (from tetra.toml)
  @staging   Execute on staging environment
  @prod      Execute on production environment

Actions:
  start      Start a service
  stop       Stop a service
  status     Show service status
  list       List services
  logs       Show service logs
  restart    Restart a service

Examples:
  tsm-remote @dev start devpages         Start devpages on dev server
  tsm-remote @staging list               List services on staging
  tsm-remote @prod stop tetra-4444       Stop service on production
  tsm-remote @dev logs devpages-4000 -f  Follow logs on dev

Requirements:
  - tetra.toml must define [environments.dev/staging/prod]
  - Org system must be loaded (tmod load org)
  - SSH access to target servers configured
  - Tetra installed on remote servers at ~/tetra/

How It Works:
  1. Resolves target (@dev) via org system's TES resolution
  2. Gets SSH command from tetra.toml (user@host with keys)
  3. Sets TSM_ENV={dev,staging,prod} on remote server
  4. Sources tetra and executes TSM command
  5. Service uses env/{dev,staging,prod}.env automatically

Configuration (tetra.toml):
  [environments.dev]
  type = "remote"
  host = "dev.example.com"
  ssh_enabled = true
  ssh_auth_user = "root"
  ssh_work_user = "dev"
  ssh_key = "~/.ssh/id_rsa"

EOF
}

# Export functions
export -f tsm_remote
export -f tsm_remote_help

# Create convenient alias
alias tsm-remote='tsm_remote'
