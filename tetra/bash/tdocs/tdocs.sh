#!/usr/bin/env bash

# TDOCS - Tetra Document Manager
# TCS 3.0-compliant module for managing LLM-generated markdown documents

# Strong globals - ensure TETRA_DIR is set
if [[ -z "$TETRA_DIR" ]]; then
    TETRA_DIR="${HOME}/.tetra"
fi

: "${TDOCS_SRC:=$TETRA_SRC/bash/tdocs}"
: "${TDOCS_DIR:=$TETRA_DIR/tdocs}"

# Source publish module if not already loaded
if [[ -z "$(type -t tdocs_list_publish_targets)" ]]; then
    if [[ -f "$TDOCS_SRC/core/publish.sh" ]]; then
        source "$TDOCS_SRC/core/publish.sh"
    fi
fi

# Module directories
TDOCS_DB_DIR="${TDOCS_DIR}/db"
TDOCS_CONFIG_DIR="${TDOCS_DIR}/config"
TDOCS_CACHE_DIR="${TDOCS_DIR}/cache"

# Export for subshells
export TDOCS_SRC TDOCS_DIR TDOCS_DB_DIR TDOCS_CONFIG_DIR TDOCS_CACHE_DIR

# Load dependencies
# Load TDS via module system if not already loaded
if [[ "${TDS_LOADED}" != "true" ]] && [[ $(type -t tetra_load_module) == "function" ]]; then
    tetra_load_module "tds" || {
        echo "Error: Failed to load TDS module - tdocs requires TDS" >&2
        return 1
    }
elif [[ "${TDS_LOADED}" != "true" ]]; then
    # Fallback to direct sourcing if module system not available
    TDS_SRC="${TDS_SRC:-$TETRA_SRC/bash/tds}"
    if [[ -f "$TDS_SRC/includes.sh" ]]; then
        source "$TDS_SRC/includes.sh"
    else
        echo "Error: TDS not found at $TDS_SRC - tdocs requires TDS" >&2
        return 1
    fi
fi

# Ensure TDS_SRC is set for later use
TDS_SRC="${TDS_SRC:-$TETRA_SRC/bash/tds}"

# Load chroma for markdown rendering
if [[ "${CHROMA_LOADED}" != "true" ]] && [[ $(type -t tetra_load_module) == "function" ]]; then
    tetra_load_module "chroma" || {
        echo "Warning: Failed to load chroma module - markdown preview features limited" >&2
    }
elif [[ "${CHROMA_LOADED}" != "true" ]]; then
    # Fallback to direct sourcing
    CHROMA_SRC="${CHROMA_SRC:-$TETRA_SRC/bash/chroma}"
    if [[ -f "$CHROMA_SRC/includes.sh" ]]; then
        source "$CHROMA_SRC/includes.sh"
    else
        echo "Warning: chroma not found - markdown preview features limited" >&2
    fi
fi

# Load tree-based help system
if [[ -f "$TETRA_SRC/bash/tree/help.sh" ]]; then
    source "$TETRA_SRC/bash/tree/help.sh"
fi

# Load tdocs constants first (taxonomy definitions)
source "$TDOCS_SRC/core/tdocs_constants.sh"

# Load tdocs components
source "$TDOCS_SRC/core/index.sh"
source "$TDOCS_SRC/core/annotate.sh"
source "$TDOCS_SRC/core/metadata.sh"
source "$TDOCS_SRC/core/database.sh"
source "$TDOCS_SRC/core/classify.sh"
source "$TDOCS_SRC/core/search.sh"
source "$TDOCS_SRC/core/doctor.sh"
source "$TDOCS_SRC/core/chuck.sh"
source "$TDOCS_SRC/core/module_ops.sh"
source "$TDOCS_SRC/core/ranking.sh"
source "$TDOCS_SRC/core/scan.sh"
source "$TDOCS_SRC/core/review.sh"
source "$TDOCS_SRC/core/help.sh"
source "$TDOCS_SRC/ui/tokens.sh"
source "$TDOCS_SRC/ui/tags.sh"
source "$TDOCS_SRC/ui/preview.sh"
source "$TDOCS_SRC/ui/interactive.sh"
source "$TDOCS_SRC/integrations/rag_evidence.sh"

# Load actions
source "$TDOCS_SRC/actions/chuck.sh"
source "$TDOCS_SRC/action_interface.sh"

# Load help tree builders (extracted for maintainability)
source "$TDOCS_SRC/core/help_tree_builders.sh"

