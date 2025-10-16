#!/usr/bin/env bash
# Incremental debug - test each component step by step to find what crashes
# This sources components ONE AT A TIME and checks after each

LOG="/tmp/tetra_incremental_$(date +%Y%m%d_%H%M%S).log"

echo "=== Incremental Tetra Debug ===" | tee "$LOG"
echo "Testing each component separately..." | tee -a "$LOG"
echo "Log: $LOG" | tee -a "$LOG"
echo "" | tee -a "$LOG"

# Test function
test_source() {
    local file="$1"
    local desc="$2"

    echo -n "Testing: $desc ... " | tee -a "$LOG"

    if [[ ! -f "$file" ]]; then
        echo "FILE NOT FOUND" | tee -a "$LOG"
        return 1
    fi

    # Try to source in subshell first
    if (source "$file") 2>>"$LOG"; then
        echo "✓ OK (subshell)" | tee -a "$LOG"
        return 0
    else
        echo "✗ FAILED (exit $?)" | tee -a "$LOG"
        return 1
    fi
}

# Step 1: Test tetra.sh environment setup only (without sourcing bootloader)
echo "=== STEP 1: Test tetra.sh env vars ===" | tee -a "$LOG"
test_source <(cat << 'EOF'
TETRA_DIR=/Users/mricos/tetra
TETRA_SRC="${TETRA_SRC:-$HOME/src/devops/tetra}"
export TETRA_DIR
export TETRA_SRC
echo "TETRA_DIR=$TETRA_DIR"
echo "TETRA_SRC=$TETRA_SRC"
EOF
) "Environment variables"

# Step 2: Test each boot component individually
echo "" | tee -a "$LOG"
echo "=== STEP 2: Test boot components individually ===" | tee -a "$LOG"

BOOT_DIR="$HOME/src/devops/tetra/bash/boot"

test_source "$BOOT_DIR/boot_core.sh" "boot_core.sh"
test_source "$BOOT_DIR/boot_modules.sh" "boot_modules.sh"
test_source "$BOOT_DIR/boot_aliases.sh" "boot_aliases.sh"
test_source "$BOOT_DIR/boot_prompt.sh" "boot_prompt.sh (SUSPECT)"

# Step 3: Test boot components in sequence (cumulative)
echo "" | tee -a "$LOG"
echo "=== STEP 3: Test cumulative loading ===" | tee -a "$LOG"

echo -n "Testing: core only ... " | tee -a "$LOG"
if (
    export TETRA_DIR=/Users/mricos/tetra
    export TETRA_SRC="$HOME/src/devops/tetra"
    source "$BOOT_DIR/boot_core.sh"
) 2>>"$LOG"; then
    echo "✓ OK" | tee -a "$LOG"
else
    echo "✗ FAILED" | tee -a "$LOG"
fi

echo -n "Testing: core + modules ... " | tee -a "$LOG"
if (
    export TETRA_DIR=/Users/mricos/tetra
    export TETRA_SRC="$HOME/src/devops/tetra"
    source "$BOOT_DIR/boot_core.sh"
    source "$BOOT_DIR/boot_modules.sh"
) 2>>"$LOG"; then
    echo "✓ OK" | tee -a "$LOG"
else
    echo "✗ FAILED" | tee -a "$LOG"
fi

echo -n "Testing: core + modules + aliases ... " | tee -a "$LOG"
if (
    export TETRA_DIR=/Users/mricos/tetra
    export TETRA_SRC="$HOME/src/devops/tetra"
    source "$BOOT_DIR/boot_core.sh"
    source "$BOOT_DIR/boot_modules.sh"
    source "$BOOT_DIR/boot_aliases.sh"
) 2>>"$LOG"; then
    echo "✓ OK" | tee -a "$LOG"
else
    echo "✗ FAILED" | tee -a "$LOG"
fi

echo -n "Testing: core + modules + aliases + prompt ... " | tee -a "$LOG"
if (
    export TETRA_DIR=/Users/mricos/tetra
    export TETRA_SRC="$HOME/src/devops/tetra"
    source "$BOOT_DIR/boot_core.sh"
    source "$BOOT_DIR/boot_modules.sh"
    source "$BOOT_DIR/boot_aliases.sh"
    source "$BOOT_DIR/boot_prompt.sh"
) 2>>"$LOG"; then
    echo "✓ OK" | tee -a "$LOG"
else
    echo "✗ FAILED (THIS IS LIKELY THE CULPRIT)" | tee -a "$LOG"
fi

# Step 4: Test full bootloader without auto-loading
echo "" | tee -a "$LOG"
echo "=== STEP 4: Test full bootloader (no auto-load) ===" | tee -a "$LOG"

echo -n "Testing: bootloader with TETRA_BOOTLOADER_LOADED set ... " | tee -a "$LOG"
if (
    export TETRA_DIR=/Users/mricos/tetra
    export TETRA_SRC="$HOME/src/devops/tetra"
    export TETRA_BOOTLOADER_LOADED="$$"  # Prevent auto-loading
    source "$HOME/src/devops/tetra/bash/bootloader.sh"
) 2>>"$LOG"; then
    echo "✓ OK" | tee -a "$LOG"
else
    echo "✗ FAILED" | tee -a "$LOG"
fi

echo "" | tee -a "$LOG"
echo "=== Analysis Complete ===" | tee -a "$LOG"
echo "Full log: $LOG"
echo ""
echo "Next steps:"
echo "1. Review log: less '$LOG'"
echo "2. If boot_prompt.sh failed, examine it: less '$BOOT_DIR/boot_prompt.sh'"
echo "3. Check for terminal control sequences that might crash your terminal"
