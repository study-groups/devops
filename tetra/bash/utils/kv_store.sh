#!/usr/bin/env bash
# utils/kv_store.sh - Exportable Key-Value Store
#
# PROBLEM: Bash associative arrays cannot be exported across subshells.
#          declare -gA creates a "global" that only exists in current shell.
#
# SOLUTION: Use delimited strings which CAN be exported.
#
# This provides a drop-in replacement for simple associative arrays
# that need to survive across shell boundaries (subshells, exports).
#
# Usage:
#   # Instead of: declare -gA MY_COLORS=([red]="\e[31m" [green]="\e[32m")
#   # Use:
#   tetra_kv_init MY_COLORS
#   tetra_kv_set MY_COLORS red $'\e[31m'
#   tetra_kv_set MY_COLORS green $'\e[32m'
#   value=$(tetra_kv_get MY_COLORS red)
#
# The store variable is automatically exported and survives subshells.
#
# Format: key=value (newline separated, with escaping for special chars)

# =============================================================================
# CORE KV OPERATIONS
# =============================================================================

# Initialize a KV store (makes it exportable)
# Usage: tetra_kv_init <store_name>
tetra_kv_init() {
    local store="$1"
    eval "export $store=''"
}

# Set a key-value pair
# Usage: tetra_kv_set <store_name> <key> <value>
tetra_kv_set() {
    local store="$1"
    local key="$2"
    local value="$3"

    # Validate key (must be valid identifier-ish)
    if [[ ! "$key" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo "tetra_kv_set: invalid key '$key'" >&2
        return 1
    fi

    # Remove existing entry
    tetra_kv_unset "$store" "$key"

    # Escape newlines and equals in value
    local escaped_value="${value//$'\n'/__NL__}"
    escaped_value="${escaped_value//=/__EQ__}"

    # Format: key=value
    local entry="${key}=${escaped_value}"

    # Add entry
    local current
    eval "current=\"\$$store\""
    if [[ -z "$current" ]]; then
        eval "export $store=\"\$entry\""
    else
        eval "export $store=\"\${current}\"\$'\\n'\"\${entry}\""
    fi
}

# Get a value by key
# Usage: tetra_kv_get <store_name> <key>
# Returns: value or empty string (exit 1 if not found)
tetra_kv_get() {
    local store="$1"
    local key="$2"

    local data
    eval "data=\"\$$store\""
    [[ -z "$data" ]] && return 1

    local entry_key entry_value
    while IFS='=' read -r entry_key entry_value; do
        [[ -z "$entry_key" ]] && continue
        if [[ "$entry_key" == "$key" ]]; then
            # Unescape
            entry_value="${entry_value//__NL__/$'\n'}"
            entry_value="${entry_value//__EQ__/=}"
            echo "$entry_value"
            return 0
        fi
    done <<< "$data"
    return 1
}

# Get value via nameref (no subshell)
# Usage: tetra_kv_get_ref <store_name> <key> <output_var>
tetra_kv_get_ref() {
    local store="$1"
    local key="$2"
    local -n _kv_out="$3"
    _kv_out=""

    local data
    eval "data=\"\$$store\""
    [[ -z "$data" ]] && return 1

    local entry_key entry_value
    while IFS='=' read -r entry_key entry_value; do
        [[ -z "$entry_key" ]] && continue
        if [[ "$entry_key" == "$key" ]]; then
            # Unescape
            entry_value="${entry_value//__NL__/$'\n'}"
            entry_value="${entry_value//__EQ__/=}"
            _kv_out="$entry_value"
            return 0
        fi
    done <<< "$data"
    return 1
}

# Remove a key
# Usage: tetra_kv_unset <store_name> <key>
tetra_kv_unset() {
    local store="$1"
    local key="$2"

    local data
    eval "data=\"\$$store\""
    [[ -z "$data" ]] && return 0

    local new_data=""
    local entry_key entry_value
    while IFS='=' read -r entry_key entry_value; do
        [[ -z "$entry_key" ]] && continue
        if [[ "$entry_key" != "$key" ]]; then
            if [[ -z "$new_data" ]]; then
                new_data="${entry_key}=${entry_value}"
            else
                new_data="${new_data}"$'\n'"${entry_key}=${entry_value}"
            fi
        fi
    done <<< "$data"
    eval "export $store=\"\$new_data\""
}

# Check if key exists
# Usage: tetra_kv_has <store_name> <key>
tetra_kv_has() {
    local store="$1"
    local key="$2"
    tetra_kv_get "$store" "$key" >/dev/null 2>&1
}

# List all keys
# Usage: tetra_kv_keys <store_name>
tetra_kv_keys() {
    local store="$1"

    local data
    eval "data=\"\$$store\""
    [[ -z "$data" ]] && return 0

    local entry_key
    while IFS='=' read -r entry_key _; do
        [[ -n "$entry_key" ]] && echo "$entry_key"
    done <<< "$data"
}

# Count entries
# Usage: tetra_kv_count <store_name>
tetra_kv_count() {
    local store="$1"
    local count=0

    local data
    eval "data=\"\$$store\""
    [[ -z "$data" ]] && { echo 0; return; }

    while IFS='=' read -r entry_key _; do
        [[ -n "$entry_key" ]] && ((count++))
    done <<< "$data"
    echo "$count"
}

# Debug: dump store contents
# Usage: tetra_kv_dump <store_name>
tetra_kv_dump() {
    local store="$1"

    local data
    eval "data=\"\$$store\""

    echo "=== KV Store: $store ==="
    if [[ -z "$data" ]]; then
        echo "(empty)"
    else
        local entry_key entry_value
        while IFS='=' read -r entry_key entry_value; do
            [[ -z "$entry_key" ]] && continue
            entry_value="${entry_value//__NL__/$'\n'}"
            entry_value="${entry_value//__EQ__/=}"
            printf "  %s = %q\n" "$entry_key" "$entry_value"
        done <<< "$data"
    fi
}

# =============================================================================
# BATCH OPERATIONS (for migrating from associative arrays)
# =============================================================================

# Bulk set from inline definition
# Usage: tetra_kv_set_bulk <store_name> key1=value1 key2=value2 ...
tetra_kv_set_bulk() {
    local store="$1"
    shift
    local pair key value
    for pair in "$@"; do
        key="${pair%%=*}"
        value="${pair#*=}"
        tetra_kv_set "$store" "$key" "$value"
    done
}

# =============================================================================
# HYDRATION (convert KV store to local associative array)
# =============================================================================
# Bash 5.2+ feature: Use this to "hydrate" a local associative array
# from the exportable string when you need fast repeated lookups.
#
# Usage:
#   local -A colors
#   tetra_kv_to_array MY_COLORS colors
#   echo "${colors[red]}"  # Fast direct access

# Hydrate a local associative array from a KV store
# Usage: tetra_kv_to_array <store_name> <array_name>
tetra_kv_to_array() {
    local store="$1"
    local -n _arr="$2"

    local data
    eval "data=\"\$$store\""
    [[ -z "$data" ]] && return 0

    local -a lines
    readarray -t lines <<< "$data"

    local entry_key entry_value line
    for line in "${lines[@]}"; do
        [[ -z "$line" ]] && continue
        entry_key="${line%%=*}"
        entry_value="${line#*=}"
        # Unescape
        entry_value="${entry_value//__NL__/$'\n'}"
        entry_value="${entry_value//__EQ__/=}"
        _arr[$entry_key]="$entry_value"
    done
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f tetra_kv_init tetra_kv_set tetra_kv_get tetra_kv_get_ref
export -f tetra_kv_unset tetra_kv_has tetra_kv_keys tetra_kv_count
export -f tetra_kv_dump tetra_kv_set_bulk tetra_kv_to_array
