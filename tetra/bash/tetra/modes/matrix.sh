#!/usr/bin/env bash
# Tetra Mode Matrix
# Central Env×Mode → Module mapping system
# Enforces [Context] Env × Mode → action:noun pattern

# ============================================================================
# ENV×MODE MATRIX
# ============================================================================

# Matrix maps Environment × Mode → Module list
declare -gA MODE_MATRIX=(
    # Local environment
    ["Local:Inspect"]="org logs tds"
    ["Local:Transfer"]="org deploy"
    ["Local:Execute"]="org tsm"

    # Dev environment
    ["Dev:Inspect"]="org tsm logs"
    ["Dev:Transfer"]="org deploy"
    ["Dev:Execute"]="tsm deploy"

    # Staging environment
    ["Staging:Inspect"]="org logs"
    ["Staging:Transfer"]="deploy"
    ["Staging:Execute"]="deploy"

    # Production environment
    ["Production:Inspect"]="org logs"
    ["Production:Transfer"]="deploy"
    ["Production:Execute"]="deploy"
)

# Module temperature (TDS theme) mapping
declare -gA MODULE_TEMPERATURE=(
    ["org"]="warm"        # Amber/orange
    ["tsm"]="neutral"     # Green/gray
    ["logs"]="cool"       # Blue/cyan
    ["deploy"]="electric" # Purple/magenta
    ["tds"]="electric"    # Purple/magenta (design/creative)
)

# Module unicode markers
declare -gA MODULE_MARKER=(
    ["org"]="⁘"      # Four dot punctuation
    ["tsm"]="◇"      # White diamond
    ["logs"]="●"     # Black circle
    ["deploy"]="◉"   # Fisheye
    ["tds"]="◉"      # Filled circle (color swatch)
)

# ============================================================================
# MATRIX QUERIES
# ============================================================================

# Get modules for a given environment and mode
get_modules_for_context() {
    local env="$1"
    local mode="$2"
    local key="${env}:${mode}"

    echo "${MODE_MATRIX[$key]:-}"
}

# Get temperature (TDS theme) for a module
get_module_temperature() {
    local module="$1"
    echo "${MODULE_TEMPERATURE[$module]:-default}"
}

# Get marker for a module
get_module_marker() {
    local module="$1"
    echo "${MODULE_MARKER[$module]:-⁘}"
}

# Check if module is valid for context
is_module_valid_for_context() {
    local module="$1"
    local env="$2"
    local mode="$3"

    local modules=$(get_modules_for_context "$env" "$mode")

    [[ " $modules " =~ " $module " ]]
}

# ============================================================================
# ACTION AGGREGATION
# ============================================================================

# Get all actions for a context (aggregated from modules)
get_actions_for_context() {
    local env="$1"
    local mode="$2"
    local modules=$(get_modules_for_context "$env" "$mode")

    local actions=""

    for module in $modules; do
        # Call module's action discovery function
        if declare -f "${module}_get_actions" >/dev/null 2>&1; then
            local module_actions=$(${module}_get_actions "$env" "$mode")
            actions+=" $module_actions"
        fi
    done

    # Return trimmed action list
    echo "$actions" | xargs
}

# Get action list with module attribution
get_actions_with_modules() {
    local env="$1"
    local mode="$2"
    local modules=$(get_modules_for_context "$env" "$mode")

    for module in $modules; do
        if declare -f "${module}_get_actions" >/dev/null 2>&1; then
            local module_actions=$(${module}_get_actions "$env" "$mode")
            for action in $module_actions; do
                echo "$action:$module"
            done
        fi
    done
}

# ============================================================================
# MODULE DISCOVERY
# ============================================================================

# Get which module handles a specific action
get_module_for_action() {
    local action="$1"
    local env="$2"
    local mode="$3"

    get_actions_with_modules "$env" "$mode" | while read -r line; do
        local act="${line%%:*}"
        local mod="${line##*:}"
        if [[ "$act" == "$action" ]]; then
            echo "$mod"
            return 0
        fi
    done
}

# ============================================================================
# MATRIX VISUALIZATION
# ============================================================================

# Display matrix for debugging
show_matrix() {
    local format="${1:-table}"  # table, simple, json

    case "$format" in
        table)
            echo "Environment × Mode Matrix:"
            echo
            printf "%-15s %-12s %s\n" "Environment" "Mode" "Modules"
            printf "%-15s %-12s %s\n" "-----------" "----" "-------"

            for key in "${!MODE_MATRIX[@]}"; do
                local env="${key%%:*}"
                local mode="${key##*:}"
                local modules="${MODE_MATRIX[$key]}"
                printf "%-15s %-12s %s\n" "$env" "$mode" "$modules"
            done | sort
            ;;

        simple)
            for key in "${!MODE_MATRIX[@]}"; do
                echo "$key → ${MODE_MATRIX[$key]}"
            done | sort
            ;;

        json)
            echo "{"
            local first=true
            for key in "${!MODE_MATRIX[@]}"; do
                if [[ "$first" == "true" ]]; then
                    first=false
                else
                    echo ","
                fi
                echo -n "  \"$key\": \"${MODE_MATRIX[$key]}\""
            done
            echo
            echo "}"
            ;;
    esac
}

# Show module temperature map
show_temperatures() {
    echo "Module Temperatures:"
    echo
    printf "%-10s %-12s %s\n" "Module" "Temperature" "Marker"
    printf "%-10s %-12s %s\n" "------" "-----------" "------"

    for module in "${!MODULE_TEMPERATURE[@]}"; do
        local temp="${MODULE_TEMPERATURE[$module]}"
        local marker="${MODULE_MARKER[$module]}"
        printf "%-10s %-12s %s\n" "$module" "$temp" "$marker"
    done | sort
}

# ============================================================================
# TES INTEGRATION
# ============================================================================

# Validate action follows verb:noun pattern
validate_action_format() {
    local action="$1"

    if [[ "$action" =~ ^[a-z]+:[a-z]+$ ]]; then
        return 0
    else
        echo "Error: Action must follow verb:noun pattern: $action" >&2
        return 1
    fi
}

# Get TES target for environment
get_tes_target_for_env() {
    local env="$1"

    case "$env" in
        Local)
            echo "@local"
            ;;
        Dev)
            echo "@dev"
            ;;
        Staging)
            echo "@staging"
            ;;
        Production)
            echo "@prod"
            ;;
        *)
            echo "@local"
            ;;
    esac
}

# ============================================================================
# EXPORT
# ============================================================================

export -f get_modules_for_context
export -f get_module_temperature
export -f get_module_marker
export -f is_module_valid_for_context
export -f get_actions_for_context
export -f get_actions_with_modules
export -f get_module_for_action
export -f show_matrix
export -f show_temperatures
export -f validate_action_format
export -f get_tes_target_for_env
