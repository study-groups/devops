#!/usr/bin/env bash

# TSM Org Helpers - Organization-scoped service path resolution
# Supports ORG×PROJECT×ENV scheme with short names from tetra.toml

# Get short name for an org from its tetra.toml
# Falls back to full org name if short_name not defined
tsm_get_org_short_name() {
    local org="${1:-${TETRA_ORG:-tetra}}"
    [[ "$org" == "system" ]] && { echo "$org"; return; }

    local toml_file="$TETRA_DIR/orgs/$org/tetra.toml"
    if [[ -f "$toml_file" ]]; then
        # Parse short_name from TOML (format: short_name = "pj")
        local short_name
        short_name=$(grep -E '^short_name\s*=' "$toml_file" 2>/dev/null | head -1 | cut -d'"' -f2)
        [[ -n "$short_name" ]] && { echo "$short_name"; return; }
    fi
    echo "$org"  # Fallback to full name
}

# Get effective org (TETRA_ORG or "tetra")
tsm_get_effective_org() {
    echo "${TETRA_ORG:-tetra}"
}

# Get services-available directory for an org
# Args: org (optional, defaults to current TETRA_ORG or "tetra")
# Special values: "system" for global tetra services, "source" for $TETRA_SRC
tsm_get_services_dir() {
    local org="${1:-$(tsm_get_effective_org)}"
    case "$org" in
        system) echo "$TETRA_DIR/tsm/services-available" ;;
        source) echo "$TETRA_SRC/bash/tsm/services-available" ;;
        *)      echo "$TETRA_DIR/orgs/$org/tsm/services-available" ;;
    esac
}

# Get services-enabled directory for an org
tsm_get_enabled_dir() {
    local org="${1:-$(tsm_get_effective_org)}"
    case "$org" in
        system) echo "$TETRA_DIR/tsm/services-enabled" ;;
        *)      echo "$TETRA_DIR/orgs/$org/tsm/services-enabled" ;;
    esac
}

# Find a service file by name, searching org → source → system
# Returns the full path to the .tsm file, or empty string if not found
tsm_find_service_file() {
    local service_name="$1"
    local current_org=$(tsm_get_effective_org)

    # Search order: current org → source → system
    for org in "$current_org" "source" "system"; do
        local candidate="$(tsm_get_services_dir "$org")/${service_name}.tsm"
        if [[ -f "$candidate" ]]; then
            echo "$candidate"
            return 0
        fi
    done

    return 1
}

# Get the org that owns a service file (by parsing path or TSM_ORG in file)
tsm_get_service_org() {
    local service_file="$1"

    # Try to determine from path
    if [[ "$service_file" == "$TETRA_DIR/tsm/services-available/"* ]]; then
        echo "system"
    elif [[ "$service_file" == "$TETRA_SRC/bash/tsm/services-available/"* ]]; then
        echo "source"
    elif [[ "$service_file" == "$TETRA_DIR/orgs/"* ]]; then
        # Extract org name from path: $TETRA_DIR/orgs/<ORG>/tsm/...
        local rel_path="${service_file#$TETRA_DIR/orgs/}"
        echo "${rel_path%%/*}"
    else
        # Fallback: read TSM_ORG from file, default to tetra
        grep -E '^TSM_ORG=' "$service_file" 2>/dev/null | head -1 | cut -d'"' -f2 || echo "tetra"
    fi
}

# Export functions
export -f tsm_get_org_short_name
export -f tsm_get_effective_org
export -f tsm_get_services_dir
export -f tsm_get_enabled_dir
export -f tsm_find_service_file
export -f tsm_get_service_org
