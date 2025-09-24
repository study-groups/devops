#!/usr/bin/env bash

# TView Action Content Generation - Generate modal content for actions
# Single responsibility: Create content for different action types

# Source SSH module
source "$(dirname "${BASH_SOURCE[0]}")/tview_ssh.sh"

# Generate modal content for current action
generate_action_modal_content() {
    local mode="$1" env="$2" item="$3"

    case "$mode:$env" in
        "TKM:TETRA")
            generate_tkm_tetra_content "$item"
            ;;
        "TKM:DEV"|"TKM:STAGING"|"TKM:PROD"|"TKM:QA")
            generate_tkm_remote_content "$env" "$item"
            ;;
        "TSM:LOCAL")
            generate_tsm_local_content "$item"
            ;;
        "TSM:DEV"|"TSM:STAGING"|"TSM:PROD"|"TSM:QA")
            generate_tsm_remote_content "$env" "$item"
            ;;
        "TOML:TETRA")
            generate_toml_tetra_content "$item"
            ;;
        *)
            echo "Action content for: $mode $env (action $item)"
            echo ""
            echo "This would show the results of executing:"
            echo "tetra $mode $env action_$item"
            ;;
    esac
}

# TKM TETRA (local) content
generate_tkm_tetra_content() {
    local item="$1"

    case $item in
        0) # SSH Key Status
            cat << EOF
SSH Key Status - Local Environment
═══════════════════════════════

🔑 Local SSH Keys:
$(ls -la ~/.ssh/id_* 2>/dev/null | head -10 || echo "No SSH keys found")

📊 SSH Agent Status:
$(ssh-add -l 2>/dev/null || echo "SSH agent not running or no keys loaded")

🔧 SSH Configuration:
$(grep -A5 -B2 "tetra\|pixeljam" ~/.ssh/config 2>/dev/null || echo "No tetra-related SSH config found")

🌐 Known Hosts:
$(grep -E "(tetra|pixeljam|dev|staging|prod)" ~/.ssh/known_hosts 2>/dev/null | head -5 || echo "No known hosts found")

💡 Quick Actions:
• Generate new key: ssh-keygen -t ed25519 -f ~/.ssh/tetra_key
• Test connection: ssh -T git@github.com
• Add key to agent: ssh-add ~/.ssh/tetra_key
EOF
            ;;
        1) # Test Connection
            test_all_ssh_connections
            ;;
        2) # Key Management
            cat << EOF
SSH Key Management
═══════════════════

🔧 Available Operations:
• Generate new keys for environments
• Deploy public keys to servers
• Rotate existing keys
• Backup current keys
• Test key authentication

⚙️ Key Generation Commands:
ssh-keygen -t ed25519 -f ~/.ssh/tetra_dev
ssh-keygen -t ed25519 -f ~/.ssh/tetra_staging
ssh-keygen -t ed25519 -f ~/.ssh/tetra_prod

📤 Key Deployment:
$(for env_name in DEV STAGING PROD QA; do
    local user_host="${SSH_CONFIG[$env_name]}"
    if [[ -n "$user_host" ]]; then
        echo "ssh-copy-id -i ~/.ssh/tetra_${env_name,,}.pub $user_host"
    fi
done)
EOF
            ;;
        *)
            echo "TKM Action $item for TETRA environment"
            ;;
    esac
}

# TKM Remote content
generate_tkm_remote_content() {
    local env="$1" item="$2"

    case $item in
        0) # SSH Key Status
            execute_ssh_command "$env" "ls -la ~/.ssh/id_* /root/.ssh/id_* 2>/dev/null | head -10"
            ;;
        1) # Test Connection
            execute_ssh_command "$env" "whoami && hostname && uptime"
            ;;
        2) # Key Management
            execute_ssh_command "$env" "ssh-add -l 2>/dev/null && echo '' && ls -la ~/.ssh/authorized_keys /root/.ssh/authorized_keys 2>/dev/null"
            ;;
        *)
            echo "TKM Action $item for $env environment"
            ;;
    esac
}

# TSM Local content
generate_tsm_local_content() {
    local item="$1"

    case $item in
        0) # Service Status
            echo "Local TSM Service Status"
            echo "═══════════════════════"
            echo ""
            if command -v tsm >/dev/null; then
                tsm status 2>/dev/null || echo "TSM status not available"
            else
                echo "❌ TSM not installed locally"
                echo ""
                echo "System processes:"
                ps aux | grep -E "(tetra|node|npm)" | head -5
            fi
            ;;
        1) # Config Check
            echo "Local TSM Configuration"
            echo "═══════════════════════"
            echo ""
            if [[ -f "$TETRA_DIR/tsm/tsm.conf" ]]; then
                echo "✅ Configuration found:"
                cat "$TETRA_DIR/tsm/tsm.conf" | head -10
            else
                echo "❌ No TSM configuration at $TETRA_DIR/tsm/tsm.conf"
            fi
            ;;
        2) # Service List
            echo "Local Services"
            echo "═══════════════"
            echo ""
            if command -v tsm >/dev/null; then
                tsm list 2>/dev/null || echo "No services running"
            else
                echo "❌ TSM not available"
            fi
            ;;
        3) # View Logs
            echo "Local Service Logs"
            echo "═══════════════════"
            echo ""
            if [[ -f "$TETRA_DIR/logs/tsm.log" ]]; then
                tail -15 "$TETRA_DIR/logs/tsm.log"
            else
                echo "❌ No logs at $TETRA_DIR/logs/tsm.log"
            fi
            ;;
        *)
            echo "TSM Action $item for LOCAL environment"
            ;;
    esac
}

