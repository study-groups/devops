#!/usr/bin/env bash
# nhb_api.sh - nh_bridge API functions for server integration
#
# JSON output functions for API consumption.

# Get NH sync status for an org
# Usage: nhb_api_status <org>
nhb_api_status() {
    local org="$1"

    if [[ -z "$org" ]]; then
        echo '{"error": "org required"}'
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$org"
    local sections_dir="$org_dir/sections"
    local infra_toml="$sections_dir/10-infrastructure.toml"

    local has_infra=false
    local nh_source=""
    local last_import=""

    if [[ -f "$infra_toml" ]]; then
        has_infra=true

        # Extract NH source from comment in TOML
        nh_source=$(grep "^# Source:" "$infra_toml" 2>/dev/null | sed 's/^# Source: //')

        # Get file modification time
        if stat -f %m "$infra_toml" &>/dev/null; then
            last_import=$(stat -f %Sm -t "%Y-%m-%dT%H:%M:%S" "$infra_toml" 2>/dev/null)
        else
            last_import=$(stat -c %y "$infra_toml" 2>/dev/null | cut -d. -f1)
        fi
    fi

    printf '{"org": "%s", "has_infrastructure": %s, "nh_source": "%s", "last_import": "%s"}\n' \
        "$org" "$has_infra" "$nh_source" "$last_import"
}

# Get all contexts with metadata
nhb_api_contexts() {
    nhb_doctl_contexts_full
}

# Get infrastructure summary for a context
# Usage: nhb_api_infrastructure <context>
nhb_api_infrastructure() {
    local context="$1"

    if [[ -z "$context" ]]; then
        echo '{"error": "context required"}'
        return 1
    fi

    local json_file="$NH_DIR/$context/digocean.json"

    if [[ ! -f "$json_file" ]]; then
        printf '{"context": "%s", "exists": false}\n' "$context"
        return 0
    fi

    # Extract summary from digocean.json
    local droplets domains volumes ssh_keys
    droplets=$(jq '[.[0].Droplets[] | {name, region: .region.slug, status, ip: .networks.v4[0].ip_address}]' "$json_file" 2>/dev/null || echo '[]')
    domains=$(jq '[.[0].Domains[] | {name}]' "$json_file" 2>/dev/null || echo '[]')
    volumes=$(jq '[.[0].Volumes[] | {name, size_gigabytes, region: .region.slug}]' "$json_file" 2>/dev/null || echo '[]')
    ssh_keys=$(jq '[.[0].SSHKeys[] | {name, fingerprint}]' "$json_file" 2>/dev/null || echo '[]')

    printf '{"context": "%s", "exists": true, "droplets": %s, "domains": %s, "volumes": %s, "ssh_keys": %s}\n' \
        "$context" "$droplets" "$domains" "$volumes" "$ssh_keys"
}

# Validate TOML section content
# Usage: nhb_api_validate_section <content>
# Reads content from stdin if not provided
nhb_api_validate_section() {
    local content="$1"

    if [[ -z "$content" ]]; then
        content=$(cat)
    fi

    if [[ -z "$content" ]]; then
        echo '{"valid": false, "error": "empty content"}'
        return 1
    fi

    # Basic TOML validation
    local errors=()
    local line_num=0

    while IFS= read -r line; do
        ((line_num++))

        # Skip comments and empty lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ "$line" =~ ^[[:space:]]*$ ]] && continue

        # Check section headers
        if [[ "$line" =~ ^\[.*\]$ ]]; then
            # Valid section header
            continue
        fi

        # Check key-value pairs
        if [[ "$line" =~ ^[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*= ]]; then
            # Valid key = value
            continue
        fi

        # Check for array items
        if [[ "$line" =~ ^[[:space:]]*\".*\"[[:space:]]*,?$ ]]; then
            continue
        fi

        # Unknown line format - might be continuation
        if [[ "$line" =~ ^[[:space:]]+ ]]; then
            continue
        fi

        errors+=("line $line_num: unexpected format")
    done <<< "$content"

    if [[ ${#errors[@]} -eq 0 ]]; then
        echo '{"valid": true}'
    else
        printf '{"valid": false, "errors": ['
        local first=true
        for err in "${errors[@]}"; do
            $first || printf ','
            printf '"%s"' "$err"
            first=false
        done
        printf ']}\n'
        return 1
    fi
}

# List section files for an org
# Usage: nhb_api_sections <org>
nhb_api_sections() {
    local org="$1"

    if [[ -z "$org" ]]; then
        echo '{"error": "org required"}'
        return 1
    fi

    local sections_dir="$TETRA_DIR/orgs/$org/sections"

    if [[ ! -d "$sections_dir" ]]; then
        printf '{"org": "%s", "sections": []}\n' "$org"
        return 0
    fi

    printf '{"org": "%s", "sections": [' "$org"

    local first=true
    for f in "$sections_dir"/*.toml; do
        [[ -f "$f" ]] || continue
        $first || printf ','
        first=false

        local name size modified
        name=$(basename "$f")
        size=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null)

        if stat -f %m "$f" &>/dev/null; then
            modified=$(stat -f %Sm -t "%Y-%m-%dT%H:%M:%S" "$f" 2>/dev/null)
        else
            modified=$(stat -c %y "$f" 2>/dev/null | cut -d. -f1)
        fi

        printf '{"name": "%s", "size": %d, "modified": "%s"}' "$name" "${size:-0}" "$modified"
    done

    printf ']}\n'
}

# Get section content
# Usage: nhb_api_section_get <org> <section>
nhb_api_section_get() {
    local org="$1"
    local section="$2"

    if [[ -z "$org" || -z "$section" ]]; then
        echo '{"error": "org and section required"}'
        return 1
    fi

    local file="$TETRA_DIR/orgs/$org/sections/$section"

    if [[ ! -f "$file" ]]; then
        printf '{"error": "section not found", "org": "%s", "section": "%s"}\n' "$org" "$section"
        return 1
    fi

    local content
    content=$(cat "$file")

    # JSON-escape the content
    content=$(printf '%s' "$content" | jq -Rs '.')

    printf '{"org": "%s", "section": "%s", "content": %s}\n' "$org" "$section" "$content"
}

# Save section content
# Usage: nhb_api_section_put <org> <section> <content>
# Content can be passed via stdin
nhb_api_section_put() {
    local org="$1"
    local section="$2"
    local content="$3"

    if [[ -z "$org" || -z "$section" ]]; then
        echo '{"error": "org and section required"}'
        return 1
    fi

    if [[ -z "$content" ]]; then
        content=$(cat)
    fi

    local file="$TETRA_DIR/orgs/$org/sections/$section"
    local sections_dir="$TETRA_DIR/orgs/$org/sections"

    # Create sections dir if needed
    [[ -d "$sections_dir" ]] || mkdir -p "$sections_dir"

    # Validate first
    local validation
    validation=$(echo "$content" | nhb_api_validate_section)
    local valid
    valid=$(echo "$validation" | jq -r '.valid')

    if [[ "$valid" != "true" ]]; then
        echo "$validation"
        return 1
    fi

    # Write content
    printf '%s' "$content" > "$file"

    printf '{"success": true, "org": "%s", "section": "%s"}\n' "$org" "$section"
}
