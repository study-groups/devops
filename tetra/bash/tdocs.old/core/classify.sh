#!/usr/bin/env bash

# TDOC Classification System
# Logic for classifying documents as core vs other

# Auto-detect module from file path
tdoc_detect_module() {
    local file="$1"
    local abs_path=$(realpath "$file" 2>/dev/null || echo "$file")

    # Check if in bash/<module>/ directory
    if [[ "$abs_path" =~ bash/([^/]+)/ ]]; then
        echo "${BASH_REMATCH[1]}"
        return 0
    fi

    # Not in a module directory
    echo ""
}

# Suggest tags based on filename and content
tdoc_suggest_tags() {
    local file="$1"
    local suggested_tags=()

    local filename=$(basename "$file")
    local content=""
    [[ -f "$file" ]] && content=$(cat "$file")

    # Add date tag if in filename
    if [[ "$filename" =~ ([0-9]{8}) ]]; then
        local date="${BASH_REMATCH[1]}"
        # Convert YYYYMMDD to YYYY-MM-DD
        local formatted_date="${date:0:4}-${date:4:2}-${date:6:2}"
        suggested_tags+=("$formatted_date")
    elif [[ "$filename" =~ ([0-9]{4}-[0-9]{2}-[0-9]{2}) ]]; then
        suggested_tags+=("${BASH_REMATCH[1]}")
    fi

    # Detect type from filename
    if [[ "$filename" =~ (BUG|FIX) ]]; then
        suggested_tags+=("bug-fix")
    elif [[ "$filename" =~ (REFACTOR|CLEANUP) ]]; then
        suggested_tags+=("refactor")
    elif [[ "$filename" =~ (PLAN|TODO) ]]; then
        suggested_tags+=("plan")
    elif [[ "$filename" =~ (SUMMARY|REPORT) ]]; then
        suggested_tags+=("summary")
    fi

    # Detect keywords in content
    if [[ -n "$content" ]]; then
        echo "$content" | grep -qi "bug" && suggested_tags+=("bug-fix")
        echo "$content" | grep -qi "refactor" && suggested_tags+=("refactor")
        echo "$content" | grep -qi "plan" && suggested_tags+=("plan")
    fi

    # Add module tag if detected
    local module=$(tdoc_detect_module "$file")
    [[ -n "$module" ]] && suggested_tags+=("$module")

    # Remove duplicates and print
    printf "%s\n" "${suggested_tags[@]}" | sort -u | tr '\n' ',' | sed 's/,$//'
}

# Suggest document type based on filename and location
tdoc_suggest_type() {
    local file="$1"
    local filename=$(basename "$file")

    # System-wide standards (TCS, TAS, TRS, TES, TTS, etc.)
    if [[ "$filename" =~ ^T[A-Z]{2}_ ]]; then
        echo "spec"
    # Module specifications (e.g., TUBES_SPECIFICATION.md)
    elif [[ "$filename" =~ _SPECIFICATION\.md$ ]]; then
        echo "spec"
    # Core document types
    elif [[ "$filename" =~ (SPEC|Specification) ]]; then
        echo "spec"
    elif [[ "$filename" =~ (GUIDE|Guide|Tutorial) ]]; then
        echo "guide"
    elif [[ "$filename" =~ (REFERENCE|Reference) ]]; then
        echo "reference"
    # Working document types
    elif [[ "$filename" =~ (BUG|FIX|FIXES) ]]; then
        echo "investigation"
    elif [[ "$filename" =~ (REFACTOR|CLEANUP) ]]; then
        echo "investigation"
    elif [[ "$filename" =~ (PLAN|TODO) ]]; then
        echo "plan"
    elif [[ "$filename" =~ (SUMMARY|REPORT) ]]; then
        echo "summary"
    elif [[ "$filename" =~ (IMPLEMENTATION|SESSION|DEBUG|FIXES) ]]; then
        echo "summary"
    else
        echo "scratch"  # Default for unknown
    fi
}

# Suggest category based on location
tdoc_suggest_category() {
    local file="$1"
    local abs_path=$(realpath "$file" 2>/dev/null || echo "$file")

    # Core docs are in top-level docs/ directory
    if [[ "$abs_path" =~ $TETRA_SRC/docs/(reference|guide|theory|workflow) ]]; then
        echo "core"
    # Everything else is "other"
    else
        echo "other"
    fi
}

# Interactive classification prompt
tdoc_classify_interactive() {
    local file="$1"

    echo "Classifying: $file"
    echo ""

    # Auto-detect values
    local suggested_category=$(tdoc_suggest_category "$file")
    local suggested_type=$(tdoc_suggest_type "$file")
    local suggested_tags=$(tdoc_suggest_tags "$file")
    local suggested_module=$(tdoc_detect_module "$file")

    # Prompt for category
    echo "Category:"
    echo "  1. CORE    (stable reference documentation)"
    echo "  2. OTHER   (working/temporal documents)"
    echo ""
    printf "Select [1-2] (default: %s): " "$suggested_category"
    read -r category_choice

    local category="$suggested_category"
    case "$category_choice" in
        1) category="core" ;;
        2) category="other" ;;
        "") category="$suggested_category" ;;
    esac

    # Prompt for type
    echo ""
    echo "Type:"
    echo "  System types: standard, specification, example"
    echo "  Core types: spec, guide, reference"
    echo "  Temporal types: temporal, plan, investigation"
    printf "Enter type (default: %s): " "$suggested_type"
    read -r type_input

    local type="${type_input:-$suggested_type}"

    # Prompt for tags
    echo ""
    printf "Tags (comma-separated, default: %s): " "$suggested_tags"
    read -r tags_input

    local tags="${tags_input:-$suggested_tags}"

    # Prompt for module
    echo ""
    printf "Module (default: %s): " "$suggested_module"
    read -r module_input

    local module="${module_input:-$suggested_module}"

    # Confirm
    echo ""
    echo "Summary:"
    echo "  Category: $category"
    echo "  Type: $type"
    echo "  Tags: $tags"
    echo "  Module: $module"
    echo ""
    printf "Accept? [Y/n]: "
    read -r confirm

    if [[ "$confirm" =~ ^[Nn] ]]; then
        echo "Cancelled"
        return 1
    fi

    # Return values as colon-separated
    echo "$category:$type:$tags:$module"
}
