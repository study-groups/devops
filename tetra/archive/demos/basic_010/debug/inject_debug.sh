#!/usr/bin/env bash

# Inject debug logging directly into the color_core.sh file
cp modules/colors/color_core.sh modules/colors/color_core.sh.backup

# Add logging to the actual theme_aware_dim function
sed -i '' '/local r=\$(( (fg_r \* fg_factor + bg_r \* bg_factor) \/ 7 ))/i\
    echo "DEBUG: fg_r='"'"'$fg_r'"'"' fg_g='"'"'$fg_g'"'"' fg_b='"'"'$fg_b'"'"'" >> /tmp/color_vars.log\
    if [[ "$fg_r" =~ [[:space:]] ]]; then echo "CORRUPTION: fg_r contains spaces" >> /tmp/color_vars.log; fi
' modules/colors/color_core.sh

echo "Debug injected into color_core.sh. Check /tmp/color_vars.log during demo run"
echo "To restore: mv modules/colors/color_core.sh.backup modules/colors/color_core.sh"