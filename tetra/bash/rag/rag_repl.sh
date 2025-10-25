#!/usr/bin/env bash
# RAG REPL - Interactive Retrieval-Augmented Generation Interface
# Integrates with bash/repl, TDS, bash/tree, and tree-sitter

# Source dependencies (follow module hierarchy)
# bash/repl - Universal REPL system
source "$TETRA_SRC/bash/repl/repl.sh"

# bash/color - Color system (loaded by repl.sh, but explicit for clarity)
source "$TETRA_SRC/bash/color/repl_colors.sh"

# bash/tds - Display system (markdown rendering, borders, semantic colors)
TDS_SRC="${TETRA_SRC}/bash/tds"
if [[ -f "$TDS_SRC/tds.sh" ]]; then
    source "$TDS_SRC/tds.sh"
else
    echo "Warning: TDS not found at $TDS_SRC - visual features disabled" >&2
fi

# bash/tree - Hierarchical navigation system
TREE_SRC="${TETRA_SRC}/bash/tree"
if [[ -f "$TREE_SRC/core.sh" ]]; then
    source "$TREE_SRC/core.sh"
    source "$TREE_SRC/help.sh"
else
    echo "Warning: bash/tree not found - help navigation disabled" >&2
fi

# RAG-specific modules
RAG_SRC="${TETRA_SRC}/bash/rag"
source "$RAG_SRC/bash/rag_prompts.sh"
source "$RAG_SRC/bash/rag_commands.sh"

# REPL Configuration
# Note: If ~/tetra/rag/history exists as a file (legacy), rename it first
if [[ -f "${TETRA_DIR}/rag/history" ]] && [[ ! -d "${TETRA_DIR}/rag/history" ]]; then
    mv "${TETRA_DIR}/rag/history" "${TETRA_DIR}/rag/rag_history.legacy" 2>/dev/null || true
fi
REPL_HISTORY_BASE="${TETRA_DIR}/rag/history/rag_repl"

# RAG REPL State
RAG_REPL_HELP_INITIALIZED=0

# ============================================================================
# HELP TREE INITIALIZATION
# ============================================================================

_rag_init_help_tree() {
    [[ $RAG_REPL_HELP_INITIALIZED -eq 1 ]] && return 0

    # Root
    tree_insert "rag" category \
        title="RAG REPL" \
        help="Retrieval-Augmented Generation Interactive Shell"

    # Flow Management
    tree_insert "rag.flow" category \
        title="Flow Management" \
        help="Create and manage RAG flows"

    tree_insert "rag.flow.create" command \
        title="Create Flow" \
        help="Create a new RAG flow with a description" \
        synopsis="/flow create \"description\" [agent]" \
        detail="Creates a new flow with the given description. Optionally specify an agent profile (base, claude-code, openai)." \
        examples="/flow create \"Fix authentication timeout\"\n/flow create \"Add new feature\" claude-code"

    tree_insert "rag.flow.status" command \
        title="Flow Status" \
        help="Show current flow status and stage" \
        synopsis="/flow status" \
        detail="Displays the active flow, current stage, and next actions."

    tree_insert "rag.flow.list" command \
        title="List Flows" \
        help="List all flows" \
        synopsis="/flow list" \
        detail="Shows all flows with their IDs, descriptions, and stages."

    tree_insert "rag.flow.resume" command \
        title="Resume Flow" \
        help="Resume a flow from checkpoint" \
        synopsis="/flow resume [flow-id]" \
        detail="Resume a previously created flow. If no flow-id specified, resumes the most recent flow."

    # Evidence Management
    tree_insert "rag.evidence" category \
        title="Evidence Management" \
        help="Add and manage evidence files for context"

    tree_insert "rag.evidence.add" command \
        title="Add Evidence" \
        help="Add evidence file with selector" \
        synopsis="/e add <selector>" \
        detail="Selector format:\n  file              Whole file\n  file::100,200     Lines 100-200\n  file::100c,500c   Bytes 100-500\n  file#tag1,tag2    With tags" \
        examples="/e add core/flow.sh\n/e add core/flow.sh::100,200#important\n/e add tests/test_flow.sh"

    tree_insert "rag.evidence.list" command \
        title="List Evidence" \
        help="List evidence files with variables and status" \
        synopsis="/e list" \
        detail="Shows all evidence files with \$e variables, active/skipped status, and file paths."

    tree_insert "rag.evidence.view" command \
        title="View Evidence" \
        help="View evidence with TDS markdown rendering" \
        synopsis="/e <number>" \
        detail="View evidence file with syntax highlighting and colored markdown rendering." \
        examples="/e 1\n/e 1 2 3"

    tree_insert "rag.evidence.toggle" command \
        title="Toggle Evidence" \
        help="Toggle evidence active/skipped" \
        synopsis="/e toggle <target>" \
        detail="Target can be:\n  100           By rank\n  flow_sh       By pattern\n  200-299       Range" \
        examples="/e toggle 200\n/e toggle 300-399"

    tree_insert "rag.evidence.status" command \
        title="Evidence Status" \
        help="Show context status and token budget" \
        synopsis="/e status"

    # Context Assembly
    tree_insert "rag.assembly" category \
        title="Context Assembly" \
        help="Assemble and submit context to LLMs"

    tree_insert "rag.assembly.select" command \
        title="Select Evidence" \
        help="Select evidence using query" \
        synopsis="/select <query>" \
        examples="/select authentication error"

    tree_insert "rag.assembly.assemble" command \
        title="Assemble Context" \
        help="Build context from evidence to prompt.mdctx" \
        synopsis="/assemble"

    tree_insert "rag.assembly.submit" command \
        title="Submit to QA" \
        help="Submit assembled context to QA agent" \
        synopsis="/submit @qa [--async]" \
        detail="Submits context to QA agent. Use --async to run in background."

    tree_insert "rag.assembly.response" command \
        title="View Response" \
        help="View LLM response with colored markdown" \
        synopsis="/r"

    # Prompt Editing
    tree_insert "rag.prompt" category \
        title="Prompt Management" \
        help="Edit and manage flow prompts/questions"

    tree_insert "rag.prompt.edit" command \
        title="Edit Prompt" \
        help="Edit or replace flow prompt" \
        synopsis="/p [\"text\"]" \
        detail="With text: replaces prompt\nWithout text: opens editor" \
        examples="/p \"How does the authentication flow work?\"\n/p"

    # Knowledge Base
    tree_insert "rag.kb" category \
        title="Knowledge Base" \
        help="Manage knowledge base entries"

    tree_insert "rag.kb.tag" command \
        title="Tag Flow" \
        help="Promote flow to knowledge base with tags" \
        synopsis="/tag [flow-id] <tags...>" \
        examples="/tag auth troubleshooting\n/tag fix-123 bug-fix performance"

    tree_insert "rag.kb.list" command \
        title="List KB" \
        help="List knowledge base entries" \
        synopsis="/kb list [tag]"

    tree_insert "rag.kb.search" command \
        title="Search KB" \
        help="Search knowledge base" \
        synopsis="/kb search <query>"

    # Workflow Guide
    tree_insert "rag.workflow" category \
        title="Quick Start Workflow" \
        help="Step-by-step workflow guide"

    tree_insert "rag.workflow.basic" command \
        title="Basic Workflow" \
        help="Standard RAG workflow" \
        synopsis="Basic workflow steps" \
        detail="1. /flow create \"your question\"\n2. /e add file.sh\n3. /assemble\n4. /submit @qa\n5. /r"

    RAG_REPL_HELP_INITIALIZED=1
}

