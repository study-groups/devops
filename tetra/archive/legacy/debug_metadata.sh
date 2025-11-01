#!/usr/bin/env bash

echo "=== Debug Metadata System ==="

# Source the metadata system
source bash/utils/module_metadata.sh

echo "1. Functions loaded:"
declare -f tetra_get_module_metadata >/dev/null && echo "  ✓ tetra_get_module_metadata" || echo "  ✗ tetra_get_module_metadata"
declare -f tetra_get_module_info >/dev/null && echo "  ✓ tetra_get_module_info" || echo "  ✗ tetra_get_module_info"

echo "2. Initialize metadata:"
tetra_init_module_metadata
echo "  Metadata length: ${#TETRA_MODULE_METADATA}"

echo "3. Test QA lookup:"
result=$(tetra_get_module_metadata qa description 2>&1)
echo "  Result: '$result'"
echo "  Return code: $?"

echo "4. List all modules:"
tetra_list_all_modules_metadata | head -5

echo "5. Test module info:"
tetra_get_module_info qa
