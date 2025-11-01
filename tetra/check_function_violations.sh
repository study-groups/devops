#!/usr/bin/env bash
# Check for function export/call violations

TETRA_SRC="${TETRA_SRC:-/Users/mricos/src/devops/tetra}"
cd "$TETRA_SRC" || exit 1

echo "=== Checking for Function Violations ==="
echo ""

violations=0

# 1. Find exported functions that don't exist in the same file
echo "1️⃣  Checking exported functions that aren't defined..."
while IFS=: read -r file line export_stmt; do
    # Extract function name from export statement
    func_name=$(echo "$export_stmt" | grep -o 'export -f [a-zA-Z_][a-zA-Z0-9_]*' | awk '{print $3}')

    if [[ -n "$func_name" ]]; then
        # Check if function is defined in the file
        if ! grep -q "^${func_name}()" "$file" && ! grep -q "^function ${func_name}" "$file"; then
            echo "   ❌ $file:$line exports '$func_name' but doesn't define it"
            ((violations++))
        fi
    fi
done < <(grep -n "export -f" bash/ -r --include="*.sh" 2>/dev/null)

echo ""

# 2. Find function calls to potentially non-existent functions
echo "2️⃣  Checking for calls to common missing functions..."

# Common patterns of missing functions based on the example
missing_patterns=(
    "repl_get_history_file"
    "tetra_log_"  # partial matches for logging functions
    "tsm_"        # tsm functions
    "org_"        # org functions
    "tdoc_"       # tdoc functions (now tdocs)
)

for pattern in "${missing_patterns[@]}"; do
    while IFS=: read -r file line content; do
        # Skip comments
        if echo "$content" | grep -qE '^\s*#'; then
            continue
        fi

        # Extract function name being called
        func_call=$(echo "$content" | grep -oE "${pattern}[a-zA-Z_][a-zA-Z0-9_]*" | head -1)

        if [[ -n "$func_call" ]]; then
            # Check if function is defined anywhere in bash/
            if ! grep -qrE "^${func_call}\(\)|^function ${func_call}" bash/ --include="*.sh" 2>/dev/null; then
                echo "   ⚠️  $file:$line calls '$func_call' which may not exist"
                ((violations++))
            fi
        fi
    done < <(grep -n "$pattern" bash/ -r --include="*.sh" 2>/dev/null | grep -v "export -f")
done

echo ""
echo "=== Summary ==="
echo "Total potential violations: $violations"

exit 0
