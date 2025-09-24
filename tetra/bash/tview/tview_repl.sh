#!/usr/bin/env bash

# TView REPL - All REPL interfaces for TView
# Contains: TSM REPL integration, Organization selection, File editing

# Enhanced REPL dispatcher with module discovery and routing
handle_repl_input() {
    local input="$1"

    # Parse module and command from input
    local module=""
    local command=""
    local args=""

    if [[ "$input" =~ ^/([a-zA-Z]+)([[:space:]]+(.*))?$ ]]; then
        module="${BASH_REMATCH[1]}"
        command="${BASH_REMATCH[3]}"
    fi

    case "$input" in
        /tview)
            if [[ "$REPL_CONTEXT" == "tview" ]]; then
                TVIEW_MODE="gamepad"
                # No output - just switch mode silently
            else
                REPL_CONTEXT="tview"
                show_repl_results "Switched to tview context. Use /tview again to exit to gamepad mode."
            fi
            ;;
        /tsm)
            REPL_CONTEXT="tsm"
            show_repl_results "Switched to TSM context. All commands will now route to TSM module."
            ;;
        /tkm)
            REPL_CONTEXT="tkm"
            show_repl_results "Switched to TKM context. All commands will now route to TKM module."
            ;;
        /deploy)
            REPL_CONTEXT="deploy"
            show_repl_results "Switched to Deploy context. All commands will now route to Deploy module."
            ;;
        /span)
            REPL_CONTEXT="span"
            show_repl_results "Switched to Span context. All commands will now route to Span module."
            ;;
        /rcm)
            REPL_CONTEXT="rcm"
            show_repl_results "Switched to RCM context. All commands will now route to RCM module."
            ;;
        /org)
            REPL_CONTEXT="org"
            show_repl_results "Switched to Organization context. All commands will now route to Org module."
            ;;
        /toml)
            REPL_CONTEXT="toml"
            show_repl_results "Switched to TOML context. All commands will now route to TOML module."
            ;;
        /exit|/quit)
            echo "Exiting TView..."
            exit 0
            ;;
        /help)
            show_repl_help
            ;;
        /modules)
            show_available_modules
            ;;
        /*)
            # Route to module dispatcher
            if [[ -n "$module" ]]; then
                dispatch_to_module "$module" "$command" "$args"
            else
                show_repl_results "Error: Invalid command format. Use /help for available commands."
            fi
            ;;
        "")
            # Empty input - show current context info
            show_current_context
            ;;
        !*)
            # Bash command execution
            local bash_cmd="${input#!}"
            if [[ -n "$bash_cmd" ]]; then
                local bash_result=$(eval "$bash_cmd" 2>&1)
                show_repl_results "Bash: $bash_cmd
════════════════════════════
$bash_result"
            fi
            ;;
        *)
            # Try to route to current context module or TSM fallback
            route_context_command "$input"
            ;;
    esac
}

# Show enhanced help with dynamic module discovery
show_repl_help() {
    local help_output="TView REPL - Enhanced Module Router
═══════════════════════════════════════

Core Commands:
  /tview       Return to gamepad mode (or switch to tview context)
  /exit        Exit TView completely
  /help        Show this help
  /modules     List all available modules

Context Switching:
  /tsm         Switch to TSM context (prompt: tsm>)
  /tkm         Switch to TKM context (prompt: tkm>)
  /deploy      Switch to Deploy context (prompt: deploy>)
  /span        Switch to Span context (prompt: span>)
  /rcm         Switch to RCM context (prompt: rcm>)
  /org         Switch to Organization context (prompt: org>)
  /toml        Switch to TOML context (prompt: toml>)

Module Commands:
$(discover_module_commands | head -10)

Execution Patterns:
  /module cmd args    Route to module command
  <empty>            Show current context info
  <cmd>              Execute in current context
  !<cmd>             Execute bash command

Current Context: ${REPL_CONTEXT}> (Env: ${CURRENT_MODE}/${CURRENT_ENV})
Connection: $(get_connection_context)

Navigation:
  Type commands and see results above
  j/k to scroll results, ESC to hide results
  Switch contexts with /${module} commands"

    show_repl_results "$help_output"
}

# Discover available module commands dynamically
discover_module_commands() {
    local modules=("tsm" "tkm" "deploy" "org")

    for module in "${modules[@]}"; do
        # Check if module has tview command discovery function
        if declare -f "${module}_tview_commands" >/dev/null 2>&1; then
            echo "  /${module}       $(${module}_tview_commands | head -1 || echo "Module commands")"
        else
            # Fallback to basic module info
            case "$module" in
                "tsm") echo "  /tsm         Service Manager (list, status, start, stop, logs)" ;;
                "tkm") echo "  /tkm         Key Manager (keys, test, deploy, status)" ;;
                "deploy") echo "  /deploy      Deployment commands (status, run, rollback)" ;;
                "org") echo "  /org         Organization management (list, switch, create)" ;;
            esac
        fi
    done
}

# Show available modules with their status
show_available_modules() {
    local modules_output="Available Tetra Modules
══════════════════════════

"

    # Check registered modules from boot system
    if declare -p TETRA_MODULE_LOADED >/dev/null 2>&1; then
        for module in "${!TETRA_MODULE_LOADED[@]}"; do
            local status="loaded"
            if [[ "${TETRA_MODULE_LOADED[$module]}" == "true" ]]; then
                status="✓ active"
            else
                status="○ available"
            fi
            modules_output+="  ${module}: ${status}
"
        done
    fi

    modules_output+="
Usage: /${module} [command] [args]
Example: /tsm list    or    /tkm status"

    show_repl_results "$modules_output"
}

# Dispatch command to specific module
dispatch_to_module() {
    local module="$1"
    local command="$2"
    local args="$3"

    # Try module-specific TView command handler first
    local tview_handler="${module}_tview_${command}"
    if [[ -n "$command" ]] && declare -f "$tview_handler" >/dev/null 2>&1; then
        # Module has specific TView handler
        local result=$($tview_handler $args 2>&1)
        show_repl_results "/${module} ${command}:
════════════════════════════
$result"
        return 0
    fi

    # Try module-specific command router
    local module_router="${module}_tview_dispatch"
    if declare -f "$module_router" >/dev/null 2>&1; then
        local result=$($module_router "$command" $args 2>&1)
        show_repl_results "/${module} ${command}:
════════════════════════════
$result"
        return 0
    fi

    # Fallback to hardcoded module handlers
    case "$module" in
        "tsm")
            handle_tsm_command "$command" "$args"
            ;;
        "tkm")
            handle_tkm_command "$command" "$args"
            ;;
        "deploy")
            handle_deploy_command "$command" "$args"
            ;;
        "rcm")
            handle_rcm_command "$command" "$args"
            ;;
        *)
            # Try direct module execution as last resort
            if command -v "$module" >/dev/null 2>&1; then
                tetra_load_module "$module" 2>/dev/null || true
                local result=$($module $command $args 2>&1)
                show_repl_results "/${module} ${command}:
════════════════════════════
$result"
            else
                show_repl_results "Error: Module '$module' not found or not available.
Use /modules to see available modules."
            fi
            ;;
    esac
}

# Handle TSM commands with enhanced context awareness
handle_tsm_command() {
    local command="$1"
    local args="$2"

    if [[ -z "$command" ]]; then
        # Show TSM overview
        local tsm_output="TSM - Tetra Service Manager
═══════════════════════════

Current Environment: ${CURRENT_ENV}
Connection: $(get_connection_context)
Service Status: $(systemctl is-active tetra.service 2>/dev/null || echo "Unknown")

Available Commands:
  /tsm list        List all services
  /tsm status      Show service status
  /tsm start       Start tetra service
  /tsm stop        Stop tetra service
  /tsm restart     Restart tetra service
  /tsm logs        Show recent logs

Remote Execution: Commands run on $(get_connection_context)"
        show_repl_results "$tsm_output"
    else
        # Execute specific TSM command
        tetra_load_module "tsm" 2>/dev/null || true
        if command -v tsm >/dev/null 2>&1; then
            local result=$(tsm $command $args 2>&1)
            show_repl_results "TSM ${command}:
════════════════════════════
$result"
        else
            show_repl_results "Error: TSM module not available. Try loading it first."
        fi
    fi
}

# Handle TKM commands
handle_tkm_command() {
    local command="$1"
    local args="$2"

    if [[ -z "$command" ]]; then
        # Show TKM overview
        local tkm_output="TKM - Tetra Key Manager
═══════════════════════════

SSH Key Status:
$(ssh-add -l 2>/dev/null || echo "No SSH keys loaded in agent")

Current Environment: ${CURRENT_ENV}
SSH Prefix: ${CURRENT_SSH_PREFIXES[${CURRENT_ENV,,}_root]:-Not configured}

Available Commands:
  /tkm keys        List available keys
  /tkm test        Test SSH connectivity
  /tkm deploy      Deploy keys to environment
  /tkm status      Show connection status

Key Operations:
  ssh-add ~/.ssh/id_rsa    Load key to agent
  ssh-copy-id user@host    Copy key to remote"
        show_repl_results "$tkm_output"
    else
        # Execute specific TKM command
        tetra_load_module "tkm" 2>/dev/null || true
        if command -v tkm >/dev/null 2>&1; then
            local result=$(tkm $command $args 2>&1)
            show_repl_results "TKM ${command}:
════════════════════════════
$result"
        else
            show_repl_results "Error: TKM module not available."
        fi
    fi
}

# Handle Deploy commands
handle_deploy_command() {
    local command="$1"
    local args="$2"

    if [[ -z "$command" ]]; then
        local deploy_output="Deploy - Deployment Manager
═══════════════════════════

Current Environment: ${CURRENT_ENV}
Connection: $(get_connection_context)

Available Commands:
  /deploy status     Show deployment status
  /deploy run        Execute deployment
  /deploy rollback   Rollback deployment
  /deploy logs       Show deployment logs"
        show_repl_results "$deploy_output"
    else
        tetra_load_module "deploy" 2>/dev/null || true
        if command -v tetra_deploy >/dev/null 2>&1; then
            local result=$(tetra_deploy $command $args 2>&1)
            show_repl_results "Deploy ${command}:
════════════════════════════
$result"
        else
            show_repl_results "Error: Deploy module not available."
        fi
    fi
}

# Handle RCM commands (legacy compatibility)
handle_rcm_command() {
    local command="$1"
    local args="$2"

    local rcm_output="RCM - Remote Command Manager
═══════════════════════════

Current Environment: ${CURRENT_ENV}
$(if [[ "$CURRENT_ENV" != "LOCAL" ]]; then
    echo "SSH Prefix: ${CURRENT_SSH_PREFIXES[${CURRENT_ENV,,}_root]:-Not configured}"
    echo ""
    echo "Available Remote Commands:"
    if declare -p RCM_COMMANDS >/dev/null 2>&1; then
        printf '%s\n' "${!RCM_COMMANDS[@]}" | sort | while read cmd; do
            echo "  $cmd: ${RCM_COMMANDS[$cmd]}"
        done
    else
        echo "  No RCM commands defined"
    fi
else
    echo "Local execution mode - commands run directly"
fi)

Usage:
  Execute via gamepad mode (navigate to RCM)
  Or use: !ssh user@host 'command'"

    show_repl_results "$rcm_output"
}

# Display REPL command output in results window
show_repl_results() {
    local output="$1"

    # Use the layout system to show results
    show_results "$output"

    # Optimized: only render the results window, not full screen
    render_results_window

    # Update status line without full redraw
    render_sticky_status
}

# Execute command safely and capture errors
safe_execute() {
    local command="$1"
    local context="$2"

    # Create temporary files for stdout and stderr
    local stdout_file=$(mktemp)
    local stderr_file=$(mktemp)

    # Execute command and capture both stdout and stderr
    if eval "$command" >"$stdout_file" 2>"$stderr_file"; then
        # Success - show stdout
        local output="$context
═══════════════════════════

$(cat "$stdout_file")"
        show_repl_results "$output"
    else
        # Error - show both stdout and stderr
        local error_output="$context - ERROR
═══════════════════════════

Command: $command

$(if [[ -s "$stdout_file" ]]; then
    echo "Output:"
    cat "$stdout_file"
    echo ""
fi)$(if [[ -s "$stderr_file" ]]; then
    echo "Error:"
    cat "$stderr_file"
else
    echo "Command failed with no error message"
fi)"
        show_repl_results "$error_output"
    fi

    # Clean up temporary files
    rm -f "$stdout_file" "$stderr_file"
}

# Show current context information
show_current_context() {
    local context_output="Current Context: $CURRENT_MODE/$CURRENT_ENV
═══════════════════════════════════════

Connection: $(get_connection_context)
Environment: ${CURRENT_ENV}
Mode: ${CURRENT_MODE}

$(case "$CURRENT_MODE" in
    "TSM")
        echo "TSM Service Status:"
        if command -v tsm >/dev/null 2>&1; then
            tsm list 2>/dev/null || echo "TSM not available"
        else
            echo "TSM module not loaded"
        fi
        ;;
    "TKM")
        echo "SSH Key Status:"
        ssh-add -l 2>/dev/null || echo "No keys in agent"
        echo ""
        echo "SSH Prefix: ${CURRENT_SSH_PREFIXES[${CURRENT_ENV,,}_root]:-Not configured}"
        ;;
    "RCM")
        echo "Remote Commands Available: ${#RCM_COMMANDS[@]}"
        echo "Current RCM Environment: ${CURRENT_RCM_ENV}"
        ;;
    "DEPLOY")
        echo "Deployment Status: Checking..."
        ;;
    *)
        echo "Use /help for available commands"
        ;;
esac)

Available Commands: Use /help to see all commands"
    show_repl_results "$context_output"
}

# Route command to current context module
route_context_command() {
    local input="$1"

    case "$REPL_CONTEXT" in
        "tsm")
            # Route to TSM
            handle_tsm_command "$input" ""
            ;;
        "tkm")
            # Route to TKM
            handle_tkm_command "$input" ""
            ;;
        "deploy")
            # Route to Deploy
            handle_deploy_command "$input" ""
            ;;
        "rcm")
            # Route to RCM
            handle_rcm_command "$input" ""
            ;;
        "span")
            # Route to Span module
            if command -v span >/dev/null 2>&1; then
                tetra_load_module "span" 2>/dev/null || true
                local result=$(span $input 2>&1)
                show_repl_results "Span ${input}:
════════════════════════════
$result"
            else
                show_repl_results "Error: Span module not available."
            fi
            ;;
        "org")
            # Handle organization commands
            if [[ "$input" == "repl" ]]; then
                org_selection_repl
            else
                show_repl_results "Org context active. Try 'repl' for organization management."
            fi
            ;;
        "toml")
            # Route to TOML editing
            if [[ "$input" == "edit" ]]; then
                toml_editor_repl
            else
                show_repl_results "TOML context active. Try 'edit' for configuration editing."
            fi
            ;;
        "tview"|*)
            # Default tview context - try TSM fallback
            if command -v tsm >/dev/null 2>&1; then
                tetra_load_module "tsm" 2>/dev/null || true
                local result=$(tsm $input 2>&1)
                show_repl_results "TSM ${input}:
════════════════════════════
$result"
            else
                show_repl_results "Error: No handler for '$input' in ${REPL_CONTEXT} context.
Try /help for available commands or switch context with /${module}."
            fi
            ;;
    esac
}

# Get connection context for current environment
get_connection_context() {
    case "$CURRENT_ENV" in
        "LOCAL")
            echo "Direct (mricos@m2.local)"
            ;;
        "DEV"|"STAGING"|"PROD"|"QA")
            local ssh_prefix="${CURRENT_SSH_PREFIXES[${CURRENT_ENV,,}_root]:-Not configured}"
            if [[ "$ssh_prefix" != "Not configured" ]]; then
                # Extract user@host from SSH prefix
                local connection=$(echo "$ssh_prefix" | sed 's/ssh //' | sed 's/ .*//')
                echo "SSH via $connection"
            else
                echo "SSH (not configured)"
            fi
            ;;
        "SYSTEM")
            echo "Overview mode"
            ;;
        *)
            echo "Unknown environment"
            ;;
    esac
}

