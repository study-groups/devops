#!/usr/bin/env bash

# TDOC Metadata System
# YAML frontmatter parsing and writing

# Parse YAML frontmatter from a markdown file
# Returns: JSON object with metadata
tdoc_parse_frontmatter() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        echo "{}"
        return 1
    fi

    local in_frontmatter=false
    local frontmatter=""

    while IFS= read -r line; do
        if [[ "$line" == "---" ]]; then
            if [[ "$in_frontmatter" == false ]]; then
                in_frontmatter=true
                continue
            else
                # End of frontmatter
                break
            fi
        fi

        if [[ "$in_frontmatter" == true ]]; then
            frontmatter+="$line"$'\n'
        fi
    done < "$file"

    if [[ -z "$frontmatter" ]]; then
        echo "{}"
        return 0
    fi

    # Parse YAML to JSON (simple parser for our use case)
    _tdoc_yaml_to_json "$frontmatter"
}

# Simple YAML to JSON converter for our metadata schema
_tdoc_yaml_to_json() {
    local yaml="$1"
    local json="{"
    local first=true

    while IFS= read -r line; do
        # Skip empty lines and comments
        [[ -z "$line" || "$line" =~ ^# ]] && continue

        # Parse key: value or key: [list]
        if [[ "$line" =~ ^([a-z_]+):[[:space:]]*(.+)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local value="${BASH_REMATCH[2]}"

            [[ "$first" == false ]] && json+=","
            first=false

            # Handle array values [item1, item2]
            if [[ "$value" =~ ^\[(.+)\]$ ]]; then
                local array_content="${BASH_REMATCH[1]}"
                json+="\"$key\":["
                local item_first=true
                IFS=',' read -ra items <<< "$array_content"
                for item in "${items[@]}"; do
                    item=$(echo "$item" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
                    [[ "$item_first" == false ]] && json+=","
                    item_first=false
                    json+="\"$item\""
                done
                json+="]"
            else
                # Scalar value
                json+="\"$key\":\"$value\""
            fi
        fi
    done <<< "$yaml"

    json+="}"
    echo "$json"
}

# Extract metadata field from JSON
tdoc_get_field() {
    local json="$1"
    local field="$2"
    local default="${3:-}"

    # Simple JSON extraction (works for our simple schema)
    if [[ "$json" =~ \"$field\":\"([^\"]+)\" ]]; then
        echo "${BASH_REMATCH[1]}"
    elif [[ "$json" =~ \"$field\":\[([^\]]+)\] ]]; then
        echo "${BASH_REMATCH[1]}"
    else
        echo "$default"
    fi
}

# Add or update frontmatter in a markdown file
tdoc_write_frontmatter() {
    local file="$1"
    local category="$2"
    local type="$3"
    local tags="$4"  # Comma-separated
    local module="${5:-}"
    local status="${6:-draft}"

    # Read existing content (skip old frontmatter if present)
    local content=""
    local skip_frontmatter=false
    local in_frontmatter=false

    if [[ -f "$file" ]]; then
        while IFS= read -r line; do
            if [[ "$line" == "---" ]]; then
                if [[ "$in_frontmatter" == false && "$skip_frontmatter" == false ]]; then
                    in_frontmatter=true
                    skip_frontmatter=true
                    continue
                elif [[ "$in_frontmatter" == true ]]; then
                    in_frontmatter=false
                    continue
                fi
            fi

            if [[ "$in_frontmatter" == false ]]; then
                content+="$line"$'\n'
            fi
        done < "$file"
    fi

    # Determine evidence weight
    local evidence_weight="secondary"
    [[ "$category" == "core" ]] && evidence_weight="primary"

    # Get current date
    local date=$(date +%Y-%m-%d)

    # Build new frontmatter
    local frontmatter="---
category: $category
type: $type
tags: [$tags]"

    [[ -n "$module" ]] && frontmatter+="
module: $module"

    frontmatter+="
created: $date
updated: $date
status: $status
evidence_weight: $evidence_weight
---
"

    # Write new file with frontmatter
    echo "$frontmatter" > "$file"
    echo -n "$content" >> "$file"
}

# Check if file has valid frontmatter
tdoc_has_frontmatter() {
    local file="$1"

    [[ ! -f "$file" ]] && return 1

    local first_line=$(head -n 1 "$file")
    [[ "$first_line" == "---" ]] && return 0

    return 1
}

# Get metadata from file (frontmatter or database)
tdoc_get_metadata() {
    local file="$1"

    # Try frontmatter first
    if tdoc_has_frontmatter "$file"; then
        tdoc_parse_frontmatter "$file"
        return 0
    fi

    # Try database
    local abs_path=$(realpath "$file" 2>/dev/null || echo "$file")
    tdoc_db_get_by_path "$abs_path"
}
