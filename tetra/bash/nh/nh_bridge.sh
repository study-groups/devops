#!/usr/bin/env bash
# NodeHolder Bridge - Documentation and Helpers
#
# This is NOT a duplication of NodeHolder functionality
# This is a bridge that:
#   - Documents the nh ↔ tetra relationship
#   - Validates digocean.json inputs
#   - Suggests when to refresh infrastructure
#   - Optionally invokes nh (with user permission)
#
# Single Source of Truth: doctl (via NodeHolder)
# Bridge Contract: digocean.json
# Security: NO doctl credentials in tetra

# Check if NodeHolder is available
nh_check_available() {
    [[ -d "../nh" ]] && [[ -f "../nh/bash/doctl.sh" ]]
}

# Get location of NodeHolder
nh_get_location() {
    if nh_check_available; then
        realpath "../nh" 2>/dev/null || echo "../nh"
    else
        echo ""
    fi
}

# Get age of digocean.json in days
nh_get_json_age() {
    local json_file="$1"

    if [[ ! -f "$json_file" ]]; then
        echo "999999"  # File doesn't exist
        return 1
    fi

    local file_time
    # macOS vs Linux stat
    if stat -f %m "$json_file" >/dev/null 2>&1; then
        file_time=$(stat -f %m "$json_file")
    else
        file_time=$(stat -c %Y "$json_file")
    fi

    local now=$(date +%s)
    local age_seconds=$((now - file_time))
    local age_days=$((age_seconds / 86400))

    echo "$age_days"
}

# Validate digocean.json format and content
nh_validate_json() {
    local json_file="$1"

    if [[ ! -f "$json_file" ]]; then
        echo "❌ File not found: $json_file"
        return 1
    fi

    # Check if valid JSON
    if ! jq empty "$json_file" 2>/dev/null; then
        echo "❌ Invalid JSON format"
        return 1
    fi

    # Check for required sections
    local has_droplets=$(jq -r '.[] | select(.Droplets) | .Droplets | length' "$json_file" 2>/dev/null)

    if [[ -z "$has_droplets" || "$has_droplets" == "0" ]]; then
        echo "⚠️  No droplets found in JSON"
        echo "   This may be a valid but empty infrastructure"
    fi

    echo "✅ Valid DigitalOcean JSON"
    return 0
}

# Suggest refresh if data is stale
nh_suggest_refresh() {
    local json_file="$1"
    local max_age_days="${2:-30}"  # Default 30 days

    local age=$(nh_get_json_age "$json_file")

    if [[ $age -gt $max_age_days ]]; then
        echo ""
        echo "⚠️  Infrastructure data is $age days old (> $max_age_days days)"
        echo ""
        echo "   To fetch latest infrastructure from DigitalOcean:"

        if nh_check_available; then
            local nh_dir=$(nh_get_location)
            echo "     cd $nh_dir"
            echo "     source bash/doctl.sh"
            echo "     nh_doctl_get_all"
        else
            echo "     Install NodeHolder: git clone <nodeholder-repo> ../nh"
            echo "     See: bash/nh/README.md"
        fi

        echo ""
        return 1
    fi

    return 0
}

