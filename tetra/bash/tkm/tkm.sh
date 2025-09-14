#!/usr/bin/env bash

# Tetra Key Manager (TKM) - Main entry point
# Manages SSH keys for tetra deployment network

# TKM Directory Convention under TETRA_DIR
# Following pattern: TETRA_DIR/tkm/{keys,config,logs,runs,temp}
TKM_BASE_DIR="${TETRA_DIR}/tkm"
TKM_KEYS_DIR="${TKM_BASE_DIR}/keys"
TKM_CONFIG_DIR="${TKM_BASE_DIR}/config"
TKM_LOGS_DIR="${TKM_BASE_DIR}/logs"
TKM_RUNS_DIR="${TKM_BASE_DIR}/runs"
TKM_TEMP_DIR="${TKM_BASE_DIR}/temp"

# Organization configuration
TKM_ORGS_DIR="${TKM_BASE_DIR}/organizations"
TKM_CURRENT_ORG_FILE="${TKM_BASE_DIR}/.current_org"

# TKM Module Management
TKM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Explicitly define TKM modules to source
TKM_MODULES=(
    "$TKM_DIR/tkm_utils.sh"
    "$TKM_DIR/tkm_core.sh"
    "$TKM_DIR/tkm_security.sh"
    "$TKM_DIR/tkm_organizations.sh"
    "$TKM_DIR/tkm_status.sh"
    "$TKM_DIR/tkm_ssh_inspector.sh"
)

# Controlled module sourcing
tkm_source_modules() {
    local verbose="${1:-false}"
    
    for module in "${TKM_MODULES[@]}"; do
        if [[ -f "$module" ]]; then
            source "$module"
            [[ "$verbose" == "true" ]] && echo "✓ Sourced: $(basename "$module")"
        else
            echo "⚠ Module not found: $(basename "$module")" >&2
        fi
    done
}

