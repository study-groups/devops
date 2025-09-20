#!/usr/bin/env bash

# Source all TSM components properly
source ../tetra/bash/tsm/tsm_utils.sh
source ../tetra/bash/tsm/tsm_core.sh
source ../tetra/bash/tsm/tsm_inspect.sh
source ../tetra/bash/tsm/tsm_services.sh
source ../tetra/bash/tsm/tsm_formatting.sh

echo "=== Debug TSM Environment-Aware Naming ==="

echo "1. Testing auto-detection with default env (local):"
script="entrypoints/devpages.sh"
tetra_tsm_start_cli "$script" "" ""

echo -e "\n2. Testing explicit dev environment:"
echo "Stopping previous process..."
tsm stop devpages-local-4000 2>/dev/null || true
sleep 1
tetra_tsm_start_cli "$script" "" "dev"

echo -e "\n3. Testing custom name override:"
echo "Stopping previous process..."
tsm stop devpages-dev-4001 2>/dev/null || true
sleep 1
tetra_tsm_start_cli "$script" "myapp" ""