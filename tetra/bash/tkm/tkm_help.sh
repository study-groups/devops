#!/usr/bin/env bash

# TKM Help System
# Provides contextual help for TKM commands

# Main help dispatcher
tkm_help() {
    local cmd="${1:-}"
    
    case "$cmd" in
        "")
            tkm_help_short
            ;;
        "all")
            tkm_help_full
            ;;
        "generate")
            tkm_help_generate
            ;;
        "deploy")
            tkm_help_deploy
            ;;
        "rotate")
            tkm_help_rotate
            ;;
        "revoke")
            tkm_help_revoke
            ;;
        "status")
            tkm_help_status
            ;;
        "envs")
            tkm_help_envs
            ;;
        "audit")
            tkm_help_audit
            ;;
        "inspect")
            tkm_help_inspect
            ;;
        "scan")
            tkm_help_scan
            ;;
        "cleanup")
            tkm_help_cleanup
            ;;
        "organizations"|"org")
            tkm_help_organizations
            ;;
        "org-add")
            tkm_help_addorg
            ;;
        "org-import")
            tkm_help_importpaste
            ;;
        "show-environments")
            tkm_help_envs
            ;;
        *)
            tkm_help_short
            echo
            echo "For detailed help on a specific command: help <command>"
            echo "For full help: help all"
            ;;
    esac
}

# Short help - common commands only
tkm_help_short() {
    cat <<'EOF'
TKM Common Commands:
  generate [env]        Generate keys for environment (default: all)
  deploy [env]          Deploy keys to environment(s)
  status [env]          Show key status
  rotate <env>          Rotate keys for environment
  audit                 Run security audit
  inspect [scope]       Inspect SSH setup
  help [cmd]            Show help (help all for full help)
  exit                  Exit REPL

Organization Commands:
  org add <name>        Create new organization
  org list              List all organizations
  org set <name>        Set current organization
  org status [name]     Show organization details
  org import [name]     Import servers from nh_show_env_vars

Environment Insights:
  @env                  Environment overview (e.g., @dev, @staging, @prod)
  @env.keys            Detailed key analysis
  @env.health          Full health check
  @env.logs            Recent deployment logs
  @env.activity        Recent key activity
EOF
}

# Full help - all commands and details
tkm_help_full() {
    cat <<'EOF'
TKM (Tetra Key Manager) Interactive REPL
========================================

Key Management Commands:
  generate [env] [type] [days]    Generate new keys (default: all deploy 30)
  deploy [env]                    Deploy keys to environment(s)
  rotate <env> [immediate]        Rotate keys for environment
  revoke <env> [pattern]          Revoke keys (old|all|specific)
  status [env]                    Show key status
  
Organization Commands:
  org add <name> [desc]          Create new organization
  org list, org ls               List all organizations
  org set <name>                 Set current organization
  org current                    Show current organization
  org status [name]              Show organization details
  org import [name]              Import servers from nh_show_env_vars
  org remove <name> [force]      Remove organization (with backup)
  org delete <name>              Delete organization (copy to tmp first)
  
Environment Commands:
  envs                           List configured environments
  addenv <name> <host> <user>    Add new environment
  rmenv <name>                   Remove environment
  show-environments              Show environments configuration
  
Security Commands:
  audit [env]                    Run security audit
  policy                         Show security policies
  logs [lines]                   Show recent TKM logs
  
SSH Inspector Commands:
  inspect [scope]                Inspect SSH setup (keys|config|agents|hosts|permissions|all)
  scan                          Quick SSH security scan
  cleanup [execute]             Clean up SSH directory (dry-run by default)
  
System Commands:
  info                          Show TKM system info and prerequisites
  history [lines]               Show command history (default: 20 lines)
  help [cmd]                    Show help for specific command
  help organizations            Show organization management help
  exit, quit                    Exit REPL
  
Environment Insights:
  @<env>                        Environment overview and status
  @<env>.keys                   Detailed key analysis
  @<env>.health                 Comprehensive health check
  @<env>.logs                   Recent deployment logs
  @<env>.activity               Recent key activity
  @<env>.connections            Test SSH connections
  @<env>.deploy-status          Deployment status summary

File Operations:
  ./<path>                      File path completion (use with other commands)
  /<path>                       Absolute path completion

Bash Commands:
  !<command>                    Execute bash command
  
Examples:
  # Organization setup
  org add pixeljam_arcade "PixelJam Arcade Digital Ocean Org"
  org set pixeljam_arcade
  org import                    Paste nh_show_env_vars output to import servers
  org status                    View imported servers and organization details
  
  # Key management  
  generate staging deploy 7     Generate 7-day staging deployment key
  deploy all                    Deploy all pending keys
  rotate production true        Rotate prod keys and immediately revoke old ones
  status staging                Show staging key status
  audit                         Run full security audit
  inspect keys                  Analyze SSH keys in ~/.ssh
  scan                          Quick SSH security assessment
  cleanup execute               Clean up orphaned SSH files
  @dev                          Show development environment status
  @staging.health               Full staging environment health check
  @prod.keys                    Analyze production keys
  !ps aux | grep ssh            Execute bash command to check SSH processes
EOF
}

