#!/usr/bin/env bash
# test_terrain_tok.sh - Regression tests for tok module and terrain modes
#
# Usage: bash test_terrain_tok.sh

TETRA_SRC="${TETRA_SRC:-/Users/mricos/src/devops/tetra}"
PASS=0
FAIL=0

pass() { echo "✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "✗ $1"; FAIL=$((FAIL + 1)); }

echo "=== TOK Module Tests ==="
echo ""

# Test tok files exist
if [[ -f "$TETRA_SRC/bash/tok/tok.sh" ]]; then pass "tok.sh exists"; else fail "tok.sh missing"; fi
if [[ -f "$TETRA_SRC/bash/tok/includes.sh" ]]; then pass "includes.sh exists"; else fail "includes.sh missing"; fi
if [[ -f "$TETRA_SRC/bash/tok/core/json.sh" ]]; then pass "core/json.sh exists"; else fail "core/json.sh missing"; fi
if [[ -f "$TETRA_SRC/bash/tok/core/hydrate.sh" ]]; then pass "core/hydrate.sh exists"; else fail "core/hydrate.sh missing"; fi
if [[ -f "$TETRA_SRC/bash/tok/core/schema.sh" ]]; then pass "core/schema.sh exists"; else fail "core/schema.sh missing"; fi

# Test schemas exist and are valid JSON
if [[ -f "$TETRA_SRC/bash/tok/schemas/guide.schema.json" ]]; then
    pass "guide.schema.json exists"
    if jq empty "$TETRA_SRC/bash/tok/schemas/guide.schema.json" 2>/dev/null; then
        pass "guide.schema.json valid JSON"
    else
        fail "guide.schema.json invalid JSON"
    fi
else
    fail "guide.schema.json missing"
fi

echo ""
echo "=== Terrain Mode Tests ==="
echo ""

# Test mode.js exists
if [[ -f "$TETRA_SRC/bash/terrain/js/core/mode.js" ]]; then pass "mode.js exists"; else fail "mode.js missing"; fi

# Test mode files
MODES_DIR="$TETRA_SRC/bash/terrain/dist/modes"
for mode in freerange guide reference deploy control; do
    if [[ -f "$MODES_DIR/${mode}.mode.json" ]]; then
        pass "${mode}.mode.json exists"
        if jq -e '.mode.name' "$MODES_DIR/${mode}.mode.json" >/dev/null 2>&1; then
            pass "${mode}.mode.json has mode.name"
        else
            fail "${mode}.mode.json missing mode.name"
        fi
    else
        fail "${mode}.mode.json missing"
    fi
done

echo ""
echo "=== Terrain Theme Tests ==="
echo ""

THEMES_DIR="$TETRA_SRC/bash/terrain/dist/themes"
for theme in dark amber forest midnight controldeck; do
    if [[ -f "$THEMES_DIR/${theme}.theme.css" ]]; then
        pass "${theme}.theme.css exists"
    else
        fail "${theme}.theme.css missing"
    fi
done

echo ""
echo "=== ControlDeck App Tests ==="
echo ""

CONTROLDECK_DIR="/Users/mricos/src/controldeck"

if [[ -f "$CONTROLDECK_DIR/terrain.config.json" ]]; then
    pass "terrain.config.json exists"
    if jq empty "$CONTROLDECK_DIR/terrain.config.json" 2>/dev/null; then
        pass "terrain.config.json valid JSON"
        MODE=$(jq -r '.mode // empty' "$CONTROLDECK_DIR/terrain.config.json")
        THEME=$(jq -r '.theme // empty' "$CONTROLDECK_DIR/terrain.config.json")
        if [[ "$MODE" == "control" ]]; then pass "mode=control"; else fail "mode should be control, got $MODE"; fi
        if [[ "$THEME" == "controldeck" ]]; then pass "theme=controldeck"; else fail "theme should be controldeck, got $THEME"; fi
    else
        fail "terrain.config.json invalid JSON"
    fi
else
    fail "terrain.config.json missing"
fi

if [[ -f "$CONTROLDECK_DIR/controldeck.js" ]]; then pass "controldeck.js exists"; else fail "controldeck.js missing"; fi
if [[ -L "$CONTROLDECK_DIR/terrain" ]]; then pass "terrain symlink exists"; else fail "terrain symlink missing"; fi

echo ""
echo "=== Summary ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo ""

if [[ $FAIL -eq 0 ]]; then
    echo "All tests passed!"
    exit 0
else
    echo "Some tests failed"
    exit 1
fi
