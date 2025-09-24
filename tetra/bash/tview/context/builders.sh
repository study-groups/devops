#!/usr/bin/env bash

# Context Builders Micro-Module
# Builds contextual information and help text

# Build context information for current selection
build_context_info() {
    local mode="${1:-$CURRENT_MODE}"
    local env="${2:-$CURRENT_ENV}"
    local item_index="${3:-$CURRENT_ITEM}"

    case "${mode}_${env}" in
        "TOML_TETRA")
            build_toml_tetra_context "$item_index"
            ;;
        "TOML_"*)
            build_toml_env_context "$env" "$item_index"
            ;;
        *)
            build_generic_context "$mode" "$env" "$item_index"
            ;;
    esac
}

# Build context for TOML editing in TETRA environment
build_toml_tetra_context() {
    local item_index="$1"

    if [[ ${#ACTIVE_MULTISPANS[@]} -gt $item_index ]]; then
        local selected_span="${ACTIVE_MULTISPANS[$item_index]}"
        local location="${MULTISPAN_LOCATIONS[$selected_span]}"
        local var_count=$(count_section_variables "$selected_span")

        cat << EOF
📍 Selected: [$selected_span] section
📄 Location: $location
🔢 Variables: $var_count in this section
🎯 Purpose: $(get_section_purpose "$selected_span")
💡 Actions: Press Enter to expand, Tab to edit variables
EOF
    else
        local total_sections=${#ACTIVE_MULTISPANS[@]}
        local total_vars=${#VARIABLE_SOURCE_MAP[@]}

        cat << EOF
📍 Selected: TOML overview
📄 File: $ACTIVE_TOML
🔢 Structure: $total_sections sections, $total_vars variables
🎯 Purpose: Hierarchical configuration management
💡 Actions: Use j/k to navigate sections, Enter to expand
EOF
    fi
}

# Build context for TOML in environments
build_toml_env_context() {
    local env="$1"
    local item_index="$2"

    local connection_status=$(render_connection_status "$env")
    local deploy_status=$(get_deployment_status "$env")

    cat << EOF
🌍 Environment: $(colorize_env "$env" "$env")
🔌 Connection: $connection_status
🚀 Deployment: $(render_status_badge "$deploy_status")
🎯 Focus: Environment-specific configuration
💡 Actions: Press 'd' to deploy, 'c' to connect
EOF
}

# Build generic context
build_generic_context() {
    local mode="$1"
    local env="$2"
    local item_index="$3"

    cat << EOF
🔧 Mode: $mode
🌍 Environment: $env
📍 Item: $item_index
💡 Context: Standard mode-environment view
EOF
}

# Get contextual help text
get_contextual_help() {
    local mode="${1:-$CURRENT_MODE}"
    local env="${2:-$CURRENT_ENV}"

    case "${mode}_${env}" in
        "TOML_TETRA")
            echo "j/k: navigate sections | Enter: expand/collapse | Tab: edit | ?: help"
            ;;
        "TOML_"*)
            echo "Enter: edit config | d: deploy | c: connect | l: logs"
            ;;
        "TSM_"*)
            echo "Enter: service actions | r: restart | l: logs | s: status"
            ;;
        *)
            echo "Enter: actions | ?: help | q: quit"
            ;;
    esac
}

# Build breadcrumb navigation
build_breadcrumbs() {
    local mode="${1:-$CURRENT_MODE}"
    local env="${2:-$CURRENT_ENV}"
    local item_index="${3:-$CURRENT_ITEM}"

    local breadcrumb="$mode"

    if [[ -n "$env" ]]; then
        breadcrumb+=" → $env"
    fi

    if [[ "$mode" == "TOML" && ${#ACTIVE_MULTISPANS[@]} -gt $item_index ]]; then
        local selected_span="${ACTIVE_MULTISPANS[$item_index]}"
        breadcrumb+=" → [$selected_span]"
    fi

    echo "$breadcrumb"
}