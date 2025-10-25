#!/usr/bin/env bash

# MELVIN Health Check - Module Health Reports
# Generate classification reports and statistics

# Dependencies
if ! declare -F melvin_classify_all >/dev/null 2>&1; then
    source "${MELVIN_SRC:-$TETRA_SRC/bash/melvin}/melvin_classifier.sh"
fi

# Health Check: Summary counts
# Usage: melvin_health_summary
melvin_health_summary() {
    # Ensure classification is loaded
    melvin_classify_all

    # Count by type
    melvin_count_by_type

    # Display summary
    echo "MELVIN Module Health Check - Summary"
    echo "====================================="
    echo ""
    printf "%-15s %5s\n" "Type" "Count"
    printf "%-15s %5s\n" "---------------" "-----"
    printf "%-15s %5d\n" "LIBRARY" "${MELVIN_TYPE_COUNTS[LIBRARY]:-0}"
    printf "%-15s %5d\n" "MODULE" "${MELVIN_TYPE_COUNTS[MODULE]:-0}"
    printf "%-15s %5d\n" "APP" "${MELVIN_TYPE_COUNTS[APP]:-0}"
    printf "%-15s %5d\n" "APP+MODULE" "${MELVIN_TYPE_COUNTS[APP+MODULE]:-0}"
    printf "%-15s %5d\n" "UNKNOWN" "${MELVIN_TYPE_COUNTS[UNKNOWN]:-0}"
    echo "---------------"

    local total=0
    for count in "${MELVIN_TYPE_COUNTS[@]}"; do
        ((total += count))
    done
    printf "%-15s %5d\n" "TOTAL" "$total"
}

