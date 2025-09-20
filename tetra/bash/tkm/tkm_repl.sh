#!/usr/bin/env bash

# TKM Interactive REPL
# Provides command-line interface for key management

# Source utilities
TKM_SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$TKM_SRC_DIR/tkm_utils.sh"

# Load shared REPL utilities
source "${TETRA_SRC:-$HOME/src/devops/tetra}/bash/utils/repl_utils.sh"

# Standardized history location
TKM_HISTORY_LOG="$TKM_DIR/history/repl.log"
TKM_HISTORY_FILE="$TKM_DIR/history/.tkm_history"

# Help function now handled by tkm_help.sh module

# Generate dynamic prompt based on current organization (use NH name)
_tkm_get_prompt() {
    local current_org=$(tkm_org_current)
    if [[ -n "$current_org" ]]; then
        echo "tkm:$current_org> "
    else
        echo "tkm> "
    fi
}

tkm_repl_process_command() {
    local input="$1"
    local cmd args
    
    # Parse command and arguments
    if [[ "$input" =~ [[:space:]] ]]; then
        cmd="${input%% *}"
        args="${input#* }"
    else
        cmd="$input"
        args=""
    fi
    
    # Handle bash commands
    if [[ "$input" =~ ^! ]]; then
        local bash_cmd="${input#!}"
        if [[ -n "$bash_cmd" ]]; then
            eval "$bash_cmd"
        fi
        return 0
    fi
    
    # Handle environment status commands
    if [[ "$input" =~ ^@ ]]; then
        tkm_env_status "$input"
        return 0
    fi
    
    # Handle file operations
    if [[ "$input" =~ ^\./ ]] || [[ "$input" =~ ^/ ]]; then
        echo "File operations not implemented yet. Use !ls $input or !cat $input"
        return 0
    fi
    
    # Main command processing
    case "$cmd" in
        help|"?")
            tkm_help $args
            ;;
        exit|quit)
            echo "Goodbye!"
            return 1
            ;;
        generate)
            tkm_generate_keys $args
            ;;
        deploy)
            tkm_deploy_keys $args
            ;;
        rotate)
            tkm_rotate_keys $args
            ;;
        revoke)
            tkm_revoke_keys $args
            ;;
        status)
            tkm_status $args
            ;;
        display)
            tkm_status_display $args
            ;;
        envs)
            echo "Configured Environments:"
            echo "========================"
            local current_org=$(tkm_org_current)
            if [[ -n "$current_org" ]]; then
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
                echo "No current organization set. Use 'org set <name>' to select one."
            fi
            ;;
        addenv)
            _tkm_add_environment $args
            ;;
        rmenv)
            _tkm_remove_environment $args
            ;;
        audit)
            tkm_security_audit $args
            ;;
        policy)
            tkm_security_show_policies
            ;;
        logs)
            local lines="${args:-20}"
            tail -n "$lines" "$TKM_LOGS_DIR/tkm.log" 2>/dev/null || echo "No logs found"
            ;;
        inspect)
            tkm_ssh_inspect $args
            ;;
        scan)
            tkm_ssh_security_scan
            ;;
        cleanup)
            tkm_ssh_cleanup $args
            ;;
        info)
            tkm_repl_show_info
            ;;
        history)
            _tkm_show_history $args
            ;;
        # Organization commands
        org)
            _tkm_org_dispatch $args
            ;;
        "")
            # Empty command - show quick status
            echo "=== TKM Quick Status ==="
            tkm_status | head -10
            ;;
        *)
            echo "Unknown command: $cmd"
            echo "Type 'help' for common commands or 'help all' for full help"
            ;;
    esac
    return 0
}

