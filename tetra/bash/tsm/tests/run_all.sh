#!/usr/bin/env bash
# TSM Test Runner
# Run shellcheck, unit tests, and integration tests

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TSM_DIR="$(dirname "$SCRIPT_DIR")"
TOTAL_FAILED=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "========================================"
echo "TSM TEST SUITE"
echo "========================================"
echo ""

# =============================================================================
# SHELLCHECK (static analysis)
# =============================================================================

if [[ "${1:-}" != "--skip-shellcheck" ]]; then
    echo -e "${CYAN}=== STATIC: Shellcheck ===${NC}"

    if ! command -v shellcheck &>/dev/null; then
        echo -e "${YELLOW}SKIPPED: shellcheck not installed${NC}"
        echo "  Install: brew install shellcheck (macOS) or apt install shellcheck (Linux)"
    else
        SHELLCHECK_FAILED=0

        # Check core TSM files
        while IFS= read -r -d '' file; do
            if ! shellcheck -S warning -e SC1090,SC1091,SC2034 "$file" 2>/dev/null; then
                echo -e "${RED}FAILED: $file${NC}"
                ((SHELLCHECK_FAILED++)) || true
            fi
        done < <(find "$TSM_DIR" -maxdepth 1 -name "*.sh" -print0)

        # Check core/ directory
        while IFS= read -r -d '' file; do
            if ! shellcheck -S warning -e SC1090,SC1091,SC2034 "$file" 2>/dev/null; then
                echo -e "${RED}FAILED: $file${NC}"
                ((SHELLCHECK_FAILED++)) || true
            fi
        done < <(find "$TSM_DIR/core" -name "*.sh" -print0 2>/dev/null)

        # Check process/ directory
        while IFS= read -r -d '' file; do
            if ! shellcheck -S warning -e SC1090,SC1091,SC2034 "$file" 2>/dev/null; then
                echo -e "${RED}FAILED: $file${NC}"
                ((SHELLCHECK_FAILED++)) || true
            fi
        done < <(find "$TSM_DIR/process" -name "*.sh" -print0 2>/dev/null)

        # Check services/ directory
        while IFS= read -r -d '' file; do
            if ! shellcheck -S warning -e SC1090,SC1091,SC2034 "$file" 2>/dev/null; then
                echo -e "${RED}FAILED: $file${NC}"
                ((SHELLCHECK_FAILED++)) || true
            fi
        done < <(find "$TSM_DIR/services" -name "*.sh" -print0 2>/dev/null)

        if [[ $SHELLCHECK_FAILED -eq 0 ]]; then
            echo -e "${GREEN}PASSED: All files pass shellcheck${NC}"
        else
            echo -e "${RED}FAILED: $SHELLCHECK_FAILED file(s) have issues${NC}"
            ((TOTAL_FAILED++)) || true
        fi
    fi
    echo ""
fi

# =============================================================================
# UNIT TESTS
# =============================================================================

# IFS safety tests (critical - run first)
echo -e "${YELLOW}=== UNIT: IFS Safety ===${NC}"
if bash "$SCRIPT_DIR/unit/test_ifs_safety.sh"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
    ((TOTAL_FAILED++)) || true
fi
echo ""

# Path validation tests
echo -e "${YELLOW}=== UNIT: Path Validation ===${NC}"
if bash "$SCRIPT_DIR/unit/test_paths.sh"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
    ((TOTAL_FAILED++)) || true
fi
echo ""

# Function existence tests
echo -e "${YELLOW}=== UNIT: Function Existence ===${NC}"
if bash "$SCRIPT_DIR/unit/test_functions.sh"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
    ((TOTAL_FAILED++)) || true
fi
echo ""

# Service lookup tests
echo -e "${YELLOW}=== UNIT: Service Lookup ===${NC}"
if bash "$SCRIPT_DIR/unit/test_service_lookup.sh"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
    ((TOTAL_FAILED++)) || true
fi
echo ""

# Port resolution tests
echo -e "${YELLOW}=== UNIT: Port Resolution ===${NC}"
if bash "$SCRIPT_DIR/unit/test_port_resolution.sh"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
    ((TOTAL_FAILED++)) || true
fi
echo ""

# =============================================================================
# INTEGRATION TESTS
# =============================================================================

if [[ "${1:-}" != "--unit-only" ]]; then
    echo -e "${YELLOW}=== INTEGRATION: Service Start ===${NC}"
    if bash "$SCRIPT_DIR/integration/test_service_start.sh"; then
        echo -e "${GREEN}PASSED${NC}"
    else
        echo -e "${RED}FAILED${NC}"
        ((TOTAL_FAILED++)) || true
    fi
    echo ""
fi

# =============================================================================
# SUMMARY
# =============================================================================

echo "========================================"
if [[ $TOTAL_FAILED -eq 0 ]]; then
    echo -e "${GREEN}ALL TESTS PASSED${NC}"
    exit 0
else
    echo -e "${RED}$TOTAL_FAILED TEST SUITE(S) FAILED${NC}"
    exit 1
fi
