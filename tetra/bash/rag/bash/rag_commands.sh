#!/usr/bin/env bash
# rag_commands.sh - RAG REPL slash command handlers
# Registers command handlers with bash/repl system

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"

# Source dependencies
source "$RAG_SRC/core/flow_manager_ttm.sh"
source "$RAG_SRC/core/evidence_manager.sh"
source "$RAG_SRC/core/evidence_selector.sh"
source "$RAG_SRC/core/assembler.sh"
source "$RAG_SRC/core/stats_manager.sh" 2>/dev/null || true
source "$RAG_SRC/bash/rag_prompts.sh"

# ============================================================================
# FLOW COMMANDS
# ============================================================================

rag_cmd_flow() {
    local subcmd="$1"
    shift || true

    case "$subcmd" in
        create|start)
            flow_create "$@"
            ;;
        status|"")
            flow_status "$@"
            ;;
        list)
            flow_list "$@"
            ;;
        resume)
            flow_resume "$@"
            ;;
        promote)
            flow_promote "$@"
            ;;
        *)
            echo "Unknown flow subcommand: $subcmd"
            echo "Usage: /flow {create|status|list|resume|promote}"
            echo ""
            echo "  create <desc>    Create new flow (local)"
            echo "  status           Show current flow status"
            echo "  list             List flows"
            echo "  resume <id>      Resume a flow"
            echo "  promote [id]     Promote flow to global"
            echo ""
            echo "Scope control:"
            echo "  RAG_SCOPE=local  rag flow list    # List local flows (default)"
            echo "  RAG_SCOPE=global rag flow list    # List global flows"
            ;;
    esac
}

# ============================================================================
# EVIDENCE COMMANDS
# ============================================================================

rag_cmd_evidence() {
    local subcmd="$1"
    shift || true

    # Check if subcmd is a number - view evidence
    if [[ "$subcmd" =~ ^[0-9]+$ ]]; then
        # Viewing evidence by number
        local evidence_nums=("$subcmd" "$@")

        # Load TDS for rendering
        if [[ -f "$TETRA_SRC/bash/tds/tds.sh" ]]; then
            source "$TETRA_SRC/bash/tds/tds.sh"
        else
            echo "Error: TDS not available for rendering" >&2
            echo "Fallback to cat..." >&2
        fi

        for num in "${evidence_nums[@]}"; do
            # Get evidence variable (e.g., $e1, $e2)
            local var_name="e${num}"
            local evidence_file="${!var_name}"

            if [[ -z "$evidence_file" ]]; then
                echo "Error: No evidence at index $num" >&2
                echo "Use /e list to see available evidence" >&2
                continue
            fi

            if [[ ! -f "$evidence_file" ]]; then
                echo "Error: Evidence file not found: $evidence_file" >&2
                continue
            fi

            # Render with TDS if available, otherwise cat
            if command -v tds_markdown >/dev/null 2>&1; then
                # Use pager for files > 50 lines
                local line_count=$(wc -l < "$evidence_file" | tr -d ' ')
                if [[ $line_count -gt 50 ]]; then
                    tds_markdown --pager "$evidence_file"
                else
                    tds_markdown "$evidence_file"
                fi
            else
                cat "$evidence_file"
            fi

            # Add separator if viewing multiple files
            if [[ ${#evidence_nums[@]} -gt 1 ]]; then
                echo ""
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                echo ""
            fi
        done
        return 0
    fi

    case "$subcmd" in
        add)
            if command -v evidence_add >/dev/null 2>&1; then
                evidence_add "$@"
                # Refresh evidence variables
                flow_init_evidence_vars
            else
                echo "Error: evidence_add not available" >&2
            fi
            ;;
        list|ls|"")
            if command -v evidence_list >/dev/null 2>&1; then
                evidence_list
            else
                echo "Error: evidence_list not available" >&2
            fi
            ;;
        toggle)
            if command -v evidence_toggle >/dev/null 2>&1; then
                evidence_toggle "$@"
                # Refresh evidence variables
                flow_init_evidence_vars
            else
                echo "Error: evidence_toggle not available" >&2
            fi
            ;;
        status)
            if command -v evidence_status >/dev/null 2>&1; then
                evidence_status "$@"
            else
                echo "Error: evidence_status not available" >&2
            fi
            ;;
        *)
            echo "Usage: /evidence {add|list|toggle|status|<number>}"
            echo ""
            echo "  add <selector>   Add evidence file"
            echo "  list             List evidence files"
            echo "  toggle <id>      Toggle evidence on/off"
            echo "  status           Show evidence status"
            echo "  <number>         View evidence (e.g., /e 1 or /e 1 2 3)"
            ;;
    esac
}

