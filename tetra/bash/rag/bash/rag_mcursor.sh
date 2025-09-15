#!/usr/bin/env bash
# RAG Multicursor Operations - Collection management
# Provides functions for creating and managing multicursor collections

# Generate unique multicursor ID
_rag_mcursor_generate_id() {
    echo "mc_$(date +%s)_$(head -c 4 /dev/urandom | base64 | tr -d '=' | tr '+/' 'AB')"
}

# Create a new multicursor collection
rag_mcursor_create() {
    local title="$1"
    local description="$2"
    local tags="$3"
    
    if [[ -z "$title" ]]; then
        echo "Usage: rag_mcursor_create <title> [description] [tags]"
        echo "Example: rag_mcursor_create 'Auth Fixes' 'Authentication bug fixes' 'bug,critical'"
        return 1
    fi
    
    # Generate multicursor ID and metadata
    local mc_id=$(_rag_mcursor_generate_id)
    local created=$(date -Iseconds)
    
    # Create multicursor JSON file
    local mc_file="$RAG_DIR/multicursor/${mc_id}.json"
    mkdir -p "$(dirname "$mc_file")"
    
    cat > "$mc_file" <<EOF
{
  "id": "$mc_id",
  "title": "$title",
  "description": "${description:-}",
  "cursors": [],
  "expanded": false,
  "tags": $(if [[ -n "$tags" ]]; then echo "\"$tags\"" | jq -R 'split(",")'; else echo "[]"; fi),
  "default_prompt": "Analyze this code collection",
  "created": "$created",
  "updated": "$created"
}
EOF

    echo "Created multicursor: $mc_id"
    echo "Title: $title"
    [[ -n "$description" ]] && echo "Description: $description"
    echo "Stored: $mc_file"
    
    # Return multicursor ID for chaining
    echo "$mc_id"
}

