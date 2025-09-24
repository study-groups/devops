#!/usr/bin/env bash

# TOML TView Action Handler
# Implements standard TView action interface for TOML editing

# Load TOML provider
TOML_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$TOML_DIR/toml_provider.sh"

# Standard interface: handle_module_action()
handle_toml_action() {
    local action="$1"
    local env="${2:-$CURRENT_ENV}"
    shift 2
    local args=("$@")

    case "$action" in
        "navigate")
            handle_toml_navigate "${args[0]}"
            ;;
        "expand")
            handle_toml_expand "${args[0]}"
            ;;
        "edit")
            handle_toml_edit "${args[0]}" "${args[1]}" "${args[2]}"
            ;;
        "search")
            handle_toml_search "${args[0]}"
            ;;
        "add_variable"|"add")
            handle_toml_add_variable "${args[0]}" "${args[1]}" "${args[2]}"
            ;;
        "save")
            handle_toml_save "${args[0]}"
            ;;
        "view")
            handle_toml_view "$env" "${args[@]}"
            ;;
        "compare")
            handle_toml_compare "$env" "${args[@]}"
            ;;
        "deploy")
            handle_toml_deploy "$env" "${args[@]}"
            ;;
        "validate")
            handle_toml_validate "$env" "${args[@]}"
            ;;
        "refresh")
            handle_toml_refresh "$env" "${args[@]}"
            ;;
        *)
            echo "Unknown TOML action: $action"
            echo "Available actions: $(get_toml_capabilities "$env")"
            return 1
            ;;
    esac
}

# Environment-specific action handlers

handle_toml_view() {
    local env="$1"
    shift
    local args=("$@")

    echo "📄 Viewing TOML configuration for $env"
    echo ""
    get_toml_items "$env"
}

handle_toml_compare() {
    local env="$1"
    local compare_file="${2:-}"

    echo "🔍 Comparing TOML configurations"
    echo ""

    if [[ -n "$compare_file" && -f "$compare_file" ]]; then
        echo "Comparing $ACTIVE_TOML with $compare_file"
        echo "💡 Implementation: Use diff or specialized TOML comparison"
    else
        echo "Usage: compare <file_to_compare>"
        return 1
    fi
}

handle_toml_deploy() {
    local env="$1"
    shift
    local args=("$@")

    echo "🚀 Deploying TOML configuration to $env"
    echo ""

    case "$env" in
        "DEV"|"STAGING"|"PROD"|"QA")
            echo "Would deploy to $env environment:"
            echo "  📄 Source: $ACTIVE_TOML"
            echo "  🎯 Target: $env environment configuration"
            echo "💡 Implementation: Copy/sync TOML to remote environment"
            ;;
        *)
            echo "Cannot deploy from $env environment"
            return 1
            ;;
    esac
}

handle_toml_validate() {
    local env="$1"
    local toml_file="${2:-$ACTIVE_TOML}"

    echo "✅ Validating TOML configuration"
    echo ""

    if [[ ! -f "$toml_file" ]]; then
        echo "❌ TOML file not found: $toml_file"
        return 1
    fi

    local validation_errors=0
    local validation_warnings=0

    # Check TOML syntax
    if command -v toml >/dev/null 2>&1; then
        if ! toml validate "$toml_file" >/dev/null 2>&1; then
            echo "❌ TOML syntax error detected"
            ((validation_errors++))
        else
            echo "✅ TOML syntax is valid"
        fi
    else
        echo "⚠️  TOML validator not available (install 'toml' CLI)"
        ((validation_warnings++))
    fi

    # Validate variable values
    echo ""
    echo "🔍 Validating variable values:"

    while IFS= read -r line; do
        if [[ "$line" =~ ^[[:space:]]*([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*=[[:space:]]*(.+)$ ]]; then
            local var_name="${BASH_REMATCH[1]}"
            local var_value="${BASH_REMATCH[2]}"

            local validation_result
            validation_result=$(validate_toml_value "$var_value")

            if [[ "$validation_result" == "valid" ]]; then
                echo "  ✅ $var_name = $var_value"
            else
                echo "  ⚠️  $var_name = $var_value (format warning)"
                ((validation_warnings++))
            fi
        fi
    done < "$toml_file"

    echo ""
    if [[ $validation_errors -eq 0 ]]; then
        echo "✅ TOML validation completed successfully"
        if [[ $validation_warnings -gt 0 ]]; then
            echo "⚠️  $validation_warnings warnings found"
        fi
        return 0
    else
        echo "❌ $validation_errors errors, $validation_warnings warnings"
        return 1
    fi
}

handle_toml_refresh() {
    local env="$1"
    local toml_file="${2:-$ACTIVE_TOML}"

    echo "🔄 Refreshing TOML configuration"
    echo ""

    if [[ -f "$toml_file" ]]; then
        # Reinitialize cursor navigation
        init_toml_cursor "$toml_file" >/dev/null 2>&1

        # Reset expansion states
        for section in "${ACTIVE_MULTISPANS[@]}"; do
            SECTION_EXPANDED["$section"]=false
        done

        echo "✅ Refreshed TOML configuration: $(basename "$toml_file")"
        echo "📊 Loaded ${#ACTIVE_MULTISPANS[@]} sections"
        return 0
    else
        echo "❌ Cannot refresh - TOML file not found: $toml_file"
        return 1
    fi
}

# Quick action shortcuts
toml_j() { handle_toml_action "navigate" "$CURRENT_ENV" "down"; }
toml_k() { handle_toml_action "navigate" "$CURRENT_ENV" "up"; }
toml_enter() { handle_toml_action "expand" "$CURRENT_ENV"; }
toml_search() { handle_toml_action "search" "$CURRENT_ENV" "$1"; }
toml_edit() { handle_toml_action "edit" "$CURRENT_ENV" "$1" "$2" "$3"; }