# ============================================================================
# PROMPT BUILDER
# ============================================================================

_rag_repl_build_prompt() {
    # Build prompt: [flow x stage x evidence] >
    # Similar to game REPL: [org x user x game] >

    local tmpfile
    tmpfile=$(mktemp /tmp/rag_repl_prompt.XXXXXX) || return 1

    # Get flow context
    local flow_dir="$(get_active_flow_dir 2>/dev/null)"
    local flow_name="none"
    local stage="NEW"
    local evidence_count=0

    if [[ -n "$flow_dir" ]] && [[ -d "$flow_dir" ]]; then
        # Get flow ID (shortened)
        local flow_id=$(basename "$flow_dir")
        flow_name=$(echo "$flow_id" | cut -d'-' -f1-2 | cut -c1-12)

        # Get stage from state.json
        if [[ -f "$flow_dir/state.json" ]] && command -v jq >/dev/null 2>&1; then
            stage=$(jq -r '.stage // "NEW"' "$flow_dir/state.json" 2>/dev/null)
        fi

        # Count active evidence files
        if [[ -d "$flow_dir/ctx/evidence" ]]; then
            evidence_count=$(find "$flow_dir/ctx/evidence" -name "*.evidence.md" -type f 2>/dev/null | wc -l | tr -d ' ')
        fi
    fi

    # Opening bracket (colored based on execution mode)
    # Augment mode (need /cmd): use distinct color
    # Takeover mode (just cmd): use standard bracket color
    if repl_is_augment 2>/dev/null; then
        text_color "$REPL_MODE_INSPECT" >> "$tmpfile"  # Blue for augment/CLI mode
    else
        text_color "$REPL_BRACKET" >> "$tmpfile"  # Standard bracket for takeover
    fi
    printf '[' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Flow name
    if [[ "$flow_name" != "none" ]]; then
        text_color "$REPL_ORG_ACTIVE" >> "$tmpfile"
        printf '%s' "$flow_name" >> "$tmpfile"
    else
        text_color "$REPL_ORG_INACTIVE" >> "$tmpfile"
        printf 'no-flow' >> "$tmpfile"
    fi
    reset_color >> "$tmpfile"

    # Separator (colored)
    text_color "$REPL_SEPARATOR" >> "$tmpfile"
    printf ' x ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Stage
    case "$stage" in
        NEW)
            text_color "$REPL_ORG_INACTIVE" >> "$tmpfile"
            ;;
        SELECT|ASSEMBLE)
            text_color "$REPL_ENV_DEV" >> "$tmpfile"  # Yellow/orange
            ;;
        EXECUTE)
            text_color "$REPL_MODE_INSPECT" >> "$tmpfile"  # Blue
            ;;
        VALIDATE|DONE)
            text_color "$REPL_ENV_PROD" >> "$tmpfile"  # Green
            ;;
        FAIL)
            text_color "$REPL_ERROR" >> "$tmpfile"  # Red
            ;;
        *)
            text_color "$REPL_ENV_LOCAL" >> "$tmpfile"
            ;;
    esac
    printf '%s' "$stage" >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Separator (colored)
    text_color "$REPL_SEPARATOR" >> "$tmpfile"
    printf ' x ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Evidence count
    if [[ $evidence_count -gt 0 ]]; then
        text_color "$REPL_ENV_DEV" >> "$tmpfile"  # Green for active evidence
        printf '%de' "$evidence_count" >> "$tmpfile"
    else
        text_color "$REPL_ORG_INACTIVE" >> "$tmpfile"
        printf 'no-e' >> "$tmpfile"
    fi
    reset_color >> "$tmpfile"

    # Closing bracket (colored to match opening)
    if repl_is_augment 2>/dev/null; then
        text_color "$REPL_MODE_INSPECT" >> "$tmpfile"  # Blue for augment/CLI mode
    else
        text_color "$REPL_BRACKET" >> "$tmpfile"  # Standard bracket for takeover
    fi
    printf '] ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    # Prompt arrow (colored)
    text_color "$REPL_ARROW" >> "$tmpfile"
    printf '> ' >> "$tmpfile"
    reset_color >> "$tmpfile"

    REPL_PROMPT=$(<"$tmpfile")
    rm -f "$tmpfile"
}

