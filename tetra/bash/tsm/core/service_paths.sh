#!/usr/bin/env bash

# TSM Service Paths - Service definition file discovery and resolution
# Handles finding .tsm service files across org namespaces
#
# Search order for services: current_org → none → system
# Paths:
#   - Org-scoped:  $TETRA_DIR/orgs/<org>/tsm/services-available/
#   - System:      $TETRA_DIR/tsm/services-available/

# === ORG RESOLUTION ===

# Get short name for an org from its tetra.toml
# Falls back to full org name if short_name not defined
tsm_get_org_short_name() {
    local org="${1:-${TETRA_ORG:-none}}"
    [[ "$org" == "none" || "$org" == "system" ]] && { echo "$org"; return; }

    local toml_file="$TETRA_DIR/orgs/$org/tetra.toml"
    if [[ -f "$toml_file" ]]; then
        local short_name
        short_name=$(grep -E '^short_name\s*=' "$toml_file" 2>/dev/null | head -1 | cut -d'"' -f2)
        [[ -n "$short_name" ]] && { echo "$short_name"; return; }
    fi
    echo "$org"
}

# Get effective org (TETRA_ORG or "none")
tsm_get_effective_org() {
    echo "${TETRA_ORG:-none}"
}

# === SERVICE DIRECTORY RESOLUTION ===

# Get services-available directory for an org
# Args: org (optional, defaults to current TETRA_ORG or "none")
# Special: "system" returns global tetra services dir
tsm_get_services_dir() {
    local org="${1:-$(tsm_get_effective_org)}"
    case "$org" in
        system) echo "$TETRA_DIR/tsm/services-available" ;;
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

# === SERVICE FILE DISCOVERY ===

# Find a service file by name
# Searches: current_org → none → system
# Returns: full path to .tsm file, or empty if not found
tsm_find_service_file() {
    local service_name="$1"
    local current_org=$(tsm_get_effective_org)

    # Search order: current org → none → system
    for org in "$current_org" "none" "system"; do
        # Skip duplicate search if current_org is "none"
        [[ "$org" == "none" && "$current_org" == "none" ]] && continue

        local candidate="$(tsm_get_services_dir "$org")/${service_name}.tsm"
        if [[ -f "$candidate" ]]; then
            echo "$candidate"
            return 0
        fi
    done

    return 1
}

# Get the org that owns a service file
# Determines from path structure or TSM_ORG in file
tsm_get_service_org() {
    local service_file="$1"

    # Determine from path
    if [[ "$service_file" == "$TETRA_DIR/tsm/services-available/"* ]]; then
        echo "system"
    elif [[ "$service_file" == "$TETRA_DIR/orgs/"* ]]; then
        # Extract org from: $TETRA_DIR/orgs/<ORG>/tsm/...
        local rel_path="${service_file#$TETRA_DIR/orgs/}"
        echo "${rel_path%%/*}"
    else
        # Fallback: read TSM_ORG from file
        grep -E '^TSM_ORG=' "$service_file" 2>/dev/null | head -1 | cut -d'"' -f2 || echo "none"
    fi
}

# === SERVICE LISTING ===

# List all available services across all orgs
tsm_list_all_services() {
    local current_org=$(tsm_get_effective_org)

    for org in "$current_org" "none" "system"; do
        [[ "$org" == "none" && "$current_org" == "none" ]] && continue

        local services_dir=$(tsm_get_services_dir "$org")
        [[ -d "$services_dir" ]] || continue

        for service_file in "$services_dir"/*.tsm; do
            [[ -f "$service_file" ]] || continue
            local name=$(basename "$service_file" .tsm)
            echo "$org:$name"
        done
    done
}

# Export functions
export -f tsm_get_org_short_name
export -f tsm_get_effective_org
export -f tsm_get_services_dir
export -f tsm_get_enabled_dir
export -f tsm_find_service_file
export -f tsm_get_service_org
export -f tsm_list_all_services
