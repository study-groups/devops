#!/usr/bin/env bash

# Deployment REPL with state tracking
# Follows TSM script pattern for consistency

# Load shared REPL utilities
source "${TETRA_SRC:-$HOME/src/devops/tetra}/bash/utils/repl_utils.sh"

# Deploy Directory Convention under TETRA_DIR
# Following standard pattern: TETRA_DIR/deploy/{config,logs,runs,history}
DEPLOY_DIR="${TETRA_DIR:-$HOME/tetra}/deploy"
DEPLOY_RUNS_DIR="${DEPLOY_DIR}/runs"
DEPLOY_CONFIG_DIR="${DEPLOY_DIR}/config"
DEPLOY_LOGS_DIR="${DEPLOY_DIR}/logs"
DEPLOY_HISTORY_DIR="${DEPLOY_DIR}/history"

# Default configuration
DEPLOY_CONFIG=(
    "DEPLOY_SOURCE_BRANCH=api-dev"
    "DEPLOY_TARGET_ENV=staging"
    "DEPLOY_REMOTE_USER=tetra"
    "DEPLOY_REMOTE_HOST=staging.pixeljamarcade.com"
    "DEPLOY_PROJECT_PATH=/home/staging/src/pixeljam/pja/arcade"
    "DEPLOY_SITE_URL=https://staging.pixeljamarcade.com"
    "DEPLOY_SERVICES=(nginx arcade-staging)"
    "DEPLOY_SCRIPT=${TETRA_SRC:-$HOME/src/devops/tetra}/bash/deploy/example_deploy_script.sh"
)

# Logging and state tracking
tetra_deploy_log_state() {
    local run_id="$1"
    local stage="$2"
    local status="$3"
    local details="${4:-}"

    # Ensure run directory exists
    mkdir -p "$DEPLOY_RUNS_DIR/$run_id"

    # Create JSON log for this stage
    local log_file="$DEPLOY_RUNS_DIR/$run_id/${stage}.json"
    cat > "$log_file" <<EOF
{
    "stage": "$stage",
    "status": "$status",
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "details": "$details"
}
EOF
}

# Configuration Management
tetra_deploy_edit_config() {
    local config_file="${1:-$DEPLOY_CONFIG_DIR/deploy_config.sh}"
    
    # Create config file if it doesn't exist
    mkdir -p "$(dirname "$config_file")"
    
    # If config file doesn't exist, create it with default values
    if [[ ! -f "$config_file" ]]; then
        for item in "${DEPLOY_CONFIG[@]}"; do
            echo "export $item" >> "$config_file"
        done
    fi

    # Open config file in editor
    ${EDITOR:-vim} "$config_file"
}

# Load Configuration
tetra_deploy_load_config() {
    local target_env="${1:-staging}" # Default to staging
    local config_file="$DEPLOY_CONFIG_DIR/deploy-${target_env}.sh"
    
    # Check if config file exists
    if [[ ! -f "$config_file" ]]; then
        echo "No configuration found for '$target_env' environment."
        echo "Creating default config at $config_file"
        tetra_deploy_edit_config "$config_file"
    fi

    # Source the configuration
    echo "Sourcing configuration from $config_file"
    source "$config_file"
}

# Preflight checks
tetra_deploy_preflight_check() {
    local run_id="$1"
    local source_branch="$2"
    local target_env="$3"

    echo "🚀 Preflight Check for $target_env from $source_branch"

    # Check git status
    if ! git status &>/dev/null; then
        tetra_deploy_log_state "$run_id" "preflight" "fail" "Not in a git repository"
        return 1
    fi

    # Validate source branch exists
    if ! git rev-parse --verify "$source_branch" &>/dev/null; then
        tetra_deploy_log_state "$run_id" "preflight" "fail" "Source branch $source_branch does not exist"
        return 1
    fi

    # Check for correct remote user
    if [[ "$DEPLOY_REMOTE_USER" != "tetra" ]]; then
        tetra_deploy_log_state "$run_id" "preflight" "fail" "DEPLOY_REMOTE_USER must be 'tetra', but is '$DEPLOY_REMOTE_USER'"
        return 1
    fi

    tetra_deploy_log_state "$run_id" "preflight" "pass" "All preflight checks passed"
    return 0
}

# Deployment Execution
tetra_deploy_execute() {
    local run_id="$1"
    local deploy_script="$2"

    echo "🚀 Starting Deployment Execution"

    # Validate deploy script exists and is executable
    if [[ ! -f "$deploy_script" || ! -x "$deploy_script" ]]; then
        tetra_deploy_log_state "$run_id" "execution" "fail" "Deploy script not found or not executable"
        return 1
    fi

    # Execute the deployment script and capture output
    local output_log="$DEPLOY_RUNS_DIR/$run_id/deployment_output.log"
    if "$deploy_script" 2>&1 | tee "$output_log"; then
        tetra_deploy_log_state "$run_id" "execution" "pass" "Deployment script completed successfully"
    else
        tetra_deploy_log_state "$run_id" "execution" "fail" "Deployment script failed"
        return 1
    fi
}

