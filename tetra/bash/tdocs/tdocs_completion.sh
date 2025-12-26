#!/usr/bin/env bash
# tdocs Shell Command Tab Completion
# Hierarchical completion for the 'tdocs' command
# Categories: doc, find, scan, mod, chuck, pub, ui

# Ensure TDOCS_DIR is set
: "${TDOCS_DIR:=$TETRA_DIR/tdocs}"

# Load tree completion if available
if [[ -n "$TETRA_SRC" ]] && [[ -f "$TETRA_SRC/bash/tree/complete.sh" ]]; then
    source "$TETRA_SRC/bash/tree/complete.sh"
fi

# Command categories and their subcommands
declare -gA TDOCS_CATEGORIES=(
    [doc]="add view tag rank promote"
    [find]="ls search evidence filter"
    [scan]="discover audit doctor run"
    [mod]="show spec audit types"
    [chuck]="save list view promote delete search"
    [pub]="publish targets nginx"
    [ui]="browse review colors about"
)

# Top-level commands (categories + special commands)
TDOCS_TOP_COMMANDS="doc find scan mod chuck pub ui ctx help"

# Helper: Get available modules from metadata (for dynamic completion)
_tdocs_shell_get_modules() {
    if [[ -d "$TDOCS_DIR/db" ]]; then
        find "$TDOCS_DIR/db" -name "*.meta" -type f \
            -exec jq -r '.module' {} \; 2>/dev/null | \
            sort -u | \
            grep -v '^null$'
    fi
}

# Ensure tree is initialized
_tdocs_ensure_tree() {
    if ! tree_exists "help.tdocs" 2>/dev/null; then
        if declare -F _tdocs_build_help_tree >/dev/null 2>&1; then
            _tdocs_build_help_tree 2>/dev/null
        fi
    fi
}

# Main completion function
_tdocs_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Level 1: Complete categories
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$TDOCS_TOP_COMMANDS" -- "$cur"))
        return 0
    fi

    local category="${COMP_WORDS[1]}"

    # Level 2: Complete subcommands within category
    if [[ $COMP_CWORD -eq 2 ]]; then
        if [[ -n "${TDOCS_CATEGORIES[$category]}" ]]; then
            COMPREPLY=($(compgen -W "${TDOCS_CATEGORIES[$category]}" -- "$cur"))
            return 0
        fi
        # Special case for ctx
        if [[ "$category" == "ctx" ]]; then
            COMPREPLY=($(compgen -W "set clear show" -- "$cur"))
            return 0
        fi
        # Special case for help
        if [[ "$category" == "help" ]]; then
            COMPREPLY=($(compgen -W "doc find scan mod chuck pub ui ctx" -- "$cur"))
            return 0
        fi
        return 0
    fi

    # Level 3+: Use tree completion or static options
    local subcommand="${COMP_WORDS[2]}"

    # Option value completions
    if [[ "$prev" == "--module" ]]; then
        local modules=$(_tdocs_shell_get_modules)
        COMPREPLY=($(compgen -W "$modules" -- "$cur"))
        return 0
    elif [[ "$prev" == "--type" ]]; then
        COMPREPLY=($(compgen -W "spec guide reference bug-fix refactor plan summary investigation" -- "$cur"))
        return 0
    elif [[ "$prev" == "--lifecycle" ]]; then
        COMPREPLY=($(compgen -W "D W S C X" -- "$cur"))
        return 0
    elif [[ "$prev" == "--kind" ]]; then
        # Chuck kinds - dynamic from chuck dir
        local kinds=""
        if [[ -d "$TDOCS_DIR/chuck" ]]; then
            kinds=$(ls -1 "$TDOCS_DIR/chuck" 2>/dev/null | sort -u)
        fi
        COMPREPLY=($(compgen -W "$kinds" -- "$cur"))
        return 0
    fi

    # Flag completions based on category.subcommand
    if [[ "$cur" == -* ]]; then
        local flags=""
        case "$category.$subcommand" in
            doc.add)
                flags="--type --lifecycle --module --tags"
                ;;
            doc.view)
                flags="--pager --meta-only --raw"
                ;;
            find.ls)
                flags="--module --type --lifecycle --preview --pager"
                ;;
            find.filter)
                flags="--module --type --lifecycle --recent"
                ;;
            scan.discover)
                flags="--auto-init"
                ;;
            scan.doctor)
                flags="--fix --summary"
                ;;
            mod.audit)
                flags="--missing"
                ;;
            chuck.list)
                flags="--kind --recent"
                ;;
            chuck.delete)
                flags="--force"
                ;;
            ui.about)
                flags="--no-pager"
                ;;
        esac
        COMPREPLY=($(compgen -W "$flags" -- "$cur"))
        return 0
    fi

    # Try tree-based completion for more complex cases
    if declare -F tree_complete >/dev/null 2>&1; then
        _tdocs_ensure_tree
        local path="help.tdocs.$category"
        [[ -n "$subcommand" ]] && path="$path.$subcommand"
        local completions=$(tree_complete "$path" "$cur" 2>/dev/null)
        if [[ -n "$completions" ]]; then
            COMPREPLY=($(compgen -W "$completions" -- "$cur"))
            return 0
        fi
    fi

    # File completion for commands that take files
    case "$category.$subcommand" in
        doc.add|doc.view|doc.tag|doc.rank|doc.promote)
            COMPREPLY=($(compgen -f -X '!*.md' -- "$cur"))
            ;;
    esac
}

# Register completion for both 'tdocs' and 'tdoc' (alias)
complete -F _tdocs_complete tdocs
complete -F _tdocs_complete tdoc
