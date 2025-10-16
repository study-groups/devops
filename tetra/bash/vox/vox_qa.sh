#!/usr/bin/env bash

# vox_qa.sh - QA database integration
# Handles qa:N references and ID resolution

# Resolve qa:N reference to actual QA database ID
vox_qa_resolve() {
    local qa_ref="$1"  # qa:0, qa:1, qa:latest, qa:1728756234

    # Strip qa: prefix if present
    local qa_spec="${qa_ref#qa:}"

    # Linux epoch is 1000000000 (Sep 9, 2001)
    # Numbers below this are relative indices, above are timestamps
    local epoch_threshold=1000000000

    if [[ "$qa_spec" == "latest" ]]; then
        # Explicit latest
        vox_qa_get_latest_id
    elif [[ "$qa_spec" =~ ^[0-9]+$ ]]; then
        # Numeric - check if relative index or timestamp
        if [[ "$qa_spec" -lt "$epoch_threshold" ]]; then
            # Relative index: qa:0 = latest, qa:1 = previous, etc.
            vox_qa_get_id_by_index "$qa_spec"
        else
            # Absolute timestamp: qa:1728756234
            echo "$qa_spec"
        fi
    else
        echo "Error: Invalid QA reference format: $qa_ref" >&2
        return 1
    fi
}

# Get QA answer file path from reference
vox_qa_get_path() {
    local qa_ref="$1"

    if [[ -z "$QA_DIR" ]]; then
        echo "Error: QA_DIR not set" >&2
        return 1
    fi

    local qa_id=$(vox_qa_resolve "$qa_ref")

    if [[ -z "$qa_id" ]]; then
        echo "Error: Could not resolve QA reference: $qa_ref" >&2
        return 1
    fi

    local answer_file="${QA_DIR}/db/${qa_id}.answer"

    if [[ ! -f "$answer_file" ]]; then
        echo "Error: QA answer not found: $answer_file" >&2
        return 1
    fi

    echo "$answer_file"
}

# Get QA ID from index (0 = latest, 1 = previous, etc.)
vox_qa_get_id_by_index() {
    local index="${1:-0}"

    if [[ -z "$QA_DIR" ]]; then
        echo "Error: QA_DIR not set" >&2
        return 1
    fi

    local db="${QA_DIR}/db"
    local files=($(ls "$db"/*.answer 2>/dev/null | sort -n))

    if [[ ${#files[@]} -eq 0 ]]; then
        echo "Error: No QA answers found" >&2
        return 1
    fi

    local last=$((${#files[@]}-1))
    local idx=$((last-index))

    if [[ $idx -lt 0 || $idx -gt $last ]]; then
        echo "Error: Invalid index: $index (valid: 0-$last)" >&2
        return 1
    fi

    local file="${files[$idx]}"
    local id=$(basename "$file" .answer)
    echo "$id"
}

# Get latest QA ID
vox_qa_get_latest_id() {
    vox_qa_get_id_by_index 0
}

# Get QA prompt for context
vox_qa_get_prompt() {
    local qa_id="$1"
    local prompt_file="${QA_DIR}/db/${qa_id}.prompt"

    if [[ -f "$prompt_file" ]]; then
        head -n1 "$prompt_file"
    else
        echo "[no prompt]"
    fi
}

# Get content from QA reference
vox_qa_get_content() {
    local qa_ref="$1"
    local answer_file=$(vox_qa_get_path "$qa_ref")

    if [[ $? -ne 0 ]]; then
        return 1
    fi

    cat "$answer_file"
}

# List all available QA sources
vox_qa_list() {
    if [[ -z "$QA_DIR" ]]; then
        echo "Error: QA_DIR not set" >&2
        return 1
    fi

    local db="${QA_DIR}/db"

    if [[ ! -d "$db" ]]; then
        echo "No QA database found at: $db" >&2
        return 1
    fi

    local files=($(ls -1 "$db"/*.answer 2>/dev/null | sort -rn))

    if [[ ${#files[@]} -eq 0 ]]; then
        echo "No QA answers found"
        return 0
    fi

    echo "Available QA Sources:"
    echo ""
    printf "%-6s %-15s %-10s %s\n" "INDEX" "TIMESTAMP" "SIZE" "PROMPT"
    echo "-------------------------------------------------------------"

    local idx=0
    for file in "${files[@]}"; do
        local id=$(basename "$file" .answer)
        local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
        local size_kb=$(echo "scale=1; $size / 1024" | bc)
        local prompt=$(vox_qa_get_prompt "$id" | head -c 50)

        printf "%-6s %-15s %-10s %s\n" "qa:$idx" "qa:$id" "${size_kb}K" "$prompt"
        ((idx++))
    done
}
