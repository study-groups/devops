#!/usr/bin/env bash
# TDS Modules Commands - Manage per-module color configs

# List all registered modules with color configs
tds_modules_list() {
    local verbose="${1:-}"

    echo
    echo "=== TDS Registered Modules ==="
    echo

    if [[ ${#_TDS_MODULE_CONFIGS[@]} -eq 0 ]]; then
        echo "  No modules registered."
        echo
        echo "  Modules register via:"
        echo "    tds_module_register \"modname\" \"\$MOD_DIR/config/colors.conf\" MOD_COLOR_TOKENS"
        echo
        return
    fi

    printf "  %-10s %-8s %-8s %s\n" "MODULE" "TOKENS" "CONFIG" "PATH"
    printf "  %-10s %-8s %-8s %s\n" "----------" "--------" "--------" "--------------------------------"

    for module in $(printf '%s\n' "${!_TDS_MODULE_CONFIGS[@]}" | sort); do
        local config_file="${_TDS_MODULE_CONFIGS[$module]}"
        local array_name="${_TDS_MODULE_ARRAYS[$module]}"
        local token_count=0
        local config_status="missing"

        if [[ -n "$array_name" ]]; then
            local -n tokens="$array_name" 2>/dev/null
            token_count=${#tokens[@]}
        fi

        [[ -f "$config_file" ]] && config_status="exists"

        printf "  %-10s %-8s %-8s" "$module" "$token_count" "$config_status"

        local path_display="$config_file"
        [[ "$config_file" == "$HOME"* ]] && path_display="~${config_file#$HOME}"
        printf " %s\n" "$path_display"
    done

    echo

    if [[ "$verbose" == "-v" || "$verbose" == "--verbose" ]]; then
        echo "-- Commands --"
        echo "  tds modules list           List registered modules"
        echo "  tds modules show <mod>     Show module's color tokens"
        echo "  tds modules edit <mod>     Edit module's color config"
        echo "  tds modules init <mod>     Create default config file"
        echo "  tds modules reload <mod>   Reload config from file"
        echo
    fi
}

# Show a specific module's colors
tds_modules_show() {
    local module="$1"

    if [[ -z "$module" ]]; then
        echo "Usage: tds modules show <module>"
        echo "Registered: $(printf '%s ' "${!_TDS_MODULE_CONFIGS[@]}")"
        return 1
    fi

    if [[ -z "${_TDS_MODULE_CONFIGS[$module]}" ]]; then
        echo "Module '$module' not registered"
        echo "Registered: $(printf '%s ' "${!_TDS_MODULE_CONFIGS[@]}")"
        return 1
    fi

    tds_module_show "$module"
}

# Edit a module's color config
tds_modules_edit() {
    local module="$1"

    if [[ -z "$module" ]]; then
        echo "Usage: tds modules edit <module>"
        echo "Registered: $(printf '%s ' "${!_TDS_MODULE_CONFIGS[@]}")"
        return 1
    fi

    local config_file="${_TDS_MODULE_CONFIGS[$module]}"
    if [[ -z "$config_file" ]]; then
        echo "Module '$module' not registered"
        return 1
    fi

    # Create default config if missing
    if [[ ! -f "$config_file" ]]; then
        tds_module_save "$module" >/dev/null
        echo "Created: $config_file"
    fi

    ${EDITOR:-vi} "$config_file"

    # Reload after editing
    tds_module_load "$module"
    echo "Reloaded: $module"
}

# Initialize a module's config file
tds_modules_init() {
    local module="$1"

    if [[ -z "$module" ]]; then
        echo "Usage: tds modules init <module>"
        echo "Registered: $(printf '%s ' "${!_TDS_MODULE_CONFIGS[@]}")"
        return 1
    fi

    if [[ -z "${_TDS_MODULE_CONFIGS[$module]}" ]]; then
        echo "Module '$module' not registered"
        return 1
    fi

    local config_file=$(tds_module_save "$module")
    echo "Created: $config_file"
}

# Reload a module's config from file
tds_modules_reload() {
    local module="$1"

    if [[ -z "$module" ]]; then
        # Reload all
        for mod in "${!_TDS_MODULE_CONFIGS[@]}"; do
            tds_module_load "$mod"
            echo "Reloaded: $mod"
        done
    else
        if [[ -z "${_TDS_MODULE_CONFIGS[$module]}" ]]; then
            echo "Module '$module' not registered"
            return 1
        fi
        tds_module_load "$module"
        echo "Reloaded: $module"
    fi
}

# Main modules command handler
tds_modules() {
    local cmd="${1:-list}"
    shift 2>/dev/null || true

    case "$cmd" in
        list|ls)
            tds_modules_list "$@"
            ;;
        show)
            tds_modules_show "$@"
            ;;
        edit)
            tds_modules_edit "$@"
            ;;
        init)
            tds_modules_init "$@"
            ;;
        reload)
            tds_modules_reload "$@"
            ;;
        help|--help|-h|*)
            cat <<EOF
TDS Module Color Management

Usage: tds modules <command> [args]

Commands:
  list [-v]        List all registered modules with color configs
  show <module>    Show module's color tokens with preview
  edit <module>    Edit module's color config in \$EDITOR
  init <module>    Create/reset module's config file
  reload [module]  Reload config from file (all if no module specified)

Registered modules: $(printf '%s ' "${!_TDS_MODULE_CONFIGS[@]}")

To register a module, add to its includes.sh:
  declare -gA MYMOD_COLOR_TOKENS=( [token]="palette:index" ... )
  tds_module_register "mymod" "\$MYMOD_DIR/config/colors.conf" MYMOD_COLOR_TOKENS
EOF
            ;;
    esac
}

export -f tds_modules tds_modules_list tds_modules_show tds_modules_edit
export -f tds_modules_init tds_modules_reload
