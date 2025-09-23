#!/usr/bin/env bash

# TView REPL - All REPL interfaces for TView
# Contains: TSM REPL integration, Organization selection, File editing

# Handle REPL (line) input for main tview REPL
handle_repl_input() {
    local input="$1"

    case "$input" in
        /tview)
            TVIEW_MODE="gamepad"
            # No output - just switch mode silently
            ;;
        /exit|/quit)
            echo "Exiting TView..."
            exit 0
            ;;
        /help)
            local help_output="TView REPL Commands:
  /tview    Return to gamepad navigation mode
  /exit     Exit TView completely
  /help     Show this help

Mode Overviews:
  /tsm      Show TSM (Service Manager) overview
  /tkm      Show TKM (Key Manager) overview
  /rcm      Show RCM (Remote Commands) overview

Execution:
  <empty>   Show current context info
  <cmd>     Execute TSM command
  !<cmd>    Execute bash command

Navigation:
  Type commands and see results above
  j/k to scroll results, ESC to hide results
  /tview to return to gamepad navigation"
            show_repl_results "$help_output"
            ;;
        /tsm)
            local tsm_output="TSM - Tetra Service Manager
═══════════════════════════

Current Environment: ${CURRENT_ENV}
Service Status: $(systemctl is-active tetra.service 2>/dev/null || echo "Unknown")

Available Commands:
  list      List all services
  status    Show service status
  start     Start tetra service
  stop      Stop tetra service
  restart   Restart tetra service
  logs      Show recent logs

Usage: tsm <command> or !systemctl <args>"
            show_repl_results "$tsm_output"
            ;;
        /tkm)
            local tkm_output="TKM - Tetra Key Manager
═══════════════════════════

SSH Key Status:
$(ssh-add -l 2>/dev/null || echo "No SSH keys loaded in agent")

Available Keys:
$(ls -la ~/.ssh/id_* 2>/dev/null | head -5 || echo "No SSH keys found")

Current Environment: ${CURRENT_ENV}
SSH Prefix: ${CURRENT_SSH_PREFIXES[${CURRENT_ENV,,}_root]:-Not configured}

Key Operations:
  ssh-add ~/.ssh/id_rsa    Load key to agent
  ssh-copy-id user@host    Copy key to remote
  ssh-keygen -t rsa        Generate new key"
            show_repl_results "$tkm_output"
            ;;
        /rcm)
            local rcm_output="RCM - Remote Command Manager
═══════════════════════════

Current Environment: ${CURRENT_ENV}
$(if [[ "$CURRENT_ENV" != "LOCAL" ]]; then
    echo "SSH Prefix: ${CURRENT_SSH_PREFIXES[${CURRENT_ENV,,}_root]:-Not configured}"
    echo ""
    echo "Available Remote Commands:"
    printf '%s\n' "${!RCM_COMMANDS[@]}" | sort | while read cmd; do
        echo "  $cmd: ${RCM_COMMANDS[$cmd]}"
    done
else
    echo "Local execution mode - commands run directly"
fi)

Usage:
  Execute via gamepad mode (navigate to RCM)
  Or use: !ssh user@host 'command'"
            show_repl_results "$rcm_output"
            ;;
        "")
            # Empty input - show current context info
            local context_output="Current Context: $CURRENT_MODE/$CURRENT_ENV

$(case "$CURRENT_MODE" in
    "TSM")
        echo "TSM Status:"
        tsm list 2>/dev/null || echo "TSM not available"
        ;;
    "TKM")
        echo "SSH Keys:"
        ssh-add -l 2>/dev/null || echo "No keys in agent"
        ;;
    "RCM")
        echo "Remote Commands Available: ${#RCM_COMMANDS[@]}"
        ;;
    *)
        echo "Mode: $CURRENT_MODE - use /help for commands"
        ;;
esac)"
            show_repl_results "$context_output"
            ;;
        !*)
            # Bash command - use safe execution
            local bash_cmd="${input#!}"
            if [[ -n "$bash_cmd" ]]; then
                safe_execute "$bash_cmd" "Bash Command: $bash_cmd"
            fi
            ;;
        *)
            # Regular TSM command - use safe execution
            if [[ -n "$input" ]]; then
                safe_execute "tsm $input" "TSM Command: $input"
            fi
            ;;
    esac
}

# Display REPL command output in results window
show_repl_results() {
    local output="$1"

    # Use the layout system to show results
    show_results "$output"

    # Force a redraw to update the display
    redraw_screen
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