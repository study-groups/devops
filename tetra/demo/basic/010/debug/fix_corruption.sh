#!/usr/bin/env bash

# Replace the fragile read-based variable assignment with array-based approach
cp modules/colors/color_core.sh.backup modules/colors/color_core.sh

# Create bulletproof version that doesn't use read
cat > temp_fix.awk << 'EOF'
/local fg_rgb=\$\(hex_to_rgb "\$fg_hex"\)/ {
    print "    # Get RGB values for both colors - bulletproof method"
    print "    local fg_rgb=$(hex_to_rgb \"$fg_hex\")"
    print "    local bg_rgb=$(hex_to_rgb \"$bg_hex\")"
    print "    # Parse RGB values using parameter expansion (no read command)"
    print "    local fg_r=${fg_rgb%% *}                    # First value"
    print "    local temp1=${fg_rgb#* }                   # Remove first"
    print "    local fg_g=${temp1%% *}                    # Second value"
    print "    local fg_b=${temp1#* }                     # Third value"
    print "    local bg_r=${bg_rgb%% *}                    # First value"
    print "    local temp2=${bg_rgb#* }                   # Remove first"
    print "    local bg_g=${temp2%% *}                    # Second value"
    print "    local bg_b=${temp2#* }                     # Third value"
    # Skip the next several lines that do the old method
    for (i = 0; i < 4; i++) getline
    next
}
{ print }
EOF

awk -f temp_fix.awk modules/colors/color_core.sh > modules/colors/color_core.sh.fixed
mv modules/colors/color_core.sh.fixed modules/colors/color_core.sh
rm temp_fix.awk

echo "Fixed color_core.sh with bulletproof parameter expansion method"