# ============================================================================
# SELECT COMMAND
# ============================================================================

rag_cmd_select() {
    local query="$*"

    if [[ -z "$query" ]]; then
        echo "Usage: /select <query>"
        echo "Example: /select authentication error"
        return 1
    fi

    if command -v select_evidence >/dev/null 2>&1; then
        select_evidence "$query"
        # Refresh evidence variables
        flow_init_evidence_vars
    else
        echo "Error: select_evidence not available" >&2
    fi
}

# ============================================================================
# ASSEMBLE COMMAND
# ============================================================================

rag_cmd_assemble() {
    if command -v assemble_ctx >/dev/null 2>&1; then
        assemble_ctx "$@"
    else
        echo "Error: assemble_ctx not available" >&2
    fi
}

# ============================================================================
# PROMPT COMMAND (edit question/request)
# ============================================================================

rag_cmd_prompt_edit() {
    local prompt_text="$*"
    local flow_dir="$(get_active_flow_dir)"

    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        echo "Error: No active flow" >&2
        echo "Create a flow first: /flow create \"description\"" >&2
        return 1
    fi

    # Support new and legacy formats
    local prompt_file="$flow_dir/ctx/010_prompt.user.md"
    if [[ ! -f "$prompt_file" ]]; then
        # Try legacy names
        if [[ -f "$flow_dir/ctx/010_request.md" ]]; then
            prompt_file="$flow_dir/ctx/010_request.md"
        elif [[ -f "$flow_dir/ctx/010_request.user.md" ]]; then
            prompt_file="$flow_dir/ctx/010_request.user.md"
        else
            echo "Error: Prompt file not found" >&2
            echo "Expected: $flow_dir/ctx/010_prompt.user.md" >&2
            return 1
        fi
    fi

    # Get flow_id for metadata
    local flow_id=$(basename "$flow_dir")

    # If text provided, replace prompt content
    if [[ -n "$prompt_text" ]]; then
        cat > "$prompt_file" <<EOF
<!-- rs:intent=edit; rs:scope=code; rs:id=$flow_id -->

$prompt_text
EOF
        echo "✓ Prompt updated"
        echo ""
        echo "Prompt: $prompt_text"
        echo ""
        echo "Next: /assemble to build context, then /submit @qa"
        return 0
    fi

    # No text provided - open editor
    local editor="${EDITOR:-${VISUAL:-vi}}"

    echo "Editing prompt..."
    echo "File: $prompt_file"
    echo ""

    "$editor" "$prompt_file"

    echo ""
    echo "✓ Prompt updated"
    echo "Next: /assemble to build context, then /submit @qa"
}

# ============================================================================
# SUBMIT COMMAND
# ============================================================================

