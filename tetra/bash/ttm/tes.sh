#!/usr/bin/env bash
# tes.sh - TES (Tetra Endpoint Specification) integration
# Progressive resolution of @symbols to execution plans

: "${TTM_DIR:=$TETRA_DIR/ttm}"
: "${TETRA_SRC:=~/tetra}"

# Resolve TES endpoint for transaction
# Args: [txn_id]
txn_resolve_tes() {
    local txn_id="${1:-}"
    local dir="$(txn_dir "$txn_id")" || return 1

    txn_id=$(basename "$dir")

    # Get target from state
    if ! command -v jq >/dev/null 2>&1; then
        echo "Error: jq required for TES resolution" >&2
        return 1
    fi

    local target=$(jq -r '.target' "$dir/state.json")

    if [[ -z "$target" ]] || [[ "$target" == "null" ]]; then
        echo "Error: No target defined in transaction" >&2
        return 1
    fi

    # Check if bash/resolve exists
    if [[ -f "$TETRA_SRC/bash/resolve/resolve.sh" ]]; then
        # Use existing resolver
        source "$TETRA_SRC/bash/resolve/resolve.sh"
        local plan=$(resolve_symbol "$target" 2>/dev/null)

        if [[ -z "$plan" ]]; then
            # Fallback to simple resolution
            plan=$(_simple_resolve "$target")
        fi
    else
        # Use simple resolution
        plan=$(_simple_resolve "$target")
    fi

    # Store in state
    txn_update "$txn_id" "{\"tes_plan\":\"$plan\"}"

    # Log TES resolved event
    echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"event\":\"tes_resolved\",\"target\":\"$target\",\"plan\":\"$plan\"}" \
        >> "$dir/events.ndjson"

    # Publish event
    ttm_publish "txn.tes_resolved" "$txn_id" "$target"

    echo "TES resolved: $target → $plan"
}

# Simple TES resolution (fallback)
# Maps @symbols to basic endpoints
_simple_resolve() {
    local target="$1"

    case "$target" in
        "@local"|"@localhost")
            echo "localhost"
            ;;
        "@dev")
            echo "dev.local"
            ;;
        "@staging")
            echo "staging.local"
            ;;
        "@prod")
            echo "prod.local"
            ;;
        @*)
            # Strip @ and use as-is
            echo "${target#@}"
            ;;
        *)
            echo "$target"
            ;;
    esac
}

# Load topology configuration
# Returns JSON mapping of @symbols to connectors
_load_topology() {
    local topology_file="$TTM_DIR/topology.json"

    if [[ -f "$topology_file" ]]; then
        cat "$topology_file"
    else
        # Return default topology
        cat <<'EOF'
{
  "@local": {"type": "local", "host": "localhost"},
  "@dev": {"type": "ssh", "host": "dev.local", "user": "deploy"},
  "@staging": {"type": "ssh", "host": "staging.local", "user": "deploy"},
  "@prod": {"type": "ssh", "host": "prod.local", "user": "deploy"}
}
EOF
    fi
}

# Get connector for target
# Args: target
txn_get_connector() {
    local target="$1"

    if ! command -v jq >/dev/null 2>&1; then
        echo "Error: jq required" >&2
        return 1
    fi

    local topology=$(_load_topology)
    echo "$topology" | jq -r --arg target "$target" '.[$target] // empty'
}

# Export functions
export -f txn_resolve_tes
export -f txn_get_connector
