#!/usr/bin/env bash

# MELVIN Docs - Documentation Integrity and Grooming
# MELVIN's second concern: Document coverage and integrity, not just code coverage

# Strong globals
: "${MELVIN_SRC:=$TETRA_SRC/bash/melvin}"
: "${MELVIN_DIR:=$TETRA_DIR/melvin}"

# Expected documentation structure per module
# Primary: README.md, DEVNOTES.md at root
# Secondary: docs/README.md, docs/DEVNOTES.md
# Reference: reference/ for ranked less-important docs

declare -gA MELVIN_DOC_COVERAGE    # module -> "has_readme has_devnotes has_docs_dir"
declare -gA MELVIN_DOC_ISSUES      # module -> list of issues
declare -gA MELVIN_DOC_UNEXPECTED  # module -> unexpected md files

# Check documentation for a module
# Usage: melvin_check_docs <module_name>
melvin_check_docs() {
    local module_name="$1"
    local module_path="${TETRA_SRC}/bash/${module_name}"

    # Fallback path
    if [[ -z "$TETRA_SRC" ]] || [[ ! -d "$module_path" ]]; then
        if [[ -n "$MELVIN_SRC" ]]; then
            module_path="$(dirname "$MELVIN_SRC")/${module_name}"
        else
            module_path="bash/${module_name}"
        fi
    fi

    if [[ ! -d "$module_path" ]]; then
        return 1
    fi

    local has_readme=0
    local has_devnotes=0
    local has_docs_dir=0
    local has_reference_dir=0
    local issues=()
    local unexpected=()

    # Check primary docs at root
    [[ -f "$module_path/README.md" ]] && has_readme=1
    [[ -f "$module_path/DEVNOTES.md" ]] && has_devnotes=1

    # Check secondary docs structure
    [[ -d "$module_path/docs" ]] && has_docs_dir=1
    [[ -d "$module_path/reference" ]] && has_reference_dir=1

    # Find all markdown files
    local all_md_files=()
    if command -v find >/dev/null 2>&1; then
        while IFS= read -r file; do
            all_md_files+=("$file")
        done < <(find "$module_path" -name "*.md" -type f 2>/dev/null)
    fi

    # Check for unexpected locations
    for md_file in "${all_md_files[@]}"; do
        local relative_path="${md_file#$module_path/}"

        # Skip expected locations
        case "$relative_path" in
            README.md|DEVNOTES.md)
                # Expected at root
                ;;
            docs/README.md|docs/DEVNOTES.md|docs/*.md)
                # Expected in docs/
                ;;
            reference/*.md|reference/*/*.md)
                # Expected in reference/
                ;;
            archive/*.md|archive/*/*.md)
                # Archive is okay
                ;;
            *)
                # Unexpected location
                unexpected+=("$relative_path")
                ;;
        esac
    done

    # Build coverage string
    local coverage=""
    [[ $has_readme -eq 1 ]] && coverage+="readme "
    [[ $has_devnotes -eq 1 ]] && coverage+="devnotes "
    [[ $has_docs_dir -eq 1 ]] && coverage+="docs_dir "
    [[ $has_reference_dir -eq 1 ]] && coverage+="ref_dir "
    MELVIN_DOC_COVERAGE["$module_name"]="${coverage% }"

    # Identify issues
    [[ $has_readme -eq 0 ]] && issues+=("Missing README.md")
    # DEVNOTES.md is optional for libraries, required for modules
    local module_type=$(melvin_get_type "$module_name" 2>/dev/null || echo "UNKNOWN")
    if [[ "$module_type" == "MODULE" ]] || [[ "$module_type" == "APP" ]] || [[ "$module_type" == "APP+MODULE" ]]; then
        [[ $has_devnotes -eq 0 ]] && issues+=("Missing DEVNOTES.md (recommended for modules)")
    fi

    # Store issues (using newline as separator)
    local issues_str=""
    for issue in "${issues[@]}"; do
        issues_str+="${issue}"$'\n'
    done
    MELVIN_DOC_ISSUES["$module_name"]="$issues_str"

    # Store unexpected (using newline as separator)
    local unexpected_str=""
    for file in "${unexpected[@]}"; do
        unexpected_str+="${file}"$'\n'
    done
    MELVIN_DOC_UNEXPECTED["$module_name"]="$unexpected_str"
}

