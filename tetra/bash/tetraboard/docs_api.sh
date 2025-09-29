#!/usr/bin/env bash
# docs_api.sh - TetraBoard documentation API for cross-module documentation
set -euo pipefail

TETRABOARD_DIR="${BASH_SOURCE[0]%/*}"
TETRA_BASE_DIR="$(dirname "$TETRABOARD_DIR")"
DOCS_CACHE_DIR="$TETRABOARD_DIR/data/docs_cache"

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}📚 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_concept() {
    echo -e "${PURPLE}💡 $1${NC}"
}

# Initialize documentation system
init_docs() {
    mkdir -p "$DOCS_CACHE_DIR"/{index,cross_refs,unified}

    print_success "Documentation system initialized"
}

# List all documentation across modules
list_docs() {
    local filter="${1:-}"

    print_info "TETRA Documentation Index"
    echo

    # Find all module docs
    local modules
    mapfile -t modules < <(find "$TETRA_BASE_DIR" -name "docs" -type d | sort)

    for module_docs in "${modules[@]}"; do
        local module_name
        module_name=$(basename "$(dirname "$module_docs")")

        echo "📂 $module_name/"

        # List README and subdirectories
        if [[ -f "$module_docs/README.md" ]]; then
            echo "  📄 README.md - Complete $module_name guide"
        fi

        # List concept documents
        if [[ -d "$module_docs/concepts" ]]; then
            echo "  📁 concepts/"
            find "$module_docs/concepts" -name "*.md" -type f | while read -r concept_file; do
                local concept_name
                concept_name=$(basename "$concept_file" .md)
                echo "    📝 $concept_name.md"
            done
        fi

        # List guides
        if [[ -d "$module_docs/guides" ]]; then
            echo "  📁 guides/"
            find "$module_docs/guides" -name "*.md" -type f | while read -r guide_file; do
                local guide_name
                guide_name=$(basename "$guide_file" .md)
                echo "    📋 $guide_name.md"
            done
        fi

        echo
    done
}

# Search across all documentation
search_docs() {
    local search_term="$1"
    local case_sensitive="${2:-false}"

    print_info "Searching for '$search_term' across all documentation"
    echo

    local grep_options="-n -H --color=always"
    if [[ "$case_sensitive" == "false" ]]; then
        grep_options="$grep_options -i"
    fi

    # Search all .md files in docs directories
    find "$TETRA_BASE_DIR" -path "*/docs/*.md" -type f -exec grep $grep_options "$search_term" {} \; | \
    while IFS=: read -r file line content; do
        local module_name
        module_name=$(echo "$file" | sed "s|$TETRA_BASE_DIR/||" | cut -d'/' -f1)
        local doc_path
        doc_path=$(echo "$file" | sed "s|.*/docs/||")

        printf "📍 %s/docs/%s:%s\n" "$module_name" "$doc_path" "$line"
        printf "   %s\n\n" "$content"
    done
}

# Show documentation for specific module
show_module_docs() {
    local module="$1"
    local section="${2:-}"

    local module_docs_dir="$TETRA_BASE_DIR/$module/docs"

    if [[ ! -d "$module_docs_dir" ]]; then
        echo "❌ Module '$module' not found or has no documentation"
        return 1
    fi

    if [[ -n "$section" ]]; then
        local section_file="$module_docs_dir/$section"
        if [[ -f "$section_file" ]]; then
            cat "$section_file"
        elif [[ -f "${section_file}.md" ]]; then
            cat "${section_file}.md"
        else
            echo "❌ Section '$section' not found in $module documentation"
            return 1
        fi
    else
        # Show module README
        if [[ -f "$module_docs_dir/README.md" ]]; then
            cat "$module_docs_dir/README.md"
        else
            echo "❌ No README.md found for module '$module'"
            return 1
        fi
    fi
}

# Find concept across all modules
find_concept() {
    local concept="$1"

    print_info "Finding concept '$concept' across modules"
    echo

    local found=false

    # Search in concepts directories
    find "$TETRA_BASE_DIR" -path "*/docs/concepts/*.md" -type f | while read -r concept_file; do
        local concept_name
        concept_name=$(basename "$concept_file" .md)

        if [[ "$concept_name" == "$concept" ]] || echo "$concept_name" | grep -qi "$concept"; then
            local module_name
            module_name=$(echo "$concept_file" | sed "s|$TETRA_BASE_DIR/||" | cut -d'/' -f1)

            echo "📍 Found in $module_name/docs/concepts/$concept_name.md"
            echo

            # Show first few lines as preview
            head -10 "$concept_file" | sed 's/^/  /'
            echo
            echo "  ..."
            echo
            found=true
        fi
    done

    # Also search in main README files
    find "$TETRA_BASE_DIR" -path "*/docs/README.md" -type f -exec grep -l -i "$concept" {} \; | while read -r readme_file; do
        local module_name
        module_name=$(echo "$readme_file" | sed "s|$TETRA_BASE_DIR/||" | cut -d'/' -f1)

        echo "📍 Mentioned in $module_name/docs/README.md"

        # Show matching lines with context
        grep -n -i -C 2 "$concept" "$readme_file" | head -10 | sed 's/^/  /'
        echo
    done

    if [[ "$found" == "false" ]]; then
        echo "❓ Concept '$concept' not found in dedicated concept files"
    fi
}

