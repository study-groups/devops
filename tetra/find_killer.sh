#!/usr/bin/env bash
# Find which file is killing the terminal

source ~/tetra/tetra.sh 2>&1 | head -3

ORG_SRC="$TETRA_SRC/bash/org"

echo "Testing each file that org/includes.sh sources..."
echo ""

test_file() {
    local file="$1"
    local opts="${2:-}"

    echo -n "Testing: $file ... "

    if [[ ! -f "$file" ]]; then
        echo "MISSING"
        return 1
    fi

    # Test in subshell
    if bash -c "set +xv; source '$file' $opts" 2>&1 >/dev/null; then
        echo "OK"
        return 0
    else
        echo "CRASHES"
        return 1
    fi
}

test_file "$ORG_SRC/tetra_org.sh"
test_file "$ORG_SRC/discovery.sh" "2>/dev/null || true"
test_file "$ORG_SRC/converter.sh" "2>/dev/null || true"
test_file "$ORG_SRC/compiler.sh" "2>/dev/null || true"
test_file "$ORG_SRC/refresh.sh" "2>/dev/null || true"
test_file "$ORG_SRC/secrets_manager.sh" "2>/dev/null || true"
test_file "$ORG_SRC/org_help.sh" "2>/dev/null || true"
test_file "$ORG_SRC/org_repl_adapter.sh" "2>/dev/null || true"
test_file "$TETRA_SRC/bash/nh/nh_bridge.sh" "2>/dev/null || true"

echo ""
echo "Now testing the full includes.sh..."
if bash -c "set +xv; source '$ORG_SRC/includes.sh'" 2>&1 >/dev/null; then
    echo "✓ includes.sh loads OK"
else
    echo "✗ includes.sh CRASHES"
fi
