#!/usr/bin/env bash

# TUI Initialization Module
# Responsibility: Module loading, path resolution, and system initialization
# Single responsibility: Bootstrap TUI system with proper module loading

# Determine the TUI modules directory using path tricks
get_tui_modules_path() {
    # Use BASH_SOURCE to find this script's directory
    local init_script_dir="$(dirname "${BASH_SOURCE[0]}")"

    # This script is in modules/, so modules/ is current directory
    echo "$init_script_dir"
}

# Get the demo directory (parent of modules/)
get_tui_demo_path() {
    local modules_dir="$(get_tui_modules_path)"
    echo "$(dirname "$modules_dir")"
}

# Source a TUI module with path resolution
# Usage: source_tui_module "module_name.sh"
source_tui_module() {
    local module_name="$1"
    local modules_path="$(get_tui_modules_path)"
    local module_path="$modules_path/$module_name"

    if [[ -f "$module_path" ]]; then
        source "$module_path"
        return 0
    else
        echo "Warning: TUI module not found: $module_path" >&2
        return 1
    fi
}

# Source a submodule (e.g., colors/color_module.sh)
# Usage: source_tui_submodule "colors/color_module.sh"
source_tui_submodule() {
    local submodule_path="$1"
    local modules_path="$(get_tui_modules_path)"
    local full_path="$modules_path/$submodule_path"

    if [[ -f "$full_path" ]]; then
        source "$full_path"
        return 0
    else
        echo "Warning: TUI submodule not found: $full_path" >&2
        return 1
    fi
}

# Initialize all core TUI modules in proper order
init_tui_system() {
    local modules_path="$(get_tui_modules_path)"

    echo "Initializing TUI system from: $modules_path"

    # Load modules in dependency order
    local modules_to_load=(
        "typography.sh"                  # Typography and visual design tokens
        "colors/color_module.sh"         # Color system (consolidated)
        "separators.sh"                  # Separator generation
        "tui_tokens.sh"                  # Semantic design tokens
        "tui_format.sh"                  # Rich text and paragraph formatting
        "handle_arrow.sh"                # Arrow key handling
        "event_system.sh"                # Pure pub/sub event system
        "tui_view.sh"                    # View layer with event subscribers
        "display_sync.sh"                # Display synchronization via events
    )

    local failed_modules=()

    for module in "${modules_to_load[@]}"; do
        if [[ "$module" == */* ]]; then
            # Submodule
            if ! source_tui_submodule "$module"; then
                failed_modules+=("$module")
            fi
        else
            # Direct module
            if ! source_tui_module "$module"; then
                failed_modules+=("$module")
            fi
        fi
    done

    # Report initialization status
    if [[ ${#failed_modules[@]} -eq 0 ]]; then
        echo "TUI system initialized successfully"
        return 0
    else
        echo "TUI system initialization completed with errors:"
        printf "  Failed to load: %s\n" "${failed_modules[@]}"
        return 1
    fi
}

# Get available TUI modules list
list_tui_modules() {
    local modules_path="$(get_tui_modules_path)"
    echo "Available TUI modules in: $modules_path"

    # List direct modules
    find "$modules_path" -maxdepth 1 -name "*.sh" -not -name "tui_init.sh" | while read -r module_path; do
        echo "  $(basename "$module_path")"
    done

    # List submodules
    find "$modules_path" -mindepth 2 -name "*.sh" | while read -r module_path; do
        echo "  $(realpath --relative-to="$modules_path" "$module_path")"
    done
}

# Validate TUI environment
validate_tui_environment() {
    local modules_path="$(get_tui_modules_path)"

    echo "TUI Environment Validation:"
    echo "  Modules path: $modules_path"
    echo "  Demo path: $(get_tui_demo_path)"

    # Check critical modules exist
    local critical_modules=(
        "typography.sh"
        "colors/color_module.sh"
        "handle_arrow.sh"
    )

    local missing_modules=()
    for module in "${critical_modules[@]}"; do
        local full_path="$modules_path/$module"
        if [[ ! -f "$full_path" ]]; then
            missing_modules+=("$module")
        fi
    done

    if [[ ${#missing_modules[@]} -eq 0 ]]; then
        echo "  Status: ✓ All critical modules found"
        return 0
    else
        echo "  Status: ✗ Missing critical modules:"
        printf "    %s\n" "${missing_modules[@]}"
        return 1
    fi
}

# Initialize TUI paths and basic environment
init_tui_paths() {
    # Set global path variables for other modules to use
    export TUI_MODULES_PATH="$(get_tui_modules_path)"
    export TUI_DEMO_PATH="$(get_tui_demo_path)"

    # Add modules path to a search path if needed
    # This allows other scripts to source modules easily
    export TUI_MODULE_SEARCH_PATH="$TUI_MODULES_PATH"
}

# Call path initialization automatically when sourced
init_tui_paths