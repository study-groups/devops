#!/usr/bin/env bash

# TView Single-Line Action Selector
# Sharp, scrollable action list in one line with position indicator

# Action line selector state
declare -gA ACTION_LINE=(
    ["current_index"]="0"
    ["total_actions"]="0"
    ["visible_width"]="60"  # Characters available for action display
)

# Action definitions for current Env x Mode
get_actions_for_context() {
    local env="$1"
    local mode="$2"
    local actions=()

    case "$mode:$env" in
        "TOML:TETRA")
            actions=(
                "edit:edit"
                "validate:validate"
                "backup:backup"
                "reset:reset"
                "view:view"
                "status:status"
            )
            ;;
        "TSM:TETRA")
            actions=(
                "list:list"
                "start:start"
                "stop:stop"
                "restart:restart"
                "logs:logs"
            )
            ;;
        "DEPLOY:TETRA")
            actions=(
                "status:status"
                "deploy:deploy"
                "rollback:rollback"
                "logs:logs"
            )
            ;;
        "DEPLOY:DEV"|"DEPLOY:STAGING"|"DEPLOY:PROD")
            actions=(
                "status:status"
                "deploy:deploy"
                "rollback:rollback"
                "logs:logs"
                "ssh:ssh"
            )
            ;;
        "TOML:DEV"|"TOML:STAGING"|"TOML:PROD")
            actions=(
                "edit:edit"
                "deploy:deploy"
                "diff:diff"
                "sync:sync"
            )
            ;;
        "TSM:DEV"|"TSM:STAGING"|"TSM:PROD")
            actions=(
                "status:status"
                "deploy:deploy"
                "ssh:ssh"
                "logs:logs"
                "restart:restart"
            )
            ;;
        "SSH:DEV"|"SSH:STAGING"|"SSH:PROD")
            actions=(
                "connect:connect"
                "tunnel:tunnel"
                "copy:copy"
                "exec:exec"
            )
            ;;
        *)
            actions=(
                "help:help"
                "refresh:refresh"
            )
            ;;
    esac

    printf '%s\n' "${actions[@]}"
}

# Parse action (id:name format)
get_action_id() { echo "$1" | cut -d':' -f1; }
get_action_name() { echo "$1" | cut -d':' -f2; }

