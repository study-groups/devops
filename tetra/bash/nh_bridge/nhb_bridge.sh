#!/usr/bin/env bash
# nhb_bridge.sh - Nodeholder Bridge Documentation and Helpers
#
# This is NOT a duplication of Nodeholder functionality.
# This is a bridge that:
#   - Documents the nh ↔ tetra relationship
#   - Validates digocean.json inputs
#   - Suggests when to refresh infrastructure
#   - Optionally invokes nh (with user permission)
#
# Single Source of Truth: doctl (via Nodeholder)
# Bridge Contract: digocean.json
# Security: NO doctl credentials in tetra

# Nodeholder locations - set these or use defaults
# NH_SRC = Nodeholder source code (~/src/devops/nh)
# NH_DIR = Nodeholder data/contexts (~/nh)
# Note: NHB_SRC is this bridge module (set by tetra module system)
NH_SRC="${NH_SRC:-$HOME/src/devops/nh}"
NH_DIR="${NH_DIR:-$HOME/nh}"

# Check if Nodeholder is available
nhb_check_available() {
    [[ -d "$NH_SRC" ]] && [[ -f "$NH_SRC/bash/nh.sh" ]]
}

# Get location of Nodeholder source
nhb_get_location() {
    if nhb_check_available; then
        echo "$NH_SRC"
    else
        echo ""
    fi
}