# Health Check: List unclassified directories
# Usage: melvin_health_unclassified
melvin_health_unclassified() {
    melvin_classify_all

    local unknowns=($(melvin_list_by_type "UNKNOWN"))

    echo "Unclassified Directories"
    echo "========================"
    echo ""

    if [[ ${#unknowns[@]} -eq 0 ]]; then
        echo "All directories classified! MELVIN never misses."
        return 0
    fi

    for dir in "${unknowns[@]}"; do
        echo "  $dir"
        local reason=$(melvin_get_reason "$dir")
        echo "    Reason: $reason"
        echo ""
    done

    echo "Total unclassified: ${#unknowns[@]}"
}

# Health Check: Detailed module report
# Usage: melvin_health_detail <module_name>
melvin_health_detail() {
    local module_name="$1"

    if [[ -z "$module_name" ]]; then
        echo "Usage: melvin_health_detail <module_name>"
        return 1
    fi

    melvin_classify_all

    local type=$(melvin_get_type "$module_name")
    local reason=$(melvin_get_reason "$module_name")
    local features=$(melvin_get_features "$module_name")

    if [[ "$type" == "UNKNOWN" ]] && [[ -z "$reason" ]]; then
        echo "Module not found: $module_name"
        return 1
    fi

    local module_path="${TETRA_SRC}/bash/${module_name}"

    echo "MELVIN Analysis: bash/$module_name"
    echo "=================================="
    echo ""
    echo "Classification: $type"
    echo "Reason: $reason"
    echo "Features: ${features:-none}"
    echo ""

    # File statistics
    if [[ -d "$module_path" ]]; then
        echo "Directory Statistics:"

        # Count files
        local file_count=$(find "$module_path" -type f -name "*.sh" 2>/dev/null | wc -l | tr -d ' ')
        echo "  Shell files: $file_count"

        # Count total lines
        local total_lines=$(find "$module_path" -type f -name "*.sh" -exec cat {} \; 2>/dev/null | wc -l | tr -d ' ')
        echo "  Total lines: $total_lines"

        # Check for README
        if [[ -f "$module_path/README.md" ]]; then
            echo "  Documentation: ✓ README.md"
        else
            echo "  Documentation: ✗ No README.md"
        fi

        # Check for tests
        if [[ -d "$module_path/tests" ]] || find "$module_path" -name "*test*.sh" 2>/dev/null | grep -q .; then
            echo "  Tests: ✓ Found"
        else
            echo "  Tests: ✗ None found"
        fi

        # Last modified
        if command -v stat >/dev/null 2>&1; then
            # macOS stat format
            local last_mod=$(find "$module_path" -type f -name "*.sh" -exec stat -f "%m %N" {} \; 2>/dev/null | sort -rn | head -1 | awk '{print $2}')
            if [[ -n "$last_mod" ]]; then
                local mod_date=$(stat -f "%Sm" -t "%Y-%m-%d" "$last_mod" 2>/dev/null)
                echo "  Last modified: $mod_date"
            fi
        fi

        echo ""

        # Check boot registration
        if grep -q "tetra_register_module.*['\"]${module_name}['\"]" "${TETRA_SRC}/bash/boot/boot_modules.sh" 2>/dev/null; then
            local line_num=$(grep -n "tetra_register_module.*['\"]${module_name}['\"]" "${TETRA_SRC}/bash/boot/boot_modules.sh" | cut -d: -f1)
            echo "Boot Registration: ✓ Registered (boot_modules.sh:$line_num)"
        else
            echo "Boot Registration: ✗ Not registered"
        fi

        # List key files
        echo ""
        echo "Key Files:"
        [[ -f "$module_path/includes.sh" ]] && echo "  ✓ includes.sh"
        [[ -f "$module_path/actions.sh" ]] && echo "  ✓ actions.sh"
        [[ -f "$module_path/${module_name}.sh" ]] && echo "  ✓ ${module_name}.sh"
        [[ -f "$module_path/${module_name}_repl.sh" ]] && echo "  ✓ ${module_name}_repl.sh"
        [[ -f "$module_path/${module_name}_tui.sh" ]] && echo "  ✓ ${module_name}_tui.sh"
        [[ -f "$module_path/README.md" ]] && echo "  ✓ README.md"
    fi
}

# Health Check: List all by type
# Usage: melvin_health_list <type>
melvin_health_list() {
    local type="${1:-MODULE}"

    melvin_classify_all

    local items=($(melvin_list_by_type "$type"))

    echo "Directories classified as: $type"
    echo "==============================="
    echo ""

    if [[ ${#items[@]} -eq 0 ]]; then
        echo "None found."
        return 0
    fi

    for dir in "${items[@]}"; do
        local reason=$(melvin_get_reason "$dir")
        printf "  %-20s %s\n" "$dir" "- $reason"
    done

    echo ""
    echo "Total: ${#items[@]}"
}

# Health Check: Full report
# Usage: melvin_health_full
melvin_health_full() {
    echo "MELVIN Full Health Report"
    echo "========================="
    echo ""

    melvin_health_summary
    echo ""
    echo ""

    echo "LIBRARIES"
    echo "========="
    melvin_list_by_type "LIBRARY" | while read -r dir; do
        echo "  $dir"
    done
    echo ""

    echo "MODULES"
    echo "======="
    melvin_list_by_type "MODULE" | while read -r dir; do
        echo "  $dir"
    done
    echo ""

    echo "APPS"
    echo "===="
    melvin_list_by_type "APP" | while read -r dir; do
        echo "  $dir"
    done
    echo ""

    echo "APP+MODULE"
    echo "=========="
    melvin_list_by_type "APP+MODULE" | while read -r dir; do
        echo "  $dir"
    done
    echo ""

    if [[ ${MELVIN_TYPE_COUNTS[UNKNOWN]:-0} -gt 0 ]]; then
        echo "UNCLASSIFIED"
        echo "============"
        melvin_list_by_type "UNKNOWN" | while read -r dir; do
            local reason=$(melvin_get_reason "$dir")
            echo "  $dir - $reason"
        done
    fi
}

# Export functions
export -f melvin_health_summary
export -f melvin_health_unclassified
export -f melvin_health_detail
export -f melvin_health_list
export -f melvin_health_full
