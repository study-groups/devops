#!/usr/bin/env bash

# MELVIN Classification - Universal Bash Module Classifier
# Works on any bash codebase, delegates to tetra-self when available

# Classification result storage
declare -gA MELVIN_CLASS_TYPE=()
declare -gA MELVIN_CLASS_REASON=()
declare -gA MELVIN_CLASS_FEATURES=()

# Generic module type detection
# Usage: melvin_detect_module_type <dir_path> [context]
melvin_detect_module_type() {
    local dir="$1"
    local context="${2:-$MELVIN_CONTEXT}"

    if [[ ! -d "$dir" ]]; then
        return 1
    fi

    # If tetra context and tetra-self available, delegate
    if [[ "$context" == "tetra" ]] && [[ $MELVIN_HAS_SELF -eq 1 ]]; then
        melvin_classify_via_self "$dir"
        return $?
    fi

    # Generic classification
    melvin_classify_generic "$dir"
}

# Classify via tetra-self (placeholder for future integration)
melvin_classify_via_self() {
    local dir="$1"
    # For now, just use generic classification
    melvin_classify_generic "$dir"
}

# Generic bash module classification
# Usage: melvin_classify_generic <dir_path>
melvin_classify_generic() {
    local dir="$1"
    local dir_name=$(basename "$dir")

    # Detection flags
    local has_includes=0
    local has_actions=0
    local has_repl=0
    local has_tui=0
    local has_tests=0
    local has_readme=0

    # Check for key files
    [[ -f "$dir/includes.sh" ]] && has_includes=1
    [[ -f "$dir/actions.sh" ]] && has_actions=1
    [[ -f "$dir/README.md" ]] && has_readme=1
    [[ -d "$dir/tests" ]] && has_tests=1

    # Check for REPL (multiple patterns)
    if [[ -f "$dir/${dir_name}_repl.sh" ]] || \
       [[ -f "$dir/repl.sh" ]] || \
       find "$dir" -maxdepth 1 -name "*repl*.sh" -type f 2>/dev/null | grep -q .; then
        has_repl=1
    fi

    # Check for TUI
    if [[ -f "$dir/${dir_name}_tui.sh" ]] || \
       [[ -f "$dir/tui.sh" ]] || \
       find "$dir" -maxdepth 1 -name "*tui*.sh" -type f 2>/dev/null | grep -q .; then
        has_tui=1
    fi

    # Build features string
    local features=""
    [[ $has_includes -eq 1 ]] && features+="includes "
    [[ $has_actions -eq 1 ]] && features+="actions "
    [[ $has_repl -eq 1 ]] && features+="repl "
    [[ $has_tui -eq 1 ]] && features+="tui "
    [[ $has_tests -eq 1 ]] && features+="tests "
    [[ $has_readme -eq 1 ]] && features+="readme "
    MELVIN_CLASS_FEATURES["$dir_name"]="${features% }"

    # Classification logic
    local type="UNKNOWN"
    local reason=""

    if [[ $has_actions -eq 1 ]] && [[ $has_tui -eq 1 ]]; then
        type="APP+MODULE"
        reason="Has actions.sh and TUI implementation"
    elif [[ $has_tui -eq 1 ]]; then
        type="APP"
        reason="Has TUI implementation"
    elif [[ $has_actions -eq 1 ]]; then
        type="MODULE"
        reason="Has actions.sh"
        [[ $has_repl -eq 1 ]] && reason+=" (with REPL)"
    elif [[ $has_includes -eq 1 ]]; then
        type="LIBRARY"
        reason="Has includes.sh only (no actions, no TUI)"
    else
        # Check if it's a collection of scripts
        local script_count=$(find "$dir" -maxdepth 1 -name "*.sh" -type f 2>/dev/null | wc -l | tr -d ' ')
        if [[ $script_count -gt 0 ]]; then
            type="SCRIPTS"
            reason="Collection of $script_count shell script(s)"
        else
            reason="No standard module patterns detected"
        fi
    fi

    # Store classification
    MELVIN_CLASS_TYPE["$dir_name"]="$type"
    MELVIN_CLASS_REASON["$dir_name"]="$reason"
}

