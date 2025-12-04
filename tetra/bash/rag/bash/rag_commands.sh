#!/usr/bin/env bash
# rag_commands.sh - RAG REPL command loader
# Sources all command modules and registers them with bash/repl

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"

# Source dependency management
source "$RAG_SRC/core/deps.sh"

# Load error handling
rag_load_module "error"

# Load prompts (needed for REPL)
source "$RAG_SRC/bash/rag_prompts.sh"

# ============================================================================
# LOAD ALL COMMAND MODULES
# ============================================================================

# Source all command modules from bash/commands/
for cmd_module in "$RAG_SRC/bash/commands"/*.sh; do
    if [[ -f "$cmd_module" ]]; then
        source "$cmd_module"
    fi
done

# ============================================================================
# REGISTER COMMANDS
# ============================================================================

rag_register_commands() {
    if ! command -v repl_register_slash_command >/dev/null 2>&1; then
        echo "Warning: bash/repl not loaded, cannot register commands" >&2
        return 1
    fi

    # Workflow commands (quick, bundle, compare, assemble, submit, response, prompt edit)
    repl_register_slash_command "quick" rag_cmd_quick
    repl_register_slash_command "q" rag_cmd_quick  # Alias
    repl_register_slash_command "bundle" rag_cmd_bundle
    repl_register_slash_command "compare" rag_cmd_compare
    repl_register_slash_command "workflow" rag_cmd_workflow
    repl_register_slash_command "assemble" rag_cmd_assemble
    repl_register_slash_command "submit" rag_cmd_submit
    repl_register_slash_command "p" rag_cmd_prompt_edit  # Edit prompt/question
    repl_register_slash_command "r" rag_cmd_response  # View LLM response

    # Session commands
    repl_register_slash_command "session" rag_cmd_session
    repl_register_slash_command "s" rag_cmd_session  # Alias

    # Flow commands
    repl_register_slash_command "flow" rag_cmd_flow
    repl_register_slash_command "f" rag_cmd_flow  # Alias

    # Evidence commands
    repl_register_slash_command "evidence" rag_cmd_evidence
    repl_register_slash_command "e" rag_cmd_evidence  # Alias
    repl_register_slash_command "select" rag_cmd_select

    # Knowledge base commands
    repl_register_slash_command "tag" rag_cmd_tag
    repl_register_slash_command "kb" rag_cmd_kb

    # QA History Retrieval
    repl_register_slash_command "qa" rag_cmd_qa
    repl_register_slash_command "a" rag_cmd_a  # Quick access to last QA answer

    # Tool commands
    repl_register_slash_command "mc" rag_cmd_mc
    repl_register_slash_command "ms" rag_cmd_ms
    repl_register_slash_command "mi" rag_cmd_mi

    # System commands
    repl_register_slash_command "status" rag_cmd_status
    repl_register_slash_command "cli" rag_cmd_cli
    repl_register_slash_command "prompt" rag_cmd_cli  # Backwards compat (prompt mode)

    # Help (override default with RAG-specific help)
    repl_register_slash_command "help" rag_cmd_help
    repl_register_slash_command "h" rag_cmd_help  # Alias
}

# Export registration function
export -f rag_register_commands
