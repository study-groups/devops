#!/usr/bin/env bash
# tdocs REPL - Interactive document browser

# Global check
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    echo "Run: source ~/tetra/tetra.sh" >&2
    exit 1
fi

# Dependencies - source REPL first
source "$TETRA_SRC/bash/repl/repl.sh"

# Set module name for completion
REPL_MODULE_NAME="tdocs"

# Color system for REPL prompts
source "$TETRA_SRC/bash/color/repl_colors.sh"

# Ensure core tdocs is loaded (with wrapper functions)
if ! declare -F tdocs_ls_docs >/dev/null 2>&1; then
    source "$TDOCS_SRC/tdocs.sh"
fi

source "$TDOCS_SRC/tdocs_commands.sh"

# REPL state (filters, context)
TDOCS_REPL_CATEGORY=""      # all|core|other
TDOCS_REPL_MODULE=""        # module filter
TDOCS_REPL_DOC_COUNT=0      # cached count

# Static fallback completions (for when tree isn't available)
_tdocs_static_completions() {
    # Commands
    cat <<'EOF'
ls
list
view
v
search
s
filter
f
tag
init
discover
evidence
e
audit
env
help
h
exit
quit
q
EOF

    # Filter options
    echo "core"
    echo "other"
    echo "module"
    echo "clear"
    echo "reset"

    # Flags
    cat <<'EOF'
--core
--other
--module
--preview
--tags
--pager
--meta-only
--raw
--type
--auto-init
--rebuild
EOF

    # Document types
    cat <<'EOF'
spec
guide
reference
bug-fix
refactor
plan
summary
investigation
EOF

    # Dynamic: modules from database
    if [[ -d "$TDOCS_DIR/db" ]]; then
        find "$TDOCS_DIR/db" -name "*.meta" -type f \
            -exec jq -r '.module' {} \; 2>/dev/null | \
            sort -u | \
            grep -v '^null$'

        # Document basenames
        find "$TDOCS_DIR/db" -name "*.meta" -type f \
            -exec jq -r '.path' {} \; 2>/dev/null | \
            grep -v '^null$' | \
            xargs -n1 basename 2>/dev/null
    fi
}

# Ensure tdocs tree is initialized
if command -v _tdocs_build_help_tree >/dev/null 2>&1; then
    _tdocs_build_help_tree 2>/dev/null || true
fi

# Register tree-based completion with static fallback
repl_register_tree_completion "help.tdocs" "_tdocs_static_completions"

# Count filtered documents
tdocs_count_filtered() {
    local count=0

    # Build filter args
    local filter_args=()
    [[ -n "$TDOCS_REPL_CATEGORY" ]] && filter_args+=("--$TDOCS_REPL_CATEGORY")
    [[ -n "$TDOCS_REPL_MODULE" ]] && filter_args+=("--module" "$TDOCS_REPL_MODULE")

    # Count documents (if ls function exists)
    if command -v tdocs_ls_docs >/dev/null 2>&1; then
        count=$(tdocs_ls_docs "${filter_args[@]}" 2>/dev/null | wc -l | tr -d ' ')
    fi

    echo "$count"
}

