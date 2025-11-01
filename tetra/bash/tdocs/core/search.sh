#!/usr/bin/env bash

# TDOC Search System
# Search and filter operations

# Search documents by query (simple grep for now)
tdoc_search_docs() {
    local query="$1"
    shift
    local options=("$@")

    if [[ -z "$query" ]]; then
        echo "Error: Search query required" >&2
        return 1
    fi

    echo "Searching for: $query"
    echo ""

    local results=()

    # Search through database metadata
    for meta_file in "$TDOCS_DB_DIR"/*.meta; do
        [[ ! -f "$meta_file" ]] && continue

        local meta=$(cat "$meta_file")
        local doc_path=$(echo "$meta" | grep -o '"doc_path": "[^"]*"' | cut -d'"' -f4)

        # Search in metadata
        if echo "$meta" | grep -qi "$query"; then
            results+=("$meta")
            continue
        fi

        # Search in document content
        if [[ -f "$doc_path" ]] && grep -qi "$query" "$doc_path" 2>/dev/null; then
            results+=("$meta")
        fi
    done

    if [[ ${#results[@]} -eq 0 ]]; then
        echo "No results found"
        return 0
    fi

    echo "Found ${#results[@]} result(s):"
    echo ""

    # Render results
    for meta in "${results[@]}"; do
        tdoc_render_compact "$meta" "$(echo "$meta" | grep -o '"doc_path": "[^"]*"' | cut -d'"' -f4)"
        echo ""
    done
}

# List documents with filters
tdoc_list_docs() {
    local show_preview=false
    local category=""
    local module=""
    local tags=""
    local use_color=true

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --preview)
                show_preview=true
                shift
                ;;
            --core)
                category="core"
                shift
                ;;
            --other)
                category="other"
                shift
                ;;
            --module)
                module="$2"
                shift 2
                ;;
            --tags)
                tags="$2"
                shift 2
                ;;
            --no-color)
                use_color=false
                shift
                ;;
            --help|-h)
                cat <<EOF
tdoc list - List documents with filters

USAGE:
  tdoc list [OPTIONS]

OPTIONS:
  --core               List core documents only
  --other              List other (working) documents
  --module <name>      Filter by module
  --tags <tags>        Filter by tags (comma-separated)
  --preview            Show metadata preview
  --no-color           Disable color output

EXAMPLES:
  tdoc list --core
  tdoc list --module rag --tags bug-fix
  tdoc list --preview

EOF
                return 0
                ;;
            *)
                shift
                ;;
        esac
    done

    # Build query
    local query_args=()
    [[ -n "$category" ]] && query_args+=("--category=$category")
    [[ -n "$module" ]] && query_args+=("--module=$module")
    [[ -n "$tags" ]] && query_args+=("--tags=$tags")

    # Get documents from database
    local results=()
    while IFS= read -r meta; do
        [[ -z "$meta" ]] && continue
        results+=("$meta")
    done < <(tdoc_db_list "${query_args[@]}")

    if [[ ${#results[@]} -eq 0 ]]; then
        echo "No documents found"
        return 0
    fi

    echo "Found ${#results[@]} document(s):"
    echo ""

    # Render results
    if [[ "$show_preview" == "true" ]]; then
        tdoc_render_list_with_preview "${results[@]}"
    else
        for meta in "${results[@]}"; do
            local doc_path=$(echo "$meta" | grep -o '"doc_path": "[^"]*"' | cut -d'"' -f4)
            tdoc_render_compact "$meta" "$doc_path"
            printf "\n"
        done
    fi
}

# Audit documents - find those without metadata
tdoc_audit_docs() {
    echo "Auditing documents for metadata..."
    echo ""

    local missing=()

    # Check top-level docs
    for file in "$TETRA_SRC/docs"/**/*.md; do
        [[ ! -f "$file" ]] && continue

        local meta=$(tdoc_get_metadata "$file")
        if [[ "$meta" == "{}" ]]; then
            missing+=("$file")
        fi
    done

    # Check module docs
    for file in "$TETRA_SRC/bash"/*/docs/**/*.md; do
        [[ ! -f "$file" ]] && continue

        local meta=$(tdoc_get_metadata "$file")
        if [[ "$meta" == "{}" ]]; then
            missing+=("$file")
        fi
    done

    if [[ ${#missing[@]} -eq 0 ]]; then
        echo "✓ All documents have metadata"
        return 0
    fi

    echo "Found ${#missing[@]} document(s) without metadata:"
    echo ""

    for file in "${missing[@]}"; do
        echo "  $file"
    done

    echo ""
    echo "Run 'tdocs init <file>' to add metadata"
    echo "Or run 'tdocs discover' to auto-index all documents"
}

# Auto-discover and index all documents
tdoc_discover_docs() {
    local auto_init="${1:-false}"  # --auto-init to automatically initialize all

    echo "Discovering documents..."
    echo ""

    local discovered=()
    local already_indexed=()
    local to_index=()

    # Scan top-level docs
    while IFS= read -r file; do
        [[ ! -f "$file" ]] && continue
        discovered+=("$file")

        local meta=$(tdoc_get_metadata "$file")
        if [[ "$meta" == "{}" ]]; then
            to_index+=("$file")
        else
            already_indexed+=("$file")
        fi
    done < <(find "$TETRA_SRC/docs" -name "*.md" -type f 2>/dev/null)

    # Scan module docs
    while IFS= read -r file; do
        [[ ! -f "$file" ]] && continue
        discovered+=("$file")

        local meta=$(tdoc_get_metadata "$file")
        if [[ "$meta" == "{}" ]]; then
            to_index+=("$file")
        else
            already_indexed+=("$file")
        fi
    done < <(find "$TETRA_SRC/bash" -path "*/docs/*.md" -type f 2>/dev/null)

    echo "Discovery Summary:"
    echo "  Total found: ${#discovered[@]}"
    echo "  Already indexed: ${#already_indexed[@]}"
    echo "  Need indexing: ${#to_index[@]}"
    echo ""

    if [[ ${#to_index[@]} -eq 0 ]]; then
        echo "✓ All documents are indexed"
        return 0
    fi

    # Auto-init if requested
    if [[ "$auto_init" == "--auto-init" ]]; then
        echo "Auto-indexing ${#to_index[@]} document(s)..."
        echo ""

        local count=0
        for file in "${to_index[@]}"; do
            # Auto-detect metadata
            local module=$(tdoc_detect_module "$file")
            local category=$(tdoc_suggest_category "$file")
            local type=$(tdoc_suggest_type "$file")
            local tags=$(tdoc_suggest_tags "$file")

            # Create database entry without modifying the file
            local timestamp=$(tdoc_db_create "$file" "$category" "$type" "$tags" "$module" "discovered")

            ((count++))
            if (( count % 10 == 0 )); then
                echo "  Indexed $count/${#to_index[@]}..."
            fi
        done

        echo ""
        echo "✓ Indexed ${#to_index[@]} document(s)"
        echo ""
        echo "Note: Documents were indexed without modifying files"
        echo "Use 'tdocs init <file>' to add frontmatter to specific files"
    else
        echo "Documents needing indexing:"
        for file in "${to_index[@]}"; do
            local rel_path=${file#$TETRA_SRC/}
            echo "  $rel_path"
        done
        echo ""
        echo "Run 'tdocs discover --auto-init' to automatically index all"
    fi
}
