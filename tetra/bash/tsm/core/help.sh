#!/usr/bin/env bash

# TSM Help System - Contextual, colored help for commands
# Quick wins: Per-command help with color coding

# Load colors if available
if [[ -f "$TETRA_SRC/bash/color/color.sh" ]]; then
    source "$TETRA_SRC/bash/color/color.sh"
else
    # Fallback to basic colors
    TETRA_CYAN='\033[0;36m'
    TETRA_YELLOW='\033[1;33m'
    TETRA_GREEN='\033[0;32m'
    TETRA_BLUE='\033[1;34m'
    TETRA_RED='\033[0;31m'
    TETRA_GRAY='\033[0;90m'
    TETRA_NC='\033[0m'
fi

# Helper for consistent formatting
_tsm_help_section() {
    echo -e "${TETRA_BLUE}$1${TETRA_NC}"
}

_tsm_help_command() {
    echo -e "  ${TETRA_CYAN}$1${TETRA_NC}"
}

_tsm_help_flag() {
    echo -e "  ${TETRA_YELLOW}$1${TETRA_NC}  $2"
}

_tsm_help_example() {
    echo -e "  ${TETRA_GRAY}# $1${TETRA_NC}"
    echo -e "  ${TETRA_GREEN}$2${TETRA_NC}"
}

# === COMMAND-SPECIFIC HELP ===

tsm_help_start() {
    cat <<EOF
$(echo -e "${TETRA_BLUE}USAGE${TETRA_NC}")
  $(echo -e "${TETRA_CYAN}tsm start${TETRA_NC}") [OPTIONS] <command|service>

$(echo -e "${TETRA_BLUE}OPTIONS${TETRA_NC}")
$(_tsm_help_flag "--env FILE" "Environment file to source (e.g., env/local.env)")
$(_tsm_help_flag "--port PORT" "Port number for the service")
$(_tsm_help_flag "--name NAME" "Custom process name")
$(_tsm_help_flag "--pre-hook CMD" "Run command before starting (e.g., tetra_python_activate)")
$(_tsm_help_flag "--help, -h" "Show this help")

$(echo -e "${TETRA_BLUE}DESCRIPTION${TETRA_NC}")
  Start any command as a background service managed by TSM.

  $(echo -e "${TETRA_YELLOW}Runtime Auto-Detection:${TETRA_NC}")
  - Python: Automatically activates pyenv if available
  - Node.js: Uses nvm if configured
  - Use --pre-hook to override or add custom setup

$(echo -e "${TETRA_BLUE}EXAMPLES${TETRA_NC}")
$(_tsm_help_example "Start Python HTTP server (auto-activates pyenv)" "tsm start python -m http.server 8020")

$(_tsm_help_example "Start with explicit pre-hook" "tsm start --pre-hook \"tetra_python_activate\" server.py")

$(_tsm_help_example "Start Node.js server with environment" "tsm start --env local node server.js")

$(_tsm_help_example "Start saved service definition" "tsm start devpages")

$(echo -e "${TETRA_BLUE}SEE ALSO${TETRA_NC}")
  tsm help pre-hooks    Learn about runtime environment setup
  tsm help environments Learn about environment files
  tsm services          List available saved services

EOF
}

tsm_help_ports() {
    cat <<EOF
$(echo -e "${TETRA_BLUE}USAGE${TETRA_NC}")
  $(echo -e "${TETRA_CYAN}tsm ports${TETRA_NC}") [SUBCOMMAND]

$(echo -e "${TETRA_BLUE}SUBCOMMANDS${TETRA_NC}")
$(_tsm_help_flag "list" "Show named port assignments (default)")
$(_tsm_help_flag "detailed" "Show detailed port information with sources")
$(_tsm_help_flag "scan" "Scan for active ports on the system")
$(_tsm_help_flag "overview" "Show port status overview")
$(_tsm_help_flag "validate" "Validate port registry consistency")
$(_tsm_help_flag "set <service> <port>" "Assign a port to a service")
$(_tsm_help_flag "remove <service>" "Remove port assignment")
$(_tsm_help_flag "conflicts [--fix]" "Detect and optionally fix conflicts")

$(echo -e "${TETRA_BLUE}EXAMPLES${TETRA_NC}")
$(_tsm_help_example "Show all port assignments" "tsm ports")

$(_tsm_help_example "Scan for port conflicts" "tsm ports scan")

$(_tsm_help_example "Assign a port to a service" "tsm ports set myapp 3000")

$(echo -e "${TETRA_BLUE}SEE ALSO${TETRA_NC}")
  tsm doctor            Diagnose port conflicts
  tsm list              Show running services and their ports

EOF
}

