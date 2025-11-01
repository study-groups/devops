#!/usr/bin/env bash
# Verify tdocs completion integration

echo "======================================"
echo "TDOCS Completion Integration Check"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

checks_passed=0
checks_failed=0

check() {
    local desc="$1"
    local cmd="$2"

    printf "%-50s " "$desc"

    if eval "$cmd" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        ((checks_passed++))
    else
        echo -e "${RED}✗${NC}"
        ((checks_failed++))
    fi
}

# Environment checks
echo "Environment:"
check "TETRA_SRC is set" '[[ -n "$TETRA_SRC" ]]'
check "TDOCS_SRC is set" '[[ -n "$TDOCS_SRC" ]]'
check "TDOCS_DIR is set" '[[ -n "$TDOCS_DIR" ]]'
echo ""

# File existence checks
echo "Files:"
check "tdocs_repl_complete.sh exists" '[[ -f "$TDOCS_SRC/tdocs_repl_complete.sh" ]]'
check "tdocs_completion.sh exists" '[[ -f "$TDOCS_SRC/tdocs_completion.sh" ]]'
check "TAB_COMPLETION_GUIDE.md exists" '[[ -f "$TDOCS_SRC/TAB_COMPLETION_GUIDE.md" ]]'
check "test_repl_completion.sh exists" '[[ -f "$TDOCS_SRC/test_repl_completion.sh" ]]'
check "test script is executable" '[[ -x "$TDOCS_SRC/test_repl_completion.sh" ]]'
echo ""

# Source checks
echo "Sourcing:"
check "Can source tdocs_repl_complete.sh" 'source "$TDOCS_SRC/tdocs_repl_complete.sh"'
check "Can source tdocs_completion.sh" 'source "$TDOCS_SRC/tdocs_completion.sh"'
echo ""

# Function checks
echo "Functions (REPL):"
check "_tdocs_repl_complete exists" 'declare -F _tdocs_repl_complete >/dev/null'
check "_tdocs_get_modules exists" 'declare -F _tdocs_get_modules >/dev/null'
check "_tdocs_get_doc_paths exists" 'declare -F _tdocs_get_doc_paths >/dev/null'
check "_tdocs_get_categories exists" 'declare -F _tdocs_get_categories >/dev/null'
check "tdocs_repl_enable_completion exists" 'declare -F tdocs_repl_enable_completion >/dev/null'
check "tdocs_repl_disable_completion exists" 'declare -F tdocs_repl_disable_completion >/dev/null'
echo ""

echo "Functions (Shell):"
check "_tdocs_complete exists" 'declare -F _tdocs_complete >/dev/null'
check "_tdocs_shell_get_modules exists" 'declare -F _tdocs_shell_get_modules >/dev/null'
check "_tdocs_shell_get_docs exists" 'declare -F _tdocs_shell_get_docs >/dev/null'
echo ""

# Integration checks
echo "Integration:"
check "tdocs function exists" 'declare -F tdocs >/dev/null'
check "tdocs_repl function exists" 'declare -F tdocs_repl >/dev/null'
check "includes.sh sources completion" 'grep -q "tdocs_completion.sh" "$TDOCS_SRC/includes.sh"'
check "tdocs_repl.sh sources completion" 'grep -q "tdocs_repl_complete.sh" "$TDOCS_SRC/tdocs_repl.sh"'
check "tdocs_repl.sh enables completion" 'grep -q "tdocs_repl_enable_completion" "$TDOCS_SRC/tdocs_repl.sh"'
check "tdocs_repl.sh disables completion" 'grep -q "tdocs_repl_disable_completion" "$TDOCS_SRC/tdocs_repl.sh"'
echo ""

# Completion registration
echo "Completion Registration:"
if command -v complete >/dev/null 2>&1; then
    check "tdocs completion is registered" 'complete -p tdocs 2>/dev/null | grep -q "_tdocs_complete"'
    check "tdoc completion is registered" 'complete -p tdoc 2>/dev/null | grep -q "_tdocs_complete"'
else
    echo -e "${YELLOW}⚠${NC} complete command not available (not in bash?)"
    ((checks_failed+=2))
fi
echo ""

# Database checks
echo "Database:"
check "TDOCS_DIR exists" '[[ -d "$TDOCS_DIR" ]]'
check "TDOCS_DIR/db exists" '[[ -d "$TDOCS_DIR/db" ]]'
metadata_count=$(find "$TDOCS_DIR/db" -name "*.meta" 2>/dev/null | wc -l | tr -d ' ')
echo "  Metadata files found: $metadata_count"
echo ""

# Summary
echo "======================================"
echo "Summary"
echo "======================================"
echo -e "Checks passed: ${GREEN}$checks_passed${NC}"
echo -e "Checks failed: ${RED}$checks_failed${NC}"
echo ""

if [[ $checks_failed -eq 0 ]]; then
    echo -e "${GREEN}✓ All integration checks passed!${NC}"
    echo ""
    echo "You can now use tab completion:"
    echo "  • In shell: tdocs <TAB>"
    echo "  • In REPL: tdocs repl (then press TAB)"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some checks failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  • Make sure TETRA_SRC is set: export TETRA_SRC=/path/to/tetra"
    echo "  • Source tetra: source ~/tetra/tetra.sh"
    echo "  • Load tdocs: tmod load tdocs"
    echo ""
    exit 1
fi
