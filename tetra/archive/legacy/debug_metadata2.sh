#!/usr/bin/env bash

echo "=== Debug Metadata System Step by Step ==="

# Source the metadata system
source bash/utils/module_metadata.sh

echo "1. Clear and add one entry:"
TETRA_MODULE_METADATA=""
tetra_add_module_metadata "test" "Test description" "test_cmd" "" "test" "stable"
echo "  Metadata after one entry: '$TETRA_MODULE_METADATA'"

echo "2. Add second entry:"
tetra_add_module_metadata "qa" "QA description" "qa_cmd" "" "ai" "stable"
echo "  Metadata after two entries:"
echo "$TETRA_MODULE_METADATA" | cat -n

echo "3. List modules:"
tetra_list_all_modules_metadata

echo "4. Test QA lookup:"
result=$(tetra_get_module_metadata qa description)
echo "  QA description: '$result'"