# Run automatic migrations (silent if nothing to migrate)
if [[ -d "$TDOCS_DB_DIR" ]] && command -v tdoc_migrate_category_to_lifecycle >/dev/null 2>&1; then
    tdoc_migrate_category_to_lifecycle 2>/dev/null || true
fi

# Module initialization
tdocs_module_init() {
    # Create necessary directories
    mkdir -p "$TDOCS_DB_DIR" "$TDOCS_CONFIG_DIR" "$TDOCS_CACHE_DIR"

    # Build help tree if tree module is loaded
    if declare -p TREE_TYPE >/dev/null 2>&1; then
        _tdocs_build_help_tree
    fi
}

# Module interface functions (for Tetra module system)
tdoc_module_actions() {
    # Auto-generate from help tree if available
    if declare -F tree_to_module_actions >/dev/null 2>&1; then
        tree_to_module_actions "help.tdocs"
    else
        # Fallback to hardcoded list
        echo "init view tag ls search evidence audit discover browse chuck about"
    fi
}

tdoc_module_properties() {
    echo "documents metadata tags database"
}

tdoc_module_info() {
    echo "TDOC - Tetra Document Manager"
    echo "Purpose: Manage and categorize LLM-generated markdown documents"
    local doc_count=$(find "$TDOCS_DB_DIR" -name "*.meta" 2>/dev/null | wc -l | tr -d ' ')
    echo "Tracked Documents: $doc_count"
}

# Main tdoc command interface - hierarchical dispatch
tdocs() {
    local category="${1:-}"

    if [[ -z "$category" ]]; then
        _tdocs_show_help
        return 0
    fi

    shift || true
    local subcmd="${1:-}"
    [[ -n "$subcmd" ]] && shift

    case "$category" in
        # DOC - Document Operations
        doc)
            case "$subcmd" in
                add)      tdocs_add_doc "$@" ;;
                view)     tdocs_view_doc "$@" ;;
                tag)      tdocs_tag_interactive "$@" ;;
                rank)
                    if [[ -z "$1" ]]; then
                        echo "Usage: tdocs doc rank <file>" >&2
                        return 1
                    fi
                    local meta=$(tdoc_get_metadata "$1")
                    if [[ -z "$meta" || "$meta" == "{}" ]]; then
                        echo "No metadata for: $1" >&2
                        return 1
                    fi
                    local lifecycle=$(_tdocs_json_get "$meta" '.lifecycle' 'W')
                    local priority=$(tdoc_lifecycle_priority "$lifecycle")
                    echo "Lifecycle: $lifecycle ($(tdoc_lifecycle_name "$lifecycle"))"
                    echo "Priority:  $priority"
                    ;;
                promote)
                    if [[ -z "$1" ]]; then
                        echo "Usage: tdocs doc promote <file>" >&2
                        return 1
                    fi
                    tdocs_promote_doc "$1"
                    ;;
                *)
                    echo "doc: add view tag rank promote" >&2
                    ;;
            esac
            ;;

        # FIND - Query Operations
        find)
            case "$subcmd" in
                ls|list)    tdocs_ls_docs "$@" ;;
                search)     tdocs_search_docs "$@" ;;
                evidence)   tdocs_evidence_for_query "$@" ;;
                filter)     tdocs_ls_docs "$@" ;;  # filter is enhanced ls
                *)
                    echo "find: ls search evidence filter" >&2
                    ;;
            esac
            ;;

        # SCAN - Discovery & Audit
        scan)
            case "$subcmd" in
                discover)   tdocs_discover_docs "$@" ;;
                audit)      tdocs_audit_docs "$@" ;;
                doctor)     tdocs_doctor "$@" ;;
                run)        tdocs_scan_docs "$@" ;;
                *)
                    echo "scan: discover audit doctor run" >&2
                    ;;
            esac
            ;;

        # MOD - Module Documentation
        mod)
            case "$subcmd" in
                show)       tdocs_module_docs "$@" ;;
                spec)       tdocs_show_spec "$@" ;;
                audit)      tdocs_audit_specs "$@" ;;
                types)      tdoc_show_types "$@" ;;
                *)
                    echo "mod: show spec audit types" >&2
                    ;;
            esac
            ;;

        # CHUCK - LLM Capture
        chuck)
            tdocs_action_chuck "$subcmd" "$@"
            ;;

        # PUB - Publishing
        pub)
            case "$subcmd" in
                publish)    tdocs_publish "$@" ;;
                targets)    tdocs_list_publish_targets "$@" ;;
                nginx)      tdocs_generate_nginx_config "$@" ;;
                *)
                    echo "pub: publish targets nginx" >&2
                    ;;
            esac
            ;;

        # UI - Interface & Info
        ui)
            case "$subcmd" in
                browse)
                    source "$TDOCS_SRC/tdocs_repl.sh"
                    tdocs_repl "$@"
                    ;;
                review)     tdocs_review_interactive "$@" ;;
                colors)     tdocs_color_explorer "$@" ;;
                about)      tdocs_about "$@" ;;
                *)
                    echo "ui: browse review colors about" >&2
                    ;;
            esac
            ;;

        # Special top-level commands
        ctx|context)
            tdocs_ctx "$subcmd" "$@"
            ;;
        help|--help|-h)
            if [[ -n "$subcmd" ]]; then
                tdocs_help_topic "$subcmd"
            else
                _tdocs_show_help
            fi
            ;;

        *)
            echo "Unknown category: $category" >&2
            echo "Categories: doc find scan mod chuck pub ui" >&2
            echo "Special: ctx help" >&2
            return 1
            ;;
    esac
}