rag_cmd_submit() {
    local target="${1:-@qa}"
    local mode="sync"  # Default to sync for now

    # Parse flags
    if [[ "$target" == "--async" ]] || [[ "$target" == "-a" ]]; then
        mode="async"
        target="${2:-@qa}"
    elif [[ "$2" == "--async" ]] || [[ "$2" == "-a" ]]; then
        mode="async"
    fi

    if [[ "$target" != "@qa" ]]; then
        echo "Error: Only @qa target supported currently" >&2
        echo "Usage: /submit [@qa] [--async]" >&2
        echo ""
        echo "Options:" >&2
        echo "  --async, -a    Run in background (prompt updates when done)" >&2
        return 1
    fi

    if [[ -f "$RAG_SRC/core/qa_submit.sh" ]]; then
        source "$RAG_SRC/core/qa_submit.sh"

        if [[ "$mode" == "async" ]]; then
            if command -v submit_to_qa_async >/dev/null 2>&1; then
                submit_to_qa_async
            else
                echo "Error: submit_to_qa_async not available" >&2
            fi
        else
            if command -v submit_to_qa >/dev/null 2>&1; then
                submit_to_qa
            else
                echo "Error: submit_to_qa not available" >&2
            fi
        fi
    else
        echo "Error: qa_submit.sh not found" >&2
    fi
}

# ============================================================================
# RESPONSE COMMAND (view LLM response)
# ============================================================================

rag_cmd_response() {
    local flow_dir="$(get_active_flow_dir)"

    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    local answer_file="$flow_dir/build/answer.md"

    if [[ ! -f "$answer_file" ]]; then
        echo "No response yet. Run /submit @qa first." >&2
        return 1
    fi

    # Load TDS for rendering if available
    if [[ -f "$TETRA_SRC/bash/tds/tds.sh" ]]; then
        source "$TETRA_SRC/bash/tds/tds.sh"
    fi

    # Render with TDS if available, otherwise cat with pager
    if command -v tds_markdown >/dev/null 2>&1; then
        local line_count=$(wc -l < "$answer_file" | tr -d ' ')
        if [[ $line_count -gt 50 ]]; then
            tds_markdown --pager "$answer_file"
        else
            tds_markdown "$answer_file"
        fi
    else
        echo "Response from LLM:"
        echo "══════════════════════════════════════════════════════════"
        cat "$answer_file"
        echo ""
        echo "══════════════════════════════════════════════════════════"
    fi

    echo ""
    echo "File: $answer_file"
    echo "Tip: Use /tag to promote this to knowledge base"
}

# ============================================================================
# STATUS COMMAND
# ============================================================================

rag_cmd_status() {
    echo "RAG System Status"
    echo "════════════════════════════════════════"
    echo ""

    # Flow status
    flow_status
    echo ""

    # Evidence count
    if command -v evidence_list >/dev/null 2>&1; then
        local flow_dir="$(get_active_flow_dir 2>/dev/null)"
        if [[ -n "$flow_dir" ]] && [[ -d "$flow_dir/ctx/evidence" ]]; then
            local evidence_count=$(find "$flow_dir/ctx/evidence" -name "*.evidence.md" 2>/dev/null | wc -l | tr -d ' ')
            echo "Evidence files: $evidence_count"
        fi
    fi

    # Stats if available
    if command -v get_context_stats >/dev/null 2>&1; then
        local flow_dir="$(get_active_flow_dir 2>/dev/null)"
        if [[ -n "$flow_dir" ]]; then
            echo ""
            get_context_stats "$flow_dir"
        fi
    fi
}

# ============================================================================
# PROMPT/CLI COMMAND (backwards compat)
# ============================================================================

rag_cmd_cli() {
    local subcmd="$1"
    local scope="${2:-flow}"

    if [[ -z "$subcmd" ]]; then
        # Show current mode
        local mode=$(get_rag_prompt_mode)
        echo "Current prompt mode: $mode"
        echo ""
        echo "Available modes:"
        echo "  minimal  - Simple > prompt"
        echo "  normal   - [flow:stage] rag> prompt"
        echo "  twoline  - Stats meters + flow prompt"
        echo ""
        echo "Usage: /cli <mode> [global]"
        echo "       /cli toggle"
        return
    fi

    case "$subcmd" in
        minimal|normal|twoline)
            rag_set_prompt_mode "$subcmd" "$scope"
            return 2  # Signal prompt rebuild
            ;;
        toggle)
            rag_toggle_prompt_mode
            return 2  # Signal prompt rebuild
            ;;
        *)
            echo "Unknown prompt mode: $subcmd"
            echo "Use: minimal, normal, twoline, toggle"
            ;;
    esac
}

