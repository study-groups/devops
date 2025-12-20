#!/usr/bin/env bash
# TSM Test Runner
# Run all unit and integration tests

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOTAL_FAILED=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================"
echo "TSM TEST SUITE"
echo "========================================"
echo ""

# Run path tests FIRST - these catch the most critical bugs
echo -e "${YELLOW}=== UNIT: Path Validation ===${NC}"
if bash "$SCRIPT_DIR/unit/test_paths.sh"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
    ((TOTAL_FAILED++))
fi
echo ""

# Function existence tests
echo -e "${YELLOW}=== UNIT: Function Existence ===${NC}"
if bash "$SCRIPT_DIR/unit/test_functions.sh"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
    ((TOTAL_FAILED++))
fi
echo ""

# Service lookup tests
echo -e "${YELLOW}=== UNIT: Service Lookup ===${NC}"
if bash "$SCRIPT_DIR/unit/test_service_lookup.sh"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
    ((TOTAL_FAILED++))
fi
echo ""

# Port resolution tests
echo -e "${YELLOW}=== UNIT: Port Resolution ===${NC}"
if bash "$SCRIPT_DIR/unit/test_port_resolution.sh"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
    ((TOTAL_FAILED++))
fi
echo ""

# Integration tests (optional, slower)
if [[ "${1:-}" != "--unit-only" ]]; then
    echo -e "${YELLOW}=== INTEGRATION: Service Start ===${NC}"
    if bash "$SCRIPT_DIR/integration/test_service_start.sh"; then
        echo -e "${GREEN}PASSED${NC}"
    else
        echo -e "${RED}FAILED${NC}"
        ((TOTAL_FAILED++))
    fi
    echo ""
fi

# Summary
echo "========================================"
if [[ $TOTAL_FAILED -eq 0 ]]; then
    echo -e "${GREEN}ALL TESTS PASSED${NC}"
    exit 0
else
    echo -e "${RED}$TOTAL_FAILED TEST SUITE(S) FAILED${NC}"
    exit 1
fi
