#!/usr/bin/env bash

# Quick debug script to catch basic sourcing errors
echo "=== COLOR SYSTEM DEBUG ==="

echo "1. Checking file existence..."
for file in ./modules/colors/{color_core,color_themes,color_palettes,color_elements,color_ui}.sh; do
    if [[ -f "$file" ]]; then
        echo "✓ $file exists"
    else
        echo "✗ $file MISSING"
    fi
done

echo -e "\n2. Checking syntax..."
for file in ./modules/colors/*.sh; do
    if bash -n "$file" 2>/dev/null; then
        echo "✓ $file syntax OK"
    else
        echo "✗ $file SYNTAX ERROR:"
        bash -n "$file"
    fi
done

echo -e "\n3. Test sourcing colors.sh..."
if source ./colors.sh 2>/dev/null; then
    echo "✓ colors.sh sources successfully"
else
    echo "✗ colors.sh FAILS:"
    bash -x ./colors.sh 2>&1 | head -10
fi