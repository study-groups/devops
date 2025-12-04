#!/usr/bin/env bash
# TRS Integration for TAS
# Org-aware record writing following TRS specification

# Current org context (set by org switch or export TAS_ORG=...)
declare -g TAS_ORG="${TAS_ORG:-}"

# Get current org from environment or org module
tas_get_org() {
    # Explicit TAS_ORG takes precedence
    if [[ -n "$TAS_ORG" ]]; then
        echo "$TAS_ORG"
        return 0
    fi

    # Try org_active function if available
    if type org_active &>/dev/null; then
        local active=$(org_active 2>/dev/null)
        if [[ -n "$active" && "$active" != "none" ]]; then
            echo "$active"
            return 0
        fi
    fi

    # Try TETRA_ORG env var
    if [[ -n "$TETRA_ORG" ]]; then
        echo "$TETRA_ORG"
        return 0
    fi

    # No org context
    return 1
}

# Set org context
tas_set_org() {
    local org="$1"

    if [[ -z "$org" ]]; then
        echo "Error: tas_set_org requires org name" >&2
        return 1
    fi

    # Validate org exists
    local org_dir="$TETRA_DIR/orgs/$org"
    if [[ ! -d "$org_dir" ]]; then
        echo "Error: Org not found: $org" >&2
        echo "Available orgs:" >&2
        ls "$TETRA_DIR/orgs/" 2>/dev/null | sed 's/^/  /'
        return 1
    fi

    TAS_ORG="$org"
    export TAS_ORG
    echo "Org context set: $org" >&2
}

# Clear org context
tas_clear_org() {
    TAS_ORG=""
    export TAS_ORG
}

# Get TRS db path for current context
# Usage: trs_get_db_path [module]
# If org context: $TETRA_DIR/orgs/{org}/db/
# If no org context: $TETRA_DIR/{module}/db/
trs_get_db_path() {
    local module="${1:-}"
    local org=$(tas_get_org)

    if [[ -n "$org" ]]; then
        # Org-scoped path
        echo "$TETRA_DIR/orgs/$org/db"
    elif [[ -n "$module" ]]; then
        # Module-scoped path
        echo "$TETRA_DIR/$module/db"
    else
        echo "Error: No org context and no module specified" >&2
        return 1
    fi
}

# Write a TRS record
# Usage: trs_write_record type kind format data [module]
# Returns: Path to written record
trs_write_record() {
    local type="$1"
    local kind="$2"
    local format="$3"
    local data="$4"
    local module="${5:-}"

    if [[ -z "$type" || -z "$kind" || -z "$format" ]]; then
        echo "Error: trs_write_record requires type, kind, format" >&2
        return 1
    fi

    # Get db path
    local db_path=$(trs_get_db_path "$module")
    if [[ $? -ne 0 ]]; then
        return 1
    fi

    # Create directory if needed
    mkdir -p "$db_path"

    # Generate filename
    local timestamp=$(date +%s)
    local filename="${timestamp}.${type}.${kind}.${format}"
    local filepath="$db_path/$filename"

    # Write data
    echo "$data" > "$filepath"

    echo "$filepath"
}

# Write deployment receipt
# Usage: trs_write_deploy_receipt env symbol host duration_ms [extra_json]
trs_write_deploy_receipt() {
    local env="$1"
    local symbol="$2"
    local host="$3"
    local duration_ms="$4"
    local extra_json="${5:-}"

    local org=$(tas_get_org)
    if [[ -z "$org" ]]; then
        echo "Error: Deployment receipts require org context" >&2
        return 1
    fi

    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local unix_ts=$(date +%s)

    # Build receipt content
    local receipt
    receipt=$(cat <<EOF
# Deployment Record (TRS)
# Organization: $org
# Environment:  $env

[metadata]
timestamp = "$timestamp"
environment = "$env"
symbol = "$symbol"
deployed_by = "$USER"
hostname = "$(hostname -s)"
duration_ms = $duration_ms

[tes_resolution]
symbol = "$symbol"
host = "$host"

[status]
state = "deployed"
validated = true
EOF
)

    # Write to org's db/
    local db_path="$TETRA_DIR/orgs/$org/db"
    mkdir -p "$db_path"

    local filename="${unix_ts}.deploy.${env}.toml"
    local filepath="$db_path/$filename"

    echo "$receipt" > "$filepath"

    echo "$filepath"
}

# Get non-canonical path with explicit org
# Usage: trs_noncanonical_path original_path dest_dir
# Adds org to filename when moving outside canonical location
trs_noncanonical_path() {
    local original="$1"
    local dest_dir="$2"

    local filename=$(basename "$original")
    local org=$(tas_get_org)

    # If org context, insert org after timestamp
    if [[ -n "$org" && "$filename" =~ ^([0-9]+)\. ]]; then
        local timestamp="${BASH_REMATCH[1]}"
        local rest="${filename#*.}"
        filename="${timestamp}.${org}.${rest}"
    fi

    echo "$dest_dir/$filename"
}

# Query records across orgs
# Usage: trs_query_all type [kind]
trs_query_all() {
    local type="$1"
    local kind="${2:-*}"

    find "$TETRA_DIR"/orgs/*/db/ -name "*.${type}.${kind}.*" 2>/dev/null
}

# Query records for current org
# Usage: trs_query type [kind]
trs_query() {
    local type="$1"
    local kind="${2:-*}"
    local org=$(tas_get_org)

    if [[ -z "$org" ]]; then
        echo "Error: trs_query requires org context" >&2
        return 1
    fi

    find "$TETRA_DIR/orgs/$org/db/" -name "*.${type}.${kind}.*" 2>/dev/null
}

# Get latest record of type
# Usage: trs_latest type [kind]
trs_latest() {
    local type="$1"
    local kind="${2:-*}"

    trs_query "$type" "$kind" | sort -r | head -1
}

# Export globals
export TAS_ORG

# Export functions
export -f tas_get_org
export -f tas_set_org
export -f tas_clear_org
export -f trs_get_db_path
export -f trs_write_record
export -f trs_write_deploy_receipt
export -f trs_noncanonical_path
export -f trs_query_all
export -f trs_query
export -f trs_latest