# Render single-line action selector
render_action_line() {
    local env="$CURRENT_ENV"
    local mode="$CURRENT_MODE"
    local current_index="${ACTION_LINE[current_index]}"

    # Get current actions
    local -a current_actions
    mapfile -t current_actions < <(get_actions_for_context "$env" "$mode")
    ACTION_LINE["total_actions"]="${#current_actions[@]}"

    # Bounds check
    if [[ $current_index -ge ${#current_actions[@]} ]]; then
        current_index=0
        ACTION_LINE["current_index"]="0"
    fi

    # Build simple action line with highlighted current action
    local action_line=""

    for i in "${!current_actions[@]}"; do
        local action="${current_actions[$i]}"
        local action_name
        action_name=$(get_action_name "$action")

        if [[ $i -eq $current_index ]]; then
            # Current action highlighted in brackets
            action_line+="[$action_name]"
        else
            # Normal action
            action_line+="$action_name"
        fi

        # Add space separator if not last
        if [[ $i -lt $((${#current_actions[@]} - 1)) ]]; then
            action_line+=" "
        fi
    done

    # Add position indicator (1-based for humans)
    local position_indicator="($((current_index + 1))/${#current_actions[@]})"
    action_line+=" $position_indicator"

    # Render the line with Action: prefix
    echo "Action: $action_line"
}

# Navigate through actions
navigate_action_line() {
    local direction="$1"
    local current_index="${ACTION_LINE[current_index]}"
    local total_actions="${ACTION_LINE[total_actions]}"

    echo "DEBUG: navigate_action_line $direction, current=$current_index, total=$total_actions" >> /tmp/tview_debug.log

    case "$direction" in
        "up"|"left")
            if [[ $current_index -gt 0 ]]; then
                ACTION_LINE["current_index"]="$((current_index - 1))"
            else
                # Wrap to end
                ACTION_LINE["current_index"]="$((total_actions - 1))"
            fi
            ;;
        "down"|"right")
            if [[ $current_index -lt $((total_actions - 1)) ]]; then
                ACTION_LINE["current_index"]="$((current_index + 1))"
            else
                # Wrap to beginning
                ACTION_LINE["current_index"]="0"
            fi
            ;;
    esac
}

# Execute selected action
execute_action_line() {
    local env="$CURRENT_ENV"
    local mode="$CURRENT_MODE"
    local current_index="${ACTION_LINE[current_index]}"

    echo "DEBUG: execute_action_line env=$env mode=$mode index=$current_index" >> /tmp/tview_debug.log

    # Get current actions
    local -a current_actions
    mapfile -t current_actions < <(get_actions_for_context "$env" "$mode")

    echo "DEBUG: Found ${#current_actions[@]} actions: ${current_actions[*]}" >> /tmp/tview_debug.log

    if [[ $current_index -lt ${#current_actions[@]} ]]; then
        local action="${current_actions[$current_index]}"
        local action_id
        local action_name
        action_id=$(get_action_id "$action")
        action_name=$(get_action_name "$action")

        # Generate real content preview based on action
        local content_preview=""

        case "$action_id" in
            "edit")
                # Look for tetra.toml for editing
                local toml_file=""
                if [[ -f "tetra.toml" ]]; then
                    toml_file="tetra.toml"
                elif [[ -f "${TETRA_DIR:-/Users/mricos/tetra}/orgs/${ACTIVE_ORG}/tetra.toml" ]]; then
                    toml_file="${TETRA_DIR:-/Users/mricos/tetra}/orgs/${ACTIVE_ORG}/tetra.toml"
                fi

                if [[ -n "$toml_file" ]]; then
                    content_preview="✏️  TETRA.TOML EDITOR
File: $toml_file

$(head -15 "$toml_file" | cat -n)

Press 'l' or Enter to open in vim
Will return to TView after editing"
                else
                    content_preview="✏️  TETRA.TOML EDITOR

File not found in:
• Current directory: $(pwd)
• Org directory: ${TETRA_DIR:-/Users/mricos/tetra}/orgs/${ACTIVE_ORG}

Press 'l' or Enter to create new tetra.toml
Will open vim after creation"
                fi
                ;;
            "view")
                # Look for tetra.toml for viewing
                local toml_file=""
                if [[ -f "tetra.toml" ]]; then
                    toml_file="tetra.toml"
                elif [[ -f "${TETRA_DIR:-/Users/mricos/tetra}/orgs/${ACTIVE_ORG}/tetra.toml" ]]; then
                    toml_file="${TETRA_DIR:-/Users/mricos/tetra}/orgs/${ACTIVE_ORG}/tetra.toml"
                fi

                if [[ -n "$toml_file" ]]; then
                    content_preview="📄 TETRA.TOML PREVIEW
File: $toml_file

$(head -20 "$toml_file" | cat -n)

$(if [[ $(wc -l < "$toml_file" 2>/dev/null || echo 0) -gt 20 ]]; then echo "... (file has $(wc -l < "$toml_file") lines total)"; fi)"
                else
                    content_preview="📄 TETRA.TOML

File not found in:
• Current directory: $(pwd)
• Org directory: ${TETRA_DIR:-/Users/mricos/tetra}/orgs/${ACTIVE_ORG}

Available files in current dir:
$(ls -la *.toml 2>/dev/null | head -3 || echo "No .toml files found")"
                fi
                ;;
            "validate")
                content_preview="✅ VALIDATION PREVIEW

Would validate:
• tetra.toml syntax
• Environment configurations
• Service definitions
• Port allocations"
                ;;
            "backup")
                content_preview="💾 BACKUP PREVIEW

Would backup:
• tetra.toml → tetra.toml.bak.$(date +%Y%m%d-%H%M%S)
• Environment configs
• Service states"
                ;;
            "status")
                content_preview="📊 STATUS PREVIEW

System Status:
• Git: $(git branch --show-current 2>/dev/null || echo "Not a git repo")
• Files: $(find . -maxdepth 2 -name "*.toml" 2>/dev/null | wc -l) TOML files
• Services: $(pgrep -f "tetra\|tsm" | wc -l) running processes
• Environment: $env

Press 'l' or Enter to check detailed status"
                ;;
            *)
                content_preview="⚡ $action_name ACTION

Environment: $env
Action: $action_id

Ready to execute - press 'l' or Enter"
                ;;
        esac


        # Execute actual action based on action_id
        case "$action_id" in
            "edit")
                # Clear screen and edit tetra.toml with vim
                clear

                # Find tetra.toml file
                local toml_file=""
                if [[ -f "tetra.toml" ]]; then
                    toml_file="tetra.toml"
                elif [[ -f "${TETRA_DIR:-/Users/mricos/tetra}/orgs/${ACTIVE_ORG}/tetra.toml" ]]; then
                    toml_file="${TETRA_DIR:-/Users/mricos/tetra}/orgs/${ACTIVE_ORG}/tetra.toml"
                fi

                if [[ -n "$toml_file" ]]; then
                    echo "Editing: $toml_file"
                    echo "Active Org: ${ACTIVE_ORG}"
                    echo "Press any key to open in vim..."
                    read -n1 -s

                    # Open in vim
                    if command -v vim >/dev/null 2>&1; then
                        vim "$toml_file"
                    else
                        echo "vim not found, using nano instead..."
                        if command -v nano >/dev/null 2>&1; then
                            nano "$toml_file"
                        else
                            echo "No editor found (vim/nano). Press any key to return to TView"
                            read -n1 -s
                        fi
                    fi
                else
                    echo "tetra.toml not found in:"
                    echo "• Current directory: $(pwd)"
                    echo "• Org directory: ${TETRA_DIR:-/Users/mricos/tetra}/orgs/${ACTIVE_ORG}"
                    echo "• Active Org: ${ACTIVE_ORG}"
                    echo ""
                    echo "Would you like to create tetra.toml in current directory? (y/N)"
                    read -n1 -s answer
                    echo
                    if [[ "$answer" =~ ^[Yy]$ ]]; then
                        echo "Creating new tetra.toml..."
                        cat > tetra.toml << 'EOF'
# Tetra Configuration File
[general]
name = "new-project"
version = "1.0.0"
environment = "development"

[database]
host = "localhost"
port = 5432
name = "app_db"
user = "app_user"

[services]
web_port = 3000
api_port = 8000

[environments.dev]
host = "dev.local"
database_url = "postgres://localhost:5432/app_dev"

[environments.prod]
host = "prod.com"
database_url = "postgres://prod-db:5432/app_prod"
EOF
                        echo "Created tetra.toml. Opening in vim..."
                        if command -v vim >/dev/null 2>&1; then
                            vim tetra.toml
                        else
                            echo "vim not found. Press any key to return to TView"
                            read -n1 -s
                        fi
                    else
                        echo "Cancelled. Press any key to return to TView"
                        read -n1 -s
                    fi
                fi

                # Return to TView
                if command -v redraw_screen >/dev/null 2>&1; then
                    redraw_screen
                fi
                ;;
            "view")
                # Clear screen and view tetra.toml with glow
                clear

                # Find tetra.toml file
                local toml_file=""
                if [[ -f "tetra.toml" ]]; then
                    toml_file="tetra.toml"
                elif [[ -f "${TETRA_DIR:-/Users/mricos/tetra}/orgs/${ACTIVE_ORG}/tetra.toml" ]]; then
                    toml_file="${TETRA_DIR:-/Users/mricos/tetra}/orgs/${ACTIVE_ORG}/tetra.toml"
                fi

                if [[ -n "$toml_file" ]]; then
                    echo "Viewing: $toml_file"
                    echo "Active Org: ${ACTIVE_ORG}"
                    if command -v glow >/dev/null 2>&1; then
                        echo "Press 'q' to return to TView"
                        echo ""
                        glow --pager "$toml_file"
                    else
                        echo "glow not found, using cat instead:"
                        echo "Press any key to return to TView"
                        echo ""
                        cat "$toml_file"
                        read -n1 -s
                    fi
                else
                    echo "tetra.toml not found in:"
                    echo "• Current directory: $(pwd)"
                    echo "• Org directory: ${TETRA_DIR:-/Users/mricos/tetra}/orgs/${ACTIVE_ORG}"
                    echo "• Active Org: ${ACTIVE_ORG}"
                    echo ""
                    echo "Available .toml files:"
                    ls -la *.toml 2>/dev/null || echo "None found"
                    echo ""
                    echo "Press any key to return to TView"
                    read -n1 -s
                fi

                # Return to TView
                if command -v redraw_screen >/dev/null 2>&1; then
                    redraw_screen
                fi
                ;;
            "status")
                # Execute status command and capture first line for status field
                local status_output=""

                # Get comprehensive status based on environment
                case "$env" in
                    "TETRA")
                        status_output=$(cat <<EOF
System: $(uname -s) $(uname -r)
Git: $(git branch --show-current 2>/dev/null || echo "Not a git repo") - $(git status --porcelain 2>/dev/null | wc -l) modified files
Services: $(pgrep -f "tetra\|tsm" | wc -l) running processes
Config: $(find . -maxdepth 2 -name "*.toml" 2>/dev/null | wc -l) TOML files found
Org: ${ACTIVE_ORG:-$(basename "$(find /Users/mricos/tetra/orgs -maxdepth 1 -type d 2>/dev/null | head -2 | tail -1)" 2>/dev/null || echo "pixeljam-arcade")}
Uptime: $(uptime | cut -d',' -f1)
EOF
)
                        ;;
                    *)
                        status_output="Environment: $env - Status check not implemented"
                        ;;
                esac

                # Set the status field (first line) and show full output
                local first_line=$(echo "$status_output" | head -1)
                export TVIEW_STATUS_FIELD="$first_line"

                # Show full status output in content area
                export ACTION_PLACEHOLDER_CONTENT="📊 SYSTEM STATUS