tsm_help_doctor() {
    cat <<EOF
$(echo -e "${TETRA_BLUE}USAGE${TETRA_NC}")
  $(echo -e "${TETRA_CYAN}tsm doctor${TETRA_NC}") [SUBCOMMAND]

$(echo -e "${TETRA_BLUE}SUBCOMMANDS${TETRA_NC}")
$(_tsm_help_flag "healthcheck" "Validate TSM environment (START HERE if issues!)")
$(_tsm_help_flag "scan" "Scan and diagnose port conflicts")
$(_tsm_help_flag "port <port>" "Diagnose specific port issues")
$(_tsm_help_flag "kill <port>" "Kill process blocking a port")
$(_tsm_help_flag "env" "Validate environment configuration")

$(echo -e "${TETRA_BLUE}DESCRIPTION${TETRA_NC}")
  Diagnostic tools for troubleshooting TSM and port issues.

  $(echo -e "${TETRA_YELLOW}Quick Fix Workflow:${TETRA_NC}")
  1. Run 'tsm doctor healthcheck' to identify issues
  2. Follow the suggested fixes
  3. Use 'tsm doctor kill <port>' to free blocked ports

$(echo -e "${TETRA_BLUE}EXAMPLES${TETRA_NC}")
$(_tsm_help_example "Diagnose all TSM issues" "tsm doctor healthcheck")

$(_tsm_help_example "Check what's using port 3000" "tsm doctor port 3000")

$(_tsm_help_example "Kill process on port 8080" "tsm doctor kill 8080")

EOF
}

# === TOPIC HELP ===

tsm_help_pre_hooks() {
    cat <<EOF
$(echo -e "${TETRA_BLUE}PRE-HOOKS - Runtime Environment Setup${TETRA_NC}")

Pre-hooks are commands that run before starting a process to set up the
runtime environment (Python, Node.js, etc.).

$(echo -e "${TETRA_BLUE}WHY USE PRE-HOOKS?${TETRA_NC}")
  - Avoid polluting .bashrc with runtime activations
  - Per-service environment control
  - Explicit, reproducible environment setup

$(echo -e "${TETRA_BLUE}STANDARD PRE-HOOKS${TETRA_NC}")
$(_tsm_help_flag "python" "Activates pyenv → tetra_python_activate")
$(_tsm_help_flag "node" "Activates nvm (if needed)")
$(_tsm_help_flag "custom" "Your own setup commands")

$(echo -e "${TETRA_BLUE}USAGE${TETRA_NC}")

  $(echo -e "${TETRA_YELLOW}Ad-hoc (command line):${TETRA_NC}")
$(_tsm_help_example "Activate Python environment before starting" "tsm start --pre-hook \"tetra_python_activate\" python server.py")

  $(echo -e "${TETRA_YELLOW}Service Definition (.tsm file):${TETRA_NC}")
    cat > \$TETRA_DIR/tsm/services-available/myapp.tsm <<'EOFTSM'
    TSM_NAME="myapp"
    TSM_COMMAND="python -m http.server"
    TSM_PORT="8020"
    $(echo -e "${TETRA_GREEN}TSM_PRE_COMMAND=\"tetra_python_activate\"${TETRA_NC}")
EOFTSM

$(echo -e "${TETRA_BLUE}AUTO-DETECTION${TETRA_NC}")
  TSM automatically detects Python and Node.js commands and activates
  the appropriate environment. Use --pre-hook to override or augment.

$(echo -e "${TETRA_BLUE}PYTHON WORKFLOW${TETRA_NC}")
$(_tsm_help_example "1. Install Python via pyenv" "tetra_python_install 3.11.11")
$(_tsm_help_example "2. Start Python server (auto-activates)" "tsm start python -m http.server 8020")
$(_tsm_help_example "3. Or use explicit pre-hook" "tsm start --pre-hook \"tetra_python_activate\" app.py")

$(echo -e "${TETRA_BLUE}SEE ALSO${TETRA_NC}")
  tsm help start        Learn about starting services
  tsm help environments Learn about environment files
  tsm help python       Python-specific guide

EOF
}

