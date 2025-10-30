#!/usr/bin/env bash
# bash/thelp - Tree Help Quick Lookup
# Provides quick help access from regular shell (augment mode)
# Usage: thelp <command> - shows help without entering interactive mode

# Source dependencies
THELP_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load bash/tree if available
if [[ -z "$(command -v tree_exists)" ]]; then
    TREE_SRC="${TETRA_SRC}/bash/tree"
    if [[ -f "$TREE_SRC/core.sh" ]]; then
        source "$TREE_SRC/core.sh"
        source "$TREE_SRC/help.sh"
    else
        echo "Error: bash/tree not found, thelp requires it" >&2
        return 1
    fi
fi

# Load command processor for module registry access
if [[ -z "$(command -v repl_register_module)" ]]; then
    REPL_SRC="${TETRA_SRC}/bash/repl"
    if [[ -f "$REPL_SRC/command_processor.sh" ]]; then
        source "$REPL_SRC/command_processor.sh"
    fi
fi

# Load shell completion system if available
if [[ -z "$(command -v tree_register_shell_completion)" ]]; then
    if [[ -f "$TETRA_SRC/bash/tree/shell_complete.sh" ]]; then
        source "$TETRA_SRC/bash/tree/shell_complete.sh"
    fi
fi

# Main thelp command
# Usage: thelp [module.]command
thelp() {
    local query="$1"

    if [[ -z "$query" ]]; then
        cat <<'EOF'
thelp - Tree Help Quick Lookup

Usage: thelp <command>
       thelp <module>.<command>
       thelp --list [module]
       thelp --modules
       thelp --complete <path> [word]

Examples:
  thelp flow                 # Show help for 'flow' command
  thelp rag.flow.create      # Show specific help path
  thelp --list rag           # List all RAG commands
  thelp --modules            # Show all registered modules
  thelp --complete rag.flow.list      # Get dynamic completions
  thelp --complete game.play pul      # Filter by current word

Tip: Use tab completion: thelp rag.flow<TAB>
EOF
        return 0
    fi

    # Handle --modules flag
    if [[ "$query" == "--modules" ]]; then
        _thelp_list_modules
        return $?
    fi

    # Handle --complete flag
    if [[ "$query" == "--complete" ]]; then
        local path="$2"
        local filter="${3:-}"
        _thelp_get_completions "$path" "$filter"
        return $?
    fi

    # Handle --list flag
    if [[ "$query" == "--list" ]]; then
        local module="${2:-rag}"
        _thelp_list_commands "$module"
        return $?
    fi

    # Normalize path (add module prefix if needed)
    local help_path="$query"

    # If no dot, try to infer module from registry or default to rag
    if [[ ! "$query" =~ \. ]]; then
        local found_module=""

        # Check if query matches a command in any registered module
        if [[ -n "${REPL_MODULE_REGISTRY[@]}" ]]; then
            for mod in "${!REPL_MODULE_REGISTRY[@]}"; do
                # Skip namespace entries
                [[ "$mod" == *:namespace ]] && continue

                local commands="${REPL_MODULE_REGISTRY[$mod]}"
                if [[ " $commands " =~ " $query " ]]; then
                    found_module="$mod"
                    break
                fi
            done
        fi

        # Use found module or default to rag
        if [[ -n "$found_module" ]]; then
            help_path="$found_module.$query"
        else
            help_path="rag.$query"
        fi
    fi

    # Try to show help
    if tree_exists "$help_path"; then
        tree_help_show "$help_path"
    else
        # Try common variations
        local tried_paths=("$help_path")

        # Try with rag prefix
        if [[ ! "$query" =~ ^rag\. ]]; then
            local rag_path="rag.$query"
            tried_paths+=("$rag_path")
            if tree_exists "$rag_path"; then
                tree_help_show "$rag_path"
                return 0
            fi
        fi

        # Try without last segment (might be a subcommand)
        if [[ "$query" =~ \. ]]; then
            local parent="${query%.*}"
            tried_paths+=("$parent")
            if tree_exists "$parent"; then
                tree_help_show "$parent"
                return 0
            fi
        fi

        echo "Help not found: $query"
        echo ""
        echo "Tried paths:"
        printf '  %s\n' "${tried_paths[@]}"
        echo ""
        echo "Available commands: thelp --list"
        return 1
    fi
}

# Get dynamic completions for a command path
# Usage: _thelp_get_completions <path> [filter_word]
_thelp_get_completions() {
    local path="$1"
    local filter="${2:-}"

    if [[ -z "$path" ]]; then
        echo "Error: path required for --complete" >&2
        return 1
    fi

    # Normalize path (try with help. prefix if needed)
    local tree_path="$path"
    if ! tree_exists "$tree_path" 2>/dev/null; then
        # Try with help. prefix
        if [[ "$path" =~ ^([^.]+)\. ]]; then
            local module="${BASH_REMATCH[1]}"
            tree_path="help.$path"
        fi
    fi

    if ! tree_exists "$tree_path" 2>/dev/null; then
        echo "Error: path not found: $path" >&2
        return 1
    fi

    # Check for completion_values (static)
    local values=$(tree_get "$tree_path" "completion_values" 2>/dev/null)
    if [[ -n "$values" ]]; then
        # Static completion values
        for value in $values; do
            if [[ -z "$filter" ]] || [[ "$value" == "$filter"* ]]; then
                echo "$value"
            fi
        done
        return 0
    fi

    # Check for completion_fn (dynamic)
    local completion_fn=$(tree_get "$tree_path" "completion_fn" 2>/dev/null)
    if [[ -n "$completion_fn" ]] && command -v "$completion_fn" >/dev/null 2>&1; then
        # Call dynamic completion function
        local all_completions=$("$completion_fn" 2>/dev/null)

        # Filter by current word if provided
        if [[ -n "$filter" ]]; then
            echo "$all_completions" | grep "^$filter"
        else
            echo "$all_completions"
        fi
        return 0
    fi

    # No completion metadata
    echo "# No completion data for: $path" >&2
    return 0
}

