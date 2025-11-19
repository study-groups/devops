#!/usr/bin/env bash

# Multispan operations - Collections of cursors with semantic relationships

# Global multispan storage (1-9 slots)
declare -gA SPAN_STORAGE_1=()
declare -gA SPAN_STORAGE_2=()
declare -gA SPAN_STORAGE_3=()
declare -gA SPAN_STORAGE_4=()
declare -gA SPAN_STORAGE_5=()
declare -gA SPAN_STORAGE_6=()
declare -gA SPAN_STORAGE_7=()
declare -gA SPAN_STORAGE_8=()
declare -gA SPAN_STORAGE_9=()

# Metadata for stored spans
declare -gA SPAN_METADATA=()

# Create a new multispan collection
multispan_create() {
    local name="$1"
    declare -gA "MULTISPAN_${name}"
    echo "Created multispan: $name"
}

# Add cursor to multispan
multispan_add_cursor() {
    local name="$1"
    local cursor="$2"
    local key="${3:-$(date +%s%N)}"  # Use timestamp as key if not provided

    # Create array reference
    local -n span_ref="MULTISPAN_${name}"
    span_ref["$key"]="$cursor"

    echo "Added cursor to $name: $key"
}

# List cursors in multispan
multispan_list() {
    local name="$1"
    local -n span_ref="MULTISPAN_${name}"

    echo "Multispan: $name"
    for key in "${!span_ref[@]}"; do
        local cursor="${span_ref[$key]}"
        local file path start end note
        eval "$(cursor_parse "$cursor")"
        printf "  [%s] %s:%s-%s (%s)\n" "$key" "$file" "$start" "$end" "$note"
    done
}

# Store multispan in slot (1-9)
multispan_store() {
    local slot="$1"
    local name="$2"
    local description="$3"

    if [[ ! "$slot" =~ ^[1-9]$ ]]; then
        echo "Error: Slot must be 1-9" >&2
        return 1
    fi

    # Copy multispan to storage slot
    local -n source_ref="MULTISPAN_${name}"
    local -n storage_ref="SPAN_STORAGE_${slot}"

    # Clear existing storage
    for key in "${!storage_ref[@]}"; do
        unset storage_ref["$key"]
    done

    # Copy cursors
    for key in "${!source_ref[@]}"; do
        storage_ref["$key"]="${source_ref[$key]}"
    done

    # Store metadata
    SPAN_METADATA["$slot"]="${description:-$name}"
    echo "Stored multispan '$name' in slot [$slot]"
}

# Load multispan from slot
multispan_load() {
    local slot="$1"
    local name="$2"

    if [[ ! "$slot" =~ ^[1-9]$ ]]; then
        echo "Error: Slot must be 1-9" >&2
        return 1
    fi

    # Create target multispan
    multispan_create "$name"

    # Copy from storage
    local -n storage_ref="SPAN_STORAGE_${slot}"
    local -n target_ref="MULTISPAN_${name}"

    for key in "${!storage_ref[@]}"; do
        target_ref["$key"]="${storage_ref[$key]}"
    done

    echo "Loaded multispan from slot [$slot] as '$name'"
}

# Show stored span slots
multispan_show_storage() {
    echo "Stored Multispan Slots:"
    for slot in {1..9}; do
        local -n storage_ref="SPAN_STORAGE_${slot}"
        local count=${#storage_ref[@]}
        local desc="${SPAN_METADATA[$slot]:-empty}"

        if [[ $count -gt 0 ]]; then
            printf "  [%d] %s (%d cursors)\n" "$slot" "$desc" "$count"
        else
            printf "  [%d] —\n" "$slot"
        fi
    done
}

# Search across all cursors in multispan
multispan_search() {
    local name="$1"
    local pattern="$2"
    local -n span_ref="MULTISPAN_${name}"

    echo "Searching '$pattern' in multispan: $name"
    for key in "${!span_ref[@]}"; do
        local cursor="${span_ref[$key]}"
        local content=$(cursor_extract "$cursor" 2>/dev/null)
        if echo "$content" | grep -q "$pattern"; then
            local file path start end note
            eval "$(cursor_parse "$cursor")"
            printf "  [%s] %s:%s-%s matches\n" "$key" "$file" "$start" "$end"
        fi
    done
}

# Merge two multispans
multispan_merge() {
    local target="$1"
    local source="$2"

    local -n target_ref="MULTISPAN_${target}"
    local -n source_ref="MULTISPAN_${source}"

    for key in "${!source_ref[@]}"; do
        # Create unique key if conflict
        local new_key="$key"
        local counter=1
        while [[ -n "${target_ref[$new_key]}" ]]; do
            new_key="${key}_${counter}"
            ((counter++))
        done
        target_ref["$new_key"]="${source_ref[$key]}"
    done

    echo "Merged multispan '$source' into '$target'"
}

# Get multispan statistics
multispan_stats() {
    local name="$1"
    local -n span_ref="MULTISPAN_${name}"

    local count=${#span_ref[@]}
    local files=()
    local total_lines=0

    for key in "${!span_ref[@]}"; do
        local cursor="${span_ref[$key]}"
        local file path start end note
        eval "$(cursor_parse "$cursor")"

        # Count unique files
        if [[ ! " ${files[*]} " =~ " ${file} " ]]; then
            files+=("$file")
        fi

        # Count total lines
        total_lines=$((total_lines + end - start + 1))
    done

    echo "CURSOR_COUNT=$count"
    echo "FILE_COUNT=${#files[@]}"
    echo "TOTAL_LINES=$total_lines"
    echo "FILES=(${files[*]})"
}