# Run a new deployment
tetra_deploy_run() {
    # Determine target environment, default to staging
    local target_env="${1:-staging}"
    
    # Load configuration
    tetra_deploy_load_config "$target_env"

    # Generate unique run ID based on timestamp
    local run_id=$(date +%s)
    
    echo "🚀 Starting Deployment Run: $run_id"
    echo "Source Branch: $DEPLOY_SOURCE_BRANCH"
    echo "Target Environment: $DEPLOY_TARGET_ENV"

    # Deployment Stages
    tetra_deploy_preflight_check "$run_id" "$DEPLOY_SOURCE_BRANCH" "$DEPLOY_TARGET_ENV" || return 1
    tetra_deploy_execute "$run_id" "$DEPLOY_SCRIPT" || return 1

    echo "✅ Deployment Completed Successfully!"
}

tetra_deploy_repl_help() {
    cat <<'EOF'
Tetra Deployment REPL
=====================

Deployment Commands:
  deploy            Start a new deployment run
  status            Show current deployment status
  config            Edit deployment configuration
  runs              List previous deployment runs
  view <run_id>     View details for a specific run
  env               Show deployment environment variables
  vars              List and describe deployment variables
  tutorial          Walk through an example deployment
  
System Commands:
  help              Show this help
  exit, quit        Exit REPL
  
Bash Commands:
  !<command>        Execute bash command (e.g. !ls -l)
  
Special:
  /command          Force slash command (for conflicts)
EOF
}

