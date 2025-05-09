#!/bin/bash

# Generate DOT format for Graphviz
echo "digraph ResolutionTree {"
echo "    rankdir=TB;"  # Set layout direction to top-to-bottom

while IFS= read -r line; do
    if [[ $line == node:* ]]; then
        id=$(echo "$line" | grep -oP '(?<=node:)\d+')
        value=$(echo "$line" | grep -oP '(?<=value:).*')
        # Escape special characters and quote the label
        value=$(echo "$value" | sed 's/"/\\"/g; s/(/\\(/g; s/)/\\)/g')
        echo "    $id [label=\"$value\"];"        
    elif [[ $line == resolve:* ]]; then
        rule=$(echo "$line" | cut -d':' -f2)
        props=(${rule//,/ })
        # Quote each node reference in the edge
        echo "    \"${props[0]}\" -> \"${props[1]}\" [label=\"resolve(${props[0]}, ${props[1]})\"];"  # Add annotation
    elif [[ $line == contradiction:* ]]; then
        value=$(echo "$line" | cut -d':' -f2)
        # Escape special characters and quote the label
        value=$(echo "$value" | sed 's/"/\\"/g; s/(/\\(/g; s/)/\\)/g')
        echo "    contradiction [label=\"$value\", shape=box, color=red];"
    fi
done

echo "}"
