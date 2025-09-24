#!/bin/bash

# TSM Codebase Audit Tool
# Generates comprehensive statistics about the TSM codebase
# Analyzes file distribution, sizes, function counts, and complexity

# Output file
OUTPUT_FILE="tsm-audit-$(date +%Y%m%d-%H%M%S).txt"

# Colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=== TSM Codebase Audit ===${NC}"
echo "Output will be saved to: $OUTPUT_FILE"
echo ""

# Start audit report
cat > "$OUTPUT_FILE" << 'EOF'
# TSM Codebase Audit Report
Generated: $(date)
Auditor: TSM Audit Tool v1.0

## Executive Summary
EOF

# Add timestamp
echo "Generated: $(date)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Find all TSM-related bash files
echo -e "${BLUE}[1/6]${NC} Discovering TSM files..."

TSM_FILES=()
TSM_DIRS=(
    "$TETRA_SRC/bash/tsm"
    "$(dirname "$0")"  # tests/tsm
    "$TETRA_SRC/tests" # tetra tests
)

# Collect all TSM bash files
for dir in "${TSM_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
        while IFS= read -r -d '' file; do
            TSM_FILES+=("$file")
        done < <(find "$dir" -name "*.sh" -type f -print0 2>/dev/null)
    fi
done

# Remove duplicates and sort
IFS=$'\n' TSM_FILES=($(sort -u <<<"${TSM_FILES[*]}"))
unset IFS

echo "Found ${#TSM_FILES[@]} TSM-related bash files"

# File Analysis
echo -e "${BLUE}[2/6]${NC} Analyzing file metrics..."

echo "## File Distribution Analysis" >> "$OUTPUT_FILE"
echo "Total TSM Files: ${#TSM_FILES[@]}" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# File size analysis
declare -a small_files=()    # < 100 lines
declare -a medium_files=()   # 100-500 lines
declare -a large_files=()    # > 500 lines

total_lines=0
total_functions=0

echo "### File Size Distribution" >> "$OUTPUT_FILE"

for file in "${TSM_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        lines=$(wc -l < "$file" 2>/dev/null || echo 0)
        total_lines=$((total_lines + lines))

        # Categorize by size
        if (( lines < 100 )); then
            small_files+=("$file:$lines")
        elif (( lines <= 500 )); then
            medium_files+=("$file:$lines")
        else
            large_files+=("$file:$lines")
        fi
    fi
done

echo "Small files (<100 lines): ${#small_files[@]}" >> "$OUTPUT_FILE"
echo "Medium files (100-500 lines): ${#medium_files[@]}" >> "$OUTPUT_FILE"
echo "Large files (>500 lines): ${#large_files[@]}" >> "$OUTPUT_FILE"
echo "Total lines of code: $total_lines" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Function Analysis
echo -e "${BLUE}[3/6]${NC} Analyzing functions..."

echo "### Function Analysis" >> "$OUTPUT_FILE"

declare -A file_function_counts
declare -A function_names

for file in "${TSM_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        # Count functions (looking for function definitions)
        local_functions=$(grep -c '^[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*()' "$file" 2>/dev/null || echo 0)
        bash_functions=$(grep -c '^[[:space:]]*function[[:space:]]' "$file" 2>/dev/null || echo 0)
        total_file_functions=$((local_functions + bash_functions))

        file_function_counts["$file"]=$total_file_functions
        total_functions=$((total_functions + total_file_functions))

        # Extract function names
        while IFS= read -r func_name; do
            if [[ -n "$func_name" ]]; then
                function_names["$func_name"]=$((${function_names["$func_name"]} + 1))
            fi
        done < <(grep -o '^[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*()' "$file" 2>/dev/null | sed 's/[[:space:]]*()[[:space:]]*//' | sed 's/^[[:space:]]*//')
    fi
done

echo "Total functions: $total_functions" >> "$OUTPUT_FILE"
echo "Average functions per file: $((total_functions / ${#TSM_FILES[@]}))" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Detailed file breakdown
echo -e "${BLUE}[4/6]${NC} Creating detailed file breakdown..."

echo "### Detailed File Analysis" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "#### Small Files (<100 lines)" >> "$OUTPUT_FILE"
for file_info in "${small_files[@]}"; do
    file="${file_info%:*}"
    lines="${file_info#*:}"
    functions="${file_function_counts["$file"]:-0}"
    basename_file=$(basename "$file")
    echo "- $basename_file: $lines lines, $functions functions" >> "$OUTPUT_FILE"
done
echo "" >> "$OUTPUT_FILE"

echo "#### Medium Files (100-500 lines)" >> "$OUTPUT_FILE"
for file_info in "${medium_files[@]}"; do
    file="${file_info%:*}"
    lines="${file_info#*:}"
    functions="${file_function_counts["$file"]:-0}"
    basename_file=$(basename "$file")
    echo "- $basename_file: $lines lines, $functions functions" >> "$OUTPUT_FILE"
done
echo "" >> "$OUTPUT_FILE"

echo "#### Large Files (>500 lines)" >> "$OUTPUT_FILE"
for file_info in "${large_files[@]}"; do
    file="${file_info%:*}"
    lines="${file_info#*:}"
    functions="${file_function_counts["$file"]:-0}"
    basename_file=$(basename "$file")
    echo "- $basename_file: $lines lines, $functions functions" >> "$OUTPUT_FILE"
done
echo "" >> "$OUTPUT_FILE"

# Complexity Analysis
echo -e "${BLUE}[5/6]${NC} Analyzing code complexity..."

