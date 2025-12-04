#!/usr/bin/env bash
# commands/workflow.sh - Workflow command handlers (quick, bundle, compare, assemble, submit)

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"

# Quick command - delegate to main rag.sh
rag_cmd_quick() {
    if declare -f rag_quick >/dev/null 2>&1; then
        rag_quick "$@"
    else
        echo "Error: rag_quick not available" >&2
        echo "Ensure RAG module is properly loaded" >&2
        return 1
    fi
}

# Bundle command - delegate to main rag.sh
rag_cmd_bundle() {
    if declare -f rag_bundle >/dev/null 2>&1; then
        rag_bundle "$@"
    else
        echo "Error: rag_bundle not available" >&2
        echo "Ensure RAG module is properly loaded" >&2
        return 1
    fi
}

# Compare command - delegate to main rag.sh
rag_cmd_compare() {
    if declare -f rag_compare >/dev/null 2>&1; then
        rag_compare "$@"
    else
        echo "Error: rag_compare not available" >&2
        echo "Ensure RAG module is properly loaded" >&2
        return 1
    fi
}

# Workflow guide
rag_cmd_workflow() {
    cat <<'EOF'
RAG Quick Start Workflow
========================

Basic workflow for answering questions about your codebase:

1. /flow create "your question"
   └─ Creates a new flow with your question as the prompt

2. /e add file.sh
   └─ Add evidence files (source code, docs, etc.)
   └─ Use selectors for specific ranges:
      • /e add file.sh::100,200     (lines 100-200)
      • /e add file.sh::100         (from line 100 to EOF)
      • /e add file.sh#important    (with tags)

3. /assemble
   └─ Builds the context from your evidence files
   └─ Creates prompt.mdctx ready for submission

4. /submit @qa [--async]
   └─ Sends the assembled context to the QA agent
   └─ Use --async to run in background

5. /r
   └─ View the LLM's response (colored markdown)

6. /tag <tags...>
   └─ Promote flow to knowledge base with tags
   └─ Example: /tag auth troubleshooting

Optional commands:
  /p "new question"     Replace the prompt/question
  /e list               List all evidence files
  /e 1                  View evidence file #1
  /e toggle 100         Toggle evidence on/off
  /flow status          Show current flow status
  /kb list              List knowledge base entries

Tip: Use /help <topic> for more details on each command
     Example: /help flow, /help evidence

EOF
}

# Assemble command
rag_cmd_assemble() {
    # Lazy load assembler
    rag_require_assembler

    if command -v assemble_ctx >/dev/null 2>&1; then
        assemble_ctx "$@"
    else
        echo "Error: assemble_ctx not available" >&2
    fi
}

# Submit command
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

    # Lazy load QA submit
    rag_require_qa_submit

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
}

# Prompt edit command
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

# Response view command
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

export -f rag_cmd_quick
export -f rag_cmd_bundle
export -f rag_cmd_compare
export -f rag_cmd_workflow
export -f rag_cmd_assemble
export -f rag_cmd_submit
export -f rag_cmd_prompt_edit
export -f rag_cmd_response
