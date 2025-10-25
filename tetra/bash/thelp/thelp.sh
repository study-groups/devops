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

Examples:
  thelp flow                 # Show help for 'flow' command
  thelp rag.flow.create      # Show specific help path
  thelp --list rag           # List all RAG commands

Modules with help trees:
  rag      Retrieval-Augmented Generation
  org      Organization management
  game     Game REPL

Tip: Use tab completion: thelp rag.flow<TAB>
EOF
        return 0
    fi

    # Handle --list flag
    if [[ "$query" == "--list" ]]; then
        local module="${2:-rag}"
        _thelp_list_commands "$module"
        return $?
    fi

    # Normalize path (add module prefix if needed)
    local help_path="$query"

    # If no dot, assume it's a rag command
    if [[ ! "$query" =~ \. ]]; then
        help_path="rag.$query"
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

# List available commands for a module
_thelp_list_commands() {
    local module="${1:-rag}"

    if ! tree_exists "$module"; then
        echo "Module not found: $module"
        return 1
    fi

    echo "Available commands in $module:"
    echo ""

    # Get all commands
    local commands=$(tree_descendants "$module" --type command | sort)

    if [[ -z "$commands" ]]; then
        echo "  (no commands found)"
        return 0
    fi

    # Display in compact format
    for cmd_path in $commands; do
        local cmd_name="${cmd_path##*.}"
        local parent="${cmd_path%.*}"
        local category="${parent##*.}"
        local title=$(tree_get "$cmd_path" "title")

        if [[ "$parent" == "$module" ]]; then
            # Top-level command
            printf "  %-20s %s\n" "$cmd_name" "${title:-}"
        else
            # Nested command
            printf "  %-20s %s\n" "$category.$cmd_name" "${title:-}"
        fi
    done
}

# Bash completion for thelp
_thelp_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Flags
    if [[ "$cur" == -* ]]; then
        COMPREPLY=( $(compgen -W "--list" -- "$cur") )
        return 0
    fi

    # After --list, complete module names
    if [[ "$prev" == "--list" ]]; then
        local modules=$(tree_query --type category --depth 1 | awk -F'.' '{print $1}' | sort -u)
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
export -f _thelp_list_commands
export -f _thelp_complete
