#!/usr/bin/env bash

# TDOC - Tetra Document Manager
# TCS 3.0-compliant module for managing LLM-generated markdown documents

# Strong globals
: "${TDOC_SRC:=$TETRA_SRC/bash/tdoc}"
: "${TDOC_DIR:=$TETRA_DIR/tdoc}"

# Module directories
TDOC_DB_DIR="${TDOC_DIR}/db"
TDOC_CONFIG_DIR="${TDOC_DIR}/config"
TDOC_CACHE_DIR="${TDOC_DIR}/cache"

# Load dependencies
TDS_SRC="${TDS_SRC:-$TETRA_SRC/bash/tds}"
if [[ -f "$TDS_SRC/tds.sh" ]]; then
    source "$TDS_SRC/tds.sh"
else
    echo "Warning: TDS not found at $TDS_SRC - color features disabled" >&2
fi

# Load tdoc components
source "$TDOC_SRC/core/metadata.sh"
source "$TDOC_SRC/core/database.sh"
source "$TDOC_SRC/core/index.sh"
source "$TDOC_SRC/core/classify.sh"
source "$TDOC_SRC/core/search.sh"
source "$TDOC_SRC/ui/tags.sh"
source "$TDOC_SRC/ui/preview.sh"
source "$TDOC_SRC/ui/interactive.sh"
source "$TDOC_SRC/integrations/rag_evidence.sh"

# Module initialization
tdoc_module_init() {
    # Create necessary directories
    mkdir -p "$TDOC_DB_DIR" "$TDOC_CONFIG_DIR" "$TDOC_CACHE_DIR"

    # Initialize indexes if they don't exist
    tdoc_index_init

    echo "tdoc module initialized successfully"
}

# Module interface functions (for Tetra module system)
tdoc_module_actions() {
    echo "init view tag list search evidence audit"
}

tdoc_module_properties() {
    echo "documents metadata tags indexes database"
}

tdoc_module_info() {
    echo "TDOC - Tetra Document Manager"
    echo "Purpose: Manage and categorize LLM-generated markdown documents"
    local doc_count=$(find "$TDOC_DB_DIR" -name "*.meta" 2>/dev/null | wc -l | tr -d ' ')
    echo "Tracked Documents: $doc_count"
}

# Main tdoc command interface
tdoc() {
    local action="${1:-}"

    if [[ -z "$action" ]]; then
        _tdoc_show_help
        return 0
    fi

    shift || true

    case "$action" in
        init)
            tdoc_init_doc "$@"
            ;;
        view)
            tdoc_view_doc "$@"
            ;;
        tag)
            tdoc_tag_interactive "$@"
            ;;
        list|ls)
            tdoc_list_docs "$@"
            ;;
        search)
            tdoc_search_docs "$@"
            ;;
        evidence)
            tdoc_evidence_for_query "$@"
            ;;
        audit)
            tdoc_audit_docs "$@"
            ;;
        index)
            case "${1:-}" in
                --rebuild)
                    tdoc_index_rebuild
                    ;;
                *)
                    tdoc_index_status
                    ;;
            esac
            ;;
        help|--help|-h)
            _tdoc_show_help
            ;;
        *)
            echo "Unknown command: $action" >&2
            echo "Try: tdoc help" >&2
            return 1
            ;;
    esac
}

_tdoc_show_help() {
    cat <<'EOF'
tdoc - Tetra Document Manager

USAGE:
  tdoc <command> [OPTIONS] [ARGS]

COMMANDS:
  init <file>              Add metadata to document (interactive)
  view <file>              Preview document with color rendering
  tag <file>               Interactive tag editor

  list                     List all documents
  list --core              List core documents only
  list --other             List other (working) documents
  list --module <name>     List module-specific documents
  list --tags <tags>       List by tags (comma-separated)

  search <query>           Full-text search across documents
  evidence <query>         Get evidence-weighted doc list (for RAG)

  audit                    Find documents without metadata
  index                    Show index status
  index --rebuild          Rebuild all indexes

OPTIONS:
  init:
    --core               Mark as core document
    --other              Mark as other (working) document
    --type <type>        Document type (spec|guide|bug-fix|refactor|plan|summary)
    --tags <tags>        Comma-separated tags
    --module <name>      Module name (auto-detected if in bash/<module>/)

  view:
    --pager              Use pager for output
    --meta-only          Show metadata only
    --raw                Show raw file with frontmatter

  list:
    --preview            Show metadata preview for each doc
    --color              Force color output (default if terminal)

EXAMPLES:
  # Initialize a new document interactively
  tdoc init bash/rag/docs/NEW_FEATURE.md

  # Non-interactive init
  tdoc init docs/API_SPEC.md --core --type spec

  # View with color preview
  tdoc view bash/rag/docs/REPL_FIXES_20251016.md

  # List all bug fixes in rag module
  tdoc list --module rag --tags bug-fix

  # Get evidence for RAG query
  tdoc evidence "bash completion system"

EOF
}

# Export for use as command
export -f tdoc
