#!/usr/bin/env bash
# Chroma - Plugin system
# Part of the chroma modular markdown renderer

# Plugin registry: name → init_function
declare -gA CHROMA_PLUGINS=()

# Hook registry: hook_name → space-separated list of callbacks
declare -gA CHROMA_HOOKS=()

# Available hook points
declare -ga CHROMA_HOOK_POINTS=(
    pre_render        # Before rendering starts
    post_render       # After rendering completes
    pre_line          # Before each line is processed
    post_line         # After each line is rendered
    transform_content # Transform line content before rendering (returns modified content)
    render_heading    # Custom heading renderer (return 0 to skip default)
    render_code       # Custom code block renderer
    render_quote      # Custom blockquote renderer
    render_list       # Custom list item renderer
    render_table      # Custom table renderer
    render_hr         # Custom horizontal rule renderer
)

# Register a plugin
# Usage: chroma_register_plugin <name> <init_function> [description]
chroma_register_plugin() {
    local name="$1"
    local init_fn="$2"
    local desc="${3:-}"

    [[ -z "$name" || -z "$init_fn" ]] && {
        echo "Usage: chroma_register_plugin <name> <init_function> [description]" >&2
        return 1
    }

    if ! declare -f "$init_fn" &>/dev/null; then
        echo "Plugin init function not found: $init_fn" >&2
        return 1
    fi

    CHROMA_PLUGINS["$name"]="$init_fn"

    # Call init function
    "$init_fn"
    return 0
}

# Register a hook callback
# Usage: chroma_hook <hook_point> <callback_function>
chroma_hook() {
    local hook="$1"
    local callback="$2"

    [[ -z "$hook" || -z "$callback" ]] && {
        echo "Usage: chroma_hook <hook_point> <callback>" >&2
        return 1
    }

    # Validate hook point
    local valid=0
    for hp in "${CHROMA_HOOK_POINTS[@]}"; do
        [[ "$hp" == "$hook" ]] && { valid=1; break; }
    done
    (( valid )) || {
        echo "Invalid hook point: $hook" >&2
        echo "Valid: ${CHROMA_HOOK_POINTS[*]}" >&2
        return 1
    }

    # Add callback to hook (avoid duplicates)
    local existing="${CHROMA_HOOKS[$hook]:-}"
    if [[ ! " $existing " =~ " $callback " ]]; then
        CHROMA_HOOKS["$hook"]="${existing:+$existing }$callback"
    fi
    return 0
}

# Remove a hook callback
# Usage: chroma_unhook <hook_point> <callback_function>
chroma_unhook() {
    local hook="$1"
    local callback="$2"

    [[ -z "$hook" || -z "$callback" ]] && return 1

    local existing="${CHROMA_HOOKS[$hook]:-}"
    local new_list=""
    for cb in $existing; do
        [[ "$cb" != "$callback" ]] && new_list="${new_list:+$new_list }$cb"
    done
    CHROMA_HOOKS["$hook"]="$new_list"
    return 0
}

# Execute all callbacks for a hook
# Usage: _chroma_run_hooks <hook_point> [args...]
# Returns: 0 if any callback returned 0 (handled), 1 if none handled
_chroma_run_hooks() {
    local hook="$1"
    shift
    local callbacks="${CHROMA_HOOKS[$hook]:-}"

    [[ -z "$callbacks" ]] && return 1

    local handled=1
    for callback in $callbacks; do
        if declare -f "$callback" &>/dev/null; then
            "$callback" "$@"
            local rc=$?
            (( rc == 0 )) && handled=0
        fi
    done
    return $handled
}

# Execute transform hooks that modify content
# Usage: _chroma_run_transform_hooks <hook_point> <content>
# Each callback receives content as $1, prints transformed content to stdout
# Returns: transformed content (or original if no hooks)
_chroma_run_transform_hooks() {
    local hook="$1"
    local content="$2"
    local callbacks="${CHROMA_HOOKS[$hook]:-}"

    [[ -z "$callbacks" ]] && { printf '%s' "$content"; return 0; }

    local result="$content"
    for callback in $callbacks; do
        if declare -f "$callback" &>/dev/null; then
            result=$("$callback" "$result")
        fi
    done
    printf '%s' "$result"
}

# List registered plugins
chroma_list_plugins() {
    echo
    echo "Chroma Plugins"
    echo

    if [[ ${#CHROMA_PLUGINS[@]} -eq 0 ]]; then
        echo "  (no plugins loaded)"
    else
        for name in "${!CHROMA_PLUGINS[@]}"; do
            printf "  %-20s %s\n" "$name" "${CHROMA_PLUGINS[$name]}"
        done
    fi
    echo

    echo "Registered Hooks:"
    for hook in "${CHROMA_HOOK_POINTS[@]}"; do
        local callbacks="${CHROMA_HOOKS[$hook]:-}"
        if [[ -n "$callbacks" ]]; then
            printf "  %-16s %s\n" "$hook:" "$callbacks"
        fi
    done
    echo
}

# Load plugins from directory
# Usage: chroma_load_plugins [directory]
chroma_load_plugins() {
    local plugin_dir="${1:-${CHROMA_PLUGINS_DIR:-}}"

    # Default plugin directories
    if [[ -z "$plugin_dir" ]]; then
        local dirs=(
            "${TETRA_DIR:-$HOME/tetra}/chroma/plugins"
            "${CHROMA_SRC:-$(dirname "${BASH_SOURCE[0]}")/..}/plugins"
        )
        for d in "${dirs[@]}"; do
            [[ -d "$d" ]] && { plugin_dir="$d"; break; }
        done
    fi

    [[ -z "$plugin_dir" || ! -d "$plugin_dir" ]] && return 0

    # Load all *.plugin.sh files
    local count=0
    for plugin_file in "$plugin_dir"/*.plugin.sh; do
        [[ -f "$plugin_file" ]] || continue
        source "$plugin_file" && ((count++))
    done

    (( count > 0 )) && echo "Loaded $count plugin(s) from $plugin_dir"
    return 0
}