# Generate unified documentation
generate_unified() {
    local output_file="${1:-$DOCS_CACHE_DIR/unified/TETRA_complete.md}"

    print_info "Generating unified TETRA documentation"

    {
        echo "# TETRA: Complete System Documentation"
        echo
        echo "*Generated: $(date '+%Y-%m-%d %H:%M:%S')*"
        echo
        echo "This document contains the complete TETRA system documentation,"
        echo "combining all module documentation into a single, terminal-friendly guide."
        echo
        echo "---"
        echo

        # Include master TetraBoard documentation
        if [[ -f "$TETRABOARD_DIR/docs/README.md" ]]; then
            cat "$TETRABOARD_DIR/docs/README.md"
            echo
            echo "---"
            echo
        fi

        # Include ULM documentation
        if [[ -f "$TETRA_BASE_DIR/ulm/docs/README.md" ]]; then
            echo "# Appendix A: ULM Documentation"
            echo
            cat "$TETRA_BASE_DIR/ulm/docs/README.md"
            echo
            echo "---"
            echo
        fi

        # Include RAG documentation
        if [[ -f "$TETRA_BASE_DIR/rag/docs/README.md" ]]; then
            echo "# Appendix B: RAG Documentation"
            echo
            cat "$TETRA_BASE_DIR/rag/docs/README.md"
            echo
            echo "---"
            echo
        fi

        # Include key concept documents
        echo "# Appendix C: Key Concepts"
        echo

        # Include ExM vs A framework
        if [[ -f "$TETRABOARD_DIR/docs/concepts/exm-vs-a-framework.md" ]]; then
            echo "## C.1 ExM vs A Framework"
            echo
            tail -n +3 "$TETRABOARD_DIR/docs/concepts/exm-vs-a-framework.md"
            echo
        fi

        echo "---"
        echo
        echo "*Complete TETRA Documentation - Generated $(date)*"

    } > "$output_file"

    print_success "Unified documentation generated: $output_file"
    print_info "View with: cat $output_file | less"
}

# Update cross-references between modules
update_cross_references() {
    print_info "Updating cross-references between modules"

    # Find all .md files with "See Also" sections
    find "$TETRA_BASE_DIR" -path "*/docs/*.md" -type f -exec grep -l "See Also" {} \; | \
    while read -r doc_file; do
        local module_name
        module_name=$(echo "$doc_file" | sed "s|$TETRA_BASE_DIR/||" | cut -d'/' -f1)

        echo "🔗 Checking cross-references in $module_name/$(echo "$doc_file" | sed "s|.*/docs/||")"

        # Validate that referenced files exist
        grep -n '\[.*\](.*\.md)' "$doc_file" | while IFS=: read -r line_num link_line; do
            # Extract the file path from markdown link
            local ref_path
            ref_path=$(echo "$link_line" | sed -n 's/.*](\([^)]*\.md\)).*/\1/p')

            if [[ -n "$ref_path" ]]; then
                # Resolve relative path
                local resolved_path
                resolved_path=$(cd "$(dirname "$doc_file")" && realpath "$ref_path" 2>/dev/null || echo "")

                if [[ -n "$resolved_path" && -f "$resolved_path" ]]; then
                    echo "  ✅ Line $line_num: $ref_path"
                else
                    echo "  ❌ Line $line_num: $ref_path (broken link)"
                fi
            fi
        done
        echo
    done

    print_success "Cross-reference check complete"
}