# Show NodeHolder status
nh_status() {
    echo "NodeHolder Bridge Status"
    echo "════════════════════════════════════════"
    echo ""

    if nh_check_available; then
        local nh_dir=$(nh_get_location)
        echo "✅ NodeHolder found at: $nh_dir"
        echo ""

        # Show available contexts
        if [[ -d "$nh_dir" ]]; then
            echo "Available contexts (with digocean.json):"
            local count=0
            for context_dir in "$nh_dir"/*/; do
                if [[ -f "$context_dir/digocean.json" ]]; then
                    local context=$(basename "$context_dir")
                    local age=$(nh_get_json_age "$context_dir/digocean.json")
                    printf "  • %-20s (age: %3d days)\n" "$context" "$age"
                    ((count++))
                fi
            done

            if [[ $count -eq 0 ]]; then
                echo "  (none found - run nh_doctl_get_all)"
            fi
        fi
    else
        echo "❌ NodeHolder not found at ../nh"
        echo ""
        echo "NodeHolder is a separate tool for fetching DigitalOcean infrastructure."
        echo ""
        echo "To install:"
        echo "  git clone <nodeholder-repo> ../nh"
        echo ""
        echo "Without NodeHolder, you can still:"
        echo "  - Import existing digocean.json files"
        echo "  - Manually create infrastructure configs"
        echo "  - Use Tetra org management features"
    fi

    echo ""
}

# Invoke NodeHolder command safely (with user confirmation)
nh_invoke_safe() {
    local command="$1"
    shift
    local args=("$@")

    if ! nh_check_available; then
        echo "❌ NodeHolder not found at ../nh"
        nh_status
        return 1
    fi

    local nh_dir=$(nh_get_location)

    echo ""
    echo "This will run NodeHolder command:"
    echo "  cd $nh_dir"
    echo "  source bash/doctl.sh"
    echo "  $command ${args[*]}"
    echo ""
    echo -n "Continue? [y/N]: "
    read -r response

    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Cancelled"
        return 1
    fi

    echo ""
    (
        cd "$nh_dir" || exit 1
        source bash/doctl.sh
        "$command" "${args[@]}"
    )
}

# Fetch latest infrastructure (with confirmation)
nh_fetch_latest() {
    local context="$1"

    echo "Fetch latest infrastructure from DigitalOcean"
    echo ""
    echo "⚠️  This requires doctl credentials configured in NodeHolder"
    echo ""

    if [[ -n "$context" ]]; then
        nh_invoke_safe nh_doctl_get_all "$context"
    else
        nh_invoke_safe nh_doctl_get_all
    fi
}

# Show workflow documentation
nh_show_workflow() {
    cat << 'EOF'
NodeHolder ↔ Tetra Workflow
═══════════════════════════════════════════════════════════

Single Source of Truth: doctl (DigitalOcean API)
Bridge Contract: digocean.json

┌─────────────────────────────────────────────────────────┐
│ NODEHOLDER (../nh)                                      │
│ - Manages doctl credentials                            │
│ - Fetches infrastructure from DigitalOcean             │
│ - Outputs: digocean.json                               │
└─────────────────────────────────────────────────────────┘
                         ↓
              digocean.json (the bridge)
                         ↓
┌─────────────────────────────────────────────────────────┐
│ TETRA (./tetra)                                         │
│ - NO doctl credentials                                 │
│ - Converts digocean.json → tetra.toml                  │
│ - Manages deployments and secrets                      │
└─────────────────────────────────────────────────────────┘

WORKFLOW:

1. Fetch infrastructure (in NodeHolder):
   cd ../nh
   source bash/doctl.sh
   nh_doctl_get_all
   → Creates: ~/nh/<context>/digocean.json

2. Import to Tetra (in Tetra):
   org import nh ~/nh/<context> <org-name>
   → Interactive discovery
   → Creates: $TETRA_DIR/org/<org-name>/

3. Configure secrets:
   org secrets init <org-name>
   $EDITOR $TETRA_DIR/org/<org-name>/secrets.env

4. Compile and deploy:
   org compile <org-name>
   org switch <org-name>
   org push <org-name> dev

REFRESH (when infrastructure changes):

1. Update in NodeHolder:
   cd ../nh
   nh_doctl_get_all

2. Refresh in Tetra:
   org refresh <org-name> ~/nh/<context>/digocean.json

TETRA WORKS WITHOUT NODEHOLDER:
- Can import any valid digocean.json
- Can create orgs manually
- No dependency on NodeHolder installation

EOF
}

# Export functions
export -f nh_check_available
export -f nh_get_location
export -f nh_get_json_age
export -f nh_validate_json
export -f nh_suggest_refresh
export -f nh_status
export -f nh_invoke_safe
export -f nh_fetch_latest
export -f nh_show_workflow
