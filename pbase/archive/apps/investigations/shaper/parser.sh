#!/bin/bash

declare -A AST
node_id=0

# Add a node to the AST
add_node() {
    local type=$1
    local value=$2
    echo "node:$node_id type:$type value:$value"
    node_id=$((node_id + 1))
}

# Add a resolution rule
add_resolution() {
    local rule=$1
    echo "resolve:$rule"
}

# Parse input
while IFS= read -r line; do
    if [[ $line == proposition* ]]; then
        value=$(echo "$line" | cut -d' ' -f2)
        add_node "proposition" "$value"
    elif [[ $line == resolve* ]]; then
        rule=$(echo "$line" | cut -d' ' -f2-)
        add_resolution "$rule"
    fi
done
