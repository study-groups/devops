#!/usr/bin/env bash

# TView Data Loading - TOML parsing and environment data collection

# Data loading functions
detect_active_toml() {
    echo "DEBUG: detect_active_toml called" >> /tmp/tview_debug.log
    echo "DEBUG: TETRA_DIR='$TETRA_DIR'" >> /tmp/tview_debug.log

    # Load active org from config file (TETRA_ACTIVE_ORG approach)
    local active_org_file="$TETRA_DIR/config/active_org"
    if [[ -f "$active_org_file" ]]; then
        export TETRA_ACTIVE_ORG="$(cat "$active_org_file")"

        # Set TOML path directly using environment variable
        local org_toml="$TETRA_DIR/orgs/$TETRA_ACTIVE_ORG/tetra.toml"
        if [[ -f "$org_toml" ]]; then
            ACTIVE_TOML="$org_toml"
            ACTIVE_ORG="$TETRA_ACTIVE_ORG"
            PROJECT_NAME="$TETRA_ACTIVE_ORG"
            return 0
        fi
    fi

    # Fallback: Check for old symlink system (backward compatibility)
    local tetra_toml="$TETRA_DIR/config/tetra.toml"
    if [[ -L "$tetra_toml" ]]; then
        # Legacy organization system
        ACTIVE_TOML="$tetra_toml"
        local target=$(readlink "$tetra_toml")
        ACTIVE_ORG=$(basename "$(dirname "$target")")
        PROJECT_NAME="$ACTIVE_ORG"
        return 0
    fi

    # Fallback to local TOML files
    local toml_files=(*.toml)
    if [[ -f "${toml_files[0]}" ]]; then
        ACTIVE_TOML="${toml_files[0]}"
        PROJECT_NAME="$(basename "$ACTIVE_TOML" .toml)"
        ACTIVE_ORG=""
    else
        ACTIVE_TOML=""
        PROJECT_NAME=""
        ACTIVE_ORG=""
    fi

    echo "DEBUG: detect_active_toml result: ACTIVE_TOML='$ACTIVE_TOML' ACTIVE_ORG='$ACTIVE_ORG' PROJECT_NAME='$PROJECT_NAME'" >> /tmp/tview_debug.log
}

# Parameter display functions for TDD requirements
get_toml_value() {
    local key="$1"
    local toml_file="${2:-$ACTIVE_TOML}"

    if [[ ! -f "$toml_file" ]]; then
        echo "N/A"
        return 1
    fi

    # Simple TOML value extraction for key paths like "metadata.name"
    if [[ "$key" =~ ^([^.]+)\.(.+)$ ]]; then
        local section="${BASH_REMATCH[1]}"
        local field="${BASH_REMATCH[2]}"

        # Extract value from TOML section
        awk -v section="$section" -v field="$field" '
        BEGIN { in_section = 0 }
        /^\[.*\]/ {
            in_section = ($0 == "[" section "]")
            next
        }
        in_section && $0 ~ "^" field " *= *" {
            gsub(/^[^=]*= *"?/, "")
            gsub(/"$/, "")
            print $0
            exit
        }
        ' "$toml_file"
    else
        # Direct key lookup (not in a section)
        awk -v field="$key" '
        !/^\[.*\]/ && $0 ~ "^" field " *= *" {
            gsub(/^[^=]*= *"?/, "")
            gsub(/"$/, "")
            print $0
            exit
        }
        ' "$toml_file"
    fi
}

show_parameters() {
    echo "=== Current Configuration Parameters ==="
    echo "Active Org:     ${ACTIVE_ORG:-N/A}"
    echo "TOML Path:      ${ACTIVE_TOML:-N/A}"
    echo "Tetra Dir:      ${TETRA_DIR:-N/A}"
    echo "Project Name:   ${PROJECT_NAME:-N/A}"
    echo ""

    if [[ -f "$ACTIVE_TOML" ]]; then
        echo "=== TOML Configuration ==="
        echo "Name:           $(get_toml_value "metadata.name")"
        echo "Type:           $(get_toml_value "metadata.type")"
        echo "Description:    $(get_toml_value "metadata.description")"
        echo "Provider:       $(get_toml_value "org.provider")"
        echo "Region:         $(get_toml_value "org.region")"
    fi
}

display_config() {
    show_parameters
}

list_settings() {
    echo "=== TView Settings ==="
    echo "Current Mode:   ${CURRENT_MODE:-TOML}"
    echo "Current Env:    ${CURRENT_ENV:-TETRA}"
    echo "Drill Level:    ${DRILL_LEVEL:-0}"
    echo "Current Item:   ${CURRENT_ITEM:-0}"
    echo ""
    show_parameters
}

# Real-time status functions for TDD requirements
update_status() {
    local component="${1:-all}"

    case "$component" in
        "toml"|"config")
            # Refresh TOML configuration status
            detect_active_toml
            echo "TOML configuration refreshed"
            ;;
        "services")
            # Check service status across environments
            check_service_status
            ;;
        "variables"|"vars")
            # Refresh system variable tracking
            refresh_variable_tracking
            ;;
        "all"|*)
            # Refresh everything
            detect_active_toml
            check_service_status
            refresh_variable_tracking
            echo "All status components refreshed"
            ;;
    esac
}

