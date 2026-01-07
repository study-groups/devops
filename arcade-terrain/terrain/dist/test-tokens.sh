#!/usr/bin/env bash
# Terrain Token Validation Test
# Validates that all TUT-compatible tokens are defined in theme files

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
THEMES_DIR="$SCRIPT_DIR/themes"

# Required TUT tokens (without -- prefix for easier matching)
REQUIRED_TOKENS=(
    "bg-primary"
    "bg-secondary"
    "bg-tertiary"
    "bg-hover"
    "border:"
    "border-visible"
    "border-active"
    "text-primary"
    "text-secondary"
    "text-muted"
    "text-code"
    "accent-primary"
    "accent-secondary"
    "success:"
    "error:"
    "warning:"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

pass_count=0
fail_count=0

validate_theme() {
    local theme_file="$1"
    local theme_name
    theme_name=$(basename "$theme_file" .css)

    echo ""
    echo "Testing: $theme_name"
    echo "----------------------------------------"

    for token in "${REQUIRED_TOKENS[@]}"; do
        # Display name (remove trailing colon if present)
        local display_name="--${token%:}"

        if grep -q "$token" "$theme_file"; then
            echo -e "  ${GREEN}✓${NC} $display_name"
            ((pass_count++)) || true
        else
            echo -e "  ${RED}✗${NC} $display_name ${RED}MISSING${NC}"
            ((fail_count++)) || true
        fi
    done
}

main() {
    echo "╔════════════════════════════════════════╗"
    echo "║   Terrain TUT Token Validation Test    ║"
    echo "╚════════════════════════════════════════╝"

    local theme_count=0
    local valid_count=0

    for theme_file in "$THEMES_DIR"/*.css; do
        if [[ -f "$theme_file" ]]; then
            ((theme_count++)) || true
            validate_theme "$theme_file"
        fi
    done

    echo ""
    echo "========================================"
    echo "Summary"
    echo "----------------------------------------"
    echo "  Themes tested: $theme_count"
    echo -e "  Tokens passed: ${GREEN}$pass_count${NC}"
    echo -e "  Tokens failed: ${RED}$fail_count${NC}"
    echo ""

    if [[ $fail_count -eq 0 ]]; then
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}Some tests failed!${NC}"
        exit 1
    fi
}

main "$@"
