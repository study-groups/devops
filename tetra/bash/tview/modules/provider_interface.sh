#!/usr/bin/env bash

# Generic Module Provider Interface for TView
# Standard interface that any module can implement for TView integration

# Global tracking of TView-integrated modules
declare -ga TVIEW_INTEGRATED_MODULES=()

# Discover all modules with TView integration
discover_tview_modules() {
    TVIEW_INTEGRATED_MODULES=()

    if [[ ! -d "$TETRA_BASH" ]]; then
        echo "TETRA_BASH directory not found: $TETRA_BASH" >&2
        return 1
    fi

    for module_dir in "$TETRA_BASH"/*/; do
        [[ -d "$module_dir" ]] || continue

        local module_name=$(basename "$module_dir")
        local tview_integration="$module_dir/tview"

        if [[ -d "$tview_integration" ]]; then
            TVIEW_INTEGRATED_MODULES+=("$module_name")

            # Optional: Pre-load module capabilities for faster access
            cache_module_capabilities "$module_name"
        fi
    done

    # Export for use in other functions
    export TVIEW_INTEGRATED_MODULES
}

# Cache module capabilities for performance
cache_module_capabilities() {
    local module="$1"
    local providers_file="$TETRA_BASH/$module/tview/providers.sh"

    if [[ -f "$providers_file" ]]; then
        # Could cache capabilities here if needed for performance
        # For now, we'll load dynamically
        return 0
    fi
}

# Check if a module supports TView integration
module_supports_tview() {
    local module="$1"

    [[ -d "$TETRA_BASH/$module/tview" && -f "$TETRA_BASH/$module/tview/providers.sh" ]]
}

# Call any module's provider function with standard interface
call_module_provider() {
    local module="$1"
    local function="$2"
    shift 2
    local args=("$@")

    # Validate module exists and has TView integration
    if ! module_supports_tview "$module"; then
        echo "Module '$module' has no TView integration"
        return 1
    fi

    local module_providers="$TETRA_BASH/$module/tview/providers.sh"

    # Source the module's providers in a subshell to avoid pollution
    (
        source "$module_providers"

        # Call the requested function if it exists
        if declare -f "$function" >/dev/null; then
            "$function" "${args[@]}"
        else
            echo "Function '$function' not implemented in module '$module'"
            return 1
        fi
    )
}

# Generic content generation using module providers
generate_module_content() {
    local mode="${1:-$CURRENT_MODE}"
    local env="${2:-$CURRENT_ENV}"
    local item_index="${3:-$CURRENT_ITEM}"

    # Convert mode to module name (TSM->tsm, TKM->tkm, etc.)
    local module=$(echo "$mode" | tr '[:upper:]' '[:lower:]')

    if ! module_supports_tview "$module"; then
        cat << EOF
🔧 $mode Module - $env Environment

❌ No TView integration available for $module module
💡 Module needs to implement standard provider interface

Available modules: $(list_tview_integrated_modules | tr '\n' ' ')
EOF
        return 1
    fi

    # Generate content using module's providers
    local status=$(call_module_provider "$module" "get_module_status" "$env" 2>/dev/null || echo "unknown")
    local capabilities=$(call_module_provider "$module" "get_module_capabilities" "$env" 2>/dev/null || echo "none")

    cat << EOF
🔧 $mode Module - $env Environment

📊 Status: $status

📋 Available Items:
$(call_module_provider "$module" "get_module_items" "$env" 2>/dev/null || echo "  No items available")

⚙️  Capabilities: $capabilities

💡 Actions: $(generate_module_actions "$module" "$env" "$capabilities")
EOF
}

# Generate actions based on module capabilities
generate_module_actions() {
    local module="$1"
    local env="$2"
    local capabilities="$3"

    local actions=""

    # Convert comma-separated capabilities to action list
    IFS=',' read -ra caps <<< "$capabilities"
    for cap in "${caps[@]}"; do
        case "$(echo "$cap" | xargs)" in  # xargs trims whitespace
            "start")
                actions+="${ACTION_SERVICE_COLOR}▸${COLOR_RESET} Start $module services\n"
                ;;
            "stop")
                actions+="${ACTION_SERVICE_COLOR}▸${COLOR_RESET} Stop $module services\n"
                ;;
            "restart")
                actions+="${ACTION_SERVICE_COLOR}▸${COLOR_RESET} Restart $module services\n"
                ;;
            "logs")
                actions+="${ACTION_VIEW_COLOR}▸${COLOR_RESET} View $module logs\n"
                ;;
            "connect")
                actions+="${ACTION_SSH_COLOR}▸${COLOR_RESET} Connect to $env\n"
                ;;
            "deploy")
                actions+="${ACTION_DEPLOY_COLOR}▸${COLOR_RESET} Deploy $module to $env\n"
                ;;
            "generate")
                actions+="${ACTION_CONFIG_COLOR}▸${COLOR_RESET} Generate $module resources\n"
                ;;
            "edit")
                actions+="${ACTION_EDIT_COLOR}▸${COLOR_RESET} Edit $module configuration\n"
                ;;
            *)
                actions+="${ACTION_VIEW_COLOR}▸${COLOR_RESET} $cap\n"
                ;;
        esac
    done

    echo -e "$actions"
}

# Execute module action
execute_module_action() {
    local module="$1"
    local action="$2"
    local env="${3:-$CURRENT_ENV}"
    shift 3
    local args=("$@")

    if ! module_supports_tview "$module"; then
        echo "Module '$module' has no TView integration"
        return 1
    fi

    # Try to call module's action handler
    local module_actions="$TETRA_BASH/$module/tview/actions.sh"

    if [[ -f "$module_actions" ]]; then
        (
            source "$module_actions"

            # Call handle_module_action if it exists
            if declare -f "handle_module_action" >/dev/null; then
                handle_module_action "$action" "$env" "${args[@]}"
            else
                echo "Action handler not implemented in module '$module'"
                return 1
            fi
        )
    else
        echo "No action handler available for module '$module'"
        return 1
    fi
}

# List all modules with TView integration
list_tview_integrated_modules() {
    if [[ ${#TVIEW_INTEGRATED_MODULES[@]} -eq 0 ]]; then
        discover_tview_modules
    fi

    for module in "${TVIEW_INTEGRATED_MODULES[@]}"; do
        echo "$module"
    done
}

# Get module integration status
get_module_integration_status() {
    local module="$1"

    if module_supports_tview "$module"; then
        local providers_exist=$([[ -f "$TETRA_BASH/$module/tview/providers.sh" ]] && echo "true" || echo "false")
        local actions_exist=$([[ -f "$TETRA_BASH/$module/tview/actions.sh" ]] && echo "true" || echo "false")
        local renderers_exist=$([[ -f "$TETRA_BASH/$module/tview/renderers.sh" ]] && echo "true" || echo "false")

        echo "integrated:true,providers:$providers_exist,actions:$actions_exist,renderers:$renderers_exist"
    else
        echo "integrated:false"
    fi
}

# Validate module provider interface implementation
validate_module_interface() {
    local module="$1"

    if ! module_supports_tview "$module"; then
        echo "❌ Module '$module' has no TView integration"
        return 1
    fi

    local providers_file="$TETRA_BASH/$module/tview/providers.sh"
    local required_functions=(
        "get_module_items"
        "get_module_status"
        "get_module_capabilities"
    )

    local missing_functions=()

    # Source and check for required functions
    (
        source "$providers_file"

        for func in "${required_functions[@]}"; do
            if ! declare -f "$func" >/dev/null; then
                missing_functions+=("$func")
            fi
        done

        if [[ ${#missing_functions[@]} -eq 0 ]]; then
            echo "✅ Module '$module' implements complete provider interface"
        else
            echo "⚠️  Module '$module' missing functions: ${missing_functions[*]}"
        fi
    )
}