# Build dynamic prompt with tmpfile for ANSI colors
# Format: [category x module x count] stats>
_tdocs_repl_build_prompt() {
    local tmpfile
    tmpfile=$(mktemp /tmp/tdocs_repl_prompt.XXXXXX) || return 1

    # Get current filter context
    local category="${TDOCS_REPL_CATEGORY:-all}"
    local module="${TDOCS_REPL_MODULE:-all}"
    local doc_count="$TDOCS_REPL_DOC_COUNT"

    # Update doc count
    if [[ "$doc_count" -eq 0 ]]; then
        doc_count=$(tdocs_count_filtered)
        TDOCS_REPL_DOC_COUNT=$doc_count
    fi

    # Opening bracket
    text_color "$REPL_BRACKET" >> "$tmpfile"
    printf '[' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Category (green for core, yellow for other, gray for all)
    case "$category" in
        core)
            text_color "$REPL_ENV_PROD" >> "$tmpfile"  # Green
            ;;
        other)
            text_color "$REPL_ENV_DEV" >> "$tmpfile"   # Yellow
            ;;
        *)
            text_color "$REPL_ORG_INACTIVE" >> "$tmpfile"  # Gray
            ;;
    esac
    printf '%s' "$category" >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Separator
    text_color "$REPL_SEPARATOR" >> "$tmpfile"
    printf ' x ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Module (blue if filtered, gray if all)
    if [[ "$module" != "all" ]]; then
        text_color "$REPL_MODE_INSPECT" >> "$tmpfile"  # Blue
    else
        text_color "$REPL_ORG_INACTIVE" >> "$tmpfile"  # Gray
    fi
    printf '%s' "$module" >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Separator
    text_color "$REPL_SEPARATOR" >> "$tmpfile"
    printf ' x ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Document count (cyan)
    text_color "$REPL_MODE_EXECUTE" >> "$tmpfile"  # Cyan
    printf '%s' "$doc_count" >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Closing bracket
    text_color "$REPL_BRACKET" >> "$tmpfile"
    printf ']' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Prompt suffix with colored stats
    printf ' ' >> "$tmpfile"
    text_color "$REPL_PROMPT_SUFFIX" >> "$tmpfile"
    printf 'docs' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Arrow
    text_color "$REPL_ARROW" >> "$tmpfile"
    printf ' ▶ ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Set REPL_PROMPT from tmpfile
    REPL_PROMPT=$(cat "$tmpfile")
    rm -f "$tmpfile"
}

# ============================================================================
# INPUT PROCESSOR
# ============================================================================

_tdocs_repl_process_input() {
    local input="$1"

    # Empty input - show current state
    if [[ -z "$input" ]]; then
        return 0
    fi

    # Shell command (!cmd for shell escape)
    if [[ "$input" == !* ]]; then
        eval "${input:1}"
        return 0
    fi

    # Parse input into command and args
    local cmd="${input%% *}"
    local args="${input#* }"
    [[ "$cmd" == "$input" ]] && args=""

    # Parse command (takeover mode - no / prefix needed)
    case "$cmd" in
        # Document listing
        ls|list)
            tdocs_cmd_ls $args
            ;;

        # View document
        view|v)
            tdocs_cmd_view $args
            ;;

        # Search
        search|s)
            tdocs_cmd_search $args
            ;;

        # Filtering
        filter|f)
            local filter_args=($args)
            local filter_type="${filter_args[0]}"
            case "$filter_type" in
                core)
                    TDOCS_REPL_CATEGORY="core"
                    TDOCS_REPL_DOC_COUNT=0  # Force recount
                    echo "Filter: core documents only"
                    return 2  # Signal prompt refresh
                    ;;
                other)
                    TDOCS_REPL_CATEGORY="other"
                    TDOCS_REPL_DOC_COUNT=0
                    echo "Filter: other documents only"
                    return 2
                    ;;
                module)
                    TDOCS_REPL_MODULE="${filter_args[1]}"
                    TDOCS_REPL_DOC_COUNT=0
                    echo "Filter: module = ${filter_args[1]}"
                    return 2
                    ;;
                clear|reset)
                    TDOCS_REPL_CATEGORY=""
                    TDOCS_REPL_MODULE=""
                    TDOCS_REPL_DOC_COUNT=0
                    echo "Filters cleared"
                    return 2
                    ;;
                *)
                    echo "Usage: filter [core|other|module <name>|clear]"
                    ;;
            esac
            ;;

        # Tagging
        tag)
            tdocs_cmd_tag $args
            ;;

        # Discovery
        discover)
            tdocs_cmd_discover $args
            ;;

        # Initialize
        init)
            tdocs_cmd_init $args
            ;;

        # Evidence (context building)
        evidence|e)
            tdocs_cmd_evidence $args
            ;;

        # Environment info
        env)
            tdocs_cmd_env
            ;;

        # Audit
        audit)
            tdocs_cmd_audit
            ;;

        # Help
        help|h|\?)
            cat <<'HELP'