# Enter REPL mode
enter_repl_mode() {
    TVIEW_MODE="repl"
    # No output - just switch mode silently
}

# Organization selection REPL for switching/managing orgs
org_selection_repl() {
    echo "═══════════════════════════════════════════════════════════════"
    echo "            ORGANIZATION SELECTION & MANAGEMENT"
    echo "═══════════════════════════════════════════════════════════════"
    echo
    echo "Current organization: ${ACTIVE_ORG:-None}"
    echo "TOML symlink: $(readlink "$TETRA_DIR/config/tetra.toml" 2>/dev/null || echo "Not set")"
    echo

    # List available organizations
    echo "Available organizations:"
    local org_count=0
    local orgs=()

    if [[ -d "$TETRA_DIR/orgs" ]]; then
        for org_dir in "$TETRA_DIR/orgs"/*; do
            if [[ -d "$org_dir" ]]; then
                local org_name=$(basename "$org_dir")
                local toml_file="$org_dir/tetra.toml"
                orgs+=("$org_name")

                if [[ "$org_name" == "${ACTIVE_ORG:-}" ]]; then
                    echo "  [$((++org_count))] → $org_name (active) $(if [[ -f "$toml_file" ]]; then echo "✓"; else echo "✗"; fi)"
                else
                    echo "  [$((++org_count))] → $org_name $(if [[ -f "$toml_file" ]]; then echo "✓"; else echo "✗"; fi)"
                fi
            fi
        done
    fi

    if [[ $org_count -eq 0 ]]; then
        echo "  No organizations found in $TETRA_DIR/orgs/"
        echo
        echo "Commands:"
        echo "  create <name>     Create new organization"
        echo "  template <name>   Create from template"
        echo "  exit              Return to tview"
    else
        echo
        echo "Commands:"
        echo "  <number>          Switch to organization by number"
        echo "  switch <name>     Switch to organization by name"
        echo "  create <name>     Create new organization"
        echo "  edit <name>       Edit organization files"
        echo "  link <name>       Create symlink to organization"
        echo "  unlink            Remove current symlink"
        echo "  exit              Return to tview"
    fi

    echo

    # Interactive loop
    while true; do
        echo -n "org> "
        read -r input

        case "$input" in
            ""|exit)
                echo "Returning to tview..."
                break
                ;;
            [0-9]*)
                # Switch by number
                local selected_num=$((input))
                if [[ $selected_num -gt 0 && $selected_num -le $org_count ]]; then
                    local selected_org="${orgs[$((selected_num - 1))]}"
                    echo "Switching to organization: $selected_org"
                    link_organization "$selected_org"
                else
                    echo "Invalid number. Use 1-$org_count"
                fi
                ;;
            switch\ *)
                local org_name="${input#switch }"
                echo "Switching to organization: $org_name"
                link_organization "$org_name"
                ;;
            link\ *)
                local org_name="${input#link }"
                echo "Creating symlink to organization: $org_name"
                link_organization "$org_name"
                ;;
            unlink)
                echo "Removing organization symlink..."
                rm -f "$TETRA_DIR/config/tetra.toml"
                echo "Symlink removed. Using local TOML files."
                ;;
            edit\ *)
                local org_name="${input#edit }"
                echo "Opening organization editor for: $org_name"
                toml_editor_repl "$org_name"
                ;;
            create\ *)
                local org_name="${input#create }"
                echo "Creating new organization: $org_name"
                create_organization "$org_name"
                ;;
            help)
                echo "Organization management commands listed above"
                ;;
            *)
                echo "Unknown command: $input"
                echo "Type 'help' for commands or 'exit' to return"
                ;;
        esac
        echo
    done
}

# Set active organization (using TETRA_ACTIVE_ORG environment variable)
link_organization() {
    local org_name="$1"
    local org_dir="$TETRA_DIR/orgs/$org_name"
    local toml_file="$org_dir/tetra.toml"

    if [[ ! -d "$org_dir" ]]; then
        echo "Organization '$org_name' not found"
        return 1
    fi

    if [[ ! -f "$toml_file" ]]; then
        echo "No tetra.toml found in organization '$org_name'"
        return 1
    fi

    # Create config directory if it doesn't exist
    mkdir -p "$TETRA_DIR/config"

    # Set active org using environment variable + persistence
    export TETRA_ACTIVE_ORG="$org_name"
    echo "$org_name" > "$TETRA_DIR/config/active_org"

    echo "✓ Switched to $org_name organization"
    echo "✓ Active org: $TETRA_ACTIVE_ORG"
    echo "✓ Config path: orgs/$TETRA_ACTIVE_ORG/tetra.toml"

    # Reload data
    detect_active_toml
    load_toml_data
}

# TOML editor REPL for editing organization files
toml_editor_repl() {
    local org_name="${1:-$ACTIVE_ORG}"

    if [[ -z "$org_name" || "$org_name" == "No active organization" ]]; then
        echo "No organization specified or active"
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$org_name"

    if [[ ! -d "$org_dir" ]]; then
        echo "Organization directory not found: $org_dir"
        return 1
    fi

    echo "═══════════════════════════════════════════════════════════════"
    echo "            ORGANIZATION FILE EDITOR: $org_name"
    echo "═══════════════════════════════════════════════════════════════"
    echo
    echo "Organization directory: $org_dir"
    echo
    echo "Available files:"
    ls -la "$org_dir" | grep -E '\.(toml|conf|env)$' | awk '{print "  " $9}'
    echo
    echo "Commands:"
    echo "  edit <file>       Edit file with \$EDITOR"
    echo "  view <file>       View file contents"
    echo "  ls                List all files"
    echo "  cd                Change to org directory (new shell)"
    echo "  validate          Validate TOML syntax"
    echo "  exit              Return to tview"
    echo

    while true; do
        echo -n "edit:$org_name> "
        read -r input

        case "$input" in
            ""|exit)
                echo "Returning to tview..."
                break
                ;;
            ls)
                echo "Files in $org_dir:"
                ls -la "$org_dir"
                ;;
            cd)
                echo "Opening new shell in $org_dir..."
                echo "Type 'exit' to return to tview"
                (cd "$org_dir" && bash)
                ;;
            edit\ *)
                local filename="${input#edit }"
                local filepath="$org_dir/$filename"

                if [[ -f "$filepath" ]]; then
                    ${EDITOR:-nano} "$filepath"
                    echo "✓ Edited $filename"
                else
                    echo "File not found: $filename"
                    echo "Available files: $(ls "$org_dir" | grep -E '\.(toml|conf|env)$' | tr '\n' ' ')"
                fi
                ;;
            view\ *)
                local filename="${input#view }"
                local filepath="$org_dir/$filename"

                if [[ -f "$filepath" ]]; then
                    echo "Contents of $filename:"
                    echo "────────────────────────────────────────"
                    cat "$filepath"
                    echo "────────────────────────────────────────"
                else
                    echo "File not found: $filename"
                fi
                ;;
            validate)
                local toml_file="$org_dir/tetra.toml"
                if [[ -f "$toml_file" ]]; then
                    echo "Validating $toml_file..."
                    if command -v toml_parse >/dev/null 2>&1; then
                        if toml_parse "$toml_file" "VALIDATE" 2>/dev/null; then
                            echo "✓ TOML syntax is valid"
                        else
                            echo "✗ TOML syntax errors found"
                        fi
                    else
                        echo "TOML parser not available for validation"
                    fi
                else
                    echo "No tetra.toml file found"
                fi
                ;;
            *)
                echo "Unknown command: $input"
                echo "Type 'help' for commands or 'exit' to return"
                ;;
        esac
        echo
    done
}

# Create new organization
create_organization() {
    local org_name="$1"
    local org_dir="$TETRA_DIR/orgs/$org_name"

    if [[ -d "$org_dir" ]]; then
        echo "Organization '$org_name' already exists"
        return 1
    fi

    echo "Creating organization: $org_name"
    mkdir -p "$org_dir"/{services,nginx,deployment,backups,deployed}

    # Create basic tetra.toml
    cat > "$org_dir/tetra.toml" << EOF
# $org_name Organization Configuration
# Generated on $(date)

[metadata]
name = "$org_name"
type = "custom"
description = "$org_name infrastructure"

[org]
name = "$org_name"
description = "$org_name infrastructure"
provider = "custom"

[infrastructure]
provider = "custom"

[environments.local]
description = "Local development environment"
domain = "localhost"
app_port = 3000
node_env = "development"

[domains]
base_domain = "example.com"
dev = "dev.example.com"
staging = "staging.example.com"
prod = "example.com"
EOF

    echo "✓ Created organization structure"
    echo "✓ Created basic tetra.toml"
    echo "Edit the configuration files to customize your infrastructure"
}

# Main tview_repl function - entry point called from tview.sh
tview_repl() {
    # Source the core module which contains tview_repl_main
    source "$TETRA_SRC/bash/tview/tview_core.sh"

    # Call the main REPL function
    tview_repl_main
}