# Generate documentation index
generate_index() {
    local index_file="$DOCS_CACHE_DIR/index/documentation_index.md"

    print_info "Generating documentation index"

    {
        echo "# TETRA Documentation Index"
        echo
        echo "*Generated: $(date '+%Y-%m-%d %H:%M:%S')*"
        echo
        echo "Complete index of all documentation across TETRA modules."
        echo

        # Module overview
        echo "## Modules"
        echo
        echo "| Module | Description | README | Concepts | Guides |"
        echo "|--------|-------------|--------|----------|--------|"

        find "$TETRA_BASE_DIR" -name "docs" -type d | sort | while read -r module_docs; do
            local module_name
            module_name=$(basename "$(dirname "$module_docs")")

            local has_readme has_concepts has_guides
            has_readme=$([[ -f "$module_docs/README.md" ]] && echo "✅" || echo "❌")
            has_concepts=$([[ -d "$module_docs/concepts" ]] && echo "✅" || echo "❌")
            has_guides=$([[ -d "$module_docs/guides" ]] && echo "✅" || echo "❌")

            echo "| $module_name | $(get_module_description "$module_name") | $has_readme | $has_concepts | $has_guides |"
        done

        echo
        echo "## All Documents"
        echo

        # List all documents
        find "$TETRA_BASE_DIR" -path "*/docs/*.md" -type f | sort | while read -r doc_file; do
            local relative_path
            relative_path=$(echo "$doc_file" | sed "s|$TETRA_BASE_DIR/||")

            local title
            title=$(head -1 "$doc_file" | sed 's/^# //')

            echo "- [$title]($relative_path)"
        done

        echo
        echo "## Concepts Index"
        echo

        # Index of all concepts
        find "$TETRA_BASE_DIR" -path "*/docs/concepts/*.md" -type f | sort | while read -r concept_file; do
            local concept_name
            concept_name=$(basename "$concept_file" .md)

            local module_name
            module_name=$(echo "$concept_file" | sed "s|$TETRA_BASE_DIR/||" | cut -d'/' -f1)

            local concept_title
            concept_title=$(head -1 "$concept_file" | sed 's/^# //')

            echo "- **$concept_name**: $concept_title ($module_name)"
        done

    } > "$index_file"

    print_success "Documentation index generated: $index_file"
}

get_module_description() {
    local module="$1"

    case "$module" in
        "ulm") echo "Unix Language Model - Code understanding and ranking" ;;
        "rag") echo "Retrieval Augmented Generation - Context formatting" ;;
        "tetraboard") echo "Monitoring, experiments, and documentation hub" ;;
        "tview") echo "Terminal user interface framework" ;;
        *) echo "TETRA module" ;;
    esac
}

# Validate documentation structure
validate_docs() {
    print_info "Validating documentation structure"
    local issues=0

    # Check that each module has a docs directory
    for module_dir in "$TETRA_BASE_DIR"/*; do
        if [[ -d "$module_dir" && -f "$module_dir"/*.sh ]]; then
            local module_name
            module_name=$(basename "$module_dir")

            if [[ ! -d "$module_dir/docs" ]]; then
                echo "⚠️  Module '$module_name' missing docs/ directory"
                ((issues++))
            else
                if [[ ! -f "$module_dir/docs/README.md" ]]; then
                    echo "⚠️  Module '$module_name' missing docs/README.md"
                    ((issues++))
                fi

                # Check for standard subdirectories
                for subdir in concepts guides reference examples; do
                    if [[ ! -d "$module_dir/docs/$subdir" ]]; then
                        echo "💡 Module '$module_name' could benefit from docs/$subdir/ directory"
                    fi
                done
            fi
        fi
    done

    if [[ $issues -eq 0 ]]; then
        print_success "Documentation structure validation passed"
    else
        echo "❌ Found $issues structural issues"
    fi

    return $issues
}

# Main CLI interface
usage() {
    cat <<EOF
Usage: docs_api.sh <command> [options]

COMMANDS:
  init                    Initialize documentation system
  list [filter]           List all documentation
  search <term>           Search across all docs
  module <name> [section] Show module documentation
  concept <name>          Find concept across modules
  unified [output_file]   Generate unified documentation
  cross-ref              Update cross-references
  index                  Generate documentation index
  validate               Validate documentation structure

EXAMPLES:
  docs_api.sh list
  docs_api.sh search "attention mechanism"
  docs_api.sh module ulm concepts/attention.md
  docs_api.sh concept "exm vs a"
  docs_api.sh unified ~/tetra_complete.md

EOF
}

# Parse commands
case "${1:-}" in
    "init")
        init_docs
        ;;
    "list")
        list_docs "${2:-}"
        ;;
    "search")
        [[ $# -lt 2 ]] && { echo "Usage: docs_api.sh search <term>" >&2; exit 1; }
        search_docs "$2" "${3:-false}"
        ;;
    "module")
        [[ $# -lt 2 ]] && { echo "Usage: docs_api.sh module <name> [section]" >&2; exit 1; }
        show_module_docs "$2" "${3:-}"
        ;;
    "concept")
        [[ $# -lt 2 ]] && { echo "Usage: docs_api.sh concept <name>" >&2; exit 1; }
        find_concept "$2"
        ;;
    "unified")
        generate_unified "${2:-}"
        ;;
    "cross-ref")
        update_cross_references
        ;;
    "index")
        generate_index
        ;;
    "validate")
        validate_docs
        ;;
    "-h"|"--help"|"help"|"")
        usage
        ;;
    *)
        echo "Unknown command: $1" >&2
        usage
        exit 1
        ;;
esac