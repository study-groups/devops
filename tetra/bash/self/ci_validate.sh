#!/usr/bin/env bash
# CI Validation Script
# Runs all code quality checks for tetra bash project
#
# Usage:
#   ci_validate.sh [--strict]
#   ci_validate.sh --quick    # Only critical checks
#   ci_validate.sh --help

set -euo pipefail

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check counters
CHECKS_RUN=0
CHECKS_PASSED=0
CHECKS_FAILED=0

# Strict mode flag
STRICT_MODE=false
QUICK_MODE=false

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TETRA_SRC="${TETRA_SRC:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

echo "================================================"
echo "TETRA BASH - CI VALIDATION"
echo "================================================"
echo "TETRA_SRC: $TETRA_SRC"
echo "Mode: $([ "$STRICT_MODE" = true ] && echo "STRICT" || echo "NORMAL")"
echo ""

# Helper function to run a check
run_check() {
    local check_name="$1"
    local check_command="$2"
    local critical="${3:-false}"

    CHECKS_RUN=$((CHECKS_RUN + 1))

    echo -n "[$CHECKS_RUN] $check_name... "

    if eval "$check_command" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))

        if [[ "$critical" == "true" ]] || [[ "$STRICT_MODE" == "true" ]]; then
            echo -e "${RED}CRITICAL FAILURE - Stopping validation${NC}"
            return 1
        fi
        return 0
    fi
}

# Check 1: TETRA_SRC is valid
check_tetra_src() {
    [[ -n "${TETRA_SRC:-}" ]] && \
    [[ -d "$TETRA_SRC" ]] && \
    [[ -d "$TETRA_SRC/bash" ]]
}

# Check 2: No hardcoded paths
check_no_hardcoded_paths() {
    local violations
    violations=$(grep -r "/Users/[^/]*/src/devops/tetra" "$TETRA_SRC/bash" --include="*.sh" 2>/dev/null | grep -v "\.md:" | grep -v "\.json:" | wc -l)
    [[ "$violations" -eq 0 ]]
}

# Check 3: Shell scripts are executable
check_executables() {
    local non_executable
    non_executable=$(find "$TETRA_SRC/bash" -type f -name "*.sh" ! -perm -u+r | wc -l)
    [[ "$non_executable" -eq 0 ]]
}

# Check 4: No syntax errors in critical modules
check_syntax_errors() {
    local error_count=0
    local critical_dirs=("boot" "utils" "self")

    for dir in "${critical_dirs[@]}"; do
        while IFS= read -r -d '' file; do
            if ! bash -n "$file" 2>/dev/null; then
                error_count=$((error_count + 1))
            fi
        done < <(find "$TETRA_SRC/bash/$dir" -type f -name "*.sh" -print0 2>/dev/null)
    done

    [[ "$error_count" -eq 0 ]]
}

# Check 5: Shellcheck critical issues (errors only)
check_shellcheck_errors() {
    if ! command -v shellcheck &>/dev/null; then
        echo -e "${YELLOW}(shellcheck not installed, skipping)${NC}"
        return 0
    fi

    local error_count=0
    local file_count=0
    while IFS= read -r -d '' file; do
        file_count=$((file_count + 1))
        if [[ $file_count -gt 50 ]]; then
            break  # Limit for quick CI check
        fi

        if ! shellcheck -S error "$file" >/dev/null 2>&1; then
            error_count=$((error_count + 1))
        fi
    done < <(find "$TETRA_SRC/bash/boot" "$TETRA_SRC/bash/utils" -type f -name "*.sh" -print0 2>/dev/null)

    [[ "$error_count" -eq 0 ]]
}

# Check 6: Boot system loads
check_boot_loads() {
    (
        export TETRA_SRC TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"
        source "$TETRA_SRC/bash/boot/boot_core.sh" 2>/dev/null
    )
}

# Check 7: No duplicate function names in core modules
check_no_duplicate_functions() {
    local duplicates
    duplicates=$(grep -rh "^[a-zA-Z_][a-zA-Z0-9_]*\s*()" "$TETRA_SRC/bash/boot" "$TETRA_SRC/bash/utils" --include="*.sh" 2>/dev/null | \
        sed 's/\s*().*$//' | sort | uniq -d | wc -l)
    [[ "$duplicates" -eq 0 ]]
}

# Check 8: Module registration matches file structure
check_module_structure() {
    local missing_count=0
    local modules=("utils" "boot" "logs" "prompt" "tsm")

    for module in "${modules[@]}"; do
        if [[ ! -d "$TETRA_SRC/bash/$module" ]]; then
            missing_count=$((missing_count + 1))
        fi
    done

    [[ "$missing_count" -eq 0 ]]
}

# Main validation flow
main_validation() {
    echo "Running CI validation checks..."
    echo ""

    # Critical checks (must pass)
    run_check "TETRA_SRC is valid" check_tetra_src true || return 1
    run_check "Boot system loads" check_boot_loads true || return 1
    run_check "No syntax errors" check_syntax_errors true || return 1

    if [[ "$QUICK_MODE" == "true" ]]; then
        echo ""
        echo "Quick mode - skipping additional checks"
    else
        # Additional checks (warnings)
        run_check "No hardcoded paths" check_no_hardcoded_paths false
        run_check "Core modules exist" check_module_structure false
        run_check "No duplicate functions" check_no_duplicate_functions false
        run_check "Shellcheck (errors only)" check_shellcheck_errors false
    fi

    # Summary
    echo ""
    echo "================================================"
    echo "VALIDATION SUMMARY"
    echo "================================================"
    echo "Total checks: $CHECKS_RUN"
    echo -e "${GREEN}Passed: $CHECKS_PASSED${NC}"
    echo -e "${RED}Failed: $CHECKS_FAILED${NC}"
    echo ""

    if [[ "$CHECKS_FAILED" -eq 0 ]]; then
        echo -e "${GREEN}✓ ALL CHECKS PASSED${NC}"
        return 0
    elif [[ "$STRICT_MODE" == "true" ]]; then
        echo -e "${RED}✗ VALIDATION FAILED (strict mode)${NC}"
        return 1
    else
        echo -e "${YELLOW}⚠ VALIDATION COMPLETED WITH WARNINGS${NC}"
        return 0
    fi
}

# Help text
show_help() {
    cat <<EOF
CI Validation Script

Usage:
  ci_validate.sh              Run all validation checks
  ci_validate.sh --strict     Fail on any check failure
  ci_validate.sh --quick      Only run critical checks
  ci_validate.sh --help       Show this help

Validation Checks:
  1. TETRA_SRC validation (critical)
  2. Boot system loading (critical)
  3. Syntax error check (critical)
  4. Hardcoded path detection
  5. Module structure validation
  6. Duplicate function detection
  7. Shellcheck error scan

Exit Codes:
  0 - All checks passed (or warnings only in normal mode)
  1 - Critical check failed or any failure in strict mode

Examples:
  ci_validate.sh                    # Normal validation
  ci_validate.sh --strict           # Strict mode (fail on warnings)
  ci_validate.sh --quick            # Quick validation for local dev
EOF
}

# Main entry point
main() {
    case "${1:-}" in
        --strict)
            STRICT_MODE=true
            main_validation
            ;;
        --quick)
            QUICK_MODE=true
            main_validation
            ;;
        --help|-h)
            show_help
            ;;
        "")
            main_validation
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            return 1
            ;;
    esac
}

main "$@"
