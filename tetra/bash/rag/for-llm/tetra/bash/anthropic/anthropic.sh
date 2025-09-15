#!/bin/bash

# Load API key from environment or file

tetra_anthropic_get_usage() {
    if [ -z "$ANTHROPIC_API_KEY" ]; then
       echo "Please set ANTHROPIC_API_KEY environment variable"
       return 1
    fi
    local start_date=${1:-$(date -d '30 days ago' '+%Y-%m-%dT00:00:00Z')}
    local end_date=${2:-$(date '+%Y-%m-%dT23:59:59Z')}
    
    echo "Fetching usage data from $start_date to $end_date"
    
    curl -s -X GET "https://api.anthropic.com/v1/usage" \
        -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
        -H "Content-Type: application/json" \
        -H "anthropic-version: 2023-06-01" \
        -G \
        -d "start_time=$start_date" \
        -d "end_time=$end_date" | jq '.'
}
