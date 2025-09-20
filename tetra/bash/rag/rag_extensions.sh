#!/usr/bin/env bash

# RAG Extensions - Additional RAG functionality for search, chunking, and context management

# Environment variables
: "${RAG_INDEX_DIR:=$RAG_DIR/index}"
: "${RAG_CHUNKS_DIR:=$RAG_DIR/chunks}"

# Initialize extended RAG directories
rag_ext_init() {
    mkdir -p "$RAG_INDEX_DIR" "$RAG_CHUNKS_DIR"
}

# Search through RAG indexed content
tetra_rag_search() {
    local query="$1"
    local limit="${2:-10}"

    if [[ -z "$query" ]]; then
        echo "Usage: tetra_rag_search <query> [limit]"
        echo "Search through RAG indexed content"
        return 1
    fi

    rag_ext_init

    echo "Searching RAG index for: $query"
    echo "Limit: $limit results"

    # Simple grep-based search for now
    if [[ -d "$RAG_INDEX_DIR" ]]; then
        find "$RAG_INDEX_DIR" -name "*.idx" -exec grep -l "$query" {} \; | head -"$limit"
    else
        echo "No RAG index found. Initialize with 'rag init' first."
        return 1
    fi
}

# Create chunks from content for RAG processing
tetra_rag_chunks() {
    local input_file="$1"
    local chunk_size="${2:-1000}"
    local overlap="${3:-100}"

    if [[ -z "$input_file" ]]; then
        echo "Usage: tetra_rag_chunks <input_file> [chunk_size] [overlap]"
        echo "Create chunks from content for RAG processing"
        return 1
    fi

    if [[ ! -f "$input_file" ]]; then
        echo "Input file not found: $input_file"
        return 1
    fi

    rag_ext_init

    local base_name=$(basename "$input_file" .mc)
    local chunk_dir="$RAG_CHUNKS_DIR/$base_name"
    mkdir -p "$chunk_dir"

    echo "Creating chunks from: $input_file"
    echo "Chunk size: $chunk_size characters"
    echo "Overlap: $overlap characters"
    echo "Output directory: $chunk_dir"

    # Simple line-based chunking for now
    local line_count=0
    local chunk_num=1
    local current_chunk=""

    while IFS= read -r line; do
        current_chunk+="$line"$'\n'
        ((line_count++))

        if [[ ${#current_chunk} -ge $chunk_size ]]; then
            local chunk_file="$chunk_dir/chunk_$(printf '%03d' $chunk_num).txt"
            echo "$current_chunk" > "$chunk_file"
            echo "Created: $chunk_file"

            # Keep overlap
            if [[ $overlap -gt 0 ]]; then
                current_chunk=$(echo "$current_chunk" | tail -c "$overlap")
            else
                current_chunk=""
            fi

            ((chunk_num++))
        fi
    done < "$input_file"

    # Save remaining content
    if [[ -n "$current_chunk" ]]; then
        local chunk_file="$chunk_dir/chunk_$(printf '%03d' $chunk_num).txt"
        echo "$current_chunk" > "$chunk_file"
        echo "Created: $chunk_file"
    fi

    echo "Created $chunk_num chunks in $chunk_dir"
}

# Build context from multiple sources
tetra_rag_context() {
    local context_name="$1"
    shift
    local sources=("$@")

    if [[ -z "$context_name" ]] || [[ ${#sources[@]} -eq 0 ]]; then
        echo "Usage: tetra_rag_context <context_name> <source1> [source2] ..."
        echo "Build context from multiple MULTICAT sources"
        return 1
    fi

    rag_ext_init

    local context_file="$RAG_DIR/contexts/${context_name}.mc"
    mkdir -p "$(dirname "$context_file")"

    echo "Building context: $context_name"
    echo "Sources: ${sources[*]}"

    {
        echo "#MULTICAT_START"
        echo "# context: $context_name"
        echo "# created: $(date)"
        echo "# sources: ${#sources[@]}"
        echo "#MULTICAT_END"
        echo ""

        for source in "${sources[@]}"; do
            if [[ -f "$source" ]]; then
                echo "# === Source: $source ==="
                cat "$source"
                echo ""
            else
                echo "# === Missing source: $source ==="
                echo ""
            fi
        done
    } > "$context_file"

    echo "Context saved to: $context_file"
}

# Create citations from RAG content
tetra_rag_cite() {
    local source_file="$1"
    local citation_style="${2:-simple}"

    if [[ -z "$source_file" ]]; then
        echo "Usage: tetra_rag_cite <source_file> [citation_style]"
        echo "Create citations from RAG content"
        echo "Styles: simple, markdown, json"
        return 1
    fi

    if [[ ! -f "$source_file" ]]; then
        echo "Source file not found: $source_file"
        return 1
    fi

    echo "Creating citation for: $source_file"

    case "$citation_style" in
        simple)
            echo "Source: $(basename "$source_file")"
            echo "Path: $source_file"
            echo "Modified: $(stat -f "%Sm" "$source_file" 2>/dev/null || stat -c "%y" "$source_file" 2>/dev/null)"
            ;;
        markdown)
            echo "**Source:** \`$(basename "$source_file")\`"
            echo "**Path:** \`$source_file\`"
            echo "**Modified:** $(stat -f "%Sm" "$source_file" 2>/dev/null || stat -c "%y" "$source_file" 2>/dev/null)"
            ;;
        json)
            printf '{"source": "%s", "path": "%s", "modified": "%s"}\n' \
                "$(basename "$source_file")" \
                "$source_file" \
                "$(stat -f "%Sm" "$source_file" 2>/dev/null || stat -c "%y" "$source_file" 2>/dev/null)"
            ;;
        *)
            echo "Unknown citation style: $citation_style"
            return 1
            ;;
    esac
}

# Export RAG data to JSONL format
tetra_rag_export_jsonl() {
    local source_dir="${1:-$RAG_DIR}"
    local output_file="${2:-$RAG_DIR/export.jsonl}"

    echo "Exporting RAG data to JSONL format"
    echo "Source directory: $source_dir"
    echo "Output file: $output_file"

    mkdir -p "$(dirname "$output_file")"

    # Export MULTICAT files as JSONL records
    find "$source_dir" -name "*.mc" -type f | while read -r mc_file; do
        local relative_path=$(realpath --relative-to="$source_dir" "$mc_file" 2>/dev/null || python -c "import os.path; print(os.path.relpath('$mc_file', '$source_dir'))")
        local modified=$(stat -f "%Sm" "$mc_file" 2>/dev/null || stat -c "%y" "$mc_file" 2>/dev/null)
        local size=$(wc -c < "$mc_file")

        printf '{"type": "multicat", "path": "%s", "modified": "%s", "size": %d, "content": %s}\n' \
            "$relative_path" \
            "$modified" \
            "$size" \
            "$(jq -Rs . < "$mc_file")" >> "$output_file"
    done

    echo "Export completed: $output_file"
    echo "Records exported: $(wc -l < "$output_file")"
}