# Get age of digocean.json in days
nhb_get_json_age() {
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
nhb_validate_json() {
    local json_file="$1"

    if [[ ! -f "$json_file" ]]; then
        echo "Error: File not found: $json_file"
        return 1
    fi

    # Check if valid JSON
    if ! jq empty "$json_file" 2>/dev/null; then
        echo "Error: Invalid JSON format"
        return 1
    fi

    # Check for required sections
    local has_droplets=$(jq -r '.[] | select(.Droplets) | .Droplets | length' "$json_file" 2>/dev/null)

    if [[ -z "$has_droplets" || "$has_droplets" == "0" ]]; then
        echo "Warning: No droplets found in JSON"
        echo "  This may be a valid but empty infrastructure"
    fi

    echo "Valid DigitalOcean JSON"
    return 0
}

# Suggest refresh if data is stale
nhb_suggest_refresh() {
    local json_file="$1"
    local max_age_days="${2:-30}"  # Default 30 days

    local age=$(nhb_get_json_age "$json_file")

    if [[ $age -gt $max_age_days ]]; then
        echo ""
        echo "Warning: Infrastructure data is $age days old (> $max_age_days days)"
        echo ""
        echo "  To fetch latest infrastructure from DigitalOcean:"

        if nhb_check_available; then
            local nh_dir=$(nhb_get_location)
            echo "    cd $nh_dir"
            echo "    source bash/doctl.sh"
            echo "    nh_doctl_get_all"
        else
            echo "    Install Nodeholder: git clone <nodeholder-repo> $NH_SRC"
            echo "    See: bash/nh_bridge/README.md"
        fi

        echo ""
        return 1
    fi

    return 0
}

# Show Nodeholder status
nhb_status() {
    echo "nh_bridge Status"
    echo "========================================"
    echo ""
    echo "NH_SRC: $NH_SRC"
    echo "NH_DIR: $NH_DIR"
    echo ""

    if nhb_check_available; then
        echo "Nodeholder: installed"
    else
        echo "Nodeholder: not found"
        echo "  Install: git clone <repo> $NH_SRC"
    fi
    echo ""

    # Show available contexts from NH_DIR
    if [[ -d "$NH_DIR" ]]; then
        echo "Contexts (in $NH_DIR):"
        local count=0
        for context_dir in "$NH_DIR"/*/; do
            [[ -d "$context_dir" ]] || continue
            local context=$(basename "$context_dir")
            if [[ -f "$context_dir/digocean.json" ]]; then
                local age=$(nhb_get_json_age "$context_dir/digocean.json")
                printf "  %-20s %3d days old\n" "$context" "$age"
                ((count++))
            else
                printf "  %-20s (no digocean.json)\n" "$context"
            fi
        done

        if [[ $count -eq 0 ]]; then
            echo "  (none with digocean.json)"
            echo ""
            echo "  Run: cd $NH_SRC && source bash/nh.sh && nh fetch"
        fi
    else
        echo "NH_DIR not found: $NH_DIR"
    fi
    echo ""
}

# Invoke Nodeholder command safely (with user confirmation)
nhb_invoke_safe() {
    local command="$1"
    shift
    local args=("$@")

    if ! nhb_check_available; then
        echo "Error: Nodeholder not found at $NH_SRC"
        nhb_status
        return 1
    fi

    local nh_dir=$(nhb_get_location)

    echo ""
    echo "This will run Nodeholder command:"
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
nhb_fetch_latest() {
    local context="$1"

    echo "Fetch latest infrastructure from DigitalOcean"
    echo ""
    echo "Warning: This requires doctl credentials configured in Nodeholder"
    echo ""

    if [[ -n "$context" ]]; then
        nhb_invoke_safe nh_doctl_get_all "$context"
    else
        nhb_invoke_safe nh_doctl_get_all
    fi
}

# Show workflow documentation
nhb_show_workflow() {
    cat << 'EOF'
Nodeholder -> Tetra Workflow
===============================================================

Single Source of Truth: doctl (DigitalOcean API)
Bridge Contract: digocean.json

+-----------------------------------------------------------+
| NODEHOLDER (../nh or ~/src/devops/nh)                     |
| - Manages doctl credentials                               |
| - Fetches infrastructure from DigitalOcean                |
| - Outputs: digocean.json                                  |
+-----------------------------------------------------------+
                         |
              digocean.json (the bridge)
                         |
                         v
+-----------------------------------------------------------+
| TETRA nh_bridge module                                    |
| - NO doctl credentials                                    |
| - Converts digocean.json -> tetra.toml                    |
| - Manages deployments and secrets                         |
+-----------------------------------------------------------+

WORKFLOW:

1. Fetch infrastructure (in Nodeholder):
   cd ~/src/devops/nh
   nh fetch
   -> Creates: ~/nh/<context>/digocean.json

2. Import to Tetra (in Tetra):
   nhb_import ~/nh/<context>/digocean.json <org-name>
   -> Interactive discovery
   -> Creates: $TETRA_DIR/orgs/<org-name>/

3. Configure secrets:
   org secrets init <org-name>
   $EDITOR $TETRA_DIR/orgs/<org-name>/secrets.env

4. Compile and deploy:
   org build <org-name>
   org switch <org-name>
   tkm init && tkm gen all

REFRESH (when infrastructure changes):

1. Update in Nodeholder:
   cd ~/src/devops/nh && nh fetch

2. Refresh in Tetra:
   nhb_import ~/nh/<context>/digocean.json <org-name>

TETRA WORKS WITHOUT NODEHOLDER:
- Can import any valid digocean.json
- Can create orgs manually
- No dependency on Nodeholder installation

EOF
}

# =============================================================================
# IMPORT INTEGRATION
# =============================================================================

# Quick import from Nodeholder context
# Usage: nhb_quick_import <context> [org_name]
nhb_quick_import() {
    local context="$1"
    local org_name="${2:-$context}"

    if [[ -z "$context" ]]; then
        echo "Usage: nhb_quick_import <context> [org_name]"
        echo ""
        echo "Imports digocean.json from Nodeholder context"
        echo ""
        echo "Example:"
        echo "  nhb_quick_import pixeljam-arcade"
        echo "  nhb_quick_import pixeljam-arcade pj"
        return 1
    fi

    # Find the JSON file
    local json_file=""

    if nhb_check_available; then
        local nh_dir=$(nhb_get_location)
        json_file="$nh_dir/$context/digocean.json"
    fi

    # Also check ~/nh/<context>
    if [[ ! -f "$json_file" && -f "$HOME/nh/$context/digocean.json" ]]; then
        json_file="$HOME/nh/$context/digocean.json"
    fi

    if [[ ! -f "$json_file" ]]; then
        echo "Error: digocean.json not found for context: $context" >&2
        echo ""
        echo "Checked:"
        nhb_check_available && echo "  $(nhb_get_location)/$context/digocean.json"
        echo "  ~/nh/$context/digocean.json"
        return 1
    fi

    # Check age and warn
    nhb_suggest_refresh "$json_file" 30

    # Source import functions
    source "${NHB_SRC:-$TETRA_SRC/bash/nh_bridge}/nhb_import.sh"

    # Run import
    nhb_import "$json_file" "$org_name"
}
