#!/usr/bin/env bash
# bash/tree/builders.sh - Help Tree Builder Utilities
# Provides convenient builder functions for standard help tree patterns

# Source dependencies
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1
fi

source "$TETRA_SRC/bash/tree/core.sh"

# Build a standard category node
# Usage: tree_build_category "path" "title" "help"
# Example: tree_build_category "help.rag.flow" "Flow Management" "Create and manage RAG flows"
tree_build_category() {
    local path="$1"
    local title="$2"
    local help="$3"

    if [[ -z "$path" || -z "$title" ]]; then
        echo "Error: tree_build_category requires path and title" >&2
        return 1
    fi

    tree_insert "$path" category \
        title="$title" \
        help="${help:-$title}"
}

# Build a standard command node
# Usage: tree_build_command "path" "title" "help" "synopsis" ["examples"] ["handler"] ["completion_fn"]
# Example: tree_build_command "help.rag.flow.create" \
#              "Create Flow" \
#              "Create a new RAG flow" \
#              "flow create 'description' [agent]" \
#              "flow create 'Fix auth bug'" \
#              "rag_flow_create" \
#              "get_available_agents"
tree_build_command() {
    local path="$1"
    local title="$2"
    local help="$3"
    local synopsis="$4"
    local examples="${5:-}"
    local handler="${6:-}"
    local completion_fn="${7:-}"

    if [[ -z "$path" || -z "$title" ]]; then
        echo "Error: tree_build_command requires path and title" >&2
        return 1
    fi

    local args=("$path" "command" "title=$title")

    [[ -n "$help" ]] && args+=("help=$help")
    [[ -n "$synopsis" ]] && args+=("synopsis=$synopsis")
    [[ -n "$examples" ]] && args+=("examples=$examples")
    [[ -n "$handler" ]] && args+=("handler=$handler")
    [[ -n "$completion_fn" ]] && args+=("completion_fn=$completion_fn")

    tree_insert "${args[@]}"

    # Register handler in REPL system if available and handler is valid
    if [[ -n "$handler" ]] && command -v repl_register_module_handler >/dev/null 2>&1; then
        if command -v "$handler" >/dev/null 2>&1; then
            repl_register_module_handler "$path" "$handler"
        fi
    fi
}

# Build a standard action node
# Usage: tree_build_action "path" "title" "help" "handler" ["completion_fn"] ["completion_values"]
# Example: tree_build_action "help.game.play" \
#              "Play Game" \
#              "Launch a game REPL" \
#              "game_play" \
#              "get_available_games" \
#              "pulsar formant estoface"
tree_build_action() {
    local path="$1"
    local title="$2"
    local help="$3"
    local handler="$4"
    local completion_fn="${5:-}"
    local completion_values="${6:-}"

    if [[ -z "$path" || -z "$title" || -z "$handler" ]]; then
        echo "Error: tree_build_action requires path, title, and handler" >&2
        return 1
    fi

    local args=("$path" "action" "title=$title" "help=$help" "handler=$handler")

    [[ -n "$completion_fn" ]] && args+=("completion_fn=$completion_fn")
    [[ -n "$completion_values" ]] && args+=("completion_values=$completion_values")

    tree_insert "${args[@]}"

    # Register handler in REPL system if available
    if command -v repl_register_module_handler >/dev/null 2>&1; then
        if command -v "$handler" >/dev/null 2>&1; then
            repl_register_module_handler "$path" "$handler"
        fi
    fi
}

# Build a flag node (boolean option)
# Usage: tree_build_flag "path" "title" "help" ["short_flag"]
# Example: tree_build_flag "help.rag.flow.create.verbose" \
#              "Verbose Output" \
#              "Enable verbose logging" \
#              "-v"
tree_build_flag() {
    local path="$1"
    local title="$2"
    local help="$3"
    local short_flag="${4:-}"

    if [[ -z "$path" || -z "$title" ]]; then
        echo "Error: tree_build_flag requires path and title" >&2
        return 1
    fi

    local args=("$path" "flag" "title=$title" "help=$help")

    [[ -n "$short_flag" ]] && args+=("short=$short_flag")

    tree_insert "${args[@]}"
}

# Build an option node (key-value option)
# Usage: tree_build_option "path" "title" "help" ["short_opt"] ["default_value"] ["completion_values"]
# Example: tree_build_option "help.rag.flow.create.agent" \
#              "Agent Type" \
#              "Specify which agent to use" \
#              "-a" \
#              "general" \
#              "general specialized research"
tree_build_option() {
    local path="$1"
    local title="$2"
    local help="$3"
    local short_opt="${4:-}"
    local default_value="${5:-}"
    local completion_values="${6:-}"

    if [[ -z "$path" || -z "$title" ]]; then
        echo "Error: tree_build_option requires path and title" >&2
        return 1
    fi

    local args=("$path" "option" "title=$title" "help=$help")

    [[ -n "$short_opt" ]] && args+=("short=$short_opt")
    [[ -n "$default_value" ]] && args+=("default=$default_value")
    [[ -n "$completion_values" ]] && args+=("completion_values=$completion_values")

    tree_insert "${args[@]}"
}

# Build a complete module help tree from a simple spec
# Usage: tree_build_module_spec "module_name" <<EOF
# category root "Module Title" "Module description"
# command action1 "Action Title" "Action help" "synopsis" "examples" "handler_fn"
# command action2 "Action Title" "Action help" "synopsis" "examples" "handler_fn"
# category subcat "Subcategory" "Subcategory help"
# command subcat.action "Action" "Help" "synopsis" "examples" "handler"
# EOF
tree_build_module_spec() {
    local module_name="$1"
    local base_path="help.$module_name"

    if [[ -z "$module_name" ]]; then
        echo "Error: tree_build_module_spec requires module_name" >&2
        return 1
    fi

    # Read spec from stdin
    while IFS= read -r line; do
        # Skip empty lines and comments
        [[ -z "$line" || "$line" == \#* ]] && continue

        # Parse line: type path title help ...
        local type path title help synopsis examples handler
        read -r type path title help synopsis examples handler <<< "$line"

        # Build full path
        if [[ "$path" == "root" ]]; then
            local full_path="$base_path"
        else
            local full_path="$base_path.$path"
        fi

        # Route to appropriate builder
        case "$type" in
            category)
                tree_build_category "$full_path" "$title" "$help"
                ;;
            command)
                tree_build_command "$full_path" "$title" "$help" "$synopsis" "$examples" "$handler"
                ;;
            action)
                tree_build_action "$full_path" "$title" "$help" "$handler"
                ;;
            flag)
                tree_build_flag "$full_path" "$title" "$help"
                ;;
            option)
                tree_build_option "$full_path" "$title" "$help"
                ;;
            *)
                echo "Warning: Unknown spec type: $type" >&2
                ;;
        esac
    done
}

# Export functions
export -f tree_build_category
export -f tree_build_command
export -f tree_build_action
export -f tree_build_flag
export -f tree_build_option
export -f tree_build_module_spec