# ============================================================================
# INPUT PROCESSOR
# ============================================================================

_rag_repl_process_input() {
    local input="$1"

    # Empty input
    [[ -z "$input" ]] && return 0

    # Shell command (! prefix)
    if [[ "$input" == !* ]]; then
        eval "${input:1}"
        return 0
    fi

    # Exit commands
    case "$input" in
        exit|quit|q)
            return 1
            ;;
    esac

    # Slash commands - delegate to registered handlers
    if [[ "$input" == /* ]]; then
        # Strip the /
        local cmd_with_args="${input#/}"

        # Let repl_dispatch_slash handle it
        # This will check module handlers first, then built-in /help, /exit, etc.
        repl_dispatch_slash "$cmd_with_args"
        return $?
    fi

    # Regular commands in REPL mode - try to be helpful
    case "$input" in
        flow|flow\ *)
            echo "Did you mean: /$input ?"
            echo "Tip: Use /$input for RAG commands"
            return 0
            ;;
        evidence|e|e\ *)
            echo "Did you mean: /$input ?"
            echo "Tip: Use /$input for RAG commands"
            return 0
            ;;
        *)
            # Default: treat as shell command in augment mode
            eval "$input"
            return 0
            ;;
    esac
}

# ============================================================================
# WELCOME MESSAGE
# ============================================================================

_rag_show_welcome() {
    echo ""
    text_color "66FFFF"
    echo "RAG REPL v2.0"
    reset_color
    echo ""
    text_color "AAAAAA"
    echo "Retrieval-Augmented Generation Interface"
    echo ""
    echo "Quick start:"
    echo "  /flow create \"your question\"  -> /e add file.sh -> /assemble -> /submit @qa"
    echo ""
    echo "Type '/help' for navigable help tree, '/exit' to quit"
    reset_color
    echo ""
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

rag_repl() {
    # Initialize help tree
    _rag_init_help_tree

    # Show welcome
    _rag_show_welcome

    # Initialize flow manager and evidence system
    if [[ -f "$RAG_SRC/core/flow_manager_ttm.sh" ]]; then
        source "$RAG_SRC/core/flow_manager_ttm.sh"
    fi
    if [[ -f "$RAG_SRC/core/evidence_manager.sh" ]]; then
        source "$RAG_SRC/core/evidence_manager.sh"
    fi

    # Initialize evidence variables if there's an active flow
    local active_flow=$(flow_active 2>/dev/null)
    if [[ -n "$active_flow" ]]; then
        flow_init_evidence_vars "$active_flow" 2>/dev/null || true
    fi

    # Register RAG commands and prompts with bash/repl
    rag_register_commands
    rag_register_prompts

    # Override REPL callbacks with RAG-specific implementations
    # Note: These are function definitions, not command substitutions
    repl_build_prompt() { _rag_repl_build_prompt "$@"; }
    repl_process_input() { _rag_repl_process_input "$@"; }
    export -f repl_build_prompt repl_process_input

    # Run unified REPL loop (provides /mode, /theme, /history, /exit)
    repl_run enhanced

    # Cleanup
    unset -f repl_build_prompt repl_process_input

    echo ""
    text_color "66FFFF"
    echo "Goodbye!"
    reset_color
    echo ""
}

# Export functions
export -f rag_repl
export -f _rag_init_help_tree
export -f _rag_repl_build_prompt
export -f _rag_repl_process_input
export -f _rag_show_welcome
