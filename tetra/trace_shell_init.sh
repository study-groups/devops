#!/usr/bin/env bash
# Comprehensive Shell Initialization Trace
# Traces the exact flow: .bashrc -> mricos.sh -> ~/tetra/tetra.sh -> tmod load org

set -x  # Print every command
exec 2>/tmp/shell_trace_$$.log  # Redirect stderr to log file

echo "=== TRACE START: $(date) ==="
echo "=== PID: $$ ==="

# Step 1: Simulate .bashrc sourcing mricos.sh
echo "=== STEP 1: Loading mricos.sh ==="
if [[ -f "$HOME/mricos.sh" ]]; then
    source "$HOME/mricos.sh"
    echo "✓ mricos.sh loaded"
else
    echo "✗ mricos.sh not found"
fi

# Step 2: Check tetra.sh was sourced
echo "=== STEP 2: Check tetra.sh loaded ==="
if [[ -n "$TETRA_DIR" && -n "$TETRA_SRC" ]]; then
    echo "✓ TETRA_DIR=$TETRA_DIR"
    echo "✓ TETRA_SRC=$TETRA_SRC"
else
    echo "✗ TETRA variables not set"
    exit 1
fi

# Step 3: Check tmod function exists
echo "=== STEP 3: Check tmod function ==="
if declare -F tmod &>/dev/null; then
    echo "✓ tmod function exists"
    declare -F tmod
else
    echo "✗ tmod function not found"
    echo "Available functions:"
    declare -F | grep -E '(tmod|tetra)' || echo "None found"
    exit 1
fi

# Step 4: Check org module files
echo "=== STEP 4: Check org module files ==="
echo "Checking: $TETRA_SRC/bash/org/includes.sh"
if [[ -f "$TETRA_SRC/bash/org/includes.sh" ]]; then
    echo "✓ org/includes.sh exists"
    echo "First 10 lines:"
    head -10 "$TETRA_SRC/bash/org/includes.sh"
else
    echo "✗ org/includes.sh not found"
fi

# Step 5: Check module loader registration
echo "=== STEP 5: Check module loaders ==="
if declare -p TETRA_MODULE_LOADERS &>/dev/null; then
    echo "✓ TETRA_MODULE_LOADERS exists"
    declare -p TETRA_MODULE_LOADERS | grep org || echo "org not registered"
else
    echo "✗ TETRA_MODULE_LOADERS not found"
fi

# Step 6: Check if org already loaded
echo "=== STEP 6: Check if org already loaded ==="
if declare -p TETRA_MODULE_LOADED &>/dev/null; then
    declare -p TETRA_MODULE_LOADED | grep org || echo "org not loaded yet"
else
    echo "TETRA_MODULE_LOADED not initialized"
fi

# Step 7: Attempt to load org with full tracing
echo "=== STEP 7: Loading org module ==="
echo "Running: tmod load org"

# Enable bash debugging for this specific command
set -v  # Print shell input lines as read
tmod load org 2>&1 | tee /tmp/tmod_load_org_$$.log
LOAD_RESULT=${PIPESTATUS[0]}

set +v

if [[ $LOAD_RESULT -eq 0 ]]; then
    echo "✓ tmod load org succeeded"
else
    echo "✗ tmod load org failed with exit code: $LOAD_RESULT"
fi

# Step 8: Check what got loaded
echo "=== STEP 8: Post-load verification ==="
if declare -p TETRA_MODULE_LOADED &>/dev/null; then
    declare -p TETRA_MODULE_LOADED | grep org && echo "✓ org now loaded" || echo "✗ org still not loaded"
fi

# Check for org functions
echo "=== Checking for org functions ==="
declare -F | grep -E '^declare -f org' || echo "No org functions found"

echo "=== TRACE END: $(date) ==="
echo ""
echo "Full trace saved to: /tmp/shell_trace_$$.log"
echo "Load output saved to: /tmp/tmod_load_org_$$.log"