# Add new environment
_tkm_add_environment() {
    local name="$1"
    local userhost="$2" 
    local privileges="${3:-deploy}"
    
    # Validate required parameters
    if [[ -z "$name" || -z "$userhost" ]]; then
        echo "Error: Name and user@host are required" >&2
        echo "Usage: addenv <n> <user@host> [privileges]" >&2
        return 1
    fi
    
    # Validate environment name
    if ! tkm_validate_env_name "$name"; then
        return 1
    fi
    
    # Split user@host into user and host
    local user host
    if [[ "$userhost" =~ ^([a-zA-Z0-9_-]+)@([a-zA-Z0-9.-]+)$ ]]; then
        user="${BASH_REMATCH[1]}"
        host="${BASH_REMATCH[2]}"
    else
        echo "Error: Invalid user@host format. Use 'user@host'" >&2
        return 1
    fi
    
    # Validate privileges
    if [[ ! "$privileges" =~ ^[a-zA-Z0-9_,-]+$ ]]; then
        echo "Error: Invalid privileges format: $privileges" >&2
        return 1
    fi
    
    echo "$name:$host:$user:$privileges" >> "$TKM_CONFIG_DIR/environments.conf"
    tkm_log "Added environment: $name ($userhost)" "INFO"
    echo "Environment '$name' added successfully"
}

# Remove environment
_tkm_remove_environment() {
    local name="$1"
    
    # Validate required parameter
    if [[ -z "$name" ]]; then
        echo "Error: Environment name is required" >&2
        echo "Usage: rmenv <n>" >&2
        return 1
    fi
    
    # Validate environment name
    if ! tkm_validate_env_name "$name"; then
        return 1
    fi
    
    local current_org=$(tkm_get_current_org_name)
    local org_servers_file="$TKM_ORGS_DIR/$current_org/environments/servers.conf"
    
    # Remove from environments.conf
    if grep -q "^${name}:" "$TKM_CONFIG_DIR/environments.conf"; then
        grep -v "^${name}:" "$TKM_CONFIG_DIR/environments.conf" > "$TKM_CONFIG_DIR/environments.conf.tmp"
        mv "$TKM_CONFIG_DIR/environments.conf.tmp" "$TKM_CONFIG_DIR/environments.conf"
    fi
    
    # Remove from organization's servers.conf
    if [[ -f "$org_servers_file" ]]; then
        grep -v "^${name}:" "$org_servers_file" > "$org_servers_file.tmp"
        mv "$org_servers_file.tmp" "$org_servers_file"
    fi
    
    tkm_log "Removed environment: $name" "INFO"
    echo "Environment '$name' removed successfully"
}