# ============================================================================
# MULTICAT COMMANDS
# ============================================================================

rag_cmd_mc() {
    if command -v mc >/dev/null 2>&1; then
        mc "$@"
    else
        echo "Error: mc (multicat) not available" >&2
        echo "Source RAG aliases: source $RAG_SRC/bash/aliases.sh" >&2
    fi
}

rag_cmd_ms() {
    if command -v ms >/dev/null 2>&1; then
        ms "$@"
    else
        echo "Error: ms (multisplit) not available" >&2
    fi
}

rag_cmd_mi() {
    if command -v mi >/dev/null 2>&1; then
        mi "$@"
    else
        echo "Error: mi (mcinfo) not available" >&2
    fi
}

# ============================================================================
# KNOWLEDGE BASE COMMANDS
# ============================================================================

rag_cmd_tag() {
    local flow_id="$1"
    shift || true
    local tags=("$@")

    # If no flow_id, use active flow
    if [[ -z "$flow_id" ]]; then
        local flow_dir="$(get_active_flow_dir)"
        if [[ -n "$flow_dir" ]]; then
            flow_id=$(basename "$flow_dir")
        else
            echo "Error: No active flow" >&2
            echo "Usage: /tag [flow-id] tag1 tag2 ..." >&2
            return 1
        fi
    fi

    # Load KB manager
    if [[ -f "$RAG_SRC/core/kb_manager.sh" ]]; then
        source "$RAG_SRC/core/kb_manager.sh"
        source "$RAG_SRC/core/flow_manager_ttm.sh"
        kb_promote "$flow_id" "${tags[@]}"
    else
        echo "Error: kb_manager.sh not found" >&2
    fi
}

rag_cmd_kb() {
    local subcmd="$1"
    shift || true

    # Load KB manager
    if [[ -f "$RAG_SRC/core/kb_manager.sh" ]]; then
        source "$RAG_SRC/core/kb_manager.sh"
        source "$RAG_SRC/core/flow_manager_ttm.sh"
    else
        echo "Error: kb_manager.sh not found" >&2
        return 1
    fi

    case "$subcmd" in
        list|ls|"")
            kb_list "$@"
            ;;
        view|v)
            kb_view "$@"
            ;;
        search|s)
            kb_search "$@"
            ;;
        reindex)
            kb_reindex
            echo "✓ Knowledge base reindexed"
            ;;
        *)
            echo "Usage: /kb {list|view|search|reindex}"
            echo ""
            echo "  list [tag]       List KB entries (optionally filtered by tag)"
            echo "  view <flow-id>   View KB entry with colored markdown"
            echo "  search <query>   Search KB entries"
            echo "  reindex          Rebuild search indexes"
            ;;
    esac
}

# ============================================================================
# HELP COMMAND
# ============================================================================