tdocs REPL Commands:

Viewing:
  ls, list           List documents (respects filters)
  view <file>        View document with syntax highlighting
  search <query>     Search across documents

Filtering:
  filter core        Show only core documents
  filter other       Show only other documents
  filter module <m>  Show only documents for module <m>
  filter clear       Clear all filters

Navigation:
  TAB                Auto-complete commands, options, and files
  Up/Down            Navigate command history

Context Building:
  evidence add <f>   Add document to context
  evidence list      List context items
  evidence view <n>  View context item

Organization:
  tag <file> <tags>  Add tags to document
  discover           Scan for new documents
  init               Initialize tdocs database

Info:
  env                Show environment details
  audit              Show system status
  help               Show this help

System:
  !<cmd>             Execute shell command
  exit, quit         Exit REPL
HELP
            ;;

        # Exit
        exit|quit|q)
            return 1  # Signal exit
            ;;

        # Unknown command
        *)
            # Try to dispatch via slash commands if registered
            if [[ -n "$cmd" ]]; then
                # Check if it's a registered slash command
                if declare -f "tdocs_cmd_${cmd}" >/dev/null 2>&1; then
                    "tdocs_cmd_${cmd}" $args
                else
                    echo "Unknown command: $cmd"
                    echo "Type 'help' for available commands, or press TAB for completions"
                    return 0
                fi
            fi
            ;;
    esac
}

# Main REPL entry point
tdocs_repl() {
    # Initialize tdocs module if not already done
    if ! command -v tdocs_module_init >/dev/null 2>&1; then
        echo "Error: tdocs module not loaded" >&2
        echo "Run: tmod load tdocs" >&2
        return 1
    fi

    # Ensure module is initialized
    tdocs_module_init 2>/dev/null || true

    # Register the tdocs module with the REPL system
    repl_register_module "tdocs" "ls view search filter tag init discover evidence audit env"

    # Register slash commands
    tdocs_register_commands

    # Set module context for help/completion
    repl_set_module_context "tdocs"

    # Set history base
    REPL_HISTORY_BASE="${TETRA_DIR}/tdocs/repl_history"

    # Set execution mode to takeover
    REPL_EXECUTION_MODE="takeover"

    # Tree completion is already registered above
    # No need to set generator here - it's handled by repl_register_tree_completion

    # Override REPL callbacks with tdocs-specific implementations
    repl_build_prompt() { _tdocs_repl_build_prompt "$@"; }
    repl_process_input() { _tdocs_repl_process_input "$@"; }
    export -f repl_build_prompt repl_process_input

    # Show welcome message
    cat <<'EOF'
╔═══════════════════════════════════════════════════════════╗
║           tdocs - Interactive Document Browser            ║
╚═══════════════════════════════════════════════════════════╝

Takeover Mode: Direct commands (no shell pass-through)

Quick Start:
  discover --auto-init  Auto-index all documents (run this first!)
  ls                    List all documents
  view <file>           View document with color rendering
  search <query>        Search across documents
  filter core           Show only core documents
  help                  Show all commands

EOF

    # Show native tab completion status
    echo "✓ Native TAB completion enabled"
    echo ""

    echo "Type exit or press Ctrl-D to quit"
    echo ""

    # Run REPL in takeover mode (full REPL control)
    repl_run

    # Cleanup
    unset -f repl_build_prompt repl_process_input

    echo ""
    echo "Goodbye!"
    echo ""
}

# Export functions
export -f tdocs_count_filtered
export -f _tdocs_repl_build_prompt
export -f _tdocs_repl_process_input
export -f tdocs_repl

# Launch REPL if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    tdocs_repl "$@"
fi
