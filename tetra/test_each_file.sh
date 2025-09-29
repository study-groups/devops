#!/usr/bin/env bash

# Test each file individually to find the problematic one
export TETRA_SRC="/Users/mricos/src/devops/tetra"
export TETRA_DIR="$TETRA_SRC"
MOD_SRC="$TETRA_SRC/bash/tsm"

echo "Testing each TSM file individually..."

files=(
    "core/config.sh"
    "core/core.sh"
    "core/utils.sh"
    "core/validation.sh"
    "core/environment.sh"
    "core/files.sh"
    "core/helpers.sh"
    "core/setup.sh"
    "system/formatting.sh"
    "system/ports.sh"
    "system/resource_manager.sh"
)

for file in "${files[@]}"; do
    echo "Testing: $file"
    if timeout 5 bash -c "export MOD_SRC='$MOD_SRC'; source '$MOD_SRC/$file'; echo 'OK'" 2>/dev/null; then
        echo "✅ $file loads successfully"
    else
        echo "❌ $file has issues or timeout"
        echo "Found problematic file: $file"
        exit 1
    fi
done

echo "All core files test successfully! Issue might be in combination or later files."