# List all multicursor collections
rag_mcursor_list() {
    local filter="$1"
    
    if [[ ! -d "$RAG_DIR/multicursor" ]]; then
        echo "No multicursors found. Create one with: rag_mcursor_create <title>"
        return 0
    fi
    
    echo "Multicursor Collections:"
    echo "======================="
    
    for mc_file in "$RAG_DIR/multicursor"/*.json; do
        [[ ! -f "$mc_file" ]] && continue
        
        local id=$(jq -r '.id' "$mc_file")
        local title=$(jq -r '.title' "$mc_file")
        local cursor_count=$(jq -r '.cursors | length' "$mc_file")
        local tags=$(jq -r '.tags | join(",")' "$mc_file")
        local created=$(jq -r '.created' "$mc_file")
        
        # Apply filter if provided
        if [[ -n "$filter" ]]; then
            if [[ "$title" != *"$filter"* && "$tags" != *"$filter"* ]]; then
                continue
            fi
        fi
        
        printf "%-20s %s (%d cursors)" "$id" "$title" "$cursor_count"
        [[ -n "$tags" && "$tags" != "" ]] && printf " [%s]" "$tags"
        printf "\n"
        printf "%20s Created: %s\n" "" "$created"
        echo ""
    done
}

# Show multicursor collection details
rag_mcursor_show() {
    local mc_id="$1"
    
    if [[ -z "$mc_id" ]]; then
        echo "Usage: rag_mcursor_show <mc_id>"
        return 1
    fi
    
    local mc_file="$RAG_DIR/multicursor/${mc_id}.json"
    if [[ ! -f "$mc_file" ]]; then
        echo "Multicursor not found: $mc_id"
        return 1
    fi
    
    echo "Multicursor Collection Details:"
    echo "=============================="
    
    local title=$(jq -r '.title' "$mc_file")
    local description=$(jq -r '.description' "$mc_file")
    local cursor_count=$(jq -r '.cursors | length' "$mc_file")
    local tags=$(jq -r '.tags | join(",")' "$mc_file")
    local created=$(jq -r '.created' "$mc_file")
    local updated=$(jq -r '.updated' "$mc_file")
    
    echo "ID: $mc_id"
    echo "Title: $title"
    [[ -n "$description" && "$description" != "" ]] && echo "Description: $description"
    echo "Cursors: $cursor_count"
    [[ -n "$tags" && "$tags" != "" ]] && echo "Tags: $tags"
    echo "Created: $created"
    echo "Updated: $updated"
    echo ""
    
    # List cursors in collection
    if [[ $cursor_count -gt 0 ]]; then
        echo "Cursors in Collection:"
        echo "--------------------"
        
        local cursors=$(jq -r '.cursors[]' "$mc_file")
        while IFS= read -r cursor_id; do
            [[ -z "$cursor_id" ]] && continue
            
            local cursor_file="$RAG_DIR/cursors/${cursor_id}.json"
            if [[ -f "$cursor_file" ]]; then
                local filename=$(jq -r '.filename' "$cursor_file")
                local start_line=$(jq -r '.start_line' "$cursor_file")
                local end_line=$(jq -r '.end_line' "$cursor_file")
                printf "  %-20s %s:%d-%d\n" "$cursor_id" "$filename" "$start_line" "$end_line"
            else
                printf "  %-20s (cursor not found)\n" "$cursor_id"
            fi
        done <<< "$cursors"
    fi
}

# Add cursor to multicursor collection
rag_mcursor_add() {
    local mc_id="$1"
    local cursor_id="$2"
    
    if [[ -z "$mc_id" || -z "$cursor_id" ]]; then
        echo "Usage: rag_mcursor_add <mc_id> <cursor_id>"
        return 1
    fi
    
    local mc_file="$RAG_DIR/multicursor/${mc_id}.json"
    local cursor_file="$RAG_DIR/cursors/${cursor_id}.json"
    
    # Validate multicursor exists
    if [[ ! -f "$mc_file" ]]; then
        echo "Multicursor not found: $mc_id"
        return 1
    fi
    
    # Validate cursor exists
    if [[ ! -f "$cursor_file" ]]; then
        echo "Cursor not found: $cursor_id"
        return 1
    fi
    
    # Check if cursor is already in collection
    if jq -e --arg cursor_id "$cursor_id" '.cursors | contains([$cursor_id])' "$mc_file" >/dev/null; then
        echo "Cursor $cursor_id is already in multicursor $mc_id"
        return 1
    fi
    
    # Add cursor to collection
    local updated=$(date -Iseconds)
    jq --arg cursor_id "$cursor_id" --arg updated "$updated" \
       '.cursors += [$cursor_id] | .updated = $updated' \
       "$mc_file" > "${mc_file}.tmp" && mv "${mc_file}.tmp" "$mc_file"
    
    echo "Added cursor $cursor_id to multicursor $mc_id"
    
    # Show cursor details
    local filename=$(jq -r '.filename' "$cursor_file")
    local start_line=$(jq -r '.start_line' "$cursor_file")
    local end_line=$(jq -r '.end_line' "$cursor_file")
    echo "Cursor: $filename:$start_line-$end_line"
}

# Remove cursor from multicursor collection
rag_mcursor_remove() {
    local mc_id="$1"
    local cursor_id="$2"
    
    if [[ -z "$mc_id" || -z "$cursor_id" ]]; then
        echo "Usage: rag_mcursor_remove <mc_id> <cursor_id>"
        return 1
    fi
    
    local mc_file="$RAG_DIR/multicursor/${mc_id}.json"
    
    # Validate multicursor exists
    if [[ ! -f "$mc_file" ]]; then
        echo "Multicursor not found: $mc_id"
        return 1
    fi
    
    # Check if cursor is in collection
    if ! jq -e --arg cursor_id "$cursor_id" '.cursors | contains([$cursor_id])' "$mc_file" >/dev/null; then
        echo "Cursor $cursor_id is not in multicursor $mc_id"
        return 1
    fi
    
    # Remove cursor from collection
    local updated=$(date -Iseconds)
    jq --arg cursor_id "$cursor_id" --arg updated "$updated" \
       '.cursors = (.cursors - [$cursor_id]) | .updated = $updated' \
       "$mc_file" > "${mc_file}.tmp" && mv "${mc_file}.tmp" "$mc_file"
    
    echo "Removed cursor $cursor_id from multicursor $mc_id"
}

# Delete multicursor collection (but not the cursors)
rag_mcursor_delete() {
    local mc_id="$1"
    
    if [[ -z "$mc_id" ]]; then
        echo "Usage: rag_mcursor_delete <mc_id>"
        return 1
    fi
    
    local mc_file="$RAG_DIR/multicursor/${mc_id}.json"
    if [[ ! -f "$mc_file" ]]; then
        echo "Multicursor not found: $mc_id"
        return 1
    fi
    
    # Show collection details before deletion
    local title=$(jq -r '.title' "$mc_file")
    local cursor_count=$(jq -r '.cursors | length' "$mc_file")
    
    echo "Deleting multicursor collection: $mc_id"
    echo "Title: $title"
    echo "Cursors: $cursor_count (cursors will not be deleted)"
    
    rm "$mc_file"
    echo "Multicursor collection deleted."
}

# Export multicursor collection to MULTICAT format
rag_mcursor_to_multicat() {
    local mc_id="$1"
    local output_file="$2"
    
    if [[ -z "$mc_id" ]]; then
        echo "Usage: rag_mcursor_to_multicat <mc_id> [output_file]"
        return 1
    fi
    
    local mc_file="$RAG_DIR/multicursor/${mc_id}.json"
    if [[ ! -f "$mc_file" ]]; then
        echo "Multicursor not found: $mc_id"
        return 1
    fi
    
    local title=$(jq -r '.title' "$mc_file")
    local description=$(jq -r '.description' "$mc_file")
    local cursors=$(jq -r '.cursors[]' "$mc_file")
    
    # Output function for MULTICAT content
    local output_func="cat"
    if [[ -n "$output_file" ]]; then
        output_func="tee '$output_file'"
    fi
    
    {
        echo "# MULTICAT export from multicursor: $title"
        [[ -n "$description" && "$description" != "" ]] && echo "# Description: $description"
        echo "# Multicursor ID: $mc_id"
        echo "# Export time: $(date -Iseconds)"
        echo ""
        
        # Export each cursor as MULTICAT block
        while IFS= read -r cursor_id; do
            [[ -z "$cursor_id" ]] && continue
            
            local cursor_file="$RAG_DIR/cursors/${cursor_id}.json"
            if [[ -f "$cursor_file" ]]; then
                rag_cursor_to_multicat "$cursor_id"
                echo ""
            else
                echo "# Warning: Cursor $cursor_id not found"
                echo ""
            fi
        done <<< "$cursors"
    } | eval "$output_func"
    
    [[ -n "$output_file" ]] && echo "Exported multicursor to: $output_file"
}

# Update multicursor metadata
rag_mcursor_tag() {
    local mc_id="$1"
    local tags="$2"
    
    if [[ -z "$mc_id" || -z "$tags" ]]; then
        echo "Usage: rag_mcursor_tag <mc_id> <tags>"
        echo "Example: rag_mcursor_tag mc_123 bug,critical,auth"
        return 1
    fi
    
    local mc_file="$RAG_DIR/multicursor/${mc_id}.json"
    if [[ ! -f "$mc_file" ]]; then
        echo "Multicursor not found: $mc_id"
        return 1
    fi
    
    # Update tags and timestamp
    local updated=$(date -Iseconds)
    local tags_json=$(echo "$tags" | jq -R 'split(",")')
    
    jq --arg updated "$updated" --argjson tags "$tags_json" \
       '.tags = $tags | .updated = $updated' \
       "$mc_file" > "${mc_file}.tmp" && mv "${mc_file}.tmp" "$mc_file"
    
    echo "Updated tags for multicursor: $mc_id"
    echo "Tags: $tags"
}

# Create multicursor from MULTICAT blocks
rag_mcursor_from_multicat() {
    local multicat_file="$1"
    local title="$2"
    local block_filter="$3"
    
    if [[ -z "$multicat_file" || -z "$title" ]]; then
        echo "Usage: rag_mcursor_from_multicat <multicat_file> <title> [block_numbers]"
        echo "Example: rag_mcursor_from_multicat project.mc 'Auth Fixes' '1,3,7'"
        return 1
    fi
    
    if [[ ! -f "$multicat_file" ]]; then
        echo "MULTICAT file not found: $multicat_file"
        return 1
    fi
    
    # Create multicursor collection
    local mc_id=$(rag_mcursor_create "$title" "Created from $multicat_file")
    
    echo "Processing MULTICAT file: $multicat_file"
    echo "Creating cursors for blocks..."
    
    # Parse MULTICAT blocks and create cursors
    local block_num=0
    local in_block=0
    local dir="" file="" cursor_id="" start_line="" end_line="" tags="" prompt="" created=""
    local content=""
    
    while IFS= read -r line; do
        if [[ "$line" == "#MULTICAT_START" ]]; then
            ((block_num++))
            in_block=1
            dir="" file="" cursor_id="" start_line="" end_line="" tags="" prompt="" created=""
            content=""
        elif [[ "$line" == "#MULTICAT_END" && $in_block -eq 1 ]]; then
            # Check if we should include this block
            if [[ -n "$block_filter" ]]; then
                if [[ ",$block_filter," != *",$block_num,"* ]]; then
                    in_block=0
                    continue
                fi
            fi
            
            # Create cursor from collected data
            if [[ -n "$dir" && -n "$file" ]]; then
                local file_path="$dir/$file"
                
                # Use existing cursor_id if present, otherwise create new
                if [[ -z "$cursor_id" ]]; then
                    cursor_id=$(_rag_cursor_generate_id)
                fi
                
                # Create cursor JSON
                local cursor_file="$RAG_DIR/cursors/${cursor_id}.json"
                mkdir -p "$(dirname "$cursor_file")"
                
                local cursor_created="${created:-$(date -Iseconds)}"
                
                cat > "$cursor_file" <<EOF
{
  "id": "$cursor_id",
  "file_path": "$file_path",
  "dir_name": "$dir",
  "filename": "$file",
  "start_line": ${start_line:-1},
  "end_line": ${end_line:-1},
  "content": $(printf '%s' "$content" | jq -R -s .),
  "tags": $(if [[ -n "$tags" ]]; then echo "\"$tags\"" | jq -R 'split(",")'; else echo "[]"; fi),
  "prompt": "${prompt:-Analyze this code section}",
  "created": "$cursor_created",
  "updated": "$cursor_created"
}
EOF
                
                # Add cursor to multicursor collection
                rag_mcursor_add "$mc_id" "$cursor_id"
                
                echo "  Block $block_num: Created cursor $cursor_id for $file"
            fi
            
            in_block=0
        elif [[ $in_block -eq 1 ]]; then
            # Parse header fields
            case "$line" in
                "# dir: "*)      dir="${line## dir: }" ;;
                "# file: "*)     file="${line## file: }" ;;
                "# cursor_id: "*) cursor_id="${line## cursor_id: }" ;;
                "# start_line: "*) start_line="${line## start_line: }" ;;
                "# end_line: "*) end_line="${line## end_line: }" ;;
                "# tags: "*)     tags="${line## tags: }" ;;
                "# prompt: "*)   prompt="${line## prompt: }" ;;
                "# created: "*)  created="${line## created: }" ;;
                "#"*)           ;;  # Skip other comments
                *)              content+="$line"$'\n' ;;
            esac
        fi
    done < "$multicat_file"
    
    echo ""
    echo "Created multicursor: $mc_id"
    rag_mcursor_show "$mc_id"
    
    echo "$mc_id"
}