echo "### Code Complexity Analysis" >> "$OUTPUT_FILE"

# Find most common function names
echo "#### Most Common Function Patterns" >> "$OUTPUT_FILE"
for func in $(printf '%s\n' "${!function_names[@]}" | head -10); do
    count="${function_names[$func]}"
    if (( count > 1 )); then
        echo "- $func: appears $count times" >> "$OUTPUT_FILE"
    fi
done
echo "" >> "$OUTPUT_FILE"

# Module analysis
echo "#### Module Breakdown" >> "$OUTPUT_FILE"
declare -A module_stats

for file in "${TSM_FILES[@]}"; do
    if [[ "$file" =~ tsm_([^/]+)\.sh$ ]]; then
        module="${BASH_REMATCH[1]}"
    elif [[ "$file" =~ /([^/]+)\.sh$ ]]; then
        module="${BASH_REMATCH[1]}"
    else
        module="other"
    fi

    lines=$(wc -l < "$file" 2>/dev/null || echo 0)
    functions="${file_function_counts["$file"]:-0}"

    # Update module stats
    module_stats["${module}:files"]=$((${module_stats["${module}:files"]} + 1))
    module_stats["${module}:lines"]=$((${module_stats["${module}:lines"]} + lines))
    module_stats["${module}:functions"]=$((${module_stats["${module}:functions"]} + functions))
done

# Output module stats
for module in $(printf '%s\n' "${!module_stats[@]}" | grep ':files$' | sed 's/:files$//'); do
    files="${module_stats["${module}:files"]}"
    lines="${module_stats["${module}:lines"]}"
    functions="${module_stats["${module}:functions"]}"
    echo "- $module: $files files, $lines lines, $functions functions" >> "$OUTPUT_FILE"
done
echo "" >> "$OUTPUT_FILE"

# Summary and Recommendations
echo -e "${BLUE}[6/6]${NC} Generating recommendations..."

echo "### Summary Statistics" >> "$OUTPUT_FILE"
echo "- Total files: ${#TSM_FILES[@]}" >> "$OUTPUT_FILE"
echo "- Total lines: $total_lines" >> "$OUTPUT_FILE"
echo "- Total functions: $total_functions" >> "$OUTPUT_FILE"
echo "- Average file size: $((total_lines / ${#TSM_FILES[@]})) lines" >> "$OUTPUT_FILE"
echo "- Average functions per file: $((total_functions / ${#TSM_FILES[@]}))" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "### Code Quality Observations" >> "$OUTPUT_FILE"

# File size distribution analysis
small_pct=$((${#small_files[@]} * 100 / ${#TSM_FILES[@]}))
medium_pct=$((${#medium_files[@]} * 100 / ${#TSM_FILES[@]}))
large_pct=$((${#large_files[@]} * 100 / ${#TSM_FILES[@]}))

echo "- File size distribution: ${small_pct}% small, ${medium_pct}% medium, ${large_pct}% large" >> "$OUTPUT_FILE"

if (( ${#large_files[@]} > 3 )); then
    echo "- ⚠️  High number of large files (${#large_files[@]}) may indicate need for refactoring" >> "$OUTPUT_FILE"
fi

if (( total_functions > total_lines / 20 )); then
    echo "- ✅ Good function density - code appears well-modularized" >> "$OUTPUT_FILE"
else
    echo "- ⚠️  Low function density - may benefit from more modular structure" >> "$OUTPUT_FILE"
fi

echo "" >> "$OUTPUT_FILE"

echo "### Recommendations for AST Support" >> "$OUTPUT_FILE"
echo "Based on this analysis, adding AST support to Tetra could provide:" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "1. **Enhanced Static Analysis**" >> "$OUTPUT_FILE"
echo "   - Function dependency mapping across $total_functions functions" >> "$OUTPUT_FILE"
echo "   - Dead code detection in ${#TSM_FILES[@]} files" >> "$OUTPUT_FILE"
echo "   - Variable scope analysis" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "2. **Code Quality Metrics**" >> "$OUTPUT_FILE"
echo "   - Cyclomatic complexity measurement" >> "$OUTPUT_FILE"
echo "   - Function call graph generation" >> "$OUTPUT_FILE"
echo "   - Import/source dependency visualization" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "3. **Refactoring Assistance**" >> "$OUTPUT_FILE"
echo "   - Identify large files (${#large_files[@]} candidates) for splitting" >> "$OUTPUT_FILE"
echo "   - Extract common patterns into reusable functions" >> "$OUTPUT_FILE"
echo "   - Module boundary optimization" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "4. **Testing Support**" >> "$OUTPUT_FILE"
echo "   - Generate function stubs for testing" >> "$OUTPUT_FILE"
echo "   - Identify untested functions" >> "$OUTPUT_FILE"
echo "   - Mock generation for dependencies" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Final report
echo -e "${GREEN}✅ Audit complete!${NC}"
echo "Report saved to: $OUTPUT_FILE"
echo ""

# Show quick summary on console
echo -e "${CYAN}=== Quick Summary ===${NC}"
echo "Files analyzed: ${#TSM_FILES[@]}"
echo "Total lines: $total_lines"
echo "Total functions: $total_functions"
echo "Distribution: ${#small_files[@]} small, ${#medium_files[@]} medium, ${#large_files[@]} large files"

# Show the report
echo ""
echo -e "${YELLOW}=== Generated Report ===${NC}"
cat "$OUTPUT_FILE"