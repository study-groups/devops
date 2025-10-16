#!/usr/bin/env bash

# vox_dry_run.sh - Dry-run analysis without hitting TTS endpoints
# Validates inputs, shows what would be processed, cache status, costs, etc.

source "${VOX_SRC}/vox_paths.sh"
source "${VOX_SRC}/vox_cache.sh"
source "${VOX_SRC}/vox_qa.sh" 2>/dev/null || true

# Analyze text input without generating TTS
vox_dry_run_analyze() {
    local voice="$1"
    local source_id="${2:-}"
    local text="${3:-}"

    # Get source content and metadata
    local source_type="stdin"
    local source_display="stdin"
    local content=""
    local content_hash=""

    if [[ -n "$source_id" ]]; then
        # ID mode
        case "$source_id" in
            qa:*)
                source_type="qa"
                source_display="$source_id"

                # Resolve and validate
                local qa_id=$(vox_qa_resolve "$source_id" 2>/dev/null)
                if [[ $? -ne 0 || -z "$qa_id" ]]; then
                    echo "Error: Could not resolve QA reference: $source_id" >&2
                    return 1
                fi

                local qa_path=$(vox_qa_get_path "$source_id" 2>/dev/null)
                if [[ $? -ne 0 ]]; then
                    echo "Error: QA file not found for: $source_id" >&2
                    return 1
                fi

                content=$(cat "$qa_path")
                source_display="$source_id (resolved: $qa_id)"
                ;;
            *)
                echo "Error: Unknown source type: $source_id" >&2
                return 1
                ;;
        esac
    else
        # Stdin mode
        content="$text"
    fi

    if [[ -z "$content" ]]; then
        echo "Error: No content to analyze" >&2
        return 1
    fi

    # Calculate content hash
    content_hash=$(echo "$content" | vox_hash_content)

    # Analyze content characteristics
    local char_count=${#content}
    local word_count=$(echo "$content" | wc -w | tr -d ' ')
    local line_count=$(echo "$content" | wc -l | tr -d ' ')
    local max_chars=4096
    local will_truncate=false
    local truncated_chars=0

    if [[ $char_count -gt $max_chars ]]; then
        will_truncate=true
        truncated_chars=$((char_count - max_chars))
    fi

    # Check cache status
    local cache_status="MISS"
    local cached_file=""
    local cached_size=""
    local estimated_size="~50-200 KB"

    if vox_cache_exists "$content_hash" "$voice"; then
        cache_status="HIT"
        cached_file=$(vox_cache_get "$content_hash" "$voice")
        if [[ -f "$cached_file" ]]; then
            local size_bytes=$(stat -f%z "$cached_file" 2>/dev/null || stat -c%s "$cached_file" 2>/dev/null)
            cached_size=$(echo "scale=1; $size_bytes / 1024" | bc)
            estimated_size="${cached_size} KB (cached)"
        fi
    fi

    # Estimate cost (OpenAI TTS pricing: $15 per 1M chars)
    local effective_chars=$char_count
    [[ $will_truncate == true ]] && effective_chars=$max_chars
    local cost_dollars=$(echo "scale=6; $effective_chars * 15 / 1000000" | bc)

    # Display analysis
    echo "==================================="
    echo "Vox Dry-Run Analysis"
    echo "==================================="
    echo ""

    echo "Source:"
    echo "  Type:       $source_type"
    echo "  ID:         $source_display"
    echo ""

    echo "Content:"
    echo "  Characters: $char_count"
    echo "  Words:      $word_count"
    echo "  Lines:      $line_count"
    echo "  Hash:       ${content_hash:0:12}..."

    if [[ $will_truncate == true ]]; then
        echo "  Truncation: YES - will truncate $truncated_chars chars (limit: $max_chars)"
    else
        echo "  Truncation: NO"
    fi
    echo ""

    echo "TTS Request:"
    echo "  Voice:      $voice"
    echo "  Model:      tts-1"
    echo "  Cost:       \$$cost_dollars USD"
    echo ""

    echo "Cache:"
    echo "  Status:     $cache_status"
    if [[ "$cache_status" == "HIT" ]]; then
        echo "  File:       $cached_file"
        echo "  Size:       $estimated_size"
        echo "  Action:     Will use cached audio (no API call)"
    else
        echo "  Action:     Will generate new audio (API call required)"
        echo "  Est. Size:  $estimated_size"
    fi
    echo ""

    # Show content preview
    echo "Content Preview (first 200 chars):"
    echo "-----------------------------------"
    echo "$content" | head -c 200
    echo ""
    echo "-----------------------------------"
    echo ""

    # Summary
    echo "Summary:"
    if [[ "$cache_status" == "HIT" ]]; then
        echo "  This request would be served from cache."
        echo "  No API calls would be made."
        echo "  Audio would play immediately."
    else
        echo "  This request would require TTS generation."
        echo "  OpenAI API call: \$$cost_dollars USD"
        echo "  Audio would be cached for future use."
    fi

    return 0
}