$status_output

Status updated in header field."
                export SHOW_ACTION_PLACEHOLDER="true"

                # Refresh screen to show status
                if command -v redraw_screen >/dev/null 2>&1; then
                    redraw_screen
                fi
                ;;
            *)
                # For other actions, show content preview
                export ACTION_PLACEHOLDER_CONTENT="$content_preview"
                export SHOW_ACTION_PLACEHOLDER="true"

                # Refresh screen to show content in content area
                if command -v redraw_screen >/dev/null 2>&1; then
                    redraw_screen
                fi
                ;;
        esac
    fi
}

# Show help for action line
show_action_help_line() {
    clear
    echo "${BOLD}TView Action Line Help${RESET}"
    echo "======================="
    echo ""
    echo "Navigation:"
    echo "  ${YELLOW}a/A${RESET}     - Navigate actions (next/previous)"
    echo "  ${YELLOW}l${RESET}       - Execute selected action"
    echo "  ${YELLOW}j${RESET}       - Go back to environment/mode selection"
    echo "  ${YELLOW}q${RESET}       - Quit TView"
    echo ""
    echo "The action line shows available actions for the current:"
    echo "  Environment: ${CURRENT_ENV:-TETRA}"
    echo "  Mode: ${CURRENT_MODE:-TOML}"
    echo ""
    echo "Actions are context-sensitive and change based on your selection."
    echo ""
}

# Initialize action line selector
init_action_line() {
    ACTION_LINE["current_index"]="0"
}

# Export functions
export -f get_actions_for_context get_action_id get_action_name
export -f render_action_line navigate_action_line execute_action_line
export -f show_action_help_line init_action_line