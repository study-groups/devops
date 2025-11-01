#!/usr/bin/env bash

# Generate AST JSON data for web dashboard

SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
OUTPUT_FILE="$PROJECT_ROOT/web/api/modules.json"

# Create API directory if it doesn't exist
mkdir -p "$(dirname "$OUTPUT_FILE")"

# Generate the AST data and save to JSON file
cd "$PROJECT_ROOT"
bash bash/modules/local_ast.sh ast > "$OUTPUT_FILE"

if [[ $? -eq 0 ]]; then
    echo "✓ Generated AST data: $OUTPUT_FILE"
    echo "📊 $(jq '.modules | length' "$OUTPUT_FILE" 2>/dev/null || echo "unknown") modules found"
else
    echo "✗ Failed to generate AST data"
    exit 1
fi