# Command-specific help functions
tkm_help_generate() {
    cat <<'EOF'
generate - Generate SSH key pairs

Usage:
  generate [environment] [key_type] [expiry_days]

Parameters:
  environment   Target environment (default: all)
  key_type      Type of key (default: deploy)
  expiry_days   Days until expiry (default: 30)

Examples:
  generate                      Generate keys for all environments
  generate staging              Generate key for staging only
  generate prod deploy 7        Generate 7-day production key
  generate dev deploy 90        Generate 90-day development key

Notes:
  - Keys are generated in $TETRA_DIR/tkm/keys/active/
  - Each key includes private key, public key, and metadata
  - Keys follow naming: {env}_{type}_{timestamp}
EOF
}

tkm_help_deploy() {
    cat <<'EOF'
deploy - Deploy public keys to remote environments

Usage:
  deploy [environment] [force]

Parameters:
  environment   Target environment (default: all)
  force         Force deployment (default: false)

Examples:
  deploy                        Deploy all pending keys
  deploy staging                Deploy staging keys only
  deploy prod true              Force deploy production keys

Notes:
  - Deploys latest generated key for each environment
  - Requires SSH access to target hosts
  - Updates key metadata after successful deployment
  - Security checks are performed before deployment
EOF
}

tkm_help_rotate() {
    cat <<'EOF'
rotate - Rotate keys for an environment

Usage:
  rotate <environment> [immediate]

Parameters:
  environment   Target environment (required)
  immediate     Immediately revoke old keys (default: false)

Examples:
  rotate staging                Rotate staging keys, keep old ones
  rotate prod true              Rotate prod keys, immediately revoke old

Process:
  1. Generate new keys for environment
  2. Deploy new keys to remote host
  3. Optionally revoke old keys immediately
  
Notes:
  - Without 'immediate', old keys remain active
  - Use 'revoke' command later to clean up old keys
  - Always test new keys before revoking old ones
EOF
}

tkm_help_revoke() {
    cat <<'EOF'
revoke - Revoke and archive keys

Usage:
  revoke <environment> [pattern]

Parameters:
  environment   Target environment (required)
  pattern       Which keys to revoke (default: old)
                - old: All but the latest key
                - all: All keys for environment
                - specific_key: Exact key name

Examples:
  revoke staging                Revoke old staging keys
  revoke prod all               Revoke all production keys
  revoke dev staging_deploy_20240101_120000
                               Revoke specific key

Notes:
  - Revoked keys are moved to archived directory
  - Key metadata is updated to "revoked" status
  - This does not remove keys from remote hosts
EOF
}

tkm_help_status() {
    cat <<'EOF'
status - Show key status information

Usage:
  status [environment]

Parameters:
  environment   Filter by environment (default: all)

Examples:
  status                        Show all key status
  status staging                Show staging keys only

Output includes:
  - Key name and environment
  - Current status (generated, deployed, revoked)
  - Deployment status (true/false)
  - Expiration date
  - Location (active/archived)

Status values:
  generated     Key created but not deployed
  deployed      Key successfully deployed to remote
  revoked       Key archived and should not be used
EOF
}

tkm_help_envs() {
    cat <<'EOF'
envs - Environment management

Usage:
  envs                          List configured environments
  addenv <name> <host> <user>   Add new environment
  rmenv <name>                  Remove environment
  show-environments              Show environments configuration

Examples:
  envs                          Show all environments
  addenv test devops@test.com    Add test environment
  rmenv old-env                 Remove old-env

Environment format:
  name:user@host:privileges

Notes:
  - Environments are stored in $TETRA_DIR/tkm/config/environments.conf
  - Only 'tetra' user is allowed for security
  - Privileges field is for future use
EOF
}

tkm_help_audit() {
    cat <<'EOF'
audit - Security audit and compliance checking

Usage:
  audit [environment]

Parameters:
  environment   Limit audit to specific environment (default: all)

Examples:
  audit                         Full security audit
  audit production              Audit production keys only

Checks performed:
  - Expired keys detection
  - Keys without expiry dates
  - Excessive keys per environment (>3)
  - File permission validation
  - Security policy compliance

Output:
  ✅ Passed checks
  ⚠️  Warnings (should be addressed)
  ❌ Critical issues (must be fixed)
EOF
}

