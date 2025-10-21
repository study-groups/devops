#!/usr/bin/env bash
# Trace exactly what the user experiences

LOG="/tmp/shell_trace_$(date +%s).log"

# Redirect all output to log AND terminal
exec > >(tee -a "$LOG") 2>&1

echo "======================================================================="
echo "SHELL TRACE - Capturing your exact experience"
echo "Started: $(date)"
echo "Log: $LOG"
echo "======================================================================="
echo ""

# Enable bash error tracing
set -eE
trap 'echo "ERROR at line $LINENO: command failed with exit code $?"' ERR

echo "Step 1: Check environment"
echo "  TETRA_SRC: ${TETRA_SRC}"
echo "  TETRA_DIR: ${TETRA_DIR}"
echo "  Shell: $BASH_VERSION"
echo "  tmod available: $(command -v tmod >/dev/null 2>&1 && echo YES || echo NO)"
echo ""

echo "Step 2: Show tmod status before load"
tmod status 2>&1 | head -20
echo ""

echo "Step 3: Check if org already loaded"
if [[ "${TETRA_MODULE_LOADED[org]}" == "true" ]]; then
    echo "  ⚠️  org is ALREADY loaded!"
    echo "  Unloading first..."
    tmod unload org
fi
echo ""

echo "Step 4: Execute 'tmod load org' with full trace"
echo "-------------------------------------------------------------------"
set -xv
tmod load org
LOAD_EXIT=$?
set +xv
echo "-------------------------------------------------------------------"
echo ""

echo "Step 5: Check exit code"
echo "  Exit code: $LOAD_EXIT"
if [[ $LOAD_EXIT -eq 0 ]]; then
    echo "  ✓ Command returned success"
else
    echo "  ✗ Command returned error: $LOAD_EXIT"
fi
echo ""

echo "Step 6: Check if shell is still responsive"
echo "  Current PID: $$"
echo "  Shell status: ALIVE"
echo ""

echo "Step 7: Check module status after load"
tmod list loaded 2>&1 | grep -E "(org|MODULE)" || echo "  (no loaded modules shown)"
echo ""

echo "Step 8: Check functions"
for func in org org_repl org_list org_active; do
    if command -v "$func" >/dev/null 2>&1; then
        echo "  ✓ $func"
    else
        echo "  ✗ $func MISSING"
    fi
done
echo ""

echo "Step 9: Try calling org_list"
if org_list 2>&1; then
    echo "  ✓ org_list works"
else
    echo "  ✗ org_list failed: $?"
fi
echo ""

echo "======================================================================="
echo "TRACE COMPLETE"
echo "Finished: $(date)"
echo "Log saved: $LOG"
echo "======================================================================="
echo ""
echo "Shell is still running. If you see this, no crash occurred during trace."