tsm_help_environments() {
    cat <<EOF
$(echo -e "${TETRA_BLUE}ENVIRONMENT FILES${TETRA_NC}")

Environment files (.env) store configuration variables for your services.

$(echo -e "${TETRA_BLUE}WORKFLOW${TETRA_NC}")
$(_tsm_help_example "1. Create environment file" "tsm init dev")

$(_tsm_help_example "2. Edit with your secrets" "vim env/dev.env")

$(_tsm_help_example "3. Start with environment" "tsm start --env dev server.js")

$(echo -e "${TETRA_BLUE}AUTO-DETECTION${TETRA_NC}")
  TSM looks for these files automatically:
  - env/dev.env
  - env/local.env

  Use --env to specify a different file.

$(echo -e "${TETRA_BLUE}ENVIRONMENT FILE FORMAT${TETRA_NC}")
  export API_KEY="your-secret-key"
  export PORT=3000
  export DATABASE_URL="db://..."

$(echo -e "${TETRA_BLUE}SEE ALSO${TETRA_NC}")
  tsm help start    Learn about the --env flag
  tsm init          Create environment file from template

EOF
}

tsm_help_python() {
    cat <<EOF
$(echo -e "${TETRA_BLUE}PYTHON WITH TSM${TETRA_NC}")

TSM integrates with pyenv for isolated Python environments.

$(echo -e "${TETRA_BLUE}SETUP${TETRA_NC}")
$(_tsm_help_example "1. Install pyenv and Python" "tetra_python_install 3.11.11")
$(_tsm_help_example "2. Verify installation" "tetra_python_status")

$(echo -e "${TETRA_BLUE}STARTING PYTHON SERVICES${TETRA_NC}")
$(_tsm_help_example "Auto-activation (recommended)" "tsm start python -m http.server 8020")

$(_tsm_help_example "Explicit pre-hook" "tsm start --pre-hook \"tetra_python_activate\" app.py 9000")

$(_tsm_help_example "Save as service" "tsm save pyserver \"python -m http.server\" 8020")

$(echo -e "${TETRA_BLUE}HOW IT WORKS${TETRA_NC}")
  1. TSM detects 'python' in your command
  2. Automatically runs tetra_python_activate
  3. Adds pyenv to PATH for that process only
  4. Your .bashrc stays clean!

$(echo -e "${TETRA_BLUE}TROUBLESHOOTING${TETRA_NC}")
$(_tsm_help_example "Check Python status" "tetra_python_status")
$(_tsm_help_example "List Python versions" "tetra_python_list")
$(_tsm_help_example "Manually activate" "tetra_python_activate")

$(echo -e "${TETRA_BLUE}SEE ALSO${TETRA_NC}")
  tsm help pre-hooks    Learn about runtime activation
  tsm help start        Learn about starting services

EOF
}

# === HELP ROUTER ===

tsm_help_topic() {
    local topic="$1"

    case "$topic" in
        start)
            tsm_help_start
            ;;
        ports)
            tsm_help_ports
            ;;
        doctor)
            tsm_help_doctor
            ;;
        pre-hooks|prehooks|hooks)
            tsm_help_pre_hooks
            ;;
        environments|env)
            tsm_help_environments
            ;;
        python)
            tsm_help_python
            ;;
        *)
            echo -e "${TETRA_RED}Unknown help topic: $topic${TETRA_NC}" >&2
            echo "Try: tsm help [start|ports|doctor|pre-hooks|environments|python]" >&2
            return 1
            ;;
    esac
}

export -f tsm_help_start
export -f tsm_help_ports
export -f tsm_help_doctor
export -f tsm_help_pre_hooks
export -f tsm_help_environments
export -f tsm_help_python
export -f tsm_help_topic
