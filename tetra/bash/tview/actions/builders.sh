#!/usr/bin/env bash

# Action Builders Micro-Module
# Builds contextual action menus for hierarchical TOML editing

# Build contextual actions based on mode, environment, and selection
build_contextual_actions() {
    local mode="${1:-$CURRENT_MODE}"
    local env="${2:-$CURRENT_ENV}"
    local item_index="${3:-$CURRENT_ITEM}"

    case "${mode}_${env}" in
        "TOML_TETRA")
            build_toml_tetra_actions "$item_index"
            ;;
        "TOML_"*)
            build_toml_env_actions "$env" "$item_index"
            ;;
        "TSM_"*)
            build_service_actions "$env" "$item_index"
            ;;
        "TKM_"*)
            build_key_actions "$env" "$item_index"
            ;;
        "RCM_"*)
            build_command_actions "$env" "$item_index"
            ;;
        *)
            build_generic_actions "$mode" "$env" "$item_index"
            ;;
    esac
}

# Build actions for TOML editing in TETRA environment
build_toml_tetra_actions() {
    local item_index="$1"

    if [[ ${#ACTIVE_MULTISPANS[@]} -gt $item_index ]]; then
        local selected_span="${ACTIVE_MULTISPANS[$item_index]}"

        cat << EOF
${ACTION_EDIT_COLOR}▸${COLOR_RESET} Edit [$selected_span] section
${ACTION_VIEW_COLOR}▸${COLOR_RESET} Show section variables
${ACTION_CONFIG_COLOR}▸${COLOR_RESET} Validate section syntax
${ACTION_DEPLOY_COLOR}▸${COLOR_RESET} Preview section changes
EOF
    else
        cat << EOF
${ACTION_VIEW_COLOR}▸${COLOR_RESET} View complete TOML structure
${ACTION_EDIT_COLOR}▸${COLOR_RESET} Add new section
${ACTION_CONFIG_COLOR}▸${COLOR_RESET} Validate entire file
${ACTION_DEPLOY_COLOR}▸${COLOR_RESET} Export configuration
EOF
    fi
}

# Build actions for TOML in specific environments
build_toml_env_actions() {
    local env="$1"
    local item_index="$2"

    cat << EOF
${ACTION_EDIT_COLOR}▸${COLOR_RESET} Edit $env configuration
${ACTION_VIEW_COLOR}▸${COLOR_RESET} Preview $env values
${ACTION_DEPLOY_COLOR}▸${COLOR_RESET} Deploy to $env
${ACTION_SSH_COLOR}▸${COLOR_RESET} Connect to $env
${ACTION_VIEW_COLOR}▸${COLOR_RESET} View $env logs
EOF
}

# Build service management actions
build_service_actions() {
    local env="$1"
    local item_index="$2"

    if [[ "$env" == "LOCAL" ]]; then
        cat << EOF
${ACTION_SERVICE_COLOR}▸${COLOR_RESET} Start local services
${ACTION_SERVICE_COLOR}▸${COLOR_RESET} Stop local services
${ACTION_VIEW_COLOR}▸${COLOR_RESET} View service logs
${ACTION_CONFIG_COLOR}▸${COLOR_RESET} Edit service config
EOF
    else
        cat << EOF
${ACTION_SSH_COLOR}▸${COLOR_RESET} Connect to $env
${ACTION_SERVICE_COLOR}▸${COLOR_RESET} Restart services on $env
${ACTION_VIEW_COLOR}▸${COLOR_RESET} Tail $env logs
${ACTION_DEPLOY_COLOR}▸${COLOR_RESET} Deploy service updates
EOF
    fi
}

# Build key management actions
build_key_actions() {
    local env="$1"
    local item_index="$2"

    cat << EOF
${ACTION_SSH_COLOR}▸${COLOR_RESET} Test SSH connection
${ACTION_CONFIG_COLOR}▸${COLOR_RESET} Generate new key pair
${ACTION_DEPLOY_COLOR}▸${COLOR_RESET} Deploy public key to $env
${ACTION_VIEW_COLOR}▸${COLOR_RESET} View key fingerprints
EOF
}

# Build remote command actions
build_command_actions() {
    local env="$1"
    local item_index="$2"

    cat << EOF
${ACTION_SSH_COLOR}▸${COLOR_RESET} Execute command on $env
${ACTION_VIEW_COLOR}▸${COLOR_RESET} View command history
${ACTION_CONFIG_COLOR}▸${COLOR_RESET} Schedule recurring command
${ACTION_SERVICE_COLOR}▸${COLOR_RESET} Monitor command output
EOF
}

# Build generic actions
build_generic_actions() {
    local mode="$1"
    local env="$2"
    local item_index="$3"

    cat << EOF
${ACTION_VIEW_COLOR}▸${COLOR_RESET} View details
${ACTION_CONFIG_COLOR}▸${COLOR_RESET} Configure settings
${ACTION_SERVICE_COLOR}▸${COLOR_RESET} Manage $mode
EOF
}

# Get action count for current context
get_action_count() {
    local mode="${1:-$CURRENT_MODE}"
    local env="${2:-$CURRENT_ENV}"

    local actions=$(build_contextual_actions "$mode" "$env")
    echo "$actions" | wc -l
}

# Get action by index
get_action_by_index() {
    local index="$1"
    local mode="${2:-$CURRENT_MODE}"
    local env="${3:-$CURRENT_ENV}"

    local actions=$(build_contextual_actions "$mode" "$env")
    echo "$actions" | sed -n "$((index + 1))p"
}