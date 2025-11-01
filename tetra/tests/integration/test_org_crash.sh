#!/usr/bin/env bash
# Find the actual crash point

LOG="/tmp/org_crash_detail.log"

{
    echo "=== Testing for crash after load ==="
    echo ""

    echo "Before load:"
    echo "Shell status: OK"

    echo ""
    echo "Loading org..."
    tmod load org
    load_exit=$?

    echo ""
    echo "After load returned:"
    echo "Exit code: $load_exit"
    echo "Shell status: $(echo OK)"

    echo ""
    echo "Testing function calls:"

    echo -n "  org_list... "
    if org_list >/dev/null 2>&1; then
        echo "OK"
    else
        echo "FAILED: $?"
    fi

    echo -n "  org_active... "
    if org_active >/dev/null 2>&1; then
        echo "OK"
    else
        echo "FAILED: $?"
    fi

    echo ""
    echo "Checking REPL registration:"
    declare -p REPL_SLASH_HANDLERS 2>/dev/null || echo "  Not set"

    echo ""
    echo "Shell still alive: YES"

} 2>&1 | tee "$LOG"

echo ""
echo "If you see this, shell didn't crash"
echo "Log: $LOG"
