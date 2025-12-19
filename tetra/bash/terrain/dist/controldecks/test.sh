#!/usr/bin/env bash
# Terrain ControlDeck Test Script
# Validates controldeck configs and provides quick testing

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAIN_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Required keys in controldeck config
REQUIRED_KEYS=(
    "terrain.name"
    "canvas.mode"
    "features"
)

echo "╔════════════════════════════════════════╗"
echo "║   Terrain ControlDeck Test Suite       ║"
echo "╚════════════════════════════════════════╝"
echo ""

# List available controldecks
echo -e "${CYAN}Available ControlDecks:${NC}"
echo "----------------------------------------"

for deck_file in "$SCRIPT_DIR"/*.terrain.json; do
    if [[ -f "$deck_file" ]]; then
        deck_name=$(basename "$deck_file" .terrain.json)
        # Extract name and mode from JSON
        name=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$deck_file" | head -1 | cut -d'"' -f4)
        mode=$(grep -o '"mode"[[:space:]]*:[[:space:]]*"[^"]*"' "$deck_file" | head -1 | cut -d'"' -f4)
        theme=$(grep -o '"theme"[[:space:]]*:[[:space:]]*"[^"]*"' "$deck_file" | head -1 | cut -d'"' -f4)

        echo -e "  ${GREEN}✓${NC} $deck_name"
        echo "    Name:  $name"
        echo "    Mode:  $mode"
        echo "    Theme: $theme"
        echo ""
    fi
done

# Validate JSON syntax
echo -e "${CYAN}Validating JSON syntax:${NC}"
echo "----------------------------------------"

pass_count=0
fail_count=0

for deck_file in "$SCRIPT_DIR"/*.terrain.json; do
    if [[ -f "$deck_file" ]]; then
        deck_name=$(basename "$deck_file")
        if python3 -m json.tool "$deck_file" > /dev/null 2>&1; then
            echo -e "  ${GREEN}✓${NC} $deck_name"
            ((pass_count++)) || true
        else
            echo -e "  ${RED}✗${NC} $deck_name - Invalid JSON"
            ((fail_count++)) || true
        fi
    fi
done

echo ""
echo "========================================"
echo "Summary"
echo "----------------------------------------"
echo "  Configs tested: $((pass_count + fail_count))"
echo -e "  Passed: ${GREEN}$pass_count${NC}"
echo -e "  Failed: ${RED}$fail_count${NC}"
echo ""

# Test instructions
echo -e "${CYAN}Test Instructions:${NC}"
echo "----------------------------------------"
echo "1. Start a local server in terrain directory:"
echo "   cd $TERRAIN_DIR && python3 -m http.server 8000"
echo ""
echo "2. Open ControlDeck Switcher:"
echo "   http://localhost:8000/dist/controldecks/switcher.html"
echo ""
echo "3. Or test directly with URL params:"
echo "   http://localhost:8000/index-modular.html?deck=freerange"
echo "   http://localhost:8000/index-modular.html?deck=contained"
echo "   http://localhost:8000/index-modular.html?deck=kiosk"
echo "   http://localhost:8000/index-modular.html?deck=deploy"
echo ""
echo "4. Add &design=true for FAB design panel:"
echo "   http://localhost:8000/index-modular.html?deck=contained&design=true"
echo ""

if [[ $fail_count -eq 0 ]]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