_tdocs_show_help() {
    # TDS-based colors for categories
    local C_TITLE='\033[1;36m'      # Bright cyan (title)
    local C_CAT='\033[1;33m'        # Yellow (category)
    local C_DOC='\033[0;32m'        # Green (doc - env:0)
    local C_FIND='\033[0;34m'       # Blue (find - mode:0)
    local C_SCAN='\033[0;33m'       # Orange (scan - verbs:3)
    local C_MOD='\033[0;35m'        # Purple (mod - nouns:0)
    local C_CHUCK='\033[0;31m'      # Red (chuck - verbs:0)
    local C_PUB='\033[0;36m'        # Cyan (pub - mode:6)
    local C_UI='\033[0;32m'         # Green (ui - env:2)
    local C_GRAY='\033[0;90m'       # Grey (descriptions)
    local C_NC='\033[0m'

    cat <<EOF
$(echo -e "${C_TITLE}tdocs${C_NC}") - hierarchical document manager

$(echo -e "${C_DOC}doc${C_NC}")   $(echo -e "${C_GRAY}add view tag rank promote${C_NC}")
$(echo -e "${C_FIND}find${C_NC}")  $(echo -e "${C_GRAY}ls search evidence filter${C_NC}")
$(echo -e "${C_SCAN}scan${C_NC}")  $(echo -e "${C_GRAY}discover audit doctor run${C_NC}")
$(echo -e "${C_MOD}mod${C_NC}")   $(echo -e "${C_GRAY}show spec audit types${C_NC}")
$(echo -e "${C_CHUCK}chuck${C_NC}") $(echo -e "${C_GRAY}save list view promote delete search${C_NC}")
$(echo -e "${C_PUB}pub${C_NC}")   $(echo -e "${C_GRAY}publish targets nginx${C_NC}")
$(echo -e "${C_UI}ui${C_NC}")    $(echo -e "${C_GRAY}browse review colors about${C_NC}")

$(echo -e "${C_CAT}ctx${C_NC}")   $(echo -e "${C_GRAY}set clear show${C_NC}")  $(echo -e "${C_GRAY}project context${C_NC}")
$(echo -e "${C_CAT}help${C_NC}")  $(echo -e "${C_GRAY}<topic>${C_NC}")         $(echo -e "${C_GRAY}show help${C_NC}")

$(echo -e "${C_GRAY}Examples:${C_NC}")
  tdocs find ls              $(echo -e "${C_GRAY}list documents${C_NC}")
  tdocs doc add file.md      $(echo -e "${C_GRAY}add metadata${C_NC}")
  tdocs scan doctor --fix    $(echo -e "${C_GRAY}repair database${C_NC}")
  tdocs ui browse            $(echo -e "${C_GRAY}interactive REPL${C_NC}")
EOF
}

# Wrapper functions to bridge tdoc_ (singular) and tdocs_ (plural) naming
# The core functions use tdoc_ but the command interface uses tdocs_

