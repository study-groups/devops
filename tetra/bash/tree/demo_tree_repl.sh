#!/usr/bin/env bash
# demo_tree_repl.sh - Demonstration of tree tab completion in a REPL
# Shows the pattern for tmod load game; game repl with TAB completion

# Source tetra
source ~/tetra/tetra.sh

# Source REPL system
source "$TETRA_SRC/bash/repl/repl.sh"
source "$TETRA_SRC/bash/color/repl_colors.sh"

# Source tree system with completion
source "$TETRA_SRC/bash/tree/core.sh"
source "$TETRA_SRC/bash/tree/complete.sh"
source "$TETRA_SRC/bash/tree/tree_repl_complete.sh"

# REPL Configuration
REPL_HISTORY_BASE="${TETRA_DIR}/tree/demo_repl_history"

# ============================================================================
# SETUP HELP TREE
# ============================================================================

# Create a sample tree structure for demo
demo_setup_tree() {
    # Root
    tree_insert "help.demo" "category" title="Demo REPL" help="Tree-based REPL demo"

    # Commands
    tree_insert "help.demo.show" "category" help="Show information"
    tree_insert "help.demo.show.status" "action" help="Show current status"
    tree_insert "help.demo.show.tree" "action" help="Show tree structure"
    tree_insert "help.demo.show.help" "action" help="Show help for topic"

    tree_insert "help.demo.list" "category" help="List items"
    tree_insert "help.demo.list.all" "action" help="List all items"
    tree_insert "help.demo.list.recent" "action" help="List recent items"

    tree_insert "help.demo.create" "category" help="Create new item"
    tree_insert "help.demo.create.node" "action" help="Create tree node"
    tree_insert "help.demo.create.file" "action" help="Create file"

    tree_insert "help.demo.delete" "category" help="Delete item"
    tree_insert "help.demo.delete.node" "action" help="Delete tree node"
    tree_insert "help.demo.delete.file" "action" help="Delete file"

    tree_insert "help.demo.help" "action" help="Show help system"
    tree_insert "help.demo.exit" "action" help="Exit REPL"
}

# ============================================================================
# PROMPT BUILDER
# ============================================================================

_demo_repl_build_prompt() {
    local tmpfile
    tmpfile=$(mktemp /tmp/demo_repl_prompt.XXXXXX) || return 1

    text_color "00AAFF" >> "$tmpfile"
    printf '⚡ ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    text_color "FFFFFF" >> "$tmpfile"
    printf 'demo' >> "$tmpfile"
    reset_color >> "$tmpfile"

    text_color "FFAA00" >> "$tmpfile"
    printf ' ▶ ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    REPL_PROMPT=$(<"$tmpfile")
    # Store for tab completion
    export TREE_REPL_PROMPT="$REPL_PROMPT"
    rm -f "$tmpfile"
}

# ============================================================================
# HELP DISPLAY
# ============================================================================

demo_show_help() {
    local topic="${1:-demo}"

    # Normalize topic
    if [[ "$topic" != help.* ]]; then
        topic="help.demo.$topic"
    fi

    # Remove duplicate "demo" if present
    topic="${topic/help.demo.demo/help.demo}"

    # Check if exists
    if ! tree_exists "$topic"; then
        echo "Unknown topic: $1"
        echo "Press TAB to see available options"
        return 1
    fi

    # Get metadata
    local title=$(tree_get "$topic" "title")
    local help_text=$(tree_get "$topic" "help")
    local detail=$(tree_get "$topic" "detail")

    echo ""
    text_color "00AAFF"
    echo "■ ${title:-$help_text}"
    reset_color

    [[ -n "$detail" ]] && echo "  $detail"

    # Show children
    local children
    children=$(tree_children "$topic")
    if [[ -n "$children" ]]; then
        echo ""
        text_color "00FF88"
        echo "Available commands (press TAB):"
        reset_color
        for child in $children; do
            local leaf="${child##*.}"
            local child_help=$(tree_get "$child" "help")
            printf "  %-14s" "$leaf"
            text_color "AAAAAA"
            echo "$child_help"
            reset_color
        done
    fi
    echo ""
}

# ============================================================================
# INPUT PROCESSOR
# ============================================================================

_demo_repl_process_input() {
    local input="$1"

    # Empty input
    [[ -z "$input" ]] && return 0

    # Exit commands
    case "$input" in
        exit|quit|q)
            return 1
            ;;
        help|h|\?)
            demo_show_help
            return 0
            ;;
    esac

    # Parse command
    local cmd_args=($input)
    local cmd="${cmd_args[0]}"
    local arg1="${cmd_args[1]}"
    local arg2="${cmd_args[2]}"

    case "$cmd" in
        show)
            case "$arg1" in
                status)
                    echo ""
                    text_color "00FF88"
                    echo "✓ Demo REPL Status"
                    reset_color
                    echo "  Tree namespace: help.demo"
                    echo "  Tab completion: ENABLED"
                    echo "  Press TAB to see available commands"
                    echo ""
                    ;;
                tree)
                    echo ""
                    tree_complete_interactive "help.demo"
                    echo ""
                    ;;
                help)
                    demo_show_help "$arg2"
                    ;;
                *)
                    echo "Usage: show {status|tree|help}"
                    echo "Press TAB after 'show' to see options"
                    ;;
            esac
            ;;
        list)
            case "$arg1" in
                all)
                    echo ""
                    echo "Listing all items..."
                    echo "  (demo - no actual items)"
                    echo ""
                    ;;
                recent)
                    echo ""
                    echo "Listing recent items..."
                    echo "  (demo - no actual items)"
                    echo ""
                    ;;
                *)
                    echo "Usage: list {all|recent}"
                    echo "Press TAB after 'list' to see options"
                    ;;
            esac
            ;;
        create)
            echo "Create: $arg1 (demo - not implemented)"
            ;;
        delete)
            echo "Delete: $arg1 (demo - not implemented)"
            ;;
        help)
            demo_show_help "$arg1"
            ;;
        *)
            text_color "FFAA00"
            echo "Unknown command: $cmd"
            reset_color
            echo "Type 'help' or press TAB to see available commands"
            ;;
    esac

    return 0
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

demo_tree_repl_run() {
    echo ""
    text_color "66FFFF"
    echo "⚡ TREE TAB COMPLETION DEMO"
    reset_color
    echo ""
    text_color "AAAAAA"
    echo "This demo shows tab completion in action:"
    echo "  • Press TAB to see available commands"
    echo "  • Type partial command + TAB to complete"
    echo "  • Multi-level: 'show<TAB>' then '<TAB>' shows options"
    echo "  • Type 'help' for more info"
    reset_color
    echo ""

    # Setup tree
    demo_setup_tree

    # Enable tab completion for this REPL
    # This is the KEY integration point!
    tree_repl_enable_completion "help.demo"

    # Override REPL callbacks
    repl_build_prompt() { _demo_repl_build_prompt "$@"; }
    repl_process_input() { _demo_repl_process_input "$@"; }
    export -f repl_build_prompt repl_process_input

    # Run REPL loop
    repl_run

    # Cleanup
    tree_repl_disable_completion
    unset -f repl_build_prompt repl_process_input

    echo ""
    text_color "66FFFF"
    echo "Goodbye! ⚡"
    reset_color
    echo ""
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    demo_tree_repl_run
fi
