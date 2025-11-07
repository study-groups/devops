#!/usr/bin/env bash

# audit_modules.sh - Audit Tetra modules for completeness

set -euo pipefail

TETRA_SRC="${TETRA_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

echo "Tetra Module Completeness Audit"
echo "================================"
echo ""
echo "Legend:"
echo "  ✓ = Present"
echo "  ✗ = Missing"
echo ""

printf "%-15s  %-8s  %-8s  %-6s  %-8s  %s\n" \
    "MODULE" "includes" "actions" "repl" "readme" "LEVEL"
echo "────────────────────────────────────────────────────────────────────"

for dir in "$TETRA_SRC"/bash/*/; do
    [[ ! -d "$dir" ]] && continue

    module=$(basename "$dir")

    # Check components
    has_includes="✗"
    [[ -f "$dir/includes.sh" ]] && has_includes="✓"

    has_actions="✗"
    [[ -f "$dir/actions.sh" ]] && has_actions="✓"

    has_repl="✗"
    repl_files=$(find "$dir" -maxdepth 1 -name "*_repl.sh" -type f 2>/dev/null | wc -l)
    [[ $repl_files -gt 0 ]] && has_repl="✓"

    has_readme="✗"
    [[ -f "$dir/README.md" ]] && has_readme="✓"

    # Determine level
    level="L1"
    if [[ "$has_includes" == "✓" ]]; then
        level="L1"
        if [[ "$has_actions" == "✓" && "$has_readme" == "✓" ]]; then
            level="L2"
            if [[ "$has_repl" == "✓" ]]; then
                level="L3"
                # Check for tests to reach L4
                if [[ -d "$dir/tests" ]]; then
                    level="L4"
                fi
            fi
        fi
    fi

    printf "%-15s  %-8s  %-8s  %-6s  %-8s  %s\n" \
        "$module" "$has_includes" "$has_actions" "$has_repl" "$has_readme" "$level"
done

echo ""
echo "Levels:"
echo "  L1 = Functional (includes.sh)"
echo "  L2 = Integrated (+ actions.sh, README.md)"
echo "  L3 = Interactive (+ REPL)"
echo "  L4 = Complete (+ tests/)"
echo ""

# Summary
total=$(ls -d "$TETRA_SRC"/bash/*/ 2>/dev/null | wc -l)
l1=$(bash bash/self/audit_modules.sh 2>/dev/null | grep "L1" | wc -l || echo 0)
l2=$(bash bash/self/audit_modules.sh 2>/dev/null | grep "L2" | wc -l || echo 0)
l3=$(bash bash/self/audit_modules.sh 2>/dev/null | grep "L3" | wc -l || echo 0)
l4=$(bash bash/self/audit_modules.sh 2>/dev/null | grep "L4" | wc -l || echo 0)

echo "Summary:"
echo "  Total modules: $total"
echo "  Level 1: $l1"
echo "  Level 2: $l2"
echo "  Level 3: $l3"
echo "  Level 4: $l4"
