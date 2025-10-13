#!/usr/bin/env bash
# bash/resolve/symbol.sh
# TES Level 0-1: Symbol → Address resolution
# Reads from organization TOML files to map semantic symbols to network addresses

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
        echo "ERROR: No organization TOML found. Set TETRA_ORG or create org config." >&2
        return 1
    fi

    # Parse TOML to find symbol address
    # Look for [symbols] section entries like: "@dev" = { address = "137.184.226.163", ... }
    local address
    address=$(awk -F'[=\"]' -v sym="@$symbol" '
        /^\[symbols\]/ { in_symbols=1; next }
        /^\[/ { in_symbols=0 }
        in_symbols && $0 ~ sym {
            # Extract address value
            if (match($0, /address[[:space:]]*=[[:space:]]*"([^"]+)"/, arr)) {
                print arr[1]
                exit
            }
        }
    ' "$org_toml")

    if [[ -z "$address" ]]; then
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
        echo "ERROR: No organization TOML found" >&2
        return 1
    fi

    # Parse connector to get work_user
    local work_user
    work_user=$(awk -F'[=\"]' -v sym="@$symbol" '
        /^\[connectors\]/ { in_connectors=1; next }
        /^\[/ { in_connectors=0 }
        in_connectors && $0 ~ sym {
            # Start of this symbol block
            in_block=1
        }
        in_block && /work_user/ {
            if (match($0, /work_user[[:space:]]*=[[:space:]]*"([^"]+)"/, arr)) {
                print arr[1]
                exit
            }
        }
        in_block && /^\[/ {
            # End of block
            in_block=0
        }
    ' "$org_toml")

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
