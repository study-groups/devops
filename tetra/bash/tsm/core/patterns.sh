#!/usr/bin/env bash

# TSM Pattern Management
# Commands for saving and listing service patterns

# Save running process as a pattern
tetra_tsm_save_pattern() {
    local tsm_id="$1"
    local pattern_name="$2"

    if [[ -z "$tsm_id" || -z "$pattern_name" ]]; then
        echo "Usage: tsm save pattern <tsm-id> <pattern-name>"
        echo ""
        echo "Examples:"
        echo "  tsm save pattern 0 myapp"
        echo "  tsm save pattern 1 worker"
        return 1
    fi

    # Find process by TSM ID
    local process_name meta_file
    if [[ -d "$TSM_PROCESSES_DIR" ]]; then
        for dir in "$TSM_PROCESSES_DIR"/*/; do
            [[ -d "$dir" ]] || continue
            local check_file="${dir}meta.json"
            [[ -f "$check_file" ]] || continue

            local found_id=$(jq -r '.tsm_id // empty' "$check_file" 2>/dev/null)
            if [[ "$found_id" == "$tsm_id" ]]; then
                process_name=$(basename "$dir")
                meta_file="$check_file"
                break
            fi
        done
    fi

    if [[ -z "$meta_file" ]]; then
        echo "❌ Process with TSM ID $tsm_id not found"
        return 1
    fi

    # Extract metadata
    local command port
    command=$(jq -r '.command // empty' "$meta_file" 2>/dev/null)
    port=$(jq -r '.port // empty' "$meta_file" 2>/dev/null)

    if [[ -z "$command" ]]; then
        echo "❌ Failed to read process metadata"
        return 1
    fi

    # Clean up port value
    [[ "$port" == "null" || "$port" == "none" ]] && port="0"

    # Extract the core command (before port injection)
    # This is tricky - we need to remove any port that was appended
    local match_pattern="$command"
    # Remove trailing port numbers
    match_pattern=$(echo "$command" | sed -E 's/ [0-9]{4,5}$//')

    # Template: add {port} at end if port is not 0
    local template="{cmd}"
    if [[ "$port" != "0" ]]; then
        template="{cmd} {port}"
    fi

    # Create user patterns file if it doesn't exist
    local user_patterns="$TETRA_DIR/tsm/patterns.txt"
    mkdir -p "$(dirname "$user_patterns")"

    if [[ ! -f "$user_patterns" ]]; then
        cat > "$user_patterns" <<'EOF'
# User-defined TSM patterns
# Format: name|match|port|template
EOF
    fi

    # Check if pattern already exists
    if grep -q "^${pattern_name}|" "$user_patterns" 2>/dev/null; then
        echo "⚠️  Pattern '$pattern_name' already exists"
        echo -n "Overwrite? [y/N] "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            echo "❌ Save cancelled"
            return 1
        fi
        # Remove existing pattern
        grep -v "^${pattern_name}|" "$user_patterns" > "${user_patterns}.tmp"
        mv "${user_patterns}.tmp" "$user_patterns"
    fi

    # Append new pattern
    echo "${pattern_name}|${match_pattern}|${port}|${template}" >> "$user_patterns"

    echo "✅ Saved pattern: $pattern_name"
    echo "   Match: $match_pattern"
    echo "   Port: $port"
    echo "   Template: $template"
    echo ""
    echo "Pattern saved to: $user_patterns"
}

# List all patterns
tetra_tsm_list_patterns() {
    local system_patterns="$TETRA_SRC/bash/tsm/patterns.txt"
    local user_patterns="$TETRA_DIR/tsm/patterns.txt"

    echo "TSM Service Patterns"
    echo "===================="
    echo ""

    # Show system patterns
    if [[ -f "$system_patterns" ]]; then
        echo "System Patterns:"
        echo "----------------"
        printf "%-15s %-30s %-6s %s\n" "NAME" "MATCH" "PORT" "TEMPLATE"
        printf "%-15s %-30s %-6s %s\n" "----" "-----" "----" "--------"

        while IFS='|' read -r name match port template; do
            # Skip comments and empty lines
            [[ "$name" =~ ^# ]] && continue
            [[ -z "$name" ]] && continue

            printf "%-15s %-30s %-6s %s\n" "$name" "$match" "$port" "$template"
        done < "$system_patterns"
        echo ""
    fi

    # Show user patterns
    if [[ -f "$user_patterns" ]]; then
        echo "User Patterns:"
        echo "--------------"
        printf "%-15s %-30s %-6s %s\n" "NAME" "MATCH" "PORT" "TEMPLATE"
        printf "%-15s %-30s %-6s %s\n" "----" "-----" "----" "--------"

        while IFS='|' read -r name match port template; do
            # Skip comments and empty lines
            [[ "$name" =~ ^# ]] && continue
            [[ -z "$name" ]] && continue

            printf "%-15s %-30s %-6s %s\n" "$name" "$match" "$port" "$template"
        done < "$user_patterns"
    else
        echo "No user patterns defined"
        echo "Add patterns with: tsm save pattern <id> <name>"
    fi
}

export -f tetra_tsm_save_pattern
export -f tetra_tsm_list_patterns
