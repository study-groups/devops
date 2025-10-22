#!/usr/bin/env bash
# bash/resolve/symbol.sh
# TES Level 0-1: Symbol → Address resolution
# Reads from organization TOML files to map semantic symbols to network addresses

# Load unified logging
if ! type tetra_log_event >/dev/null 2>&1; then
    [[ -n "${TETRA_SRC:-}" ]] && source "${TETRA_SRC}/bash/utils/unified_log.sh" 2>/dev/null || true
fi

# Source centralized TOML parser
TOML_PARSER="${TETRA_SRC}/bash/utils/toml_parser.sh"
if [[ -f "$TOML_PARSER" ]]; then
    source "$TOML_PARSER"
fi

# Resolve a symbol to an address
# Level 0 → 1: @staging → 24.199.72.22
resolve_symbol_to_address() {
    local symbol=$1

    # Strip @ prefix if present
    symbol="${symbol#@}"

    # Special case: @local always resolves to localhost
    if [[ "$symbol" == "local" ]]; then
        echo "127.0.0.1"
        return 0
    fi

    # Look up symbol in org config
    # Try to find the active org's TOML file
    local org_toml
    if [[ -n "$TETRA_ORG" ]]; then
        org_toml="$TETRA_DIR/orgs/$TETRA_ORG/$TETRA_ORG.toml"
    else
        # Try to find any org toml in orgs directory
        org_toml=$(find "$TETRA_DIR/orgs" -name "*.toml" -type f 2>/dev/null | head -1)
    fi

    if [[ ! -f "$org_toml" ]]; then
        type tetra_log_error >/dev/null 2>&1 && \
            tetra_log_error resolve "symbol-to-address" "$symbol" "{\"error\":\"no org TOML found\",\"TETRA_ORG\":\"${TETRA_ORG:-}\"}"
        echo "ERROR: No organization TOML found. Set TETRA_ORG or create org config." >&2
        return 1
    fi

    # Parse TOML using centralized parser
    toml_parse "$org_toml" "ORG" || {
        type tetra_log_error >/dev/null 2>&1 && \
            tetra_log_error resolve "symbol-to-address" "$symbol" "{\"error\":\"failed to parse TOML\",\"org_toml\":\"$org_toml\"}"
        echo "ERROR: Failed to parse $org_toml" >&2
        return 1
    }

    # Look up symbol address in [symbols] section
    # Format: "@dev" = { address = "137.184.226.163", ... }
    # The parser converts dots to underscores, so we look for key "@symbol"
    local address
    local symbol_key="@${symbol}"

    # Try to get the address from the symbols section
    # Since the value is inline JSON-like, we need to extract just the address field
    local symbol_value
    symbol_value=$(toml_get "symbols" "$symbol_key" "ORG" 2>/dev/null)

    # Extract address from inline JSON-like format: { address = "...", ... }
    if [[ -n "$symbol_value" && "$symbol_value" =~ address[[:space:]]*=[[:space:]]*\"([^\"]+)\" ]]; then
        address="${BASH_REMATCH[1]}"
    fi

    if [[ -z "$address" ]]; then
        type tetra_log_error >/dev/null 2>&1 && \
            tetra_log_error resolve "symbol-to-address" "$symbol" "{\"error\":\"symbol not found\",\"org_toml\":\"$org_toml\"}"
        echo "ERROR: Symbol @$symbol not found in $org_toml" >&2
        return 1
    fi

    echo "$address"
}

# Resolve address to channel (Address → Channel)
# Level 1 → 2: 143.198.45.123 → dev@143.198.45.123
resolve_address_to_channel() {
    local address=$1
    local symbol=$2

    # Strip @ prefix if present
    symbol="${symbol#@}"

    # For localhost, use current user
    if [[ "$address" == "127.0.0.1" || "$address" == "localhost" ]]; then
        echo "$USER@localhost"
        return 0
    fi

    # Look up the work_user for this symbol from connectors section
    local org_toml
    if [[ -n "$TETRA_ORG" ]]; then
        org_toml="$TETRA_DIR/orgs/$TETRA_ORG/$TETRA_ORG.toml"
    else
        org_toml=$(find "$TETRA_DIR/orgs" -name "*.toml" -type f 2>/dev/null | head -1)
    fi

    if [[ ! -f "$org_toml" ]]; then
        type tetra_log_error >/dev/null 2>&1 && \
            tetra_log_error resolve "address-to-channel" "$address" "{\"error\":\"no org TOML found\",\"symbol\":\"$symbol\"}"
        echo "ERROR: No organization TOML found" >&2
        return 1
    fi

    # Parse TOML using centralized parser
    toml_parse "$org_toml" "ORG" || {
        type tetra_log_error >/dev/null 2>&1 && \
            tetra_log_error resolve "address-to-channel" "$address" "{\"error\":\"failed to parse TOML\",\"org_toml\":\"$org_toml\"}"
        echo "ERROR: Failed to parse $org_toml" >&2
        return 1
    }

    # Get work_user from connectors section
    local work_user
    local symbol_key="@${symbol}"
    local connector_value
    connector_value=$(toml_get "connectors" "$symbol_key" "ORG" 2>/dev/null)

    # Extract work_user from inline format: { work_user = "...", ... }
    if [[ -n "$connector_value" && "$connector_value" =~ work_user[[:space:]]*=[[:space:]]*\"([^\"]+)\" ]]; then
        work_user="${BASH_REMATCH[1]}"
    fi

    if [[ -z "$work_user" ]]; then
        # Default to symbol name as user if not found
        work_user="$symbol"
    fi

    echo "${work_user}@${address}"
}

# Parse symbol from various formats
parse_symbol() {
    local input=$1

    # Extract symbol portion
    if [[ "$input" =~ ^@[a-z]+ ]]; then
        echo "${BASH_REMATCH[0]}"
    else
        echo "$input"
    fi
}

# List available symbols from org config
list_symbols() {
    local org_toml
    if [[ -n "$TETRA_ORG" ]]; then
        org_toml="$TETRA_DIR/orgs/$TETRA_ORG/$TETRA_ORG.toml"
    else
        org_toml=$(find "$TETRA_DIR/orgs" -name "*.toml" -type f 2>/dev/null | head -1)
    fi

    if [[ ! -f "$org_toml" ]]; then
        type tetra_log_error >/dev/null 2>&1 && \
            tetra_log_error resolve "list-symbols" "query" "{\"error\":\"no org TOML found\"}"
        echo "ERROR: No organization TOML found" >&2
        return 1
    fi

    echo "Available symbols:"
    awk '
        /^\[symbols\]/ { in_symbols=1; next }
        /^\[/ { in_symbols=0 }
        in_symbols && /^"@[a-z]+"/ {
            if (match($0, /"(@[a-z]+)"/, arr)) {
                symbol = arr[1]
                if (match($0, /address[[:space:]]*=[[:space:]]*"([^"]+)"/, arr2)) {
                    printf "  %-12s → %s\n", symbol, arr2[1]
                }
            }
        }
    ' "$org_toml"
}