# Show TKM system information and prerequisites
tkm_repl_show_info() {
    echo "=== TKM System Information ==="
    echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo
    
    # Environment Information
    echo "Environment:"
    echo "------------"
    echo "TETRA_DIR:     ${TETRA_DIR:-'NOT SET'}"
    echo "TETRA_SRC:     ${TETRA_SRC:-'NOT SET'}"
    echo "TKM_BASE_DIR:  ${TKM_BASE_DIR:-'NOT SET'}"
    echo "HOME:          $HOME"
    echo "USER:          ${USER:-$(whoami)}"
    echo
    
    # Directory Structure
    echo "Directory Structure:"
    echo "-------------------"
    if [[ -d "$TKM_BASE_DIR" ]]; then
        echo "✅ TKM Base:      $TKM_BASE_DIR"
        echo "✅ Keys:          $TKM_KEYS_DIR"
        echo "✅ Config:        $TKM_CONFIG_DIR"
        echo "✅ Logs:          $TKM_LOGS_DIR"
        
        # Check subdirectories
        local subdirs=("active" "archived" "pending")
        for subdir in "${subdirs[@]}"; do
            if [[ -d "$TKM_KEYS_DIR/$subdir" ]]; then
                echo "✅ Keys/$subdir:   $TKM_KEYS_DIR/$subdir"
            else
                echo "❌ Keys/$subdir:   Missing"
            fi
        done
    else
        echo "❌ TKM Base:      $TKM_BASE_DIR (not found)"
        echo "💡 Run 'tkm init' to create directory structure"
    fi
    echo
    
    # Prerequisites Check
    echo "Prerequisites:"
    echo "-------------"
    
    # Check required commands
    local required_commands=("ssh-keygen" "ssh" "ssh-add")
    for cmd in "${required_commands[@]}"; do
        if command -v "$cmd" >/dev/null 2>&1; then
            local version=$(ssh -V 2>&1 | head -1 || echo "unknown")
            echo "✅ $cmd:          $(which "$cmd") ($version)"
        else
            echo "❌ $cmd:          Not found"
        fi
    done
    
    # Check optional commands
    local optional_commands=("lsof" "pstree" "tree")
    for cmd in "${optional_commands[@]}"; do
        if command -v "$cmd" >/dev/null 2>&1; then
            echo "✅ $cmd (opt):    $(which "$cmd")"
        else
            echo "⚠️  $cmd (opt):    Not found (optional)"
        fi
    done
    echo
    
    # SSH Environment
    echo "SSH Environment:"
    echo "---------------"
    if [[ -d "$HOME/.ssh" ]]; then
        echo "✅ SSH Directory: $HOME/.ssh"
        local ssh_perms=$(stat -c %a "$HOME/.ssh" 2>/dev/null || stat -f %A "$HOME/.ssh" 2>/dev/null)
        if [[ "$ssh_perms" == "700" ]]; then
            echo "✅ SSH Perms:     $ssh_perms"
        else
            echo "⚠️  SSH Perms:     $ssh_perms (should be 700)"
        fi
    else
        echo "❌ SSH Directory: $HOME/.ssh (not found)"
    fi
    
    if [[ -n "$SSH_AUTH_SOCK" ]]; then
        echo "✅ SSH Agent:     $SSH_AUTH_SOCK"
        if command -v ssh-add >/dev/null 2>&1; then
            local key_count=$(ssh-add -l 2>/dev/null | wc -l)
            echo "🔑 Loaded Keys:   $key_count"
        fi
    else
        echo "❌ SSH Agent:     Not running"
    fi
    echo
    
    # Configuration Status
    echo "Configuration:"
    echo "-------------"
    local current_org=$(tkm_org_current)
    if [[ -n "$current_org" ]]; then
        local org_servers_file="$TKM_ORGS_DIR/$current_org/environments/servers.conf"
        if [[ -f "$org_servers_file" ]]; then
            local env_count=$(grep -v '^#' "$org_servers_file" | grep -c ':' 2>/dev/null || echo "0")
            echo "✅ Environments:  $env_count configured (org: $current_org)"
            echo "📁 Config File:   $org_servers_file"
        else
            echo "❌ Environments:  No configuration found for org: $current_org"
        fi
    else
        echo "❌ Environments:  No current organization set"
    fi
    
    if [[ -f "$TKM_CONFIG_DIR/tkm.conf" ]]; then
        echo "✅ TKM Config:    $TKM_CONFIG_DIR/tkm.conf"
    else
        echo "⚠️  TKM Config:    Using defaults"
    fi
    echo
    
    # Key Statistics
    echo "Key Statistics:"
    echo "--------------"
    if [[ -d "$TKM_KEYS_DIR" ]]; then
        local active_keys=$(find "$TKM_KEYS_DIR/active" -name "*.pub" 2>/dev/null | wc -l)
        local archived_keys=$(find "$TKM_KEYS_DIR/archived" -name "*.pub" 2>/dev/null | wc -l)
        local pending_keys=$(find "$TKM_KEYS_DIR/pending" -name "*.pub" 2>/dev/null | wc -l)
        
        echo "🔑 Active Keys:   $active_keys"
        echo "📦 Archived Keys: $archived_keys"
        echo "⏳ Pending Keys:  $pending_keys"
        
        # Check for old directory structure
        local legacy_keys=$(find "$TKM_KEYS_DIR/local" -name "*.pub" 2>/dev/null | wc -l)
        if [[ "$legacy_keys" -gt 0 ]]; then
            echo "⚠️  Legacy Keys:   $legacy_keys (in old 'local' directory)"
        fi
    else
        echo "❌ No key directories found"
    fi
    echo
    
    # System Health
    echo "System Health:"
    echo "-------------"
    local issues=0
    
    # Check for common issues
    if [[ ! -d "$TKM_BASE_DIR" ]]; then
        echo "❌ TKM not initialized"
        ((issues++))
    fi
    
    if [[ -z "$TETRA_DIR" ]]; then
        echo "❌ TETRA_DIR not set"
        ((issues++))
    fi
    
    if ! command -v ssh-keygen >/dev/null 2>&1; then
        echo "❌ ssh-keygen not available"
        ((issues++))
    fi
    
    if [[ "$issues" -eq 0 ]]; then
        echo "✅ All systems operational"
    else
        echo "⚠️  $issues issues detected"
    fi
    
    echo
    echo "Quick Actions:"
    echo "  'generate all' - Generate keys for all environments"
    echo "  'status'       - Show current key status"
    echo "  'inspect all'  - Full SSH environment inspection"
    echo "  'help'         - Show common commands"
    echo "  'help all'     - Show all available commands"
    echo "  'help <cmd>'   - Show help for specific command"
}