# TSM Remote content
generate_tsm_remote_content() {
    local env="$1" item="$2"

    case $item in
        0) # SSH Test
            execute_ssh_command "$env" "echo 'SSH connection test successful' && date"
            ;;
        1) # Service Status
            execute_ssh_command "$env" "tsm status"
            ;;
        2) # Service List
            execute_ssh_command "$env" "tsm list"
            ;;
        3) # Tail Logs
            execute_ssh_command "$env" "tsm logs --tail 20"
            ;;
        *)
            echo "TSM Action $item for $env environment"
            ;;
    esac
}

# TOML TETRA content
generate_toml_tetra_content() {
    local item="$1"

    case $item in
        0) # View Configuration -> Interactive TOML Modal
            # Navigation mode content
            if [[ -f "$ACTIVE_TOML" ]]; then
                echo "🔧 TOML Configuration Navigator"
                echo "════════════════════════════════"
                echo ""
                echo "File: $(basename "$ACTIVE_TOML")"
                echo "Mode: Navigate"
                echo ""
                echo "📋 Available Sections:"
                # Show sections directly from TOML file
                awk -F'[][]' '/^\[/{printf "  ▶ [%s]\n", $2}' "$ACTIVE_TOML" | head -20
                echo ""
                echo "🎮 Navigation Controls:"
                echo "  w/j     - Move up"
                echo "  s/k     - Move down"
                echo "  a/h     - Drill out/back"
                echo "  d/l     - Drill into section"
                echo "  Enter   - Toggle edit mode"
                echo "  ESC     - Exit modal"
                echo ""
                echo "💡 Use d/l to drill into a section to see variables"
            else
                echo "❌ No TOML Configuration Available"
                echo ""
                echo "💡 Set ACTIVE_TOML environment variable to load a file"
            fi
            ;;
        1) # Edit Configuration -> Modal TOML Editor
            # Generate static content for edit mode - no live initialization
            if [[ -f "$ACTIVE_TOML" ]]; then
                cat << EOF
✏️  TOML Configuration Editor
══════════════════════════════════

File: $(basename "$ACTIVE_TOML")
Mode: Interactive Edit

📝 Current Sections:
EOF
                # Show sections directly from file
                awk -F'[][]' '/^\[/{printf "  📂 [%s]\n", $2}' "$ACTIVE_TOML" | head -20
                cat << EOF

🎮 Modal Navigation (awsd):
  w/W     - Move cursor up
  s/S     - Move cursor down
  a/A     - Drill out (back to parent)
  d/D     - Drill in (expand section)
  Enter   - Edit selected item
  r/R     - Refresh view
  ESC/q   - Exit modal

📋 Editing Flow:
1. Navigate to section with w/s
2. Press 'd' to drill into section
3. Select variables with w/s
4. Press Enter to edit values
5. Use 'a' to go back up levels

💡 The modal will become fully interactive once opened
EOF
            else
                cat << EOF
✏️  TOML Editor - No File Available
═══════════════════════════════════

❌ No TOML file currently loaded

To load a TOML file:
  export ACTIVE_TOML="path/to/your/file.toml"

Available TOML files in current directory:
EOF
                find . -name "*.toml" -type f 2>/dev/null | head -5 | sed 's/^/  /'
                echo ""
                echo "💡 Set ACTIVE_TOML to enable interactive editing"
            fi
            ;;
        2) # Validate TOML
            echo "TOML Validation Results"
            echo "═══════════════════════"
            echo ""
            if [[ -f "$ACTIVE_TOML" ]]; then
                echo "⏳ Validating syntax..."
                echo ""
                if command -v python3 >/dev/null; then
                    if python3 -c "import tomllib; tomllib.load(open('$ACTIVE_TOML', 'rb'))" 2>/dev/null; then
                        echo "✅ TOML syntax is valid"
                    else
                        echo "❌ TOML syntax errors found"
                        echo ""
                        echo "Run this to see detailed errors:"
                        echo "python3 -c \"import tomllib; tomllib.load(open('$ACTIVE_TOML', 'rb'))\""
                    fi
                else
                    echo "⚠️ Python3 not available for validation"
                    echo ""
                    echo "Install python3 to validate TOML syntax"
                fi
                echo ""
                echo "File: $ACTIVE_TOML"
                echo "Size: $(wc -c < "$ACTIVE_TOML" 2>/dev/null || echo "0") bytes"
                echo "Lines: $(wc -l < "$ACTIVE_TOML" 2>/dev/null || echo "0")"
            else
                echo "❌ No TOML file to validate"
            fi
            ;;
        *)
            echo "TOML Action $item for TETRA environment"
            ;;
    esac
}