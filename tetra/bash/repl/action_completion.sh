#!/usr/bin/env bash
# REPL Action Completion
# Tab completion for module.action syntax with TDS colors

# Source action registry
if [[ -f "$TETRA_SRC/bash/actions/registry.sh" ]]; then
    source "$TETRA_SRC/bash/actions/registry.sh"
fi

# Complete action names for current module context
# Usage: repl_complete_actions [module]
repl_complete_actions() {
    local module="$1"
    local current_word="$2"

    action_registry_init

    # If current word has a dot, complete with module prefix
    if [[ "$current_word" == *.* ]]; then
        local prefix="${current_word%%.*}"
        action_complete_list "$prefix"
    elif [[ -n "$module" ]]; then
        # Complete for current module context
        action_complete_list "$module" | while read -r fqn; do
            # Show just the action name if in module context
            echo "${fqn#*.}"
        done
    else
        # Show all actions with module prefix
        action_complete_list
    fi
}

# Show action help menu (for tab key)
# Usage: repl_show_action_menu [module]
repl_show_action_menu() {
    local module="$1"

    action_registry_init

    echo ""
    if type tds_text_color &>/dev/null; then
        tds_text_color "content.heading.h3"
        if [[ -n "$module" ]]; then
            echo "Available actions for $module:"
        else
            echo "Available actions:"
        fi
        tput sgr0
    else
        if [[ -n "$module" ]]; then
            echo "Available actions for $module:"
        else
            echo "Available actions:"
        fi
    fi
    echo ""

    # List actions with color formatting
    action_list "$module"
    echo ""
}

# Generate bash completion for action.module syntax
# Usage in bash: complete -F _repl_action_complete tetra
_repl_action_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"

    # If completing after module., show actions for that module
    if [[ "$cur" == *.* ]]; then
        local module="${cur%%.*}"
        COMPREPLY=($(compgen -W "$(action_complete_list "$module")" -- "$cur"))
    else
        # Show all modules or actions
        local modules=$(action_complete_list | cut -d. -f1 | sort -u)
        COMPREPLY=($(compgen -W "$modules" -- "$cur"))
    fi
}

# Enhanced readline completion for REPL mode
# Shows colored action menu on tab
repl_action_tab_handler() {
    local input="$1"
    local module="$2"

    # If input looks like module. or just partial action
    if [[ "$input" == *.* || "$input" =~ ^[a-z]+$ ]]; then
        repl_show_action_menu "$module"
        return 0
    fi

    return 1
}

# Export functions
export -f repl_complete_actions
export -f repl_show_action_menu
export -f _repl_action_complete
export -f repl_action_tab_handler
