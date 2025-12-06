#!/usr/bin/env bash
# NH → Tetra Integration
# Simple export of discovered infrastructure for Tetra consumption

# Export all NH variables for Tetra to consume
nh_export_for_tetra() {
    local context="${DIGITALOCEAN_CONTEXT:-$1}"

    echo "# NH Infrastructure Export for Tetra"
    echo "# Context: $context"
    echo "# Generated: $(date)"
    echo ""

    # Export all NH short variables
    env | grep '^p[a-z]*=' | sort

    echo ""
    echo "# Server name hints from NH:"
    if [[ -f "$NH_DIR/$context/digocean.json" ]]; then
        jq -r '.[] | select(.Droplets) | .Droplets[] |
            "# \(.name) → \(.networks.v4[] | select(.type=="public") | .ip_address) (tags: \(.tags | join(",")))"' \
            "$NH_DIR/$context/digocean.json" 2>/dev/null
    fi
}