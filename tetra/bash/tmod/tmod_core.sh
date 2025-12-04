#!/usr/bin/env bash

# tmod Core Functions - Module management operations

tmod_load_module() {
    if [[ $# -eq 0 ]]; then
        echo "Usage: load <module> [module2 ...] [-dev]"
        echo "Available modules:"
        tetra_get_unloaded_modules | sed 's/^/  /'
        return 1
    fi

    # Check if -dev flag is present
    local dev_flag=0
    for arg in "$@"; do
        if [[ "$arg" == "-dev" ]]; then
            dev_flag=1
            tetra_register_dev_modules
            break
        fi
    done

    # Load each module (reload if already loaded)
    local module
    for module in "$@"; do
        # Skip the -dev flag
        [[ "$module" == "-dev" ]] && continue

        # If already loaded, reload it
        if [[ "${TETRA_MODULE_LOADED[$module]}" == "true" ]]; then
            tmod_reload_module "$module"
        else
            tetra_smart_load_module "$module"
        fi
    done
}

tmod_unload_module() {
    local module="$1"

    if [[ -z "$module" ]]; then
        echo "Usage: unload <module>"
        echo "Loaded modules:"
        tetra_get_loaded_modules | sed 's/^/  /'
        return 1
    fi

    echo "Unloading module: $module"
    tetra_remove_module "$module"
}

tmod_reload_module() {
    local module="$1"

    if [[ -z "$module" ]]; then
        echo "Usage: tmod reload <module>"
        echo "Loaded modules:"
        tetra_get_loaded_modules | sed 's/^/  /'
        return 1
    fi

    # Check for module-specific reload function first
    local reload_fn="${module}_reload"
    if declare -F "$reload_fn" &>/dev/null; then
        echo "Reloading $module (using ${reload_fn})..."
        "$reload_fn"
        return $?
    fi

    # Fall back to re-sourcing includes.sh
    local module_path="${TETRA_SRC}/bash/${module}/includes.sh"

    if [[ ! -f "$module_path" ]]; then
        echo "Error: Module includes not found: $module_path" >&2
        return 1
    fi

    echo "Reloading $module (re-sourcing includes.sh)..."
    source "$module_path"
    local rc=$?

    if [[ $rc -eq 0 ]]; then
        echo "Module '$module' reloaded"
    else
        echo "Error reloading module '$module'" >&2
    fi

    return $rc
}

# Format module list with checkmarks for loaded modules
_tmod_format_module_list() {
    local -n all_ref=$1
    local -n loaded_ref=$2
    local output=""

    for module in "${all_ref[@]}"; do
        if printf '%s\n' "${loaded_ref[@]}" | grep -Fxq "$module"; then
            output+="✓ $module"$'\n'
        else
            output+="  $module"$'\n'
        fi
    done
    echo "$output" | column
}

# Format simple module list in columns
_tmod_format_simple_list() {
    local module_list="$1"
    local prefix="$2"

    if [[ -n "$module_list" ]]; then
        if command -v column >/dev/null 2>&1; then
            echo "$module_list" | column -c 80 2>/dev/null || echo "$module_list" | sed "s/^/$prefix/"
        else
            echo "$module_list" | sed "s/^/$prefix/"
        fi
    fi
}

tmod_list_modules() {
    local filter="${1:-all}"
    local dev_flag="${2:-}"

    [[ "$filter" == "-dev" ]] && { dev_flag="-dev"; filter="all"; }

    case "$filter" in
        all)
            echo "Available Modules (✓ = loaded):"
            local all_modules loaded_modules
            readarray -t all_modules < <(tetra_get_available_modules | sort)
            readarray -t loaded_modules < <(tetra_get_loaded_modules)

            if [[ ${#all_modules[@]} -gt 0 ]]; then
                _tmod_format_module_list all_modules loaded_modules
            else
                echo "  (none found)"
            fi
            ;;
        loaded)
            echo "Loaded Modules:"
            local module_list=$(tetra_get_loaded_modules | sort)
            _tmod_format_simple_list "$module_list" "  " || echo "  (none loaded)"
            ;;
        unloaded)
            echo "Unloaded Modules:"
            local module_list=$(tetra_get_unloaded_modules | sort)
            _tmod_format_simple_list "$module_list" "  " || echo "  (all modules loaded)"
            ;;
        *)
            tetra_list_modules_enhanced "$filter" "$([[ "$dev_flag" == "-dev" ]] && echo "true" || echo "false")"
            ;;
    esac
}

tmod_find_modules() {
    local pattern="$1"
    local dev_flag="${2:-}"
    
    if [[ -z "$pattern" ]]; then
        echo "Usage: find <pattern> [-dev]"
        echo "Search modules by name or description"
        return 1
    fi
    
    tetra_find_module "$pattern" "$dev_flag"
}

tmod_help() {
    local module="$1"

    if [[ -z "$module" ]]; then
        cat <<EOF
tmod - Tetra Module Manager

  TETRA_DIR  $TETRA_DIR
  TETRA_SRC  $TETRA_SRC

REGULAR USE
  status             Show module system status
  list [filter]      List modules (all/loaded/unloaded/category)
  load <module>      Load a module
  help [module]      Show help for a module

ALL COMMANDS
  Modules   status list load unload find help
  Config    enable disable config
  Dev       dev fix index repl
EOF
    else
        tetra_module_help "$module"
    fi
}

tmod_status() {
    _tetra_status_header "Module System"

    # Only show environment issues if they exist
    _tetra_status_validate_env "TETRA_DIR" "TETRA_SRC"

    # Module statistics (compact)
    local available_count=$(tetra_get_available_modules 2>/dev/null | wc -w)
    local loaded_count=$(tetra_get_loaded_modules 2>/dev/null | wc -w)
    local registered_count=${#TETRA_MODULE_LOADERS[@]}

    echo "Modules: $loaded_count/$available_count loaded, $registered_count registered"

    # Core modules (compact, one line)
    local core_status=""
    local core_modules=(utils tmod prompt python nvm tsm)
    for module in "${core_modules[@]}"; do
        if command -v "tetra_${module}_activate" >/dev/null 2>&1 || \
           command -v "$module" >/dev/null 2>&1 || \
           [[ "$module" == "utils" ]] || [[ "$module" == "tmod" ]] || [[ "$module" == "prompt" ]]; then
            core_status+="✓$module "
        else
            core_status+="○$module "
        fi
    done
    echo "Core: $core_status"

    echo ""
    echo "Use 'tmod list' for detailed module info"
}

tmod_dev() {
    local subcmd="${1:-help}"
    shift
    
    case "$subcmd" in
        register|reg)
            echo "Registering development modules..."
            tetra_register_dev_modules
            ;;
        list|ls)
            tetra_list_dev_modules
            ;;
        help|h)
            cat <<'EOF'
tmod dev - Development Module Operations

Commands:
  register|reg    Register development modules from configured paths
  list|ls         List development modules and their status
  help|h          Show this help

Development module paths:
  ~/src/bash/*           - External bash modules
  $TETRA_SRC/bash/wip/*  - Work in progress modules  
  $TETRA_SRC/dev-modules/* - Development modules
EOF
            ;;
        *)
            echo "Unknown dev command: $subcmd"
            echo "Use 'tmod dev help' for available commands"
            return 1
            ;;
    esac
}

tmod_fix() {
    local target_path="${1:-$TETRA_SRC/bash}"
    echo "Fixing missing includes.sh files in $target_path..."
    tetra_fix_module_includes "$target_path"
}

tmod_index() {
    echo "Rebuilding module index..."
    tetra_load_module_index
    local count=$(tetra_list_all_modules_metadata | wc -l)
    echo "Module index rebuilt with $count modules"
}