rag_cmd_help() {
    local topic="$1"
    local interactive=0

    # Check for --interactive flag
    if [[ "$topic" == "--interactive" ]] || [[ "$topic" == "-i" ]]; then
        interactive=1
        topic="$2"
    elif [[ "$2" == "--interactive" ]] || [[ "$2" == "-i" ]]; then
        interactive=1
    fi

    # Check if bash/tree help system is available
    if command -v tree_help_show >/dev/null 2>&1; then
        if [[ $interactive -eq 1 ]]; then
            # Interactive navigation mode (explicit opt-in)
            echo "Interactive help browser"
            echo "Navigate: type topic name to dive in, 'b' to go back, 'q' to quit"
            echo ""
            tree_help_navigate "${topic:-rag}"
            return 0
        fi

        if [[ -n "$topic" ]]; then
            # Show specific topic (non-interactive)
            local help_path="rag.$topic"
            if tree_exists "$help_path"; then
                tree_help_show "$help_path"
            else
                # Try without rag prefix
                help_path="rag"
                if tree_exists "$help_path"; then
                    tree_help_show "$help_path"
                else
                    echo "Help topic not found: $topic"
                    echo "Try: /help (show overview) or /help --interactive (browse)"
                fi
            fi
        else
            # Show main help (non-interactive)
            tree_help_show "rag"
        fi
        return 0
    fi

    # Fallback to legacy help if bash/tree not available
    echo "Note: bash/tree not available, showing simplified help"
    echo ""

    cat <<'EOF'
RAG QUICK REFERENCE
===================

Essential Commands:
  /flow create "question"    Start new flow (sets prompt!)
  /e add file.sh             Add evidence
  /e 1                       View evidence (colored!)
  /p ["text"]                Edit or replace prompt
  /assemble                  Build context
  /submit @qa --async        Send to LLM (background)
  /r                         View response (colored markdown)
  /tag auth troubleshooting  Save to knowledge base

Knowledge Base:
  /kb list                   List saved Q&A
  /kb search <query>         Search knowledge base
  /kb view <flow-id>         View saved entry

Get More Help:
  /help flow                 Flow commands
  /help evidence             Evidence commands
  /help workflow             Quick start workflow
  /help --interactive        Browse help tree interactively

Shortcuts: /f (flow), /e (evidence), /h (help)
EOF
}

# ============================================================================
# REGISTER COMMANDS
# ============================================================================

rag_register_commands() {
    if ! command -v repl_register_slash_command >/dev/null 2>&1; then
        echo "Warning: bash/repl not loaded, cannot register commands" >&2
        return 1
    fi

    # Flow commands
    repl_register_slash_command "flow" rag_cmd_flow
    repl_register_slash_command "f" rag_cmd_flow  # Alias

    # Evidence commands
    repl_register_slash_command "evidence" rag_cmd_evidence
    repl_register_slash_command "e" rag_cmd_evidence  # Alias

    # Context commands
    repl_register_slash_command "select" rag_cmd_select
    repl_register_slash_command "assemble" rag_cmd_assemble
    repl_register_slash_command "submit" rag_cmd_submit

    # Prompt/question editing
    repl_register_slash_command "p" rag_cmd_prompt_edit  # Edit prompt/question

    # View response
    repl_register_slash_command "r" rag_cmd_response  # View LLM response

    # Display commands
    repl_register_slash_command "cli" rag_cmd_cli
    repl_register_slash_command "prompt" rag_cmd_cli  # Backwards compat (prompt mode)

    # Tool commands
    repl_register_slash_command "mc" rag_cmd_mc
    repl_register_slash_command "ms" rag_cmd_ms
    repl_register_slash_command "mi" rag_cmd_mi

    # System commands
    repl_register_slash_command "status" rag_cmd_status

    # Knowledge base commands
    repl_register_slash_command "tag" rag_cmd_tag
    repl_register_slash_command "kb" rag_cmd_kb

    # Help (override default with RAG-specific help)
    repl_register_slash_command "help" rag_cmd_help
    repl_register_slash_command "h" rag_cmd_help  # Alias
}

# Export functions
export -f rag_cmd_flow
export -f rag_cmd_evidence
export -f rag_cmd_select
export -f rag_cmd_assemble
export -f rag_cmd_prompt_edit
export -f rag_cmd_response
export -f rag_cmd_submit
export -f rag_cmd_status
export -f rag_cmd_cli
export -f rag_cmd_mc
export -f rag_cmd_ms
export -f rag_cmd_mi
export -f rag_cmd_help
export -f rag_cmd_tag
export -f rag_cmd_kb
export -f rag_register_commands
