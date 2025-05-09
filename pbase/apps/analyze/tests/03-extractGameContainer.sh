#!/bin/bash

# Define variables for URL and element
url="${1:-https://pixeljamarcade.com/play/grid-ranger}"  # Remove quotes
element="${2:-.game-container}"  # Remove quotes

# Use environment variables for base URL and API key
curl -X POST "$PBASE_URL/extract-dom" \
    -H "x-api-key: $PBASE_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"$url\", \"element\": \"$element\"}"
