#!/usr/bin/env bash
# RAG Tree - Help and Completion Tree Structure
# Defines the RAG (Retrieval-Augmented Generation) command tree

# Source dependencies
source "$TETRA_SRC/bash/tree/core.sh"

# Initialize rag tree under help.rag namespace
rag_tree_init() {
    local ns="help.rag"

    # Root category
    tree_insert "$ns" "category" \
        title="RAG - Retrieval-Augmented Generation" \
        description="Evidence selection and context assembly for AI workflows"

    # ========================================================================
    # FLOW MANAGEMENT
    # ========================================================================

    # flow category
    tree_insert "$ns.flow" "category" \
        title="Flow management" \
        description="Create and manage RAG workflows"

    tree_insert "$ns.flow.start" "command" \
        title="Start new flow" \
        description="Create a new RAG workflow" \
        usage="rag flow start \"<description>\"" \
        handler="rag_flow_start" \
        examples="rag flow start \"Implement user authentication\""

    tree_insert "$ns.flow.status" "command" \
        title="Show flow status" \
        description="Display current flow state and checkpoints" \
        usage="rag flow status" \
        handler="rag_flow_status"

    tree_insert "$ns.flow.resume" "command" \
        title="Resume flow" \
        description="Resume flow from a checkpoint" \
        usage="rag flow resume [id]" \
        handler="rag_flow_resume"

    tree_insert "$ns.flow.list" "command" \
        title="List all flows" \
        description="Show all available RAG flows" \
        usage="rag flow list" \
        handler="rag_flow_list"

    # ========================================================================
    # CONTEXT COMMANDS
    # ========================================================================

    # select - Evidence selection
    tree_insert "$ns.select" "command" \
        title="Select evidence" \
        description="Use ULM to select relevant code/documents" \
        usage="rag select \"<query>\"" \
        handler="rag_select" \
        examples="rag select \"authentication middleware\"
rag select \"database connection logic\""

    # assemble - Context assembly
    tree_insert "$ns.assemble" "command" \
        title="Assemble context" \
        description="Assemble selected evidence into prompt.mdctx" \
        usage="rag assemble" \
        handler="rag_assemble"

    # plan - Preview assembly
    tree_insert "$ns.plan" "command" \
        title="Preview assembly plan" \
        description="Show what will be assembled without executing" \
        usage="rag plan" \
        handler="rag_plan"

    # submit - Submit to agent
    tree_insert "$ns.submit" "command" \
        title="Submit to AI agent" \
        description="Submit assembled context to specified agent" \
        usage="rag submit @<agent>" \
        handler="rag_submit" \
        examples="rag submit @qa
rag submit @claude"

    # ========================================================================
    # MULTICAT TOOLS
    # ========================================================================

    # mc - Create MULTICAT
    tree_insert "$ns.mc" "command" \
        title="Create MULTICAT file" \
        description="Combine multiple files into a single MULTICAT format" \
        usage="rag mc <files...>" \
        handler="tetra_rag_mc" \
        examples="rag mc src/*.js
rag mc docs/ tests/"

    # ms - Split MULTICAT
    tree_insert "$ns.ms" "command" \
        title="Split MULTICAT file" \
        description="Extract files from MULTICAT back to filesystem" \
        usage="rag ms <file.mc>" \
        handler="tetra_rag_ms"

    # mi - MULTICAT info
    tree_insert "$ns.mi" "command" \
        title="Show MULTICAT info" \
        description="Display metadata and contents of MULTICAT file" \
        usage="rag mi <file.mc>" \
        handler="tetra_rag_mi"

    # ========================================================================
    # SYSTEM COMMANDS
    # ========================================================================

    # repl - Interactive REPL
    tree_insert "$ns.repl" "command" \
        title="Interactive RAG REPL" \
        description="Start interactive command-line interface for RAG" \
        usage="rag repl" \
        handler="rag_repl"

    # status - System status
    tree_insert "$ns.status" "command" \
        title="Show RAG system status" \
        description="Display configuration, database, and flow status" \
        usage="rag status" \
        handler="rag_status"

    # init - Initialize system
    tree_insert "$ns.init" "command" \
        title="Initialize RAG system" \
        description="Set up RAG directories and configuration" \
        usage="rag init" \
        handler="rag_init"
}

# Export the init function
export -f rag_tree_init