refresh_data() {
    echo "Refreshing TView data sources..."

    # Refresh configuration
    detect_active_toml

    # Refresh environment-specific data
    case "$CURRENT_ENV" in
        "DEV"|"STAGING"|"PROD"|"QA")
            # Test SSH connectivity for remote environments
            local ssh_status=$(test_ssh_connectivity "$CURRENT_ENV")
            echo "SSH Status [$CURRENT_ENV]: $ssh_status"
            ;;
        "LOCAL"|"TETRA")
            # Check local services and files
            echo "Local environment: OK"
            ;;
    esac

    # Refresh multispan cursor tracking
    refresh_multispan_tracking
}

get_current_state() {
    echo "=== Current TView State ==="
    echo "Timestamp:      $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Mode:           $CURRENT_MODE"
    echo "Environment:    $CURRENT_ENV"
    echo "Active Org:     $ACTIVE_ORG"
    echo "TOML Path:      $ACTIVE_TOML"
    echo "Current Item:   $CURRENT_ITEM"
    echo "Drill Level:    $DRILL_LEVEL"

    # Show variable tracking state
    if [[ -n "$TRACKED_VARIABLES" ]]; then
        echo "Tracked Vars:   $(echo "$TRACKED_VARIABLES" | wc -w) variables"
    fi

    # Show multispan state
    if [[ -n "$ACTIVE_MULTISPANS" ]]; then
        echo "Active Spans:   $(echo "$ACTIVE_MULTISPANS" | wc -w) spans"
    fi
}

check_service_status() {
    local env="${1:-$CURRENT_ENV}"

    case "$env" in
        "LOCAL")
            # Check local processes (Mac-compatible)
            if ps aux | grep -q "[t]etra" 2>/dev/null; then
                echo "tetra: active"
            else
                echo "tetra: inactive"
            fi
            ;;
        "DEV"|"STAGING"|"PROD"|"QA")
            # Check remote services via SSH
            local ssh_prefix=$(get_ssh_prefix_for_env "$env")
            if [[ -n "$ssh_prefix" ]]; then
                local service_check=$($ssh_prefix "systemctl is-active tetra.service 2>/dev/null || echo 'unknown'")
                echo "tetra.service [$env]: $service_check"
            else
                echo "tetra.service [$env]: no_ssh"
            fi
            ;;
    esac
}

# Variable tracking for hierarchical TOML editing
refresh_variable_tracking() {
    # Build mapping of SYSTEM_VARIABLE_NAME to TOML locations
    if [[ -f "$ACTIVE_TOML" ]]; then
        # Extract variables that might be referenced in system
        TRACKED_VARIABLES=$(grep -o '\${[^}]*}' "$ACTIVE_TOML" 2>/dev/null | sort -u | tr '\n' ' ')

        # Build variable source map
        build_variable_source_map
    fi
}

