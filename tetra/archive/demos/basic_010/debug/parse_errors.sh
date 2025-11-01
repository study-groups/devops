#!/usr/bin/env bash

echo "=== BASH PARSE ERROR DETECTION ==="

# Check syntax of all color files
echo "1. Syntax check all color files:"
for file in modules/colors/*.sh; do
    if bash -n "$file" 2>&1; then
        echo "✓ $file syntax OK"
    else
        echo "✗ $file SYNTAX ERROR:"
        bash -n "$file" 2>&1 | head -5
    fi
done

echo -e "\n2. Check line 185 in color_core.sh:"
sed -n '180,190p' modules/colors/color_core.sh | cat -n

echo -e "\n3. Check line 56 in color_module.sh:"
sed -n '50,60p' modules/colors/color_module.sh | cat -n

echo -e "\n4. Check line 167 in top_status.sh:"
sed -n '160,170p' top_status.sh | cat -n

echo -e "\n5. Test variable assignment directly:"
source modules/colors/color_core.sh
echo "Testing hex_to_rgb:"
hex_to_rgb "00AA00"
echo "Testing variable read:"
{ read fg_r fg_g fg_b; } < <(hex_to_rgb "00AA00")
echo "fg_r='$fg_r' fg_g='$fg_g' fg_b='$fg_b'"
echo "Testing arithmetic:"
echo "r calculation: fg_r=$fg_r * 7 = $((fg_r * 7))"