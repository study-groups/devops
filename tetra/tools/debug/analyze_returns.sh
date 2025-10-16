#!/usr/bin/env bash
# Comprehensive analysis of return statements in bash scripts
# This script identifies problematic return usage patterns

set -euo pipefail

TETRA_ROOT="${TETRA_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

echo "=========================================="
echo "RETURN STATEMENT ANALYSIS"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

total_returns=0
problematic_returns=0

# Find all bash scripts
while IFS= read -r file; do
    # Skip this analysis script itself
    [[ "$file" == *"analyze_returns.sh"* ]] && continue

    # Check if file has return statements
    if grep -q "return" "$file" 2>/dev/null; then
        echo -e "${BLUE}=== Analyzing: $file ===${NC}"

        # Find all return statements with context
        grep -n -B 2 -A 2 "return" "$file" | while IFS=: read -r line_info; do
            if [[ "$line_info" =~ ^[0-9]+-.*return ]]; then
                line_num=$(echo "$line_info" | cut -d- -f1)
                line_content=$(echo "$line_info" | cut -d- -f2-)

                ((total_returns++))

                # Check for problematic patterns
                is_problematic=0
                reason=""

                # Pattern 1: return in main script body (not in function)
                # This requires checking if we're inside a function definition

                # Pattern 2: return without error handling before it
                if [[ "$line_content" =~ return[[:space:]]+[0-9]+ ]] && [[ ! "$line_content" =~ ^[[:space:]]*# ]]; then
                    # Check if there's error handling nearby
                    context=$(grep -B 5 -A 0 "^${line_num}:" "$file" 2>/dev/null || echo "")
                    if [[ ! "$context" =~ (set[[:space:]]+-e|trap|if[[:space:]]+\[|\|\|) ]]; then
                        is_problematic=1
                        reason="No visible error handling before return"
                    fi
                fi

                # Pattern 3: return in subshell (pipes, $(), etc)
                if [[ "$line_content" =~ \|.*return ]] || [[ "$line_content" =~ \$\(.*return ]]; then
                    is_problematic=1
                    reason="return in pipe/subshell (ineffective)"
                fi

                # Pattern 4: return with no value (defaults to 0)
                if [[ "$line_content" =~ return[[:space:]]*$ ]] || [[ "$line_content" =~ return[[:space:]]*\; ]]; then
                    # This might be intentional, just flag it
                    echo -e "  ${YELLOW}Line $line_num: return with no explicit value${NC}"
                    echo "    $line_content"
                fi

                if [[ $is_problematic -eq 1 ]]; then
                    ((problematic_returns++))
                    echo -e "  ${RED}PROBLEM at line $line_num: $reason${NC}"
                    echo "    $line_content"
                fi
            fi
        done

        echo ""
    fi
done < <(find "$TETRA_ROOT" -type f -name "*.sh" 2>/dev/null)

echo "=========================================="
echo "SUMMARY"
echo "=========================================="
echo -e "Total return statements found: ${GREEN}$total_returns${NC}"
echo -e "Potentially problematic returns: ${RED}$problematic_returns${NC}"
echo ""

# Now find returns that are NOT in functions
echo "=========================================="
echo "RETURNS NOT IN FUNCTIONS (CRITICAL)"
echo "=========================================="
echo ""

while IFS= read -r file; do
    [[ "$file" == *"analyze_returns.sh"* ]] && continue

    if grep -q "return" "$file" 2>/dev/null; then
        # Extract all function names
        functions=$(grep -E "^[[:space:]]*function[[:space:]]+[a-zA-Z_][a-zA-Z0-9_]*|^[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*\(\)" "$file" | \
                   sed -E 's/^[[:space:]]*function[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*).*/\1/; s/^[[:space:]]*([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*\(\).*/\1/' || echo "")

        # For each return, check if it's inside a function
        while IFS= read -r line; do
            line_num=$(echo "$line" | cut -d: -f1)
            line_content=$(echo "$line" | cut -d: -f2-)

            # Get context around this return
            start_line=$((line_num - 50))
            [[ $start_line -lt 1 ]] && start_line=1

            context=$(sed -n "${start_line},${line_num}p" "$file")

            # Check if we're inside any function
            in_function=0
            while IFS= read -r func_name; do
                [[ -z "$func_name" ]] && continue
                # Look for function definition before this return
                if echo "$context" | grep -qE "(function[[:space:]]+${func_name}|${func_name}[[:space:]]*\(\))"; then
                    # Check if we've closed the function already
                    open_braces=$(echo "$context" | grep -E "(function[[:space:]]+${func_name}|${func_name}[[:space:]]*\(\))" -A 1000 | grep -c "{" || echo 0)
                    close_braces=$(echo "$context" | grep -E "(function[[:space:]]+${func_name}|${func_name}[[:space:]]*\(\))" -A 1000 | grep -c "}" || echo 0)

                    if [[ $open_braces -gt $close_braces ]]; then
                        in_function=1
                        break
                    fi
                fi
            done <<< "$functions"

            if [[ $in_function -eq 0 ]]; then
                echo -e "${RED}CRITICAL: Return outside function${NC}"
                echo "  File: $file"
                echo "  Line $line_num: $line_content"
                echo ""
            fi
        done < <(grep -n "return" "$file")
    fi
done < <(find "$TETRA_ROOT" -type f -name "*.sh" 2>/dev/null)

echo ""
echo "=========================================="
echo "DETAILED RETURN LOCATIONS"
echo "=========================================="
echo ""

find "$TETRA_ROOT" -type f -name "*.sh" -exec grep -l "return" {} \; 2>/dev/null | while read -r file; do
    echo -e "${BLUE}$file${NC}"
    grep -n "return" "$file" | head -20
    echo ""
done