# Ensure all TKM modules are loaded
_tkm_load_modules() {
    local tkm_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # Source all TKM modules if not already loaded
    for module in "$tkm_dir"/tkm_*.sh; do
        [[ -f "$module" ]] && source "$module"
    done
}

# Initialize REPL history
_tkm_init_history() {
    # Save original shell history settings
    TKM_ORIG_HISTFILE="$HISTFILE"
    TKM_ORIG_HISTSIZE="$HISTSIZE"
    TKM_ORIG_HISTFILESIZE="$HISTFILESIZE"
    TKM_ORIG_HISTCONTROL="$HISTCONTROL"
    
    # Save current bash history to avoid corruption
    history -w 2>/dev/null || true
    
    # Disable history expansion to avoid issues with !
    set +H
    
    # Create TKM history file if it doesn't exist
    touch "$TKM_HISTORY_FILE" 2>/dev/null || true
    
    # Load existing TKM history into array
    TKM_HISTORY_ARRAY=()
    if [[ -f "$TKM_HISTORY_FILE" ]]; then
        while IFS= read -r line; do
            TKM_HISTORY_ARRAY+=("$line")
        done < "$TKM_HISTORY_FILE"
    fi
    TKM_HISTORY_INDEX=${#TKM_HISTORY_ARRAY[@]}
}

# Restore original shell history settings
_tkm_restore_history() {
    # Clear any TKM history from current session
    history -c 2>/dev/null || true
    
    # Restore original shell history settings
    export HISTFILE="$TKM_ORIG_HISTFILE"
    export HISTSIZE="$TKM_ORIG_HISTSIZE"
    export HISTFILESIZE="$TKM_ORIG_HISTFILESIZE"
    export HISTCONTROL="$TKM_ORIG_HISTCONTROL"
    
    # Reload original history file if it exists
    if [[ -n "$TKM_ORIG_HISTFILE" && -f "$TKM_ORIG_HISTFILE" ]]; then
        history -r "$TKM_ORIG_HISTFILE" 2>/dev/null || true
    fi
    
    # Re-enable history expansion
    set -H 2>/dev/null || true
}

# Save command to history
_tkm_save_history() {
    local cmd="$1"
    [[ -z "$cmd" ]] && return
    
    # Save to TKM history file
    echo "$cmd" >> "$TKM_HISTORY_FILE"
    
    # Add to history array
    TKM_HISTORY_ARRAY+=("$cmd")
    TKM_HISTORY_INDEX=${#TKM_HISTORY_ARRAY[@]}
}

# Show command history
_tkm_show_history() {
    local lines="${1:-20}"
    
    echo "TKM Command History (last $lines commands):"
    echo "=========================================="
    
    if [[ -f "$TKM_HISTORY_FILE" ]]; then
        # Show numbered history from file
        tail -n "$lines" "$TKM_HISTORY_FILE" | nl -w3 -s': '
    else
        echo "No command history found"
    fi
    
    echo
    echo "History file: $TKM_HISTORY_FILE"
    
    if [[ -f "$TKM_HISTORY_LOG" ]]; then
        local total_commands=$(wc -l < "$TKM_HISTORY_LOG" 2>/dev/null || echo "0")
        echo "Total logged commands: $total_commands"
        echo "Detailed log: $TKM_HISTORY_LOG"
    fi
}

# Main REPL loop
tkm_repl_main() {
    # Ensure all modules are loaded
    _tkm_load_modules
    
    # Initialize command history
    _tkm_init_history
    
    # Enable tab completion
    local tkm_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [[ -f "$tkm_dir/tkm_completion.sh" ]]; then
        source "$tkm_dir/tkm_completion.sh"
        # Set up custom completion for REPL
        _tkm_setup_repl_completion
    fi
    
    echo "TKM (Tetra Key Manager) REPL"
    
    # Show current organization info
    local current_org=$(tkm_org_current)
    if [[ -n "$current_org" ]]; then
        local do_name=$(tkm_org_get_do_name "$current_org")
        echo "Organization: $current_org ($do_name)"
    else
        echo "No organization set. Use 'org add <nh_name> <do_name>' to create one."
    fi
    echo
    
    echo "Type 'help' for common commands, 'help all' for full help, 'exit' to quit"
    echo "Use 'history' to see TKM command history, Tab for completion"
    echo "Prefixes: !command (bash), @env.status (environment insights), ./file (files)"
    echo
    
    # Create isolated history environment for TKM
    local tkm_temp_hist=$(mktemp)
    trap "_tkm_restore_history; rm -f '$tkm_temp_hist' 2>/dev/null || true" EXIT INT TERM
    
    # Copy TKM history to temp file for readline
    if [[ -f "$TKM_HISTORY_FILE" ]]; then
        cp "$TKM_HISTORY_FILE" "$tkm_temp_hist" 2>/dev/null || true
    fi
    
    while true; do
        # Use completely isolated readline with temporary history
        if [[ -t 0 ]]; then
            # Interactive mode with isolated history
            local saved_histfile="$HISTFILE"
            local saved_histsize="$HISTSIZE"
            
            # Temporarily use isolated history for this read operation only
            export HISTFILE="$tkm_temp_hist"
            export HISTSIZE=1000
            
            # Clear current session history and load TKM history
            history -c 2>/dev/null || true
            history -r "$tkm_temp_hist" 2>/dev/null || true
            
            local prompt=$(_tkm_get_prompt)
            if ! read -e -r -p "$prompt" input; then
                # Restore original settings
                export HISTFILE="$saved_histfile"
                export HISTSIZE="$saved_histsize"
                echo
                break
            fi
            
            # Immediately restore original settings
            export HISTFILE="$saved_histfile"
            export HISTSIZE="$saved_histsize"
        else
            # Non-interactive mode - simple read
            local prompt=$(_tkm_get_prompt)
            echo -n "$prompt"
            if ! read -r input; then
                echo
                break
            fi
        fi
        
        # Skip empty lines
        if [[ -z "$input" ]]; then
            continue
        fi
        
        # Save to command history
        _tkm_save_history "$input"
        
        # Update temp history file for next readline
        echo "$input" >> "$tkm_temp_hist"
        
        # Log command to history log
        echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $input" >> "$TKM_HISTORY_LOG"
        
        if ! tkm_repl_process_command "$input"; then
            break
        fi
        echo
    done
    
    # Restore original shell history when exiting
    _tkm_restore_history
}
