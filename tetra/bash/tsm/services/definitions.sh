#!/usr/bin/env bash

# TSM Service Definitions - Org Helpers
# Multi-org service discovery and path resolution
# Requires: bash 5.2+

# Guard: TETRA_DIR must be set
if [[ -z "$TETRA_DIR" ]]; then
    echo "❌ TETRA_DIR not set. Source tetra.sh first." >&2
    return 1 2>/dev/null || exit 1
fi

# Default org for saving new services
TSM_DEFAULT_ORG="${TSM_DEFAULT_ORG:-tetra}"

# Single services-enabled directory (consolidated)
TSM_SERVICES_ENABLED="$TETRA_DIR/tsm/services-enabled"

# Get list of all orgs with TSM directories
_tsm_get_orgs() {
    local org_dir
    for org_dir in "$TETRA_DIR/orgs"/*/tsm; do
        [[ -d "$org_dir" ]] || continue
        basename "$(dirname "$org_dir")"
    done
}

# Parse service reference: "org/service" or just "service"
# Usage: _tsm_parse_service_ref "tetra/quasar" out_org out_service
_tsm_parse_service_ref() {
    local ref="$1"
    local -n _out_org="$2"
    local -n _out_service="$3"

    if [[ "$ref" == */* ]]; then
        _out_org="${ref%%/*}"
        _out_service="${ref#*/}"
    else
        _out_org=""
        _out_service="$ref"
    fi
}

# Find a service across all orgs (or in specific org if prefixed)
# Usage: _tsm_find_service "quasar" out_org out_file
# Returns 0 if found, 1 if not found
_tsm_find_service() {
    local ref="$1"
    local -n _out_found_org="$2"
    local -n _out_found_file="$3"

    local parsed_org parsed_service
    _tsm_parse_service_ref "$ref" parsed_org parsed_service

    if [[ -n "$parsed_org" ]]; then
        # Explicit org specified
        local service_file="$TETRA_DIR/orgs/$parsed_org/tsm/services-available/${parsed_service}.tsm"
        if [[ -f "$service_file" ]]; then
            _out_found_org="$parsed_org"
            _out_found_file="$service_file"
            return 0
        fi
        return 1
    fi

    # Search all orgs - check for ambiguity first
    local org match_count=0 first_org="" first_file=""
    while IFS= read -r org; do
        [[ -z "$org" ]] && continue
        local service_file="$TETRA_DIR/orgs/$org/tsm/services-available/${parsed_service}.tsm"
        if [[ -f "$service_file" ]]; then
            ((match_count++))
            if [[ $match_count -eq 1 ]]; then
                first_org="$org"
                first_file="$service_file"
            fi
        fi
    done < <(_tsm_get_orgs)

    if [[ $match_count -eq 0 ]]; then
        return 1
    fi

    if [[ $match_count -gt 1 ]]; then
        echo "⚠️  '$parsed_service' exists in $match_count orgs, using '$first_org'. Use org/service to be explicit." >&2
    fi

    _out_found_org="$first_org"
    _out_found_file="$first_file"
    return 0
}

# Get the TSM directory for a specific org
_tsm_org_dir() {
    local org="${1:-$TSM_DEFAULT_ORG}"
    echo "$TETRA_DIR/orgs/$org/tsm"
}

# List all available orgs
tetra_tsm_orgs() {
    echo "Available orgs:"
    local org
    for org in $(_tsm_get_orgs); do
        local count=$(ls -1 "$TETRA_DIR/orgs/$org/tsm/services-available"/*.tsm 2>/dev/null | wc -l | tr -d ' ')
        echo "  $org ($count services)"
    done
}

export -f _tsm_get_orgs
export -f _tsm_parse_service_ref
export -f _tsm_find_service
export -f _tsm_org_dir
export -f tetra_tsm_orgs