tkm_help_inspect() {
    cat <<'EOF'
inspect - SSH environment inspection

Usage:
  inspect [scope]

Scopes:
  keys          Analyze SSH keys in ~/.ssh
  config        Check SSH configuration
  agents        Examine SSH agent status
  hosts         Review known_hosts file
  permissions   Validate file permissions
  all           Complete inspection (default)

Examples:
  inspect                       Full SSH inspection
  inspect keys                  Check SSH keys only
  inspect config                Review SSH config

Features:
  - Key pair validation
  - Permission checking
  - Security analysis
  - Agent status
  - Configuration review
EOF
}

tkm_help_scan() {
    cat <<'EOF'
scan - Quick SSH security scan

Usage:
  scan

Features:
  - Directory permission check
  - Private key encryption status
  - Configuration security review
  - SSH agent status
  - Key age analysis
  - Security summary

Output:
  ✅ Secure configurations
  ⚠️  Warnings (recommendations)
  ❌ Critical security issues

Notes:
  - Faster than full 'inspect all'
  - Focuses on security essentials
  - Provides actionable recommendations
EOF
}

tkm_help_cleanup() {
    cat <<'EOF'
cleanup - SSH directory maintenance

Usage:
  cleanup [action]

Actions:
  (no action)     Dry run - show what would be cleaned
  execute         Actually perform cleanup

Examples:
  cleanup                       Show cleanup candidates
  cleanup execute               Perform actual cleanup

Cleanup targets:
  - Orphaned public keys (missing private key)
  - Backup files (*.bak, *~, *.old)
  - Temporary files

Notes:
  - Always run dry-run first
  - Backup important files before cleanup
  - Does not touch active key pairs
EOF
}

# Organization Management Help
tkm_help_organizations() {
    cat <<EOF
=== TKM Organization Management ===

TKM supports multi-organization infrastructure management, allowing you to
track and manage servers across different Digital Ocean organizations.

Organization Commands:
  org add <name> [desc]    Create new organization
  org list, org ls         List all organizations  
  org set <name>           Set current organization
  org current              Show current organization
  org status [name]        Show organization details
  org import [name]        Import servers from nh_show_env_vars
  org remove <name> [force] Remove organization (with backup)
  org delete <name>        Delete organization (copy to tmp first)

Organization Structure:
  Each organization has its own:
  - Server inventory (environments/servers.conf)
  - SSH keys (keys/)
  - Metadata (metadata/org.conf)

Workflow:
  1. Create organization:     org add pixeljam_arcade "PixelJam Arcade Org"
  2. Set as current:          org set pixeljam_arcade  
  3. Import servers:          org import
  4. View status:             org status
  5. Generate keys:           generate all

Examples:
  org add mycompany "My Company Infrastructure"
  org set mycompany
  org import
  org status mycompany

See also: help org-add, help org-import
EOF
}

tkm_help_addorg() {
    cat <<EOF
=== org add - Create Organization ===

Creates a new organization for tracking infrastructure.

Usage:
  org add <name> [description]

Arguments:
  name          Organization name (alphanumeric, underscore, dash only)
  description   Optional description

Examples:
  org add pixeljam_arcade
  org add pixeljam_arcade "PixelJam Arcade Digital Ocean Org"
  org add mycompany "My Company Infrastructure"

What it creates:
  - Organization directory structure
  - Empty server configuration
  - Metadata file with creation info
  - Sets as current org if first one

Directory structure created:
  \$TETRA_DIR/tkm/organizations/<name>/
    environments/servers.conf    - Server inventory
    keys/                       - Organization-specific keys  
    metadata/org.conf          - Organization metadata

Notes:
  - Organization names must be unique
  - Use 'org import' after creation to add servers
  - First organization becomes current automatically
EOF
}

tkm_help_importpaste() {
    cat <<EOF
=== org import - Import Servers from nh_show_env_vars ===

Imports server information by pasting output from nh_show_env_vars.

Usage:
  org import [org_name]

Process:
  1. Run 'pj && nh_show_env_vars' in your terminal
  2. Copy the export statements output
  3. Run 'org import' in TKM REPL
  4. Paste the copied content
  5. Press Ctrl+D to finish

Input format expected:
  export pxjam_arcade_qa01=146.190.151.245  # sfo3, 2048MB, 50GB
  export pxjam_arcade_prod01=64.23.151.249  # sfo3, 8192MB, 160GB
  export pxjam_arcade_dev01=137.184.226.163  # sfo3, 4096MB, 25GB
  export pxjam_arcade_qa01_private=10.124.0.2
  export pxjam_arcade_prod01_floating=164.90.247.44

What it does:
  - Parses public, private, and floating IPs
  - Extracts server specs from comments
  - Determines privileges based on server type (dev/qa/prod)
  - Creates backup of existing configuration
  - Updates organization server inventory

Examples:
  org import                     # Import to current organization
  org import pixeljam_arcade     # Import to specific organization

Notes:
  - Creates backup before overwriting existing servers
  - Automatically detects IP types (public/private/floating)
  - Sets appropriate privileges per environment type
  - Updates organization metadata with import timestamp
EOF
}