tdocs_ls_docs() {
    # Local-first: if .md files exist in current dir, list them
    local md_count=$(find . -maxdepth 3 -name "*.md" -type f ! -path "*/.git/*" ! -path "*/node_modules/*" 2>/dev/null | wc -l | tr -d ' ')

    if [[ $md_count -gt 0 ]]; then
        # Set local context
        export TDOCS_REPL_CONTEXT="local"
        export TDOCS_DB_DIR="$PWD/tdocs/db"

        # Ensure tdocs exists
        if [[ ! -d "tdocs" ]]; then
            tdocs_index_init >/dev/null
        fi

        # Scan for latest state
        tdocs_scan_dir "." >/dev/null 2>&1

        # List with numbers
        echo "Local docs in $PWD:"
        echo ""

        local n=0
        while IFS= read -r file; do
            ((n++))
            local hash=$(tdoc_index_get_hash "$file")
            local size=$(wc -c < "$file" 2>/dev/null | tr -d ' ')
            local size_kb=$((size / 1024))

            # Get summary if available
            local summary=""
            if [[ -n "$hash" ]]; then
                local meta_file=$(tdoc_meta_file "$hash")
                if [[ -f "$meta_file" ]]; then
                    summary=$(grep "^summary:" "$meta_file" 2>/dev/null | cut -d' ' -f2-)
                fi
            fi

            printf "%3d. %-40s %4dK" "$n" "$file" "$size_kb"
            [[ -n "$hash" ]] && printf "  %s" "$hash"
            echo ""
            [[ -n "$summary" ]] && printf "     %s\n" "$summary"
        done < <(find . -maxdepth 3 -name "*.md" -type f ! -path "*/.git/*" ! -path "*/node_modules/*" 2>/dev/null | sort)

        echo ""
        echo "Total: $md_count documents"

    else
        # Fall back to global/legacy listing
        local cache_file="$TDOCS_CACHE_DIR/ls_output.cache"
        local cache_signature="${*}"
        local use_cache=false

        if [[ -z "$cache_signature" ]] || [[ "$cache_signature" =~ ^(--numbered)?$ ]]; then
            use_cache=true
        fi

        if [[ "$use_cache" == true ]] && _tdoc_cache_is_valid "$cache_file"; then
            cat "$cache_file"
            return 0
        fi

        if [[ "$use_cache" == true ]]; then
            tdoc_list_docs "$@" | tee "$cache_file"
        else
            tdoc_list_docs "$@"
        fi
    fi
}

tdocs_view_doc() {
    tdoc_view_doc "$@"
}

tdocs_search_docs() {
    tdoc_search_docs "$@"
}

tdocs_tag_interactive() {
    tdoc_tag_interactive "$@"
}

tdocs_add_doc() {
    tdoc_add_doc "$@"
}

tdocs_audit_docs() {
    tdoc_audit_docs "$@"
}

tdocs_scan_docs() {
    tdoc_scan_docs "$@"
}

tdocs_doctor() {
    tdoc_doctor "$@"
}

tdocs_evidence_for_query() {
    tdoc_evidence_for_query "$@"
}

# Additional wrappers for tdoc_ → tdocs_ consistency
tdocs_annotate() {
    tdoc_annotate "$@"
}

tdocs_list_notes() {
    tdoc_list_notes "$@"
}

tdocs_note_get() {
    tdoc_note_get "$@"
}

tdocs_action_chuck() {
    tdoc_action_chuck "$@"
}

tdocs_module_docs() {
    tdoc_module_docs "$@"
}

tdocs_show_spec() {
    tdoc_show_spec "$@"
}

tdocs_audit_specs() {
    tdoc_audit_specs "$@"
}

# Discover markdown files without metadata
tdocs_discover_docs() {
    # Wrapper for scan with discovery focus
    tdocs_scan "$@"
}

