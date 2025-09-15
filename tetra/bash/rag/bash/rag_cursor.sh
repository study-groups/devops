#!/usr/bin/env bash
# RAG Cursor Operations - Individual cursor management
# Provides functions for creating, managing, and manipulating cursors

# Generate unique cursor ID
_rag_cursor_generate_id() {
    echo "c_$(date +%s)_$(head -c 4 /dev/urandom | base64 | tr -d '=' | tr '+/' 'AB')"
}

# Create a new cursor
rag_cursor_create() {
    local file="$1"
    local start_line="$2"
    local end_line="$3"
    local tags="$4"
    local prompt="$5"
    
    # Validate required parameters
    if [[ -z "$file" || -z "$start_line" ]]; then
        echo "Usage: rag_cursor_create <file> <start_line> [end_line] [tags] [prompt]"
        return 1
    fi
    
    # Default end_line to start_line if not provided
    [[ -z "$end_line" ]] && end_line="$start_line"
    
    # Validate file exists
    if [[ ! -f "$file" ]]; then
        echo "Error: File '$file' not found"
        return 1
    fi
    
    # Generate cursor ID and metadata
    local cursor_id=$(_rag_cursor_generate_id)
    local dir=$(dirname "$(realpath "$file")")
    local filename=$(basename "$file")
    local created=$(date -Iseconds)
    
    # Extract content from file
    local content=""
    if command -v sed >/dev/null 2>&1; then
        content=$(sed -n "${start_line},${end_line}p" "$file")
    else
        content=$(awk "NR>=${start_line} && NR<=${end_line}" "$file")
    fi
    
    # Create cursor JSON file
    local cursor_file="$RAG_DIR/cursors/${cursor_id}.json"
    mkdir -p "$(dirname "$cursor_file")"
    
    cat > "$cursor_file" <<EOF
{
  "id": "$cursor_id",
  "file_path": "$(realpath "$file")",
  "dir_name": "$dir",
  "filename": "$filename",
  "start_line": $start_line,
  "end_line": $end_line,
  "content": $(printf '%s' "$content" | jq -R -s .),
  "tags": $(if [[ -n "$tags" ]]; then echo "\"$tags\"" | jq -R 'split(",")'; else echo "[]"; fi),
  "prompt": "${prompt:-Analyze this code section}",
  "created": "$created",
  "updated": "$created"
}
EOF

    echo "Created cursor: $cursor_id"
    echo "File: $filename ($start_line-$end_line)"
    echo "Stored: $cursor_file"
    
    # Return cursor ID for chaining
    echo "$cursor_id"
}