tetra_deploy_repl_process_command() {
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
    
    # Handle slash commands (legacy/forced)
    if [[ "$cmd" =~ ^/ ]]; then
        cmd="${cmd#/}"
    fi
    
    # Handle bash commands
    if [[ "$input" =~ ^! ]]; then
        local bash_cmd="${input#!}"
        if [[ -n "$bash_cmd" ]]; then
            eval "$bash_cmd"
        fi
        return 0
    fi
    
    # Main command processing
    case "$cmd" in
        help|"?")
            tetra_deploy_repl_help
            ;;
        exit|quit)
            echo "Goodbye!"
            return 1
            ;;
        deploy)
            tetra_deploy_run "$args"
            ;;
        status)
            echo "=== Current Configuration ==="
            ( set -o posix ; set ) | grep -E '^(DEPLOY_SOURCE_BRANCH|DEPLOY_TARGET_ENV|DEPLOY_REMOTE_USER|DEPLOY_REMOTE_HOST|DEPLOY_PROJECT_PATH|DEPLOY_SITE_URL|DEPLOY_SERVICES|DEPLOY_SCRIPT)='
            echo
            echo "=== Recent Runs ==="
            ls -1 "$DEPLOY_RUNS_DIR" 2>/dev/null | sort -nr | head -5 || echo "No deployment runs found"
            ;;
        config)
            tetra_deploy_edit_config
            ;;
        runs)
            ls -1 "$DEPLOY_RUNS_DIR" 2>/dev/null | sort -nr || echo "No deployment runs found"
            ;;
        view)
            if [[ -n "$args" ]]; then
                if [[ -d "$DEPLOY_RUNS_DIR/$args" ]]; then
                    for log in "$DEPLOY_RUNS_DIR/$args"/*.json; do
                        if [[ -f "$log" ]]; then
                            echo "=== $(basename "$log") ==="
                            cat "$log"
                            echo
                        fi
                    done
                else
                    echo "Run ID '$args' not found"
                fi
            else
                echo "Usage: view <run_id>"
            fi
            ;;
        env)
            ( set -o posix ; set ) | grep -E '^(DEPLOY_SOURCE_BRANCH|DEPLOY_TARGET_ENV|DEPLOY_REMOTE_USER|DEPLOY_REMOTE_HOST|DEPLOY_PROJECT_PATH|DEPLOY_SITE_URL|DEPLOY_SERVICES|DEPLOY_SCRIPT)='
            ;;
        vars)
            cat <<'EOF'
Deployment Variables (meta):
----------------------------
These variables control the deployment process itself. They are typically set
in a deploy-<env>.sh file (e.g., deploy-staging.sh).

- DEPLOY_SOURCE_BRANCH: The git branch to deploy from.
- DEPLOY_TARGET_ENV:    The target environment (e.g., staging, production).
- DEPLOY_REMOTE_USER:   The SSH user for the remote host (should be 'tetra').
- DEPLOY_REMOTE_HOST:   The remote host's domain or IP address.
- DEPLOY_PROJECT_PATH:  The absolute path to the project on the remote host.
- DEPLOY_SITE_URL:      The public URL of the deployed site.
- DEPLOY_SERVICES:      A space-separated list of services to restart (e.g., "nginx myapp").
- DEPLOY_SCRIPT:        Path to the script that performs the actual build and deploy steps.
EOF
            echo
            echo "Current Values:"
            echo "---------------"
            ( set -o posix ; set ) | grep '^DEPLOY_'
            ;;
        tutorial)
            tetra_deploy_tutorial
            ;;
        "")
            # Empty command - show status
            echo "=== Recent Runs ==="
            ls -1 "$DEPLOY_RUNS_DIR" 2>/dev/null | sort -nr | head -3 || echo "No deployment runs found"
            ;;
        *)
            echo "Unknown command: $cmd"
            echo "Type 'help' for available commands"
            ;;
    esac
    return 0
}

tetra_deploy_tutorial() {
    local temp_config_file
    temp_config_file=$(mktemp)

    cat > "$temp_config_file" <<EOF
# This is an example staging deployment configuration.
# The 'deploy' command will source this file to get its settings.
export DEPLOY_SOURCE_BRANCH="main"
export DEPLOY_TARGET_ENV="staging"
export DEPLOY_REMOTE_USER="tetra"
export DEPLOY_REMOTE_HOST="staging.pixeljamarcade.com"
export DEPLOY_PROJECT_PATH="/home/tetra/example-project"
export DEPLOY_SITE_URL="https://staging.example.com"
export DEPLOY_SERVICES="nginx"
export DEPLOY_SCRIPT="\$TETRA_SRC/bash/deploy/example_deploy_script.sh"
EOF

    # Function to pause and wait for Enter
    _pause() {
        echo
        read -p "Press Enter to continue..."
        echo
    }

    clear
    echo "Welcome to the Tetra Deployment REPL Tutorial!"
    echo "This will walk you through a typical 'sunny day' deployment to a staging environment."
    _pause

    echo "Step 0: Security Setup (First Time Only)"
    echo "----------------------------------------"
    echo "Before deploying, you need to set up secure key management:"
    echo "  1. Run 'tkm repl' to enter the key manager"
    echo "  2. Run 'generate all' to create keys for all environments"
    echo "  3. Run 'deploy all' to distribute keys to remote hosts"
    echo "  4. Run 'audit' to verify security posture"
    echo
    _pause

    echo "Step 1: Configuration"
    echo "---------------------"
    echo "First, we need to define our deployment variables. These are stored in a"
    echo "file like 'deploy-staging.sh'. For this tutorial, we'll use an example file."
    echo
    echo "Here are the contents of our example config:"
    echo "--------------------------------------------------"
    cat "$temp_config_file"
    echo "--------------------------------------------------"
    _pause

    echo "Step 2: Starting the Deployment"
    echo "-------------------------------"
    echo "Now, you would run the 'deploy staging' command."
    echo "This tells the REPL to use the 'staging' configuration."
    echo
    echo "The REPL will now load the variables from '$temp_config_file' (our tutorial example)."
    source "$temp_config_file"
    echo "Configuration loaded."
    _pause

    echo "Step 3: Preflight Checks"
    echo "------------------------"
    echo "Before deploying, the system runs preflight checks to ensure everything is ready."
    echo "It checks if you're in a git repository and if the source branch exists."
    echo
    echo "Running preflight check for '$DEPLOY_TARGET_ENV' from branch '$DEPLOY_SOURCE_BRANCH'..."
    sleep 1 # simulate work
    echo "✅ All preflight checks passed."
    _pause

    echo "Step 4: Executing the Deployment Script"
    echo "---------------------------------------"
    echo "The REPL now executes the script defined in the DEPLOY_SCRIPT variable."
    echo "This script is responsible for the actual deployment steps, like:"
    echo "  - Pulling the latest code from git"
    echo "  - Installing dependencies"
    echo "  - Building assets"
    echo "  - Restarting services"
    echo
    echo "Executing script: $DEPLOY_SCRIPT..."
    echo "(This is a simulation, the actual script will not be run)"
    sleep 2 # simulate work
    echo
    echo "--- Example Script Output ---"
    echo "  - Cloning branch 'main'..."
    echo "  - Installing dependencies with npm..."
    echo "  - Build complete."
    echo "  - Restarting nginx..."
    echo "  - Deployment to https://staging.example.com successful!"
    echo "---------------------------"
    _pause

    echo "Step 5: Completion"
    echo "------------------"
    echo "That's it! The deployment is complete."
    echo "You can use the 'runs' command to see a history of deployments and 'view <id>'"
    echo "to see the logs for a specific run."
    echo
    echo "Tutorial finished."

    # Clean up the temp file
    rm -f "$temp_config_file"
}

# REPL Loop
tetra_deploy_repl() {
    echo "Tetra Deployment REPL"
    echo "Type 'help' for commands, 'exit' to quit"
    echo
    
    # Load default (staging) config at start
    tetra_deploy_load_config "staging"

    while true; do
        echo -n "deploy> "
        if ! read -r input; then
            # EOF reached
            echo
            break
        fi
        
        # Skip empty lines
        if [[ -z "$input" ]]; then
            continue
        fi
        
        if ! tetra_deploy_repl_process_command "$input"; then
            break
        fi
        echo
    done
}

# If script is run directly, start REPL
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    tetra_deploy_repl "$@"
fi

# Ensure zero exit when sourced
true
