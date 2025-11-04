#!/usr/bin/env bash

# trepl - Universal Tetra REPL Launcher
# Launch any module's REPL with a single command

# Global check
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    echo "Run: source ~/tetra/tetra.sh" >&2
    exit 1
fi

# REPL registry - maps module names to their REPL scripts
declare -gA TREPL_REGISTRY=(
    [org]="$TETRA_SRC/bash/org/org_repl.sh"
    [rag]="$TETRA_SRC/bash/rag/rag_repl.sh"
    [tdocs]="$TETRA_SRC/bash/tdocs/tdocs_repl.sh"
    [qa]="$TETRA_SRC/bash/qa/qa_repl.sh"
    [tmod]="$TETRA_SRC/bash/tmod/tmod_repl.sh"
    [game]="$TETRA_SRC/bash/game/game_repl.sh"
    [vox]="$TETRA_SRC/bash/vox/vox_repl.sh"
    [tkm]="$TETRA_SRC/bash/tkm/tkm_repl.sh"
    [tsm]="$TETRA_SRC/bash/tsm/interfaces/repl_v2.sh"
    [logs]="$TETRA_SRC/bash/logs/logs_repl.sh"
    [pbase]="$TETRA_SRC/bash/pbase/pbase_repl.sh"
    [melvin]="$TETRA_SRC/bash/melvin/melvin_repl.sh"
    [midi]="$TETRA_SRC/bash/midi/core/repl.sh"
    [tcurses]="$TETRA_SRC/bash/tcurses/tcurses_repl.sh"
    [tds]="$TETRA_SRC/bash/tds/tds_repl.sh"
    [deploy]="$TETRA_SRC/bash/deploy/deploy_repl.sh"
    [tree]="$TETRA_SRC/bash/tree/demo_tree_repl.sh"
)

# Module descriptions
declare -gA TREPL_DESCRIPTIONS=(
    [org]="Organization management and deployment"
    [rag]="Retrieval-Augmented Generation"
    [tdocs]="Interactive document browser"
    [qa]="Question-Answering system"
    [tmod]="Module system management"
    [game]="Game development REPL"
    [vox]="Voice synthesis"
    [tkm]="Tetra Key Manager"
    [tsm]="Tetra Service Manager"
    [logs]="Log management and analysis"
    [pbase]="Polybase integration"
    [melvin]="AI assistant"
    [midi]="MIDI sequencer"
    [tcurses]="Terminal UI components"
    [tds]="Terminal Display System"
    [deploy]="Deployment automation"
    [tree]="Tree-based help system"
)

# Discover available REPLs
trepl_discover() {
    echo "Discovering REPLs..."

    local found=0
    for module in "${!TREPL_REGISTRY[@]}"; do
        local repl_script="${TREPL_REGISTRY[$module]}"

        if [[ -f "$repl_script" ]]; then
            ((found++))
        fi
    done

    echo "Found $found available REPLs"
}

# List available REPLs
trepl_list() {
    echo ""
    echo "═══ Available Tetra REPLs ═══"
    echo ""

    # Header
    printf "%-12s %-10s %s\n" "MODULE" "STATUS" "DESCRIPTION"
    echo "────────────────────────────────────────────────────────────────"

    # Sort modules and display
    for module in $(printf '%s\n' "${!TREPL_REGISTRY[@]}" | sort); do
        local repl_script="${TREPL_REGISTRY[$module]}"
        local description="${TREPL_DESCRIPTIONS[$module]:-No description}"
        local status="✓"

        if [[ ! -f "$repl_script" ]]; then
            status="✗"
        fi

        printf "%-12s %-10s %s\n" "$module" "$status" "$description"
    done

    echo ""
    echo "Usage: trepl <module>"
    echo "Example: trepl org"
    echo ""
}

