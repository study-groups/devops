#!/bin/bash

declare -A PROPOSITIONS
declare -A CONTRADICTIONS

# Process AST input
while IFS= read -r line; do
    if [[ $line == node:* ]]; then
        id=$(echo "$line" | grep -oP '(?<=node:)\d+')
        value=$(echo "$line" | grep -oP '(?<=value:).*')
        PROPOSITIONS["$id"]="$value"
    elif [[ $line == resolve:* ]]; then
        rule=$(echo "$line" | cut -d':' -f2)
        props=(${rule//,/ })
        for prop in "${props[@]}"; do
            negated="¬$prop"
            for id in "${!PROPOSITIONS[@]}"; do
                if [[ "${PROPOSITIONS[$id]}" == "$negated" ]]; then
                    echo "Unsatisfiability detected: $prop and $negated"
                    CONTRADICTIONS["$id"]="$prop"
                fi
            done
        done
    fi
done

# Print resolution results
for key in "${!CONTRADICTIONS[@]}"; do
    echo "contradiction: ${CONTRADICTIONS[$key]}"
done
