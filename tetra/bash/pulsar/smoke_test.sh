#!/usr/bin/env bash
# Pulsar Module Smoke Tests
# Run: bash pulsar/test_smoke.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PASS=0
FAIL=0

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

pass() { ((PASS++)); green "✓ $1"; }
fail() { ((FAIL++)); red "✗ $1"; }

echo "═══════════════════════════════════════"
echo "  Pulsar Module Smoke Tests"
echo "═══════════════════════════════════════"
echo

# ─────────────────────────────────────────
# Test 1: Directory structure
# ─────────────────────────────────────────
echo "Testing directory structure..."

[[ -d "$SCRIPT_DIR/core" ]] && pass "core/ exists" || fail "core/ missing"
[[ -d "$SCRIPT_DIR/docs" ]] && pass "docs/ exists" || fail "docs/ missing"
[[ -d "$SCRIPT_DIR/engine" ]] && pass "engine/ exists" || fail "engine/ missing"
[[ -d "$SCRIPT_DIR/engine/src" ]] && pass "engine/src/ exists" || fail "engine/src/ missing"
[[ -d "$SCRIPT_DIR/engine/bin" ]] && pass "engine/bin/ exists" || fail "engine/bin/ missing"
[[ -d "$SCRIPT_DIR/maps" ]] && pass "maps/ exists" || fail "maps/ missing"
[[ -d "$SCRIPT_DIR/scripts" ]] && pass "scripts/ exists" || fail "scripts/ missing"

echo

# ─────────────────────────────────────────
# Test 2: Core files exist
# ─────────────────────────────────────────
echo "Testing core files..."

[[ -f "$SCRIPT_DIR/pulsar.sh" ]] && pass "pulsar.sh exists" || fail "pulsar.sh missing"
[[ -f "$SCRIPT_DIR/core/repl.sh" ]] && pass "core/repl.sh exists" || fail "core/repl.sh missing"
[[ -f "$SCRIPT_DIR/core/help.sh" ]] && pass "core/help.sh exists" || fail "core/help.sh missing"
[[ -f "$SCRIPT_DIR/maps/control-map.json" ]] && pass "maps/control-map.json exists" || fail "maps/control-map.json missing"

echo

# ─────────────────────────────────────────
# Test 3: C engine source files
# ─────────────────────────────────────────
echo "Testing C engine source files..."

required_c_files=(
    "pulsar.c" "types.h"
    "input.c" "input.h"
    "layout.c" "layout.h"
    "osc.c" "osc.h"
    "render.c" "render.h"
    "tgp.c" "tgp.h"
    "toml.c" "toml.h"
    "ui.c" "ui.h"
    "utils.c" "utils.h"
)

for file in "${required_c_files[@]}"; do
    [[ -f "$SCRIPT_DIR/engine/src/$file" ]] && pass "engine/src/$file" || fail "engine/src/$file missing"
done

echo

# ─────────────────────────────────────────
# Test 4: Binary exists and is executable
# ─────────────────────────────────────────
echo "Testing pulsar binary..."

if [[ -f "$SCRIPT_DIR/engine/bin/pulsar" ]]; then
    pass "engine/bin/pulsar exists"
    if [[ -x "$SCRIPT_DIR/engine/bin/pulsar" ]]; then
        pass "engine/bin/pulsar is executable"
    else
        fail "engine/bin/pulsar not executable"
    fi
else
    fail "engine/bin/pulsar missing"
fi

echo

# ─────────────────────────────────────────
# Test 5: Binary runs and responds
# ─────────────────────────────────────────
echo "Testing pulsar binary execution..."

if [[ -x "$SCRIPT_DIR/engine/bin/pulsar" ]]; then
    output=$(echo "QUIT" | timeout 2 "$SCRIPT_DIR/engine/bin/pulsar" 2>&1 || true)
    if [[ "$output" == *"PULSAR ENGINE"* ]] || [[ "$output" == *"READY"* ]]; then
        pass "pulsar binary shows banner"
    else
        fail "pulsar binary no banner output"
    fi

    if [[ "$output" == *"OK"* ]]; then
        pass "pulsar binary responds OK"
    else
        fail "pulsar binary no OK response"
    fi
fi

echo

# ─────────────────────────────────────────
# Test 6: PQL scripts exist and have content
# ─────────────────────────────────────────
echo "Testing PQL scripts..."

pql_count=$(find "$SCRIPT_DIR/scripts" -name "*.pql" 2>/dev/null | wc -l | tr -d ' ')
if [[ $pql_count -gt 0 ]]; then
    pass "Found $pql_count PQL scripts"
else
    fail "No PQL scripts found"
fi

# Check hello.pql specifically
if [[ -f "$SCRIPT_DIR/scripts/hello.pql" ]]; then
    if [[ -s "$SCRIPT_DIR/scripts/hello.pql" ]]; then
        pass "scripts/hello.pql has content"
    else
        fail "scripts/hello.pql is empty"
    fi
fi

echo

# ─────────────────────────────────────────
# Test 7: Makefile dry-run
# ─────────────────────────────────────────
echo "Testing Makefile..."

if [[ -f "$SCRIPT_DIR/engine/Makefile" ]]; then
    pass "engine/Makefile exists"
    if make -n -C "$SCRIPT_DIR/engine" >/dev/null 2>&1; then
        pass "Makefile syntax valid (dry-run)"
    else
        fail "Makefile syntax error"
    fi
else
    fail "engine/Makefile missing"
fi

echo

# ─────────────────────────────────────────
# Test 8: Bash scripts syntax check
# ─────────────────────────────────────────
echo "Testing bash script syntax..."

for script in "$SCRIPT_DIR"/core/*.sh "$SCRIPT_DIR/pulsar.sh"; do
    if [[ -f "$script" ]]; then
        name=$(basename "$script")
        if bash -n "$script" 2>/dev/null; then
            pass "$name syntax OK"
        else
            fail "$name syntax error"
        fi
    fi
done

echo

# ─────────────────────────────────────────
# Test 9: JSON validity
# ─────────────────────────────────────────
echo "Testing JSON files..."

if command -v python3 &>/dev/null; then
    if python3 -m json.tool "$SCRIPT_DIR/maps/control-map.json" >/dev/null 2>&1; then
        pass "control-map.json valid JSON"
    else
        fail "control-map.json invalid JSON"
    fi
else
    yellow "⚠ Skipping JSON validation (python3 not found)"
fi

echo

# ─────────────────────────────────────────
# Summary
# ─────────────────────────────────────────
echo "═══════════════════════════════════════"
total=$((PASS + FAIL))
if [[ $FAIL -eq 0 ]]; then
    green "All $PASS tests passed!"
else
    echo "Results: $PASS passed, $FAIL failed (of $total)"
fi
echo "═══════════════════════════════════════"

exit $FAIL