# Classify all modules in root
# Usage: melvin_classify_all [root_path]
melvin_classify_all() {
    local root="${1:-$MELVIN_ROOT}"

    # Clear existing
    MELVIN_CLASS_TYPE=()
    MELVIN_CLASS_REASON=()
    MELVIN_CLASS_FEATURES=()

    # Determine where to look for modules
    local scan_dir="$root"

    # For tetra, look in bash/ subdirectory
    if [[ "$MELVIN_CONTEXT" == "tetra" ]] && [[ -d "$root/bash" ]]; then
        scan_dir="$root/bash"
    fi

    if [[ ! -d "$scan_dir" ]]; then
        echo "Error: Directory not found: $scan_dir" >&2
        return 1
    fi

    # Classify each subdirectory
    for dir in "$scan_dir"/*; do
        [[ ! -d "$dir" ]] && continue

        local dir_name=$(basename "$dir")

        # Skip hidden directories and graveyard
        [[ "$dir_name" == "."* ]] && continue
        [[ "$dir_name" == "graveyard" ]] && continue

        melvin_detect_module_type "$dir" "$MELVIN_CONTEXT"
    done
}

# Get classification type
# Usage: melvin_get_type <module_name>
melvin_get_type() {
    local module_name="$1"
    echo "${MELVIN_CLASS_TYPE[$module_name]:-UNKNOWN}"
}

# Get classification reason
# Usage: melvin_get_reason <module_name>
melvin_get_reason() {
    local module_name="$1"
    echo "${MELVIN_CLASS_REASON[$module_name]}"
}

# Get features
# Usage: melvin_get_features <module_name>
melvin_get_features() {
    local module_name="$1"
    echo "${MELVIN_CLASS_FEATURES[$module_name]}"
}

# List modules by type
# Usage: melvin_list_by_type <type>
melvin_list_by_type() {
    local target_type="$1"

    for module in "${!MELVIN_CLASS_TYPE[@]}"; do
        if [[ "${MELVIN_CLASS_TYPE[$module]}" == "$target_type" ]]; then
            echo "$module"
        fi
    done | sort
}

# Count modules by type
# Usage: melvin_count_by_type
melvin_count_by_type() {
    declare -gA MELVIN_TYPE_COUNTS
    MELVIN_TYPE_COUNTS=()

    for type in LIBRARY MODULE APP "APP+MODULE" SCRIPTS UNKNOWN; do
        local count=0
        for module in "${!MELVIN_CLASS_TYPE[@]}"; do
            [[ "${MELVIN_CLASS_TYPE[$module]}" == "$type" ]] && ((count++))
        done
        MELVIN_TYPE_COUNTS["$type"]=$count
    done
}

# Show classification summary
# Usage: melvin_classification_summary
melvin_classification_summary() {
    melvin_classify_all

    melvin_count_by_type

    echo "MELVIN Classification Summary"
    echo "============================="
    echo "Root: $MELVIN_ROOT"
    echo "Context: $MELVIN_CONTEXT"
    echo ""

    printf "%-15s %5s\n" "Type" "Count"
    printf "%-15s %5s\n" "───────────────" "─────"
    printf "%-15s %5d\n" "LIBRARY" "${MELVIN_TYPE_COUNTS[LIBRARY]:-0}"
    printf "%-15s %5d\n" "MODULE" "${MELVIN_TYPE_COUNTS[MODULE]:-0}"
    printf "%-15s %5d\n" "APP" "${MELVIN_TYPE_COUNTS[APP]:-0}"
    printf "%-15s %5d\n" "APP+MODULE" "${MELVIN_TYPE_COUNTS[APP+MODULE]:-0}"
    printf "%-15s %5d\n" "SCRIPTS" "${MELVIN_TYPE_COUNTS[SCRIPTS]:-0}"
    printf "%-15s %5d\n" "UNKNOWN" "${MELVIN_TYPE_COUNTS[UNKNOWN]:-0}"
    echo "───────────────────────"

    local total=0
    for count in "${MELVIN_TYPE_COUNTS[@]}"; do
        ((total += count))
    done
    printf "%-15s %5d\n" "TOTAL" "$total"
}

# Show detailed classification for a module
# Usage: melvin_show_classification <module_name>
melvin_show_classification() {
    local module="$1"

    if [[ -z "$module" ]]; then
        echo "Usage: melvin classify <module_name>"
        return 1
    fi

    # Find module directory
    local module_dir=""
    if [[ "$MELVIN_CONTEXT" == "tetra" ]] && [[ -d "$MELVIN_ROOT/bash/$module" ]]; then
        module_dir="$MELVIN_ROOT/bash/$module"
    elif [[ -d "$MELVIN_ROOT/$module" ]]; then
        module_dir="$MELVIN_ROOT/$module"
    else
        echo "Module not found: $module"
        return 1
    fi

    # Classify if not already done
    if [[ -z "${MELVIN_CLASS_TYPE[$module]}" ]]; then
        melvin_detect_module_type "$module_dir"
    fi

    local type=$(melvin_get_type "$module")
    local reason=$(melvin_get_reason "$module")
    local features=$(melvin_get_features "$module")

    echo "Module: $module"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Type: $type"
    echo "Reason: $reason"

    if [[ -n "$features" ]]; then
        echo ""
        echo "Features:"
        for feature in $features; do
            echo "  ✓ $feature"
        done
    fi

    echo ""
    echo "Location: $module_dir"
}

# Detailed health report for a module
# Usage: melvin_health_detail <module_name>
melvin_health_detail() {
    local module_name="$1"
    [[ -z "$module_name" ]] && { echo "Usage: melvin_health_detail <module>"; return 1; }

    melvin_classify_all >/dev/null 2>&1

    local type=$(melvin_get_type "$module_name")
    local reason=$(melvin_get_reason "$module_name")
    local features=$(melvin_get_features "$module_name")
    local module_path="$MELVIN_ROOT"
    [[ "$MELVIN_CONTEXT" == "tetra" ]] && module_path="$MELVIN_ROOT/bash/$module_name"
    [[ -d "$MELVIN_ROOT/$module_name" ]] && module_path="$MELVIN_ROOT/$module_name"

    echo "MELVIN Analysis: $module_name"
    echo "================================"
    echo "Classification: $type"
    echo "Reason: $reason"
    echo "Features: ${features:-none}"
    echo ""

    if [[ -d "$module_path" ]]; then
        local file_count=$(find "$module_path" -maxdepth 2 -type f -name "*.sh" 2>/dev/null | wc -l | tr -d ' ')
        local total_lines=$(find "$module_path" -maxdepth 2 -type f -name "*.sh" -exec cat {} \; 2>/dev/null | wc -l | tr -d ' ')
        echo "Shell files: $file_count"
        echo "Total lines: $total_lines"
        [[ -f "$module_path/README.md" ]] && echo "Docs: ✓ README.md" || echo "Docs: ✗ No README"
        [[ -d "$module_path/tests" ]] && echo "Tests: ✓ Found" || echo "Tests: ✗ None"
    fi
}

# Export functions
export -f melvin_detect_module_type
export -f melvin_classify_via_self
export -f melvin_classify_generic
export -f melvin_classify_all
export -f melvin_get_type
export -f melvin_get_reason
export -f melvin_get_features
export -f melvin_list_by_type
export -f melvin_count_by_type
export -f melvin_classification_summary
export -f melvin_show_classification
export -f melvin_health_detail
