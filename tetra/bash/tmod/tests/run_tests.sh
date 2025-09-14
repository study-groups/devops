#!/usr/bin/env bash

# tmod Test Runner

# Ensure we're in the correct directory
TMOD_TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$TMOD_TEST_DIR" || exit 1

# Source tetra environment and module system
source "$TETRA_SRC/bash/tetra_env.sh"

# Run all test scripts
echo "Running tmod Tests..."
echo "===================="

# Find and run all test scripts
for test_script in test_*.sh; do
    if [[ -f "$test_script" && "$test_script" != "test_helpers.sh" ]]; then
        echo
        echo "Running $test_script:"
        echo "-------------------"
        bash "$test_script"
    fi
done