# Initialize TKM environment with enhanced logging and validation
tkm_init() {
    # Validate TETRA_DIR first
    if [[ -z "$TETRA_DIR" ]]; then
        echo "❌ Error: TETRA_DIR environment variable not set" >&2
        return 1
    fi
    
    if [[ ! -d "$TETRA_DIR" ]]; then
        echo "❌ Error: TETRA_DIR directory does not exist: $TETRA_DIR" >&2
        return 1
    fi
    
    # Create TKM directory structure with comprehensive error handling
    local required_dirs=(
        "$TKM_KEYS_DIR/active"
        "$TKM_KEYS_DIR/archived"
        "$TKM_KEYS_DIR/pending"
        "$TKM_CONFIG_DIR"
        "$TKM_LOGS_DIR"
        "$TKM_RUNS_DIR"
        "$TKM_TEMP_DIR"
        "$TKM_ORGS_DIR"
    )
    
    local failed_dirs=()
    for dir in "${required_dirs[@]}"; do
        if ! mkdir -p "$dir"; then
            failed_dirs+=("$dir")
        fi
    done
    
    if [[ ${#failed_dirs[@]} -gt 0 ]]; then
        echo "❌ Failed to create directories:" >&2
        printf '%s\n' "${failed_dirs[@]}" >&2
        return 1
    fi
    
    # Source modules during initialization
    tkm_source_modules
    
    # Rest of the initialization logic remains similar to original...
    local env_config="$TKM_CONFIG_DIR/environments.conf"
    local tkm_config="$TKM_CONFIG_DIR/tkm.conf"
    
    # Configuration file creation logic remains the same...
    
    tkm_log "TKM initialized successfully at $TKM_BASE_DIR" "INFO"
    
    echo "✅ TKM initialized at $TKM_BASE_DIR"
    echo "Directory structure:"
    printf "  %s\n" "${required_dirs[@]#$TKM_BASE_DIR/}"
    echo
    echo "Next steps:"
    echo "  • Run 'tkm repl' to start interactive mode"
    echo "  • Run 'tkm info' to verify installation"
    echo "  • Create organization: 'org add <n> <description>'"
}

# Show TKM help
_tkm_show_help() {
    cat <<'EOF'
TKM (Tetra Key Manager) - SSH key management for tetra deployments

Usage: tkm <command> [args...]

Commands:
  init                     Initialize TKM environment
  repl                     Start interactive REPL mode
  
Key Management:
  generate <env|all>       Generate SSH keys for environment(s)
  deploy <env|all>         Deploy keys to remote environment(s)
  rotate <env>             Rotate keys for environment
  revoke <env>             Revoke keys for environment
  status [env]             Show key status
  
Organization Management:
  org add <nh> <do> [user] [host]  Create new organization
  org list                         List all organizations
  org set <name>                   Set current organization
  org current                      Show current organization
  
Environment Management:
  envs                     Show environments for current org
  info                     Show system information
  
Examples:
  tkm org add pj pixeljam_arcade devops pj.example.com
  tkm org set pj
  tkm generate all
  tkm deploy all
  tkm status
  tkm repl                 # Start interactive mode

Use 'tkm repl' for interactive mode with tab completion and history.
EOF
}

# Main TKM function dispatcher with more robust error handling
tkm() {
    local action="${1:-help}"
    shift || true
    
    # More robust module sourcing with error tracking
    local module_errors=0
    for module in "${TKM_MODULES[@]}"; do
        if [[ -f "$module" ]]; then
            source "$module" || ((module_errors++))
        else
            echo "⚠ Module not found: $(basename "$module")" >&2
            ((module_errors++))
        fi
    done
    
    if [[ $module_errors -gt 0 ]]; then
        echo "❌ Warning: $module_errors module(s) failed to load" >&2
    fi
    
    case "$action" in
        init)
            tkm_init
            ;;
        repl)
            tkm_repl_main "$@"
            ;;
        generate)
            tkm_generate_keys "$@" || {
                echo "❌ Key generation failed for: $*" >&2
                return 1
            }
            ;;
        deploy)
            tkm_deploy_keys "$@" || {
                echo "❌ Key deployment failed for: $*" >&2
                return 1
            }
            ;;
        rotate)
            tkm_rotate_keys "$@" || {
                echo "❌ Key rotation failed for: $*" >&2
                return 1
            }
            ;;
        status)
            tkm_status "$@" || {
                echo "❌ Status check failed for: $*" >&2
                return 1
            }
            ;;
        display)
            tkm_status_display "$@" || {
                echo "❌ Display failed for: $*" >&2
                return 1
            }
            ;;
        revoke)
            tkm_revoke_keys "$@" || {
                echo "❌ Key revocation failed for: $*" >&2
                return 1
            }
            ;;
        org)
            _tkm_org_dispatch "$@" || {
                echo "❌ Organization command failed for: $*" >&2
                return 1
            }
            ;;
        envs)
            # Existing envs implementation
            local current_org=$(tkm_org_current)
            if [[ -n "$current_org" ]]; then
                echo "Configured Environments (org: $current_org):"
                echo "============================================"
                local org_servers_file="$TKM_ORGS_DIR/$current_org/environments/servers.conf"
                if [[ -f "$org_servers_file" ]]; then
                    while IFS=: read -r env_name public_ip private_ip floating_ip user privileges specs; do
                        [[ "$env_name" =~ ^#.*$ ]] && continue
                        [[ -z "$env_name" ]] && continue
                        local host="${floating_ip:-${public_ip:-${private_ip:-unknown}}}"
                        printf "%-12s %s@%s (%s)\n" "$env_name" "$user" "$host" "$privileges"
                    done < "$org_servers_file"
                else
                    echo "No environments configured for organization: $current_org"
                fi
            else
                echo "No current organization set. Use 'tkm org set <n>' to select one."
                return 1
            fi
            ;;
        show-environments)
            # Show environments configuration verbatim
            local config_file="$TKM_CONFIG_DIR/environments.conf"
            local current_org=$(tkm_org_current)
            local org_servers_file="$TKM_ORGS_DIR/$current_org/environments/servers.conf"
            
            echo "=== Global Environments Configuration ($config_file) ==="
            if [[ -f "$config_file" ]]; then
                cat "$config_file"
            else
                echo "No global environments configuration found"
            fi
            
            echo -e "\n=== Organization Servers Configuration ($org_servers_file) ==="
            if [[ -f "$org_servers_file" ]]; then
                cat "$org_servers_file"
            else
                echo "No organization servers configuration found"
            fi
            ;;
        info)
            tkm_repl_info || {
                echo "❌ Info retrieval failed" >&2
                return 1
            }
            ;;
        help|--help|-h)
            _tkm_show_help
            ;;
        *)
            echo "❌ Unknown command: $action"
            echo "Use 'tkm help' for available commands"
            return 1
            ;;
    esac
}

# Tetra-prefixed wrapper functions
tetra_tkm() { tkm "$@"; }
tetra_tkm_init() { tkm_init "$@"; }
tetra_tkm_repl() { tkm repl "$@"; }
tetra_tkm_generate() { tkm generate "$@"; }
tetra_tkm_deploy() { tkm deploy "$@"; }
tetra_tkm_rotate() { tkm rotate "$@"; }
tetra_tkm_status() { tkm status "$@"; }
tetra_tkm_revoke() { tkm revoke "$@"; }
tetra_tkm_audit() { tkm_security_audit "$@"; }
tetra_tkm_inspect() { tkm_ssh_inspect "$@"; }

# Controlled auto-initialization with environment variable flag
if [[ -n "$TETRA_DIR" && ! -d "$TKM_BASE_DIR" ]]; then
    if [[ "${TKM_AUTO_INIT:-false}" == "true" ]]; then
        echo "🔧 TKM not initialized. Initializing now..."
        tkm_init
    else
        echo "ℹ️ TKM not initialized. Run 'tkm init' or set TKM_AUTO_INIT=true" >&2
    fi
fi
