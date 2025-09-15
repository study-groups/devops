#!/usr/bin/env bash

echo "=== Testing qa.sh reload ==="

# Source the updated qa.sh
source ../qa.sh

echo "Functions loaded:"
declare -f _get_qa_engine >/dev/null && echo "✓ _get_qa_engine" || echo "✗ _get_qa_engine missing"
declare -f _get_openai_api >/dev/null && echo "✓ _get_openai_api" || echo "✗ _get_openai_api missing"
declare -f qq >/dev/null && echo "✓ qq" || echo "✗ qq missing"

# Test the engine function
echo ""
echo "Testing _get_qa_engine with no engine set:"
result=$(_get_qa_engine)
echo "Result: '$result'"

echo ""
echo "Try: source ~/src/bash/qa/qa.sh"