# Launch a REPL
trepl_launch() {
    local module="$1"

    if [[ -z "$module" ]]; then
        trepl_list
        return 1
    fi

    # Check if module exists in registry
    if [[ -z "${TREPL_REGISTRY[$module]}" ]]; then
        echo "Error: Unknown module '$module'" >&2
        echo "" >&2
        echo "Available modules:" >&2
        printf '%s\n' "${!TREPL_REGISTRY[@]}" | sort | sed 's/^/  /' >&2
        echo "" >&2
        echo "Use 'trepl list' to see all available REPLs" >&2
        return 1
    fi

    local repl_script="${TREPL_REGISTRY[$module]}"

    # Check if REPL script exists
    if [[ ! -f "$repl_script" ]]; then
        echo "Error: REPL script not found: $repl_script" >&2
        return 1
    fi

    # Set module context
    export TREPL_MODULE="$module"
    export TREPL_SCRIPT="$repl_script"

    # Source and run the REPL
    echo "Launching $module REPL..."
    echo ""

    source "$repl_script"

    # Each REPL should define its own entry point
    # Common patterns: <module>_repl, <module>_repl_main, repl_run
    if declare -F "${module}_repl" >/dev/null 2>&1; then
        "${module}_repl"
    elif declare -F "${module}_repl_main" >/dev/null 2>&1; then
        "${module}_repl_main"
    elif declare -F "repl_run" >/dev/null 2>&1; then
        repl_run
    else
        echo "Error: No REPL entry point found" >&2
        echo "Expected: ${module}_repl, ${module}_repl_main, or repl_run" >&2
        return 1
    fi
}

# Interactive REPL selector
trepl_select() {
    echo ""
    echo "═══ Tetra REPL Selector ═══"
    echo ""

    # Build sorted list
    local modules=()
    for module in $(printf '%s\n' "${!TREPL_REGISTRY[@]}" | sort); do
        if [[ -f "${TREPL_REGISTRY[$module]}" ]]; then
            modules+=("$module")
        fi
    done

    # Display menu
    local i=1
    for module in "${modules[@]}"; do
        local description="${TREPL_DESCRIPTIONS[$module]:-No description}"
        printf "  [%2d] %-10s - %s\n" "$i" "$module" "$description"
        ((i++))
    done

    echo ""
    read -p "Select REPL (number or name): " choice

    # Handle numeric choice
    if [[ "$choice" =~ ^[0-9]+$ ]]; then
        if [[ $choice -ge 1 ]] && [[ $choice -le ${#modules[@]} ]]; then
            local module="${modules[$((choice-1))]}"
            trepl_launch "$module"
        else
            echo "Invalid selection" >&2
            return 1
        fi
    else
        # Handle name choice
        trepl_launch "$choice"
    fi
}

# Main command dispatcher
trepl() {
    local subcommand="${1:-select}"
    shift 2>/dev/null || true

    case "$subcommand" in
        list|ls)
            trepl_list "$@"
            ;;
        discover)
            trepl_discover "$@"
            ;;
        select|menu)
            trepl_select "$@"
            ;;
        help|--help|-h)
            trepl_help
            ;;
        *)
            # Assume it's a module name
            trepl_launch "$subcommand" "$@"
            ;;
    esac
}

# Display help
trepl_help() {
    cat <<'EOF'
trepl - Universal Tetra REPL Launcher

USAGE:
    trepl [command] [module]

COMMANDS:
    trepl <module>        Launch specified module REPL
    trepl select          Interactive REPL selector (default)
    trepl list            List all available REPLs
    trepl discover        Discover available REPLs
    trepl help            Show this help

EXAMPLES:
    # Interactive selector
    trepl

    # Launch specific REPL
    trepl org
    trepl rag
    trepl tdocs

    # List all REPLs
    trepl list

AVAILABLE MODULES:
    org      - Organization management
    rag      - Retrieval-Augmented Generation
    tdocs    - Interactive document browser
    qa       - Question-Answering system
    tmod     - Module system management
    tsm      - Service management
    logs     - Log management
    game     - Game development

    ... and more (use 'trepl list' for full list)

REPL FEATURES:
    - Tab completion
    - Command history
    - Tree-based help navigation
    - Context-aware prompts
    - Slash commands
    - Module-specific actions

KEYBOARD SHORTCUTS:
    Tab         - Completion
    Ctrl-R      - History search
    Ctrl-C      - Cancel input
    Ctrl-D      - Exit REPL
    /help       - Module help
    /exit       - Exit REPL

SEE ALSO:
    bash/repl/README.md - Universal REPL documentation
    <module>/README.md  - Module-specific documentation
EOF
}

# Export main function
export -f trepl

# If script is executed directly (not sourced), run it
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    trepl "$@"
fi
