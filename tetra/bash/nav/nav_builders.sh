#!/usr/bin/env bash
# nav/nav_builders.sh - Help Tree Builder Utilities
# Provides convenient builder functions for standard nav tree patterns

NAV_BUILDERS_SRC="${NAV_BUILDERS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

# Source nav core
source "$NAV_BUILDERS_SRC/nav.sh"

# Build a standard category node
# Usage: nav_build_category "path" "title" "help"
nav_build_category() {
    local path="$1"
    local title="$2"
    local help="$3"

    if [[ -z "$path" || -z "$title" ]]; then
        echo "Error: nav_build_category requires path and title" >&2
        return 1
    fi

    nav_define "$path" category \
        title="$title" \
        help="${help:-$title}"
}

# Build a standard command node
# Usage: nav_build_command "path" "title" "help" "synopsis" ["examples"] ["handler"] ["completion_fn"]
nav_build_command() {
    local path="$1"
    local title="$2"
    local help="$3"
    local synopsis="$4"
    local examples="${5:-}"
    local handler="${6:-}"
    local completion_fn="${7:-}"

    if [[ -z "$path" || -z "$title" ]]; then
        echo "Error: nav_build_command requires path and title" >&2
        return 1
    fi

    local args=("$path" "command" "title=$title")

    [[ -n "$help" ]] && args+=("help=$help")
    [[ -n "$synopsis" ]] && args+=("synopsis=$synopsis")
    [[ -n "$examples" ]] && args+=("examples=$examples")
    [[ -n "$handler" ]] && args+=("handler=$handler")
    [[ -n "$completion_fn" ]] && args+=("completion_fn=$completion_fn")

    nav_define "${args[@]}"

    # Register handler in REPL system if available and handler is valid
    if [[ -n "$handler" ]] && command -v repl_register_module_handler >/dev/null 2>&1; then
        if command -v "$handler" >/dev/null 2>&1; then
            repl_register_module_handler "$path" "$handler"
        fi
    fi
}

# Build a standard action node
# Usage: nav_build_action "path" "title" "help" "handler" ["completion_fn"] ["completion_values"]
nav_build_action() {
    local path="$1"
    local title="$2"
    local help="$3"
    local handler="$4"
    local completion_fn="${5:-}"
    local completion_values="${6:-}"

    if [[ -z "$path" || -z "$title" || -z "$handler" ]]; then
        echo "Error: nav_build_action requires path, title, and handler" >&2
        return 1
    fi

    local args=("$path" "action" "title=$title" "help=$help" "handler=$handler")

    [[ -n "$completion_fn" ]] && args+=("completion_fn=$completion_fn")
    [[ -n "$completion_values" ]] && args+=("completion_values=$completion_values")

    nav_define "${args[@]}"

    # Register handler in REPL system if available
    if command -v repl_register_module_handler >/dev/null 2>&1; then
        if command -v "$handler" >/dev/null 2>&1; then
            repl_register_module_handler "$path" "$handler"
        fi
    fi
}

# Build a flag node (boolean option)
# Usage: nav_build_flag "path" "title" "help" ["short_flag"]
nav_build_flag() {
    local path="$1"
    local title="$2"
    local help="$3"
    local short_flag="${4:-}"

    if [[ -z "$path" || -z "$title" ]]; then
        echo "Error: nav_build_flag requires path and title" >&2
        return 1
    fi

    local args=("$path" "flag" "title=$title" "help=$help")

    [[ -n "$short_flag" ]] && args+=("short=$short_flag")

    nav_define "${args[@]}"
}

# Build an option node (key-value option)
# Usage: nav_build_option "path" "title" "help" ["short_opt"] ["default_value"] ["completion_values"]
nav_build_option() {
    local path="$1"
    local title="$2"
    local help="$3"
    local short_opt="${4:-}"
    local default_value="${5:-}"
    local completion_values="${6:-}"

    if [[ -z "$path" || -z "$title" ]]; then
        echo "Error: nav_build_option requires path and title" >&2
        return 1
    fi

    local args=("$path" "option" "title=$title" "help=$help")

    [[ -n "$short_opt" ]] && args+=("short=$short_opt")
    [[ -n "$default_value" ]] && args+=("default=$default_value")
    [[ -n "$completion_values" ]] && args+=("completion_values=$completion_values")

    nav_define "${args[@]}"
}

# Build a complete module help tree from a simple spec
# Usage: nav_build_module_spec "module_name" <<EOF
# category root "Module Title" "Module description"
# command action1 "Action Title" "Action help" "synopsis" "examples" "handler_fn"
# EOF
nav_build_module_spec() {
    local module_name="$1"
    local base_path="help.$module_name"

    if [[ -z "$module_name" ]]; then
        echo "Error: nav_build_module_spec requires module_name" >&2
        return 1
    fi

    while IFS= read -r line; do
        [[ -z "$line" || "$line" == \#* ]] && continue

        local type path title help synopsis examples handler
        read -r type path title help synopsis examples handler <<< "$line"

        if [[ "$path" == "root" ]]; then
            local full_path="$base_path"
        else
            local full_path="$base_path.$path"
        fi

        case "$type" in
            category) nav_build_category "$full_path" "$title" "$help" ;;
            command)  nav_build_command "$full_path" "$title" "$help" "$synopsis" "$examples" "$handler" ;;
            action)   nav_build_action "$full_path" "$title" "$help" "$handler" ;;
            flag)     nav_build_flag "$full_path" "$title" "$help" ;;
            option)   nav_build_option "$full_path" "$title" "$help" ;;
            *)        echo "Warning: Unknown spec type: $type" >&2 ;;
        esac
    done
}

# =============================================================================
# TREE_* COMPATIBILITY SHIMS
# =============================================================================

tree_build_category() { nav_build_category "$@"; }
tree_build_command() { nav_build_command "$@"; }
tree_build_action() { nav_build_action "$@"; }
tree_build_flag() { nav_build_flag "$@"; }
tree_build_option() { nav_build_option "$@"; }
tree_build_module_spec() { nav_build_module_spec "$@"; }

# =============================================================================
# EXPORTS
# =============================================================================

export -f nav_build_category nav_build_command nav_build_action
export -f nav_build_flag nav_build_option nav_build_module_spec
export -f tree_build_category tree_build_command tree_build_action
export -f tree_build_flag tree_build_option tree_build_module_spec