# List all registered modules
_thelp_list_modules() {
    echo "Available modules:"
    echo ""

    # Try registry first (runtime modules)
    if [[ -n "${REPL_MODULE_REGISTRY[@]}" ]]; then
        local has_modules=0
        for mod in "${!REPL_MODULE_REGISTRY[@]}"; do
            # Skip namespace entries
            [[ "$mod" == *:namespace ]] && continue

            has_modules=1
            local namespace="${REPL_MODULE_REGISTRY[${mod}:namespace]:-help.$mod}"
            local description=""

            # Try to get description from tree
            if tree_exists "$namespace" 2>/dev/null; then
                description=$(tree_get "$namespace" "title" 2>/dev/null)
            fi

            printf "  %-12s %s\n" "$mod" "${description:-No description}"
        done

        if [[ $has_modules -eq 1 ]]; then
            echo ""
            echo "Use: thelp --list <module> to see commands"
            return 0
        fi
    fi

    # Fallback: scan tree for help.* roots
    echo "  (scanning tree structure...)"
    echo ""

    local roots=$(tree_query --type category --depth 1 2>/dev/null | grep '^help\.' | sort -u)
    if [[ -n "$roots" ]]; then
        for root in $roots; do
            local mod="${root#help.}"
            local title=$(tree_get "$root" "title" 2>/dev/null)
            printf "  %-12s %s\n" "$mod" "${title:-No description}"
        done
        echo ""
        echo "Use: thelp --list <module> to see commands"
    else
        echo "  (no modules found)"
        echo ""
        echo "Modules register themselves when their REPLs start."
        echo "Try starting a REPL first (e.g., rag, game, org)"
    fi
}

# List available commands for a module
_thelp_list_commands() {
    local module="${1:-rag}"

    # Validate module exists in registry or tree
    local namespace=""
    if [[ -n "${REPL_MODULE_REGISTRY[$module]}" ]]; then
        namespace="${REPL_MODULE_REGISTRY[${module}:namespace]:-help.$module}"
    else
        # Try help.$module convention
        namespace="help.$module"
    fi

    if ! tree_exists "$namespace" 2>/dev/null && ! tree_exists "$module" 2>/dev/null; then
        echo "Module not found: $module"
        echo ""
        echo "Available modules:"
        _thelp_list_modules
        return 1
    fi

    # Use namespace if it exists, otherwise use module name directly
    local search_root="$namespace"
    if ! tree_exists "$namespace" 2>/dev/null; then
        search_root="$module"
    fi

    echo "Available commands in $module:"
    echo ""

    # Get all commands
    local commands=$(tree_descendants "$search_root" --type command 2>/dev/null | sort)

    if [[ -z "$commands" ]]; then
        echo "  (no commands found)"
        return 0
    fi

    # Display in compact format
    for cmd_path in $commands; do
        # Strip namespace prefix if present
        local display_path="$cmd_path"
        if [[ "$cmd_path" == help.* ]]; then
            display_path="${cmd_path#help.$module.}"
        elif [[ "$cmd_path" == $module.* ]]; then
            display_path="${cmd_path#$module.}"
        fi

        local title=$(tree_get "$cmd_path" "title" 2>/dev/null)
        printf "  %-20s %s\n" "$display_path" "${title:-}"
    done
}

# Bash completion for thelp
_thelp_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Flags
    if [[ "$cur" == -* ]]; then
        COMPREPLY=( $(compgen -W "--list --modules" -- "$cur") )
        return 0
    fi

    # After --list, complete module names from registry or tree
    if [[ "$prev" == "--list" ]]; then
        local modules=""

        # Try registry first
        if [[ -n "${REPL_MODULE_REGISTRY[@]}" ]]; then
            for mod in "${!REPL_MODULE_REGISTRY[@]}"; do
                [[ "$mod" == *:namespace ]] && continue
                modules="$modules $mod"
            done
        fi

        # Fallback to tree scan
        if [[ -z "$modules" ]]; then
            modules=$(tree_query --type category --depth 1 2>/dev/null | grep '^help\.' | sed 's/^help\.//' | sort -u)
        fi

        COMPREPLY=( $(compgen -W "$modules" -- "$cur") )
        return 0
    fi

    # Complete command paths
    local module="rag"
    local search_term="$cur"

    # If cur has a dot, extract module
    if [[ "$cur" =~ ^([^.]+)\. ]]; then
        module="${BASH_REMATCH[1]}"
        search_term="${cur#*.}"
    fi

    # Get commands from tree
    local commands=""
    if tree_exists "$module"; then
        # Get all descendants (commands and categories)
        commands=$(tree_descendants "$module" | while read -r path; do
            # Strip module prefix
            echo "${path#$module.}"
        done)

        # Add module prefix if original query had it
        if [[ "$cur" =~ \. ]]; then
            commands=$(echo "$commands" | sed "s/^/$module./")
        fi
    fi

    COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
}

# Register completion
complete -F _thelp_complete thelp

# Export functions
export -f thelp
export -f _thelp_get_completions
export -f _thelp_list_modules
export -f _thelp_list_commands
export -f _thelp_complete
