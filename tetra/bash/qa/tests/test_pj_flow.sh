#!/usr/bin/env bash

echo "=== Testing Complete PJ Flow ==="

# Start fresh - unset any existing functions
unset -f pj 2>/dev/null
unset -f nh_load_env_vars 2>/dev/null
unset -f nh_make_short_vars 2>/dev/null

# Clear variables
unset paq pap pad 2>/dev/null

echo "Creating pj function..."
pj() {
    source $HOME/nh/pj/init.sh
}

echo "Running pj command..."
pj

echo ""
echo "Checking if variables are set:"
echo "  paq=${paq:-NOT SET}"
echo "  pad=${pad:-NOT SET}"
echo "  pap=${pap:-NOT SET}"

echo ""
echo "Testing SSH connection syntax:"
if [[ -n "$paq" ]]; then
    echo "  ssh root@$paq  # Would connect to qa server"
else
    echo "  ✗ paq not set"
fi

echo ""
echo "All exported variables starting with 'p':"
env | grep '^p[a-z]*=' | head -10