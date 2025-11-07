#!/usr/bin/env bash

# Tetra Pre-Flight Check - Validates environment before any operations

set -euo pipefail

# Standard Tetra paths
EXPECTED_TETRA_DIR="$HOME/tetra"
EXPECTED_TETRA_SRC="$HOME/src/devops/tetra"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_status() {
    local status="$1"
    local message="$2"

    if [[ "$status" == "pass" ]]; then
        echo -e "${GREEN}✓${NC} $message"
        return 0
    elif [[ "$status" == "warn" ]]; then
        echo -e "${YELLOW}⚠${NC} $message"
        return 1
    else
        echo -e "${RED}✗${NC} $message"
        return 1
    fi
}

check_environment() {
    local errors=0

    echo "🚀 Tetra Pre-Flight Check"
    echo "========================"

    # Check TETRA_DIR
    if [[ -z "${TETRA_DIR:-}" ]]; then
        check_status "fail" "TETRA_DIR not set (should be $EXPECTED_TETRA_DIR)"
        ((errors++))
    elif [[ "$TETRA_DIR" != "$EXPECTED_TETRA_DIR" ]]; then
        check_status "warn" "TETRA_DIR=$TETRA_DIR (expected $EXPECTED_TETRA_DIR)"
        ((errors++))
    else
        check_status "pass" "TETRA_DIR=$TETRA_DIR"
    fi

    # Check TETRA_SRC
    if [[ -z "${TETRA_SRC:-}" ]]; then
        check_status "fail" "TETRA_SRC not set (should be $EXPECTED_TETRA_SRC)"
        ((errors++))
    elif [[ "$TETRA_SRC" != "$EXPECTED_TETRA_SRC" ]]; then
        check_status "warn" "TETRA_SRC=$TETRA_SRC (expected $EXPECTED_TETRA_SRC)"
        ((errors++))
    else
        check_status "pass" "TETRA_SRC=$TETRA_SRC"
    fi

    # Check directories exist
    if [[ ! -d "$EXPECTED_TETRA_DIR" ]]; then
        check_status "fail" "Directory $EXPECTED_TETRA_DIR does not exist"
        ((errors++))
    else
        check_status "pass" "Directory $EXPECTED_TETRA_DIR exists"
    fi

    if [[ ! -d "$EXPECTED_TETRA_SRC" ]]; then
        check_status "fail" "Directory $EXPECTED_TETRA_SRC does not exist"
        ((errors++))
    else
        check_status "pass" "Directory $EXPECTED_TETRA_SRC exists"
    fi

    # Check core modules
    for module in tsm tview pm; do
        local module_file="$EXPECTED_TETRA_SRC/bash/$module/${module}.sh"
        if [[ -f "$module_file" ]]; then
            check_status "pass" "Core module $module found"
        else
            check_status "fail" "Core module $module missing at $module_file"
            ((errors++))
        fi
    done

    echo "========================"

    if [[ $errors -eq 0 ]]; then
        echo -e "${GREEN}All checks passed! Tetra environment is ready.${NC}"
        return 0
    else
        echo -e "${RED}$errors error(s) found. Fix environment before proceeding.${NC}"
        echo ""
        echo "Quick fix:"
        echo "export TETRA_DIR=$EXPECTED_TETRA_DIR"
        echo "export TETRA_SRC=$EXPECTED_TETRA_SRC"
        return 1
    fi
}

# Auto-fix function
auto_fix() {
    echo "🔧 Auto-fixing Tetra environment..."

    # Create directories if they don't exist
    mkdir -p "$EXPECTED_TETRA_DIR"
    mkdir -p "$(dirname "$EXPECTED_TETRA_SRC")"

    # Set environment variables for current session
    export TETRA_DIR="$EXPECTED_TETRA_DIR"
    export TETRA_SRC="$EXPECTED_TETRA_SRC"

    echo "Environment variables set for current session."
    echo "Add these to your ~/.bashrc or ~/.zshrc:"
    echo "export TETRA_DIR=$EXPECTED_TETRA_DIR"
    echo "export TETRA_SRC=$EXPECTED_TETRA_SRC"
}

# Main execution
case "${1:-check}" in
    "check")
        check_environment
        ;;
    "fix")
        auto_fix
        check_environment
        ;;
    *)
        echo "Usage: $0 [check|fix]"
        echo "  check - Run pre-flight checks (default)"
        echo "  fix   - Auto-fix environment then check"
        ;;
esac