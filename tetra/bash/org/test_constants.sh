#!/usr/bin/env bash
# Quick test to verify org_constants loads properly

echo "Testing org_constants.sh loading..."
echo

source "$TETRA_SRC/bash/org/org_constants.sh"

echo "ORG_ENVIRONMENTS: ${ORG_ENVIRONMENTS[@]}"
echo "Count: ${#ORG_ENVIRONMENTS[@]}"
echo

echo "ORG_MODES: ${ORG_MODES[@]}"
echo "Count: ${#ORG_MODES[@]}"
echo

if [[ ${#ORG_ENVIRONMENTS[@]} -eq 4 ]] && [[ ${#ORG_MODES[@]} -eq 3 ]]; then
    echo "✓ Constants loaded correctly"
else
    echo "✗ Constants NOT loaded correctly"
    exit 1
fi
