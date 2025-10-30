#!/usr/bin/env bash
# boot_profile.sh - Profile tetra bootloader performance
# Usage: bash bash/boot/boot_profile.sh

set -e

TETRA_SRC="${TETRA_SRC:-$HOME/src/devops/tetra}"
PROFILE_LOG="/tmp/tetra_boot_profile.log"
TRACE_LOG="/tmp/tetra_boot_trace.log"

echo "Profiling Tetra boot sequence..."
echo "TETRA_SRC: $TETRA_SRC"
echo ""

# Clean up previous logs
rm -f "$PROFILE_LOG" "$TRACE_LOG"

# Method 1: Count lines executed with set -x
echo "=== Method 1: Counting executed lines with set -x ==="
(
    export TETRA_SRC
    export TETRA_DIR="$HOME/tetra"
    export PS4='+(${BASH_SOURCE}:${LINENO}): ${FUNCNAME[0]:+${FUNCNAME[0]}(): }'
    set -x
    source ~/tetra/tetra.sh 2>"$TRACE_LOG" >/dev/null
) || true

# Count total lines executed
total_lines=$(wc -l < "$TRACE_LOG" | tr -d ' ')
echo "Total trace lines: $total_lines"

# Count by file
echo ""
echo "Top files by lines executed:"
grep -o '^+([^:]*' "$TRACE_LOG" | sed 's/^+(//' | sort | uniq -c | sort -rn | head -20

# Method 2: Time individual boot stages
echo ""
echo "=== Method 2: Timing individual boot stages ==="

time_stage() {
    local stage="$1"
    local start=$(date +%s%N)
    eval "$2" >/dev/null 2>&1 || true
    local end=$(date +%s%N)
    local elapsed=$(( (end - start) / 1000000 ))
    printf "%-30s %6d ms\n" "$stage:" "$elapsed"
}

# Fresh shell for each test
export TETRA_SRC TETRA_DIR="$HOME/tetra"

time_stage "Full boot" "bash -c 'source ~/tetra/tetra.sh'"
time_stage "Bootloader validation" "bash -c 'source $TETRA_SRC/bash/bootloader.sh; exit 0' 2>&1 | head -1"
time_stage "Load boot_core.sh" "bash -c 'export TETRA_DIR=~/tetra; source $TETRA_SRC/bash/boot/boot_core.sh'"
time_stage "Load boot_modules.sh" "bash -c 'export TETRA_DIR=~/tetra; source $TETRA_SRC/bash/boot/boot_core.sh; source $TETRA_SRC/bash/boot/boot_modules.sh'"
time_stage "Load utils module" "bash -c 'source ~/tetra/tetra.sh; tetra_load_module utils'"
time_stage "Load prompt module" "bash -c 'source ~/tetra/tetra.sh; tetra_load_module prompt'"
time_stage "Load tmod module" "bash -c 'source ~/tetra/tetra.sh; tetra_load_module tmod'"
time_stage "Load qa module" "bash -c 'source ~/tetra/tetra.sh; tetra_load_module qa'"

# Method 3: Analyze what's being loaded at boot
echo ""
echo "=== Method 3: Boot-time module analysis ==="
echo "Modules registered for lazy loading: $(grep -c 'tetra_register_module' $TETRA_SRC/bash/boot/boot_modules.sh)"
echo "Lazy function stubs created: $(grep -c 'tetra_create_lazy_function' $TETRA_SRC/bash/boot/boot_modules.sh)"
echo "Modules loaded immediately (boot_core.sh): $(grep -c '^tetra_load_module' $TETRA_SRC/bash/boot/boot_core.sh)"

echo ""
echo "Modules loaded at boot:"
grep '^tetra_load_module' "$TETRA_SRC/bash/boot/boot_core.sh" | sed 's/tetra_load_module "/  - /' | sed 's/"$//'

# Method 4: Check includes.sh sizes
echo ""
echo "=== Method 4: Module complexity (lines in includes.sh) ==="
for module in utils prompt tmod qa; do
    if [[ -f "$TETRA_SRC/bash/$module/includes.sh" ]]; then
        lines=$(wc -l < "$TETRA_SRC/bash/$module/includes.sh" | tr -d ' ')
        printf "%-15s %5d lines\n" "$module:" "$lines"
    fi
done

echo ""
echo "Profile logs saved:"
echo "  Trace log: $TRACE_LOG"
echo "  Lines: $total_lines"
