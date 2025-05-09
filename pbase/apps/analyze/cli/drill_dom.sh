#!/bin/bash

# CLI wrapper for DOM extraction using Playwright
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
OUTPUT_DIR="../reports/dom"

# Create output directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/$OUTPUT_DIR"

# Parse arguments
URL=$1
SELECTOR=$2
OUTPUT_FILE=$3

if [ -z "$URL" ] || [ -z "$SELECTOR" ]; then
    echo "Usage: ./drill_dom.sh <url> <selector> [output-file]"
    exit 1
fi

# If no output file specified, generate one based on timestamp
if [ -z "$OUTPUT_FILE" ]; then
    OUTPUT_FILE="$SCRIPT_DIR/$OUTPUT_DIR/dom_$(date +%Y%m%d_%H%M%S).json"
else
    OUTPUT_FILE="$SCRIPT_DIR/$OUTPUT_DIR/$OUTPUT_FILE"
fi

# Run the Playwright script
node "$SCRIPT_DIR/extract_dom.js" "$URL" "$SELECTOR" "$OUTPUT_FILE" 