# Show document types taxonomy
tdoc_show_types() {
    local C_TITLE='\033[1;36m'
    local C_CAT='\033[0;33m'
    local C_TYPE='\033[0;32m'
    local C_GRAY='\033[0;90m'
    local C_NC='\033[0m'

    echo -e "${C_TITLE}Document Types${C_NC}"
    echo ""
    echo -e "${C_CAT}Learn${C_NC} ${C_GRAY}(how-to)${C_NC}"
    echo -e "  ${C_TYPE}guide${C_NC}         step-by-step instructions"
    echo -e "  ${C_TYPE}example${C_NC}       code samples and demos"
    echo -e "  ${C_TYPE}tutorial${C_NC}      comprehensive walkthroughs"
    echo ""
    echo -e "${C_CAT}Reference${C_NC} ${C_GRAY}(what-is)${C_NC}"
    echo -e "  ${C_TYPE}spec${C_NC}          specifications and contracts"
    echo -e "  ${C_TYPE}standard${C_NC}      conventions and standards"
    echo -e "  ${C_TYPE}reference${C_NC}     API and interface docs"
    echo ""
    echo -e "${C_CAT}Understand${C_NC} ${C_GRAY}(why)${C_NC}"
    echo -e "  ${C_TYPE}investigation${C_NC} research and analysis"
    echo -e "  ${C_TYPE}architecture${C_NC}  system design decisions"
    echo -e "  ${C_TYPE}explanation${C_NC}   conceptual documentation"
    echo ""
    echo -e "${C_CAT}Track${C_NC} ${C_GRAY}(what-changed)${C_NC}"
    echo -e "  ${C_TYPE}summary${C_NC}       meeting and session notes"
    echo -e "  ${C_TYPE}bug-fix${C_NC}       bug fix documentation"
    echo -e "  ${C_TYPE}refactor${C_NC}      refactoring notes"
    echo -e "  ${C_TYPE}changelog${C_NC}     version history"
    echo ""
    echo -e "${C_CAT}Plan${C_NC} ${C_GRAY}(what-next)${C_NC}"
    echo -e "  ${C_TYPE}plan${C_NC}          implementation plans"
    echo -e "  ${C_TYPE}proposal${C_NC}      feature proposals"
    echo -e "  ${C_TYPE}roadmap${C_NC}       project roadmaps"
    echo ""
    echo -e "${C_CAT}Other${C_NC}"
    echo -e "  ${C_TYPE}scratch${C_NC}       temporary notes (low rank)"
    echo ""
    echo -e "${C_GRAY}Lifecycle: D(raft) W(orking) S(table) C(anonical) X(archived)${C_NC}"
}

tdocs_scan_dir() {
    tdoc_scan_dir "$@"
}

tdocs_index_init() {
    tdoc_index_init "$@"
}

tdocs_init_doc() {
    tdoc_init_doc "$@"
}

# Helper: Add left margin to piped input
_tdocs_add_margin() {
    local margin="$1"
    while IFS= read -r line; do
        printf "%*s%s\n" "$margin" "" "$line"
    done
}

tdocs_about() {
    local use_pager=true
    local left_margin=4
    local right_margin=4
    local max_width=""

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --no-pager|-n)
                use_pager=false
                shift
                ;;
            --width|-w)
                max_width="$2"
                shift 2
                ;;
            --margin|-m)
                left_margin="$2"
                right_margin="$2"
                shift 2
                ;;
            --left-margin)
                left_margin="$2"
                shift 2
                ;;
            --right-margin)
                right_margin="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done

    local readme_path="$TDOCS_SRC/docs/README.md"

    if [[ ! -f "$readme_path" ]]; then
        echo "Error: Documentation not found at $readme_path" >&2
        return 1
    fi

    # Calculate content width
    local term_width=${COLUMNS:-80}
    local content_width=$((term_width - left_margin - right_margin))

    # Apply max width if specified
    if [[ -n "$max_width" ]]; then
        content_width=$max_width
    fi

    # Ensure minimum width
    [[ $content_width -lt 40 ]] && content_width=40

    # Use TDS markdown renderer if available, otherwise fall back to simpler rendering
    if declare -F tds_render_markdown >/dev/null 2>&1; then
        # TDS is available - use it with margins
        if [[ "$use_pager" == true ]]; then
            TDS_MARKDOWN_WIDTH=$content_width tds_render_markdown "$readme_path" | \
                _tdocs_add_margin "$left_margin" | \
                less -R
        else
            TDS_MARKDOWN_WIDTH=$content_width tds_render_markdown "$readme_path" | \
                _tdocs_add_margin "$left_margin"
        fi
    else
        # Fallback: Try bat, then less, then cat
        if [[ "$use_pager" == true ]]; then
            if command -v bat >/dev/null 2>&1; then
                bat --style=plain --paging=always --terminal-width=$content_width "$readme_path" | \
                    _tdocs_add_margin "$left_margin"
            elif command -v less >/dev/null 2>&1; then
                cat "$readme_path" | \
                    _tdocs_add_margin "$left_margin" | \
                    less -R
            else
                cat "$readme_path" | \
                    _tdocs_add_margin "$left_margin"
            fi
        else
            cat "$readme_path" | \
                _tdocs_add_margin "$left_margin"
        fi
    fi
}

# Auto-export all tdocs and tdoc functions
# This ensures all module functions are available in REPL and subshells
while IFS= read -r func; do
    export -f "$func"
done < <(declare -F | awk '{print $3}' | grep -E '^(tdocs?_|_tdoc)')

# Export main command
export -f tdocs