# Analyze QA reference directly
vox_dry_run_qa() {
    local qa_ref="$1"
    local voice="${2:-alloy}"

    echo "Analyzing QA Reference: $qa_ref"
    echo ""

    # Resolve QA ID
    local qa_id=$(vox_qa_resolve "$qa_ref" 2>/dev/null)
    if [[ $? -ne 0 ]]; then
        echo "Error: Could not resolve QA reference: $qa_ref" >&2
        echo ""
        echo "Valid formats:"
        echo "  qa:0           - Latest answer (relative)"
        echo "  qa:1           - Previous answer (relative)"
        echo "  qa:latest      - Latest answer (explicit)"
        echo "  qa:1728756234  - Specific timestamp (absolute)"
        echo ""
        echo "Use 'vox ls qa' to see available QA answers"
        return 1
    fi

    # Get QA file
    local qa_path=$(vox_qa_get_path "$qa_ref")
    if [[ $? -ne 0 ]]; then
        return 1
    fi

    # Get prompt for context
    local prompt=$(vox_qa_get_prompt "$qa_id")

    # Read content
    local content=$(cat "$qa_path")

    # Run standard analysis
    echo "QA Metadata:"
    echo "  Prompt:     $prompt"
    echo "  File:       $qa_path"
    echo ""

    vox_dry_run_analyze "$voice" "$qa_ref" "$content"
}

# Analyze file directly (future: support file:path references)
vox_dry_run_file() {
    local file_path="$1"
    local voice="${2:-alloy}"

    if [[ ! -f "$file_path" ]]; then
        echo "Error: File not found: $file_path" >&2
        return 1
    fi

    local content=$(cat "$file_path")

    echo "Analyzing File: $file_path"
    echo ""

    vox_dry_run_analyze "$voice" "" "$content"
}

# Show what vox play/generate would do
vox_dry_run_command() {
    local command="$1"  # play or generate
    local voice="$2"
    local source_id="${3:-}"
    local output_file="${4:-}"

    echo "Command: vox $command $voice ${source_id:-(stdin)}"
    [[ -n "$output_file" ]] && echo "Output:  $output_file"
    echo ""

    # Get content
    local content=""
    if [[ -n "$source_id" ]]; then
        # ID mode
        vox_dry_run_analyze "$voice" "$source_id"
    else
        # Stdin mode
        content=$(cat)
        vox_dry_run_analyze "$voice" "" "$content"
    fi
}

# Batch analysis - analyze multiple QA answers
vox_dry_run_batch() {
    local voice="${1:-alloy}"
    local start_index="${2:-0}"
    local count="${3:-5}"

    echo "==================================="
    echo "Batch Dry-Run Analysis"
    echo "==================================="
    echo "Voice: $voice"
    echo "Range: qa:$start_index to qa:$((start_index + count - 1))"
    echo ""

    local total_chars=0
    local total_cost=0
    local cache_hits=0
    local cache_misses=0

    for ((i=start_index; i<start_index+count; i++)); do
        local qa_ref="qa:$i"
        local qa_id=$(vox_qa_resolve "$qa_ref" 2>/dev/null)

        if [[ $? -ne 0 ]]; then
            echo "[$qa_ref] Not found - skipping"
            continue
        fi

        local qa_path=$(vox_qa_get_path "$qa_ref" 2>/dev/null)
        if [[ ! -f "$qa_path" ]]; then
            echo "[$qa_ref] File not found - skipping"
            continue
        fi

        local content=$(cat "$qa_path")
        local char_count=${#content}
        local content_hash=$(echo "$content" | vox_hash_content)

        local cache_status="MISS"
        if vox_cache_exists "$content_hash" "$voice"; then
            cache_status="HIT"
            ((cache_hits++))
        else
            ((cache_misses++))
        fi

        local prompt=$(vox_qa_get_prompt "$qa_id" | head -c 40)

        printf "%-8s %-10s %6d chars  %s\n" "$qa_ref" "[$cache_status]" "$char_count" "$prompt"

        total_chars=$((total_chars + char_count))
    done

    echo ""
    echo "Summary:"
    echo "  Total items:    $((cache_hits + cache_misses))"
    echo "  Cache hits:     $cache_hits"
    echo "  Cache misses:   $cache_misses"
    echo "  Total chars:    $total_chars"

    if [[ $cache_misses -gt 0 ]]; then
        local total_cost=$(echo "scale=4; $total_chars * 15 / 1000000" | bc)
        echo "  Est. cost:      \$$total_cost USD (for cache misses)"
    else
        echo "  Est. cost:      \$0.00 USD (all cached)"
    fi
}

# Export functions
export -f vox_dry_run_analyze
export -f vox_dry_run_qa
export -f vox_dry_run_file
export -f vox_dry_run_command
export -f vox_dry_run_batch
