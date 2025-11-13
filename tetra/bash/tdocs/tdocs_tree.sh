#!/usr/bin/env bash
# TDocs Tree - Help and Completion Tree Structure
# Defines the tdocs (type-based documentation) command tree

# Source dependencies
source "$TETRA_SRC/bash/tree/core.sh"

# Initialize tdocs tree under help.tdocs namespace
tdocs_tree_init() {
    local ns="help.tdocs"

    # Root category
    tree_insert "$ns" "category" \
        title="Type-Based Documentation System" \
        description="Intelligent documentation ranking and search with type-based scoring"

    # ========================================================================
    # CORE COMMANDS
    # ========================================================================

    # ls - List documents with ranks
    tree_insert "$ns.ls" "command" \
        title="List documents with rankings" \
        description="Display all indexed documents sorted by rank" \
        usage="tdocs ls" \
        handler="tdocs_ls" \
        aliases="list"

    # view - View a specific document
    tree_insert "$ns.view" "command" \
        title="View document by number" \
        description="Display a specific document from the ls output" \
        usage="tdocs view <n>" \
        handler="tdocs_view" \
        examples="tdocs view 1
tdocs view 5"

    # search - Search documents
    tree_insert "$ns.search" "command" \
        title="Search documents" \
        description="Full-text search across all indexed documents" \
        usage="tdocs search <query>" \
        handler="tdocs_search" \
        examples="tdocs search 'authentication'
tdocs search 'API integration'"

    # rank - Explain ranking
    tree_insert "$ns.rank" "command" \
        title="Explain document ranking" \
        description="Show why a document received its rank score" \
        usage="tdocs rank <file>" \
        handler="tdocs_rank"

    # ========================================================================
    # DOCUMENT MANAGEMENT
    # ========================================================================

    # add - Add/edit metadata
    tree_insert "$ns.add" "command" \
        title="Add or edit document metadata" \
        description="Add or modify metadata tags for a document" \
        usage="tdocs add <file>" \
        handler="tdocs_add"

    # promote - Change document type
    tree_insert "$ns.promote" "command" \
        title="Promote document type" \
        description="Change document type: notes (0.3) → guide (0.6) → reference (1.0)" \
        usage="tdocs promote <file>" \
        handler="tdocs_promote" \
        examples="tdocs promote myfile.md"

    # scan - Refresh index
    tree_insert "$ns.scan" "command" \
        title="Scan and refresh document index" \
        description="Re-index all documents and update rankings" \
        usage="tdocs scan [path]" \
        handler="tdocs_scan"

    # ========================================================================
    # MODULE DOCUMENTATION
    # ========================================================================

    # module - View module documentation
    tree_insert "$ns.module" "command" \
        title="View module documentation" \
        description="Display documentation for a specific module" \
        usage="tdocs module <name>" \
        handler="tdocs_module" \
        examples="tdocs module tsm
tdocs module org"

    # spec - View module specification
    tree_insert "$ns.spec" "command" \
        title="View module specification" \
        description="Display the technical specification for a module" \
        usage="tdocs spec <name>" \
        handler="tdocs_spec" \
        examples="tdocs spec tsm
tdocs spec repl"

    # ========================================================================
    # INTERACTIVE MODE
    # ========================================================================

    # browse - Interactive REPL
    tree_insert "$ns.browse" "command" \
        title="Interactive documentation browser" \
        description="Launch REPL mode for browsing documentation" \
        usage="tdocs browse" \
        handler="tdocs_browse" \
        aliases="repl"

    # ========================================================================
    # HELP TOPICS
    # ========================================================================

    # help.types - Document type information
    tree_insert "$ns.types" "topic" \
        title="Document type scoring" \
        description="reference: 1.0 (authoritative), guide: 0.6 (tutorial), notes: 0.3 (scratch)"

    # help.filter - Filtering documentation
    tree_insert "$ns.filter" "topic" \
        title="Filtering and search" \
        description="How to filter documents by type, module, or content"
}

# Export the init function
export -f tdocs_tree_init