# List all cursors
rag_cursor_list() {
    local filter="$1"
    
    if [[ ! -d "$RAG_DIR/cursors" ]]; then
        echo "No cursors found. Create one with: rag_cursor_create <file> <line>"
        return 0
    fi
    
    echo "Cursors:"
    echo "-------"
    
    for cursor_file in "$RAG_DIR/cursors"/*.json; do
        [[ ! -f "$cursor_file" ]] && continue
        
        local id=$(jq -r '.id' "$cursor_file")
        local filename=$(jq -r '.filename' "$cursor_file") 
        local start_line=$(jq -r '.start_line' "$cursor_file")
        local end_line=$(jq -r '.end_line' "$cursor_file")
        local tags=$(jq -r '.tags | join(",")' "$cursor_file")
        
        # Apply filter if provided
        if [[ -n "$filter" ]]; then
            if [[ "$filename" != *"$filter"* && "$tags" != *"$filter"* ]]; then
                continue
            fi
        fi
        
        printf "%-20s %s:%d-%d" "$id" "$filename" "$start_line" "$end_line"
        [[ -n "$tags" && "$tags" != "" ]] && printf " [%s]" "$tags"
        printf "\n"
    done
}

# Show cursor details  
rag_cursor_show() {
    local cursor_id="$1"
    
    if [[ -z "$cursor_id" ]]; then
        echo "Usage: rag_cursor_show <cursor_id>"
        return 1
    fi
    
    local cursor_file="$RAG_DIR/cursors/${cursor_id}.json"
    if [[ ! -f "$cursor_file" ]]; then
        echo "Cursor not found: $cursor_id"
        return 1
    fi
    
    echo "Cursor Details:"
    echo "==============="
    
    local filename=$(jq -r '.filename' "$cursor_file")
    local file_path=$(jq -r '.file_path' "$cursor_file")
    local start_line=$(jq -r '.start_line' "$cursor_file")
    local end_line=$(jq -r '.end_line' "$cursor_file")
    local tags=$(jq -r '.tags | join(",")' "$cursor_file")
    local prompt=$(jq -r '.prompt' "$cursor_file")
    local created=$(jq -r '.created' "$cursor_file")
    local content=$(jq -r '.content' "$cursor_file")
    
    echo "ID: $cursor_id"
    echo "File: $filename"
    echo "Path: $file_path"
    echo "Lines: $start_line-$end_line"
    [[ -n "$tags" && "$tags" != "" ]] && echo "Tags: $tags"
    echo "Prompt: $prompt"
    echo "Created: $created"
    echo ""
    echo "Content:"
    echo "--------"
    echo "$content"
}

# Delete a cursor
rag_cursor_delete() {
    local cursor_id="$1"
    
    if [[ -z "$cursor_id" ]]; then
        echo "Usage: rag_cursor_delete <cursor_id>"
        return 1
    fi
    
    local cursor_file="$RAG_DIR/cursors/${cursor_id}.json"
    if [[ ! -f "$cursor_file" ]]; then
        echo "Cursor not found: $cursor_id"
        return 1
    fi
    
    # Show cursor details before deletion
    local filename=$(jq -r '.filename' "$cursor_file")
    local start_line=$(jq -r '.start_line' "$cursor_file")  
    local end_line=$(jq -r '.end_line' "$cursor_file")
    
    echo "Deleting cursor: $cursor_id"
    echo "File: $filename ($start_line-$end_line)"
    
    rm "$cursor_file"
    echo "Cursor deleted."
}

# Update cursor tags
rag_cursor_tag() {
    local cursor_id="$1"
    local tags="$2"
    
    if [[ -z "$cursor_id" || -z "$tags" ]]; then
        echo "Usage: rag_cursor_tag <cursor_id> <tags>"
        echo "Example: rag_cursor_tag c_123 bug,critical,auth"
        return 1
    fi
    
    local cursor_file="$RAG_DIR/cursors/${cursor_id}.json"
    if [[ ! -f "$cursor_file" ]]; then
        echo "Cursor not found: $cursor_id"
        return 1
    fi
    
    # Update tags and timestamp
    local updated=$(date -Iseconds)
    local tags_json=$(echo "$tags" | jq -R 'split(",")')
    
    jq --arg updated "$updated" --argjson tags "$tags_json" \
       '.tags = $tags | .updated = $updated' \
       "$cursor_file" > "${cursor_file}.tmp" && mv "${cursor_file}.tmp" "$cursor_file"
    
    echo "Updated tags for cursor: $cursor_id"
    echo "Tags: $tags"
}

# Update cursor prompt
rag_cursor_prompt() {
    local cursor_id="$1"
    local prompt="$2"
    
    if [[ -z "$cursor_id" || -z "$prompt" ]]; then
        echo "Usage: rag_cursor_prompt <cursor_id> <prompt>"
        return 1
    fi
    
    local cursor_file="$RAG_DIR/cursors/${cursor_id}.json"
    if [[ ! -f "$cursor_file" ]]; then
        echo "Cursor not found: $cursor_id"
        return 1
    fi
    
    # Update prompt and timestamp
    local updated=$(date -Iseconds)
    
    jq --arg updated "$updated" --arg prompt "$prompt" \
       '.prompt = $prompt | .updated = $updated' \
       "$cursor_file" > "${cursor_file}.tmp" && mv "${cursor_file}.tmp" "$cursor_file"
    
    echo "Updated prompt for cursor: $cursor_id"
    echo "Prompt: $prompt"
}

# Convert cursor to MULTICAT block
rag_cursor_to_multicat() {
    local cursor_id="$1"
    
    if [[ -z "$cursor_id" ]]; then
        echo "Usage: rag_cursor_to_multicat <cursor_id>"
        return 1
    fi
    
    local cursor_file="$RAG_DIR/cursors/${cursor_id}.json"
    if [[ ! -f "$cursor_file" ]]; then
        echo "Cursor not found: $cursor_id"
        return 1
    fi
    
    # Extract cursor data
    local dir_name=$(jq -r '.dir_name' "$cursor_file")
    local filename=$(jq -r '.filename' "$cursor_file")
    local start_line=$(jq -r '.start_line' "$cursor_file")
    local end_line=$(jq -r '.end_line' "$cursor_file")
    local tags=$(jq -r '.tags | join(",")' "$cursor_file")
    local prompt=$(jq -r '.prompt' "$cursor_file")
    local created=$(jq -r '.created' "$cursor_file")
    local content=$(jq -r '.content' "$cursor_file")
    
    # Output MULTICAT block
    echo "#MULTICAT_START"
    echo "# dir: $dir_name"
    echo "# file: $filename"
    echo "# cursor_id: $cursor_id"
    echo "# start_line: $start_line"
    echo "# end_line: $end_line"
    [[ -n "$tags" && "$tags" != "" ]] && echo "# tags: $tags"
    echo "# prompt: $prompt"
    echo "# created: $created"
    echo "#MULTICAT_END"
    echo "$content"
}

# Search cursors by content or metadata
rag_cursor_search() {
    local query="$1"
    
    if [[ -z "$query" ]]; then
        echo "Usage: rag_cursor_search <query>"
        echo "Search in cursor content, filenames, and tags"
        return 1
    fi
    
    if [[ ! -d "$RAG_DIR/cursors" ]]; then
        echo "No cursors found."
        return 0
    fi
    
    echo "Search results for: $query"
    echo "========================="
    
    for cursor_file in "$RAG_DIR/cursors"/*.json; do
        [[ ! -f "$cursor_file" ]] && continue
        
        # Search in JSON content (filename, tags, content)
        if jq -e --arg query "$query" '
            (.filename | contains($query)) or 
            (.tags | join(",") | contains($query)) or 
            (.content | contains($query))' "$cursor_file" >/dev/null 2>&1; then
            
            local id=$(jq -r '.id' "$cursor_file")
            local filename=$(jq -r '.filename' "$cursor_file")
            local start_line=$(jq -r '.start_line' "$cursor_file")
            local end_line=$(jq -r '.end_line' "$cursor_file")
            
            echo "Found: $id - $filename:$start_line-$end_line"
        fi
    done
}