# Check all modules
# Usage: melvin_check_all_docs
melvin_check_all_docs() {
    local bash_dir="${TETRA_SRC}/bash"

    if [[ -z "$TETRA_SRC" ]] || [[ ! -d "$bash_dir" ]]; then
        if [[ -n "$MELVIN_SRC" ]]; then
            bash_dir="$(dirname "$MELVIN_SRC")"
        else
            bash_dir="bash"
        fi
    fi

    if [[ ! -d "$bash_dir" ]]; then
        echo "Error: bash directory not found: $bash_dir" >&2
        return 1
    fi

    # Clear arrays
    MELVIN_DOC_COVERAGE=()
    MELVIN_DOC_ISSUES=()
    MELVIN_DOC_UNEXPECTED=()

    # Check each module
    for dir in "$bash_dir"/*; do
        [[ ! -d "$dir" ]] && continue
        local dir_name=$(basename "$dir")
        [[ "$dir_name" == "."* ]] && continue
        [[ "$dir_name" == "graveyard" ]] && continue

        melvin_check_docs "$dir_name"
    done
}

# Documentation health summary
# Usage: melvin_docs_summary
melvin_docs_summary() {
    melvin_check_all_docs

    local total=0
    local with_readme=0
    local with_devnotes=0
    local with_issues=0
    local with_unexpected=0

    for module in "${!MELVIN_DOC_COVERAGE[@]}"; do
        ((total++))

        local coverage="${MELVIN_DOC_COVERAGE[$module]}"
        [[ "$coverage" == *"readme"* ]] && ((with_readme++))
        [[ "$coverage" == *"devnotes"* ]] && ((with_devnotes++))

        local issues="${MELVIN_DOC_ISSUES[$module]}"
        [[ -n "$issues" ]] && ((with_issues++))

        local unexpected="${MELVIN_DOC_UNEXPECTED[$module]}"
        [[ -n "$unexpected" ]] && ((with_unexpected++))
    done

    echo "MELVIN Documentation Health Check"
    echo "=================================="
    echo ""
    printf "%-30s %5d\n" "Total modules scanned:" "$total"
    printf "%-30s %5d\n" "With README.md:" "$with_readme"
    printf "%-30s %5d\n" "With DEVNOTES.md:" "$with_devnotes"
    printf "%-30s %5d\n" "With issues:" "$with_issues"
    printf "%-30s %5d\n" "With unexpected docs:" "$with_unexpected"
    echo ""

    local coverage_pct=0
    [[ $total -gt 0 ]] && coverage_pct=$(awk "BEGIN {printf \"%.1f\", ($with_readme / $total) * 100}")
    echo "README.md coverage: ${coverage_pct}%"

    if [[ $with_issues -gt 0 ]]; then
        echo ""
        echo "⚠ $with_issues modules have documentation issues"
        echo "  Run: melvin docs issues"
    fi

    if [[ $with_unexpected -gt 0 ]]; then
        echo ""
        echo "⚠ $with_unexpected modules have misplaced documentation"
        echo "  Run: melvin docs groom"
    fi
}

# List modules with documentation issues
# Usage: melvin_docs_issues
melvin_docs_issues() {
    melvin_check_all_docs

    echo "Documentation Issues"
    echo "===================="
    echo ""

    local has_issues=0
    for module in $(printf '%s\n' "${!MELVIN_DOC_ISSUES[@]}" | sort); do
        local issues="${MELVIN_DOC_ISSUES[$module]}"
        if [[ -n "$issues" ]]; then
            echo "bash/$module"
            while IFS= read -r issue; do
                [[ -n "$issue" ]] && echo "  ⚠ $issue"
            done <<< "$issues"
            echo ""
            has_issues=1
        fi
    done

    [[ $has_issues -eq 0 ]] && echo "No documentation issues found!"
}

# List modules with unexpected documentation
# Usage: melvin_docs_unexpected
melvin_docs_unexpected() {
    melvin_check_all_docs

    echo "Unexpected Documentation Locations"
    echo "===================================="
    echo ""
    echo "Expected structure:"
    echo "  bash/<module>/README.md              - Primary documentation"
    echo "  bash/<module>/DEVNOTES.md            - Developer notes"
    echo "  bash/<module>/docs/*.md              - Secondary documentation"
    echo "  bash/<module>/reference/*.md         - Reference docs (ranked, less important)"
    echo ""

    local has_unexpected=0
    for module in $(printf '%s\n' "${!MELVIN_DOC_UNEXPECTED[@]}" | sort); do
        local unexpected="${MELVIN_DOC_UNEXPECTED[$module]}"
        if [[ -n "$unexpected" ]]; then
            echo "bash/$module"
            while IFS= read -r file; do
                [[ -n "$file" ]] && echo "  📄 $file"
            done <<< "$unexpected"
            echo ""
            has_unexpected=1
        fi
    done

    [[ $has_unexpected -eq 0 ]] && echo "All documentation is properly located!"
}

# Detailed documentation report for a module
# Usage: melvin_docs_detail <module>
melvin_docs_detail() {
    local module="$1"

    if [[ -z "$module" ]]; then
        echo "Usage: melvin docs detail <module>"
        return 1
    fi

    melvin_check_docs "$module"

    echo "Documentation Report: bash/$module"
    echo "===================================="
    echo ""

    local coverage="${MELVIN_DOC_COVERAGE[$module]}"
    local issues="${MELVIN_DOC_ISSUES[$module]}"
    local unexpected="${MELVIN_DOC_UNEXPECTED[$module]}"

    echo "Coverage:"
    [[ "$coverage" == *"readme"* ]] && echo "  ✓ README.md" || echo "  ✗ README.md"
    [[ "$coverage" == *"devnotes"* ]] && echo "  ✓ DEVNOTES.md" || echo "  ✗ DEVNOTES.md (optional for libraries)"
    [[ "$coverage" == *"docs_dir"* ]] && echo "  ✓ docs/ directory" || echo "  ✗ docs/ directory"
    [[ "$coverage" == *"ref_dir"* ]] && echo "  ✓ reference/ directory" || echo "  ✗ reference/ directory"
    echo ""

    if [[ -n "$issues" ]]; then
        echo "Issues:"
        while IFS= read -r issue; do
            [[ -n "$issue" ]] && echo "  ⚠ $issue"
        done <<< "$issues"
        echo ""
    fi

    if [[ -n "$unexpected" ]]; then
        echo "Unexpected Files:"
        while IFS= read -r file; do
            [[ -n "$file" ]] && echo "  📄 $file"
        done <<< "$unexpected"
        echo ""
    fi

    if [[ -z "$issues" ]] && [[ -z "$unexpected" ]]; then
        echo "✓ Documentation structure looks good!"
    fi
}

# Export functions
export -f melvin_check_docs
export -f melvin_check_all_docs
export -f melvin_docs_summary
export -f melvin_docs_issues
export -f melvin_docs_unexpected
export -f melvin_docs_detail
