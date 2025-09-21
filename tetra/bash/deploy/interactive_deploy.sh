#!/bin/bash

# Deployment Action Runner
# Requires: jq, bash 4.0+

# Deployment actions JSON file path
DEPLOY_ACTIONS_FILE="${TETRA_BASH:-/home/dev/src/pixeljam/pja/arcade/tetra/bash}/deploy/deploy_actions.json"

# Logging and tracking
DEPLOY_LOG_DIR="${HOME}/.tetra/deploy/logs"
mkdir -p "$DEPLOY_LOG_DIR"
CURRENT_DEPLOY_LOG="${DEPLOY_LOG_DIR}/deploy_$(date +%Y%m%d_%H%M%S).log"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Logging function
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    
    case "$level" in
        INFO)
            echo -e "${GREEN}[INFO]${NC} $timestamp: $message" | tee -a "$CURRENT_DEPLOY_LOG"
            ;;
        WARN)
            echo -e "${YELLOW}[WARN]${NC} $timestamp: $message" | tee -a "$CURRENT_DEPLOY_LOG"
            ;;
        ERROR)
            echo -e "${RED}[ERROR]${NC} $timestamp: $message" | tee -a "$CURRENT_DEPLOY_LOG"
            ;;
        *)
            echo "$timestamp: $message" | tee -a "$CURRENT_DEPLOY_LOG"
            ;;
    esac
}

# Interactive deployment function
interactive_deploy() {
    local deploy_phase="${1:-all}"
    
    # Validate jq is installed
    if ! command -v jq &> /dev/null; then
        log_message ERROR "jq is not installed. Please install jq to continue."
        return 1
    fi
    
    # Read deployment actions
    local deploy_actions
    if ! deploy_actions=$(jq '.' "$DEPLOY_ACTIONS_FILE"); then
        log_message ERROR "Failed to parse deployment actions JSON"
        return 1
    fi
    
    # Filter actions if specific phase is provided
    if [[ "$deploy_phase" != "all" ]]; then
        deploy_actions=$(echo "$deploy_actions" | jq "[.[] | select(.id == \"$deploy_phase\")]")
    fi
    
    # Iterate through deployment phases
    echo "$deploy_actions" | jq -c '.[]' | while read -r phase; do
        local phase_id=$(echo "$phase" | jq -r '.id')
        local phase_name=$(echo "$phase" | jq -r '.name')
        local phase_description=$(echo "$phase" | jq -r '.description')
        
        log_message INFO "Starting Deployment Phase: $phase_name"
        echo -e "\n${YELLOW}🚀 Phase: $phase_name${NC}"
        echo -e "${YELLOW}Description: $phase_description${NC}\n"
        
        # Iterate through steps in the phase
        echo "$phase" | jq -c '.steps[]' | while read -r step; do
            local action=$(echo "$step" | jq -r '.action')
            local prompt=$(echo "$step" | jq -r '.prompt')
            local command=$(echo "$step" | jq -r '.command')
            
            # Prompt user for confirmation
            read -p "${GREEN}Action: $prompt${NC} (y/n/q): " user_response
            
            case "$user_response" in
                [Yy])
                    log_message INFO "Executing: $action - $prompt"
                    # Execute the command
                    if eval "$command"; then
                        log_message INFO "Action $action completed successfully"
                    else
                        log_message ERROR "Action $action failed"
                        read -p "Continue to next step? (y/n): " continue_response
                        [[ "$continue_response" != [Yy] ]] && return 1
                    fi
                    ;;
                [Qq])
                    log_message INFO "Deployment interrupted by user"
                    return 0
                    ;;
                *)
                    log_message WARN "Skipping action: $action"
                    ;;
            esac
        done
        
        log_message INFO "Completed Deployment Phase: $phase_name"
    done
    
    log_message INFO "Deployment process completed"
}

# Allow sourcing or direct execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    interactive_deploy "$@"
fi