build_variable_source_map() {
    # Create mapping of variables to their TOML source locations
    declare -gA VARIABLE_SOURCE_MAP

    if [[ ! -f "$ACTIVE_TOML" ]]; then
        return 1
    fi

    # Parse TOML and track variable definitions
    local line_num=0
    local current_section=""

    while IFS= read -r line; do
        ((line_num++))

        # Track sections
        if [[ "$line" =~ ^\[([^\]]+)\] ]]; then
            current_section="${BASH_REMATCH[1]}"
            continue
        fi

        # Track variable assignments
        if [[ "$line" =~ ^([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*=[[:space:]]*(.+)$ ]]; then
            local var_name="${BASH_REMATCH[1]}"
            local var_value="${BASH_REMATCH[2]}"

            # Build full variable path
            local var_path="$var_name"
            if [[ -n "$current_section" ]]; then
                var_path="${current_section}.${var_name}"
            fi

            # Store source location
            VARIABLE_SOURCE_MAP["$var_path"]="${ACTIVE_TOML}:${line_num}"

            # Also store uppercase version (common in environment variables)
            local var_upper=$(echo "$var_name" | tr '[:lower:]' '[:upper:]')
            VARIABLE_SOURCE_MAP["$var_upper"]="${ACTIVE_TOML}:${line_num}"
        fi
    done < "$ACTIVE_TOML"
}

# Find source-of-truth for a SYSTEM_VARIABLE_NAME
find_variable_source() {
    local var_name="$1"

    # Refresh variable tracking if not done recently
    if [[ -z "$TRACKED_VARIABLES" ]]; then
        refresh_variable_tracking
    fi

    # Check direct mapping
    if [[ -n "${VARIABLE_SOURCE_MAP[$var_name]}" ]]; then
        echo "${VARIABLE_SOURCE_MAP[$var_name]}"
        return 0
    fi

    # Check common patterns
    local patterns=(
        "${var_name,,}"  # lowercase
        "${var_name^^}"  # uppercase
        "$(echo "$var_name" | sed 's/_//g')"  # no underscores
    )

    for pattern in "${patterns[@]}"; do
        if [[ -n "${VARIABLE_SOURCE_MAP[$pattern]}" ]]; then
            echo "${VARIABLE_SOURCE_MAP[$pattern]}"
            return 0
        fi
    done

    # Search all TOML files in organization
    if [[ -d "$(dirname "$ACTIVE_TOML")" ]]; then
        local search_result=$(grep -rn "$var_name" "$(dirname "$ACTIVE_TOML")"/*.toml 2>/dev/null | head -1)
        if [[ -n "$search_result" ]]; then
            echo "$search_result" | cut -d: -f1-2
            return 0
        fi
    fi

    echo "not_found"
    return 1
}

# Multispan cursor tracking support
refresh_multispan_tracking() {
    # Initialize multispan tracking arrays
    declare -ga ACTIVE_MULTISPANS=()
    declare -gA MULTISPAN_LOCATIONS=()

    if [[ ! -f "$ACTIVE_TOML" ]]; then
        return 1
    fi

    # Track logical sections as spans
    local sections=($(grep -n '^\[' "$ACTIVE_TOML" | cut -d: -f1))

    for i in "${!sections[@]}"; do
        local start_line="${sections[$i]}"
        local end_line="${sections[$((i+1))]:-$(wc -l < "$ACTIVE_TOML")}"
        local section_name=$(sed -n "${start_line}p" "$ACTIVE_TOML" | sed 's/^\[\(.*\)\]$/\1/')

        ACTIVE_MULTISPANS+=("$section_name")
        MULTISPAN_LOCATIONS["$section_name"]="${ACTIVE_TOML}:${start_line}-${end_line}"
    done
}

# Helper functions
test_ssh_connectivity() {
    local env="$1"
    local ssh_prefix=$(get_ssh_prefix_for_env "$env")

    if [[ -n "$ssh_prefix" ]]; then
        if timeout 2 $ssh_prefix "echo 'ok'" >/dev/null 2>&1; then
            echo "connected"
        else
            echo "failed"
        fi
    else
        echo "no_config"
    fi
}

get_ssh_prefix_for_env() {
    local env="$1"

    # This would integrate with existing SSH configuration
    # For now, return basic structure
    case "$env" in
        "DEV")
            echo "ssh root@dev.pixeljamarcade.com"
            ;;
        "STAGING")
            echo "ssh root@staging.pixeljamarcade.com"
            ;;
        "PROD")
            echo "ssh root@prod.pixeljamarcade.com"
            ;;
        "QA")
            echo "ssh root@qa.pixeljamarcade.com"
            ;;
        *)
            echo ""
            ;;
    esac
}

# Micro-module dispatcher functions for TDD requirements
# These functions compose functionality from micro-modules

# Source micro-modules and module provider interface
source_micro_modules() {
    local tview_dir="$(dirname "${BASH_SOURCE[0]}")"

    # Source TOML micro-modules
    [[ -f "$tview_dir/toml/tree_builder.sh" ]] && source "$tview_dir/toml/tree_builder.sh"
    [[ -f "$tview_dir/toml/variable_tracker.sh" ]] && source "$tview_dir/toml/variable_tracker.sh"

    # Source status micro-modules
    [[ -f "$tview_dir/status/indicators.sh" ]] && source "$tview_dir/status/indicators.sh"
    [[ -f "$tview_dir/status/providers.sh" ]] && source "$tview_dir/status/providers.sh"

    # Source action micro-modules
    [[ -f "$tview_dir/actions/builders.sh" ]] && source "$tview_dir/actions/builders.sh"

    # Source context micro-modules
    [[ -f "$tview_dir/context/builders.sh" ]] && source "$tview_dir/context/builders.sh"

    # Source module provider interface
    [[ -f "$tview_dir/modules/provider_interface.sh" ]] && source "$tview_dir/modules/provider_interface.sh"

    # Discover available modules on first load
    discover_tview_modules
}

# Content generator dispatcher
content_generator() {
    local mode="${1:-$CURRENT_MODE}"
    local env="${2:-$CURRENT_ENV}"
    local item_index="${3:-$CURRENT_ITEM}"

    # Source micro-modules if not already loaded
    source_micro_modules

    case "${mode}_${env}" in
        "TOML_TETRA")
            # Load TOML editor
            if [[ -f "$TETRA_BASH/tview/toml/toml_provider.sh" ]]; then
                source "$TETRA_BASH/tview/toml/toml_provider.sh"

                cat << EOF
🔧 TOML Configuration Editor - $env Environment

📊 Status: $(get_toml_status "$env")

$(get_toml_items "$env")

⚙️  Capabilities: $(get_toml_capabilities "$env")

💡 Navigation: j/k (up/down) | Enter (expand/collapse) | / (search) | e (edit)
EOF
            else
                # Fallback to existing micro-module system
                cat << EOF
$(render_parameter_dashboard)

🌳 Hierarchical TOML Structure:
$(build_toml_tree "$item_index")

📍 Multispan Tracking:
$(render_multispan_status)

🔍 Variable Tracking:
$(render_variable_tracking)
EOF
            fi
            ;;
        "TOML_"*)
            # Load TOML provider for other environments
            if [[ -f "$TETRA_BASH/tview/toml/toml_provider.sh" ]]; then
                source "$TETRA_BASH/tview/toml/toml_provider.sh"

                cat << EOF
🔧 TOML Configuration - $env Environment

📊 Status: $(get_toml_status "$env")

$(get_toml_items "$env")

⚙️  Capabilities: $(get_toml_capabilities "$env")

🌍 Connection: $(render_connection_status "$env")
EOF
            else
                # Fallback to existing system
                cat << EOF
📄 TOML Configuration for $(colorize_env "$env" "$env")

$(build_context_info "$mode" "$env" "$item_index")

⚙️  Available Actions:
$(build_contextual_actions "$mode" "$env" "$item_index")
EOF
            fi
            ;;
        *)
            # Try generic module provider first
            local module=$(echo "$mode" | tr '[:upper:]' '[:lower:]')
            if module_supports_tview "$module"; then
                generate_module_content "$mode" "$env" "$item_index"
            else
                # Fallback to old system
                cat << EOF
🔧 $mode Mode - $env Environment

$(get_status_summary "$mode" "$env")

$(build_contextual_actions "$mode" "$env" "$item_index")

💡 Module Integration: $(get_module_integration_status "$module")
🔍 Available Modules: $(list_tview_integrated_modules | tr '\n' ' ')
EOF
            fi
            ;;
    esac
}

# Context builder dispatcher
context_builder() {
    local mode="${1:-$CURRENT_MODE}"
    local env="${2:-$CURRENT_ENV}"
    local item_index="${3:-$CURRENT_ITEM}"

    source_micro_modules
    build_context_info "$mode" "$env" "$item_index"
}

# Status provider dispatcher
status_provider() {
    local mode="${1:-$CURRENT_MODE}"
    local env="${2:-$CURRENT_ENV}"
    local detailed="${3:-false}"

    source_micro_modules

    if [[ "$detailed" == "true" ]]; then
        get_detailed_status "$mode" "$env"
    else
        get_status_summary "$mode" "$env"
    fi
}

# Action builder dispatcher
action_builder() {
    local mode="${1:-$CURRENT_MODE}"
    local env="${2:-$CURRENT_ENV}"
    local item_index="${3:-$CURRENT_ITEM}"

    source_micro_modules
    build_contextual_actions "$mode" "$env" "$item_index"
}

# Module directory tracking functions for TDD requirements

# Config monitoring for file change detection
monitor_config_changes() {
    local config_files=(
        "$ACTIVE_TOML"
        "$TETRA_DIR/tetra.toml"
        "$TETRA_DIR/orgs/$ACTIVE_ORG/org.toml"
    )

    declare -gA CONFIG_FILE_TIMESTAMPS

    for config_file in "${config_files[@]}"; do
        if [[ -f "$config_file" ]]; then
            local timestamp=$(stat -c %Y "$config_file" 2>/dev/null || stat -f %m "$config_file" 2>/dev/null || echo "0")
            CONFIG_FILE_TIMESTAMPS["$config_file"]="$timestamp"
        fi
    done
}

# Check for config file changes
check_config_changes() {
    local changed_files=()

    for config_file in "${!CONFIG_FILE_TIMESTAMPS[@]}"; do
        if [[ -f "$config_file" ]]; then
            local current_timestamp=$(stat -c %Y "$config_file" 2>/dev/null || stat -f %m "$config_file" 2>/dev/null || echo "0")
            local stored_timestamp="${CONFIG_FILE_TIMESTAMPS[$config_file]}"

            if [[ "$current_timestamp" != "$stored_timestamp" ]]; then
                changed_files+=("$config_file")
                CONFIG_FILE_TIMESTAMPS["$config_file"]="$current_timestamp"
            fi
        fi
    done

    if [[ ${#changed_files[@]} -gt 0 ]]; then
        echo "Config files changed: ${changed_files[*]}"
        return 0
    else
        return 1
    fi
}

# Initialize config monitoring on startup
init_config_monitoring() {
    monitor_config_changes
    echo "Config monitoring initialized for ${#CONFIG_FILE_TIMESTAMPS[@]} files"
}

# Track TETRA_DIR module directories
track_tetra_modules() {
    local tetra_mods_dir="$TETRA_DIR"

    if [[ ! -d "$tetra_mods_dir" ]]; then
        echo "TETRA_DIR not found: $tetra_mods_dir" >&2
        return 1
    fi

    # Track modules in TETRA_DIR structure
    local module_dirs=(
        "$tetra_mods_dir/bash"
        "$tetra_mods_dir/orgs"
        "$tetra_mods_dir/config"
        "$tetra_mods_dir/tsm"
    )

    for mod_dir in "${module_dirs[@]}"; do
        if [[ -d "$mod_dir" ]]; then
            echo "Module directory: $mod_dir"

            # Count items in directory
            local item_count=$(find "$mod_dir" -maxdepth 1 -type f -o -type d | wc -l)
            echo "  Items: $((item_count - 1))"  # Subtract 1 for the directory itself

            # Track last modification
            local last_mod=$(stat -c %Y "$mod_dir" 2>/dev/null || stat -f %m "$mod_dir" 2>/dev/null || echo "0")
            echo "  Last modified: $(date -r "$last_mod" 2>/dev/null || echo "unknown")"
        fi
    done
}

# Get module directory status
get_tetra_mods_status() {
    local tetra_bash_dir="$TETRA_BASH"
    local tetra_dir="$TETRA_DIR"

    if [[ -d "$tetra_bash_dir" ]]; then
        local module_count=$(find "$tetra_bash_dir" -maxdepth 1 -type d | wc -l)
        echo "tetra_bash_modules:$((module_count - 1))"
    else
        echo "tetra_bash_modules:0"
    fi

    if [[ -d "$tetra_dir" ]]; then
        local org_count=0
        [[ -d "$tetra_dir/orgs" ]] && org_count=$(find "$tetra_dir/orgs" -maxdepth 1 -type d | wc -l)
        echo "tetra_orgs:$((org_count - 1))"
    else
        echo "tetra_orgs:0"
    fi
}

# Load customization overrides from .customizations.toml
load_customization_overrides() {
    local customization_file

    # Look for customization file using TETRA_ACTIVE_ORG
    if [[ -n "$TETRA_ACTIVE_ORG" ]]; then
        customization_file="$TETRA_DIR/orgs/$TETRA_ACTIVE_ORG/custom.toml"
        # Fallback to old naming convention for backward compatibility
        if [[ ! -f "$customization_file" ]]; then
            customization_file="$TETRA_DIR/orgs/$TETRA_ACTIVE_ORG/${TETRA_ACTIVE_ORG}.customizations.toml"
        fi
    elif [[ -n "$ACTIVE_ORG" && "$ACTIVE_ORG" != "No active organization" ]]; then
        # Legacy fallback for old ACTIVE_ORG detection
        customization_file="$TETRA_DIR/orgs/$ACTIVE_ORG/${ACTIVE_ORG}.customizations.toml"
    else
        # Fallback to local directory
        customization_file="./customizations.toml"
    fi

    if [[ -f "$customization_file" ]]; then
        # Parse customization file with CUSTOM namespace
        if toml_parse "$customization_file" "CUSTOM" 2>/dev/null; then
            # Load SSH users arrays
            DEV_SSH_USERS=($(toml_get "ssh_users" "dev" "CUSTOM" 2>/dev/null | tr -d '[]"' | tr ',' ' '))
            STAGING_SSH_USERS=($(toml_get "ssh_users" "staging" "CUSTOM" 2>/dev/null | tr -d '[]"' | tr ',' ' '))
            PROD_SSH_USERS=($(toml_get "ssh_users" "prod" "CUSTOM" 2>/dev/null | tr -d '[]"' | tr ',' ' '))
            QA_SSH_USERS=($(toml_get "ssh_users" "qa" "CUSTOM" 2>/dev/null | tr -d '[]"' | tr ',' ' '))

            # Load SSH config preferences
            DEV_DOMAIN=$(toml_get "ssh_config" "dev_domain" "CUSTOM" 2>/dev/null || echo "")
            STAGING_DOMAIN=$(toml_get "ssh_config" "staging_domain" "CUSTOM" 2>/dev/null || echo "")
            PROD_DOMAIN=$(toml_get "ssh_config" "prod_domain" "CUSTOM" 2>/dev/null || echo "")
            QA_DOMAIN=$(toml_get "ssh_config" "qa_domain" "CUSTOM" 2>/dev/null || echo "")
            PREFER_DOMAIN_SSH=$(toml_get "ssh_config" "prefer_domain_ssh" "CUSTOM" 2>/dev/null || echo "false")

            # Load environment mapping overrides
            STAGING_SERVER_OVERRIDE=$(toml_get "environment_mapping" "staging_server_override" "CUSTOM" 2>/dev/null || echo "")
            QA_SERVER_OVERRIDE=$(toml_get "environment_mapping" "qa_server_override" "CUSTOM" 2>/dev/null || echo "")
        fi
    else
        # Set defaults if no customization file
        DEV_SSH_USERS=("root" "dev")
        STAGING_SSH_USERS=("root" "staging")
        PROD_SSH_USERS=("root" "production")
        QA_SSH_USERS=("root" "qa")
        PREFER_DOMAIN_SSH="false"
    fi

    # Apply environment mapping overrides
    apply_environment_mapping_overrides
}

# Apply environment mapping overrides (staging on prod server, etc.)
apply_environment_mapping_overrides() {
    # Handle staging_server_override = "prod_server"
    if [[ "$STAGING_SERVER_OVERRIDE" == "prod_server" ]]; then
        # Staging uses prod server's IP and hardware info, but keeps staging SSH config
        STAGING_IP="$PROD_IP"
        STAGING_PRIVATE_IP="$PROD_PRIVATE_IP"
        STAGING_REGION="$PROD_REGION"
        STAGING_SIZE="$PROD_SIZE"
        STAGING_MEMORY="$PROD_MEMORY"
        # Keep staging nickname and SSH users as configured
        # This allows staging to be a user on the prod machine
    fi

    # Handle qa_server_override if configured
    if [[ "$QA_SERVER_OVERRIDE" == "dev_server" ]]; then
        QA_IP="$DEV_IP"
        QA_PRIVATE_IP="$DEV_PRIVATE_IP"
        QA_REGION="$DEV_REGION"
        QA_SIZE="$DEV_SIZE"
        QA_MEMORY="$DEV_MEMORY"
    fi
}

load_toml_data() {
    # Source the TOML parser
    source "$TETRA_SRC/bash/utils/toml_parser.sh" 2>/dev/null || true

    # Load customization overrides if available
    load_customization_overrides

    if [[ -n "$ACTIVE_TOML" && -f "$ACTIVE_TOML" ]]; then
        # Use enhanced TOML parser for comprehensive data extraction
        if toml_parse "$ACTIVE_TOML" "TOML" 2>/dev/null; then
            # Extract infrastructure data using TOML parser
            DEV_SERVER=$(toml_get "infrastructure" "dev_server" "TOML" 2>/dev/null || grep "^dev_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DEV_IP=$(toml_get "infrastructure" "dev_ip" "TOML" 2>/dev/null || grep "^dev_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DEV_PRIVATE_IP=$(toml_get "infrastructure" "dev_private_ip" "TOML" 2>/dev/null || grep "^dev_private_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DEV_MEMORY=$(toml_get "infrastructure" "dev_memory" "TOML" 2>/dev/null || grep "^dev_memory" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DEV_REGION=$(toml_get "infrastructure" "dev_region" "TOML" 2>/dev/null || grep "^dev_region" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DEV_NICKNAME=$(toml_get "infrastructure" "dev_nickname" "TOML" 2>/dev/null || echo "dev-server")
            DEV_SSH_USER=$(toml_get "infrastructure" "dev_ssh_user" "TOML" 2>/dev/null || echo "dev")
            DEV_SIZE=$(toml_get "infrastructure" "dev_size" "TOML" 2>/dev/null || echo "Unknown")

            STAGING_SERVER=$(toml_get "infrastructure" "qa_server" "TOML" 2>/dev/null || grep "^qa_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_IP=$(toml_get "infrastructure" "qa_ip" "TOML" 2>/dev/null || grep "^qa_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_PRIVATE_IP=$(toml_get "infrastructure" "qa_private_ip" "TOML" 2>/dev/null || grep "^qa_private_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_MEMORY=$(toml_get "infrastructure" "qa_memory" "TOML" 2>/dev/null || grep "^qa_memory" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_REGION=$(toml_get "infrastructure" "qa_region" "TOML" 2>/dev/null || grep "^qa_region" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_NICKNAME=$(toml_get "infrastructure" "staging_nickname" "TOML" 2>/dev/null || toml_get "infrastructure" "qa_nickname" "TOML" 2>/dev/null || echo "staging-server")
            STAGING_SSH_USER=$(toml_get "infrastructure" "staging_ssh_user" "TOML" 2>/dev/null || echo "staging")
            STAGING_SIZE=$(toml_get "infrastructure" "staging_size" "TOML" 2>/dev/null || toml_get "infrastructure" "qa_size" "TOML" 2>/dev/null || echo "Unknown")

            PROD_SERVER=$(toml_get "infrastructure" "prod_server" "TOML" 2>/dev/null || grep "^prod_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_IP=$(toml_get "infrastructure" "prod_ip" "TOML" 2>/dev/null || grep "^prod_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_PRIVATE_IP=$(toml_get "infrastructure" "prod_private_ip" "TOML" 2>/dev/null || grep "^prod_private_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_MEMORY=$(toml_get "infrastructure" "prod_memory" "TOML" 2>/dev/null || grep "^prod_memory" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_REGION=$(toml_get "infrastructure" "prod_region" "TOML" 2>/dev/null || grep "^prod_region" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_NICKNAME=$(toml_get "infrastructure" "prod_nickname" "TOML" 2>/dev/null || echo "prod-server")
            PROD_SSH_USER=$(toml_get "infrastructure" "prod_ssh_user" "TOML" 2>/dev/null || echo "production")
            PROD_SIZE=$(toml_get "infrastructure" "prod_size" "TOML" 2>/dev/null || echo "Unknown")

            # QA Environment
            QA_SERVER=$(toml_get "infrastructure" "qa_server" "TOML" 2>/dev/null || grep "^qa_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            QA_IP=$(toml_get "infrastructure" "qa_ip" "TOML" 2>/dev/null || grep "^qa_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            QA_PRIVATE_IP=$(toml_get "infrastructure" "qa_private_ip" "TOML" 2>/dev/null || grep "^qa_private_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            QA_MEMORY=$(toml_get "infrastructure" "qa_memory" "TOML" 2>/dev/null || grep "^qa_memory" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            QA_REGION=$(toml_get "infrastructure" "qa_region" "TOML" 2>/dev/null || grep "^qa_region" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            QA_NICKNAME=$(toml_get "infrastructure" "qa_nickname" "TOML" 2>/dev/null || echo "qa-server")
            QA_SSH_USER=$(toml_get "infrastructure" "qa_ssh_user" "TOML" 2>/dev/null || echo "qa")
            QA_SIZE=$(toml_get "infrastructure" "qa_size" "TOML" 2>/dev/null || echo "Unknown")

            # Extract domain configuration - multiple fallback strategies
            DOMAIN_BASE=$(toml_get "domains" "base_domain" "TOML" 2>/dev/null || \
                         toml_get "domain" "base" "TOML" 2>/dev/null || \
                         grep "^base_domain" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || \
                         echo "pixeljamarcade.com")

            # Environment-specific domains with enhanced fallbacks
            DEV_DOMAIN=$(toml_get "environments_dev" "domain" "TOML" 2>/dev/null || \
                        toml_get "domains" "dev" "TOML" 2>/dev/null || \
                        toml_get "domain" "dev" "TOML" 2>/dev/null || \
                        echo "dev.$DOMAIN_BASE")

            STAGING_DOMAIN=$(toml_get "environments_staging" "domain" "TOML" 2>/dev/null || \
                           toml_get "domains" "staging" "TOML" 2>/dev/null || \
                           toml_get "domain" "staging" "TOML" 2>/dev/null || \
                           echo "staging.$DOMAIN_BASE")

            PROD_DOMAIN=$(toml_get "environments_prod" "domain" "TOML" 2>/dev/null || \
                         toml_get "domains" "prod" "TOML" 2>/dev/null || \
                         toml_get "domain" "prod" "TOML" 2>/dev/null || \
                         echo "$DOMAIN_BASE")

            # Organization metadata
            ORG_NAME=$(toml_get "metadata" "name" "TOML" 2>/dev/null || \
                      toml_get "org" "name" "TOML" 2>/dev/null || \
                      echo "Unknown")
            ORG_TYPE=$(toml_get "metadata" "type" "TOML" 2>/dev/null || echo "standard")
            ORG_PROVIDER=$(toml_get "infrastructure" "provider" "TOML" 2>/dev/null || \
                          toml_get "org" "provider" "TOML" 2>/dev/null || echo "Unknown")

            # Check for shared infrastructure scenarios
            SHARED_IP_MODE="false"
            if [[ "$DEV_IP" == "$STAGING_IP" && "$STAGING_IP" == "$PROD_IP" && "$DEV_IP" != "Unknown" ]]; then
                SHARED_IP_MODE="true"
                SHARED_IP="$DEV_IP"
            fi

            # Extract port and service configuration
            LOCAL_DOMAIN="localhost"
            LOCAL_PORT=$(toml_get "environments_local" "app_port" "TOML" 2>/dev/null || \
                        toml_get "services_app_dev" "port" "TOML" 2>/dev/null || \
                        grep "^app_port" "$ACTIVE_TOML" | cut -d'=' -f2 | tr -d ' ' 2>/dev/null || echo "3000")
            LOCAL_NODE_ENV=$(toml_get "environments_local" "node_env" "TOML" 2>/dev/null || echo "development")
            LOCAL_DATA_DIR=$(toml_get "paths" "data" "TOML" 2>/dev/null || echo "/home/dev/pj/pd")
            LOCAL_SERVICE_CONFIG=$(toml_get "services_app_dev" "start_command" "TOML" 2>/dev/null || echo "npm run dev")

            # Extract services information
            SERVICES_TYPE=$(toml_get "services_app" "type" "TOML" 2>/dev/null || echo "nodejs")
            SERVICES_ENVIRONMENTS=$(toml_get "services_app" "environments" "TOML" 2>/dev/null | tr -d '[]"' | tr ',' ' ' || echo "dev staging prod")

            # Extract additional configuration sections
            TOML_SECTIONS=""
            if command -v toml_sections >/dev/null 2>&1; then
                TOML_SECTIONS=$(toml_sections "TOML" | tr '\n' ' ')
            fi

            TOML_SYNC_STATUS="Enhanced TOML data loaded"
        else
            # Fallback to basic grep parsing
            DEV_SERVER=$(grep "^dev_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DEV_IP=$(grep "^dev_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_SERVER=$(grep "^qa_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            STAGING_IP=$(grep "^qa_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_SERVER=$(grep "^prod_server" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            PROD_IP=$(grep "^prod_ip" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
            DOMAIN_BASE=$(grep "^domain_base" "$ACTIVE_TOML" | cut -d'"' -f2 2>/dev/null || echo "pixeljamarcade.com")
            LOCAL_PORT=$(grep "^default_port" "$ACTIVE_TOML" | awk '{print $3}' 2>/dev/null || echo "3000")

            DEV_DOMAIN="dev.$DOMAIN_BASE"
            STAGING_DOMAIN="staging.$DOMAIN_BASE"
            PROD_DOMAIN="$DOMAIN_BASE"
            LOCAL_DOMAIN="localhost"
            LOCAL_NODE_ENV="development"
            LOCAL_DATA_DIR="/home/dev/pj/pd"
            LOCAL_SERVICE_CONFIG="npm run dev"
            ORG_PROVIDER="Unknown"
            SERVICES_TYPE="nodejs"
            SERVICES_ENVIRONMENTS="dev staging prod"

            TOML_SYNC_STATUS="Basic TOML parsing"
        fi
    else
        # Set defaults when no TOML
        DEV_SERVER="Unknown"
        DEV_IP="Unknown"
        STAGING_SERVER="Unknown"
        STAGING_IP="Unknown"
        PROD_SERVER="Unknown"
        PROD_IP="Unknown"
        TOML_SYNC_STATUS="No TOML file - use NH_ variables or create TOML"
        LOCAL_DOMAIN="localhost"
        LOCAL_PORT="3000"
        LOCAL_NODE_ENV="development"
        LOCAL_DATA_DIR="/home/dev/pj/pd"
        LOCAL_SERVICE_CONFIG="npm run dev"
        DOMAIN_BASE="localhost"
        DEV_DOMAIN="localhost"
        STAGING_DOMAIN="localhost"
        PROD_DOMAIN="localhost"
        TOML_SECTIONS=""
        ORG_PROVIDER="Unknown"
        SERVICES_TYPE="nodejs"
        SERVICES_ENVIRONMENTS="dev staging prod"
    fi
}

load_ssh_connectivity() {
    # Load SSH status from background cache (instant)
    get_cached_ssh_status

    # Set fallbacks if no IP configured
    if [[ "$DEV_IP" == "Unknown" || -z "$DEV_IP" ]]; then
        DEV_SSH_STATUS="○ No IP"
    fi
    if [[ "$STAGING_IP" == "Unknown" || -z "$STAGING_IP" ]]; then
        STAGING_SSH_STATUS="○ No IP"
    fi
    if [[ "$PROD_IP" == "Unknown" || -z "$PROD_IP" ]]; then
        PROD_SSH_STATUS="○ No IP"
    fi
    if [[ "$QA_IP" == "Unknown" || -z "$QA_IP" ]]; then
        QA_SSH_STATUS="○ No IP"
    fi
}

load_environment_data() {
    # Load TSM data
    if command -v tsm >/dev/null 2>&1; then
        TSM_SERVICES=$(tsm list 2>/dev/null | tail -n +3 || echo "")
        TSM_COUNT_RUNNING=$(echo "$TSM_SERVICES" | grep -c "online" 2>/dev/null || echo "0")
        TSM_COUNT_STOPPED=$(echo "$TSM_SERVICES" | grep -c "stopped\|offline" 2>/dev/null || echo "0")
    else
        TSM_SERVICES=""
        TSM_COUNT_RUNNING=0
        TSM_COUNT_STOPPED=0
    fi

    # Load Git data
    if git rev-parse --git-dir >/dev/null 2>&1; then
        GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
        GIT_STATUS=$(git status --porcelain 2>/dev/null)
        if [[ -z "$GIT_STATUS" ]]; then
            GIT_CLEAN="✓"
        else
            GIT_CLEAN="✗"
        fi
    else
        GIT_BRANCH="main"
        GIT_CLEAN="○"
    fi

    # Load Organization data
    if [[ -f "$TETRA_DIR/config/tetra.toml" ]]; then
        # Try to extract active organization from symlink target
        local toml_target=$(readlink "$TETRA_DIR/config/tetra.toml" 2>/dev/null)
        if [[ -n "$toml_target" ]]; then
            ACTIVE_ORG=$(basename "$(dirname "$toml_target")")
        else
            ACTIVE_ORG="Local Project"
        fi
    else
        ACTIVE_ORG="No active organization"
    fi

    # Count total organizations
    if [[ -d "$TETRA_DIR/orgs" ]]; then
        TOTAL_ORGS=$(find "$TETRA_DIR/orgs" -maxdepth 1 -type d | wc -l)
        TOTAL_ORGS=$((TOTAL_ORGS - 1)) # Subtract 1 for the orgs directory itself
    else
        TOTAL_ORGS=0
    fi

    # Set other defaults
    SSH_AGENT_STATUS="Unknown"
    TKM_KEY_COUNT="Unknown"
    TKM_KNOWN_HOSTS_COUNT="Unknown"
    DEPLOY_READINESS="Unknown"
    BUILD_STATUS="Unknown"
    ORG_STATUS="Ready"
    DEV_ORG_SYNC="Unknown"
    STAGING_ORG_SYNC="Unknown"
    PROD_ORG_SYNC="Unknown"
}

# Helper functions for TOML structure display
show_toml_structure() {
    if [[ -n "$ACTIVE_TOML" && -f "$ACTIVE_TOML" ]]; then
        echo "  ├─ [metadata] - Organization info"
        echo "  ├─ [infrastructure] - Server configs"
        echo "  ├─ [domains] - Domain mappings"
        echo "  ├─ [services] - App configurations"
        echo "  └─ [environments] - Env-specific settings"
    else
        echo "  └─ No TOML structure available"
    fi
}

show_services_summary() {
    if [[ -n "$ACTIVE_TOML" && -f "$ACTIVE_TOML" ]]; then
        echo "  ├─ Type: ${SERVICES_TYPE:-nodejs}"
        echo "  ├─ Environments: ${SERVICES_ENVIRONMENTS:-dev staging prod}"
        echo "  └─ Config: service ports, commands, env files"
    else
        echo "  └─ No services configuration"
    fi
}

show_local_services_config() {
    echo "  ├─ Start Command: ${LOCAL_SERVICE_CONFIG:-npm run dev}"
    echo "  ├─ Environment File: env/dev.env"
    echo "  └─ Process Management: TSM (Tetra Service Manager)"
}