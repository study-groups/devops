#!/usr/bin/env bash

# Basic test for qa system
set -euo pipefail

# Test directory setup
TEST_QA_DIR="/tmp/test_qa_$$"
export QA_DIR="$TEST_QA_DIR"

echo "Testing qa system with QA_DIR=$QA_DIR"

# Clean slate
rm -rf "$TEST_QA_DIR"
mkdir -p "$TEST_QA_DIR"

# Source the qa system
source "../qa.sh"

# Check if functions are loaded
echo "Checking if functions are loaded..."
declare -f _qa_sanitize_index >/dev/null && echo "✓ _qa_sanitize_index loaded" || echo "✗ _qa_sanitize_index missing"
declare -f qq >/dev/null && echo "✓ qq loaded" || echo "✗ qq missing"
declare -f qa_query >/dev/null && echo "✓ qa_query loaded" || echo "✗ qa_query missing"

# Test basic functionality
echo "Testing _qa_sanitize_index..."
result=$(_qa_sanitize_index "")
[[ "$result" == "0" ]] && echo "✓ Empty index defaults to 0" || echo "✗ Failed: got '$result'"

result=$(_qa_sanitize_index "5")
[[ "$result" == "5" ]] && echo "✓ Valid index passes through" || echo "✗ Failed: got '$result'"

echo "Test complete"