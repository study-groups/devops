#!/usr/bin/env bash
# nhb_doctl.sh - doctl context management via nh_bridge
#
# Functions for listing, switching, and fetching doctl contexts.
# All output as JSON for API consumption.

# List doctl auth contexts (JSON output)
nhb_doctl_contexts() {
    local config_file="$HOME/Library/Application Support/doctl/config.yaml"
    [[ ! -f "$config_file" ]] && config_file="$HOME/.config/doctl/config.yaml"

    if [[ ! -f "$config_file" ]]; then
        echo '{"error": "doctl config not found", "contexts": []}'
        return 1
    fi

    # Parse auth-contexts from YAML
    local contexts=()
    local in_contexts=false

    while IFS= read -r line; do
        if [[ "$line" =~ ^auth-contexts: ]]; then
            in_contexts=true
            continue
        fi

        if $in_contexts; then
            # Stop at next top-level key
            [[ "$line" =~ ^[a-z] ]] && break

            # Extract context name (indented key ending with :)
            if [[ "$line" =~ ^[[:space:]]+([a-zA-Z0-9_-]+): ]]; then
                contexts+=("${BASH_REMATCH[1]}")
            fi
        fi
    done < "$config_file"

    # Output JSON
    printf '{"contexts": ['
    local first=true
    for ctx in "${contexts[@]}"; do
        $first || printf ','
        printf '"%s"' "$ctx"
        first=false
    done
    printf ']}\n'
}

# Get current doctl context name
nhb_doctl_current() {
    local config_file="$HOME/Library/Application Support/doctl/config.yaml"
    [[ ! -f "$config_file" ]] && config_file="$HOME/.config/doctl/config.yaml"

    if [[ ! -f "$config_file" ]]; then
        echo '{"error": "doctl config not found"}'
        return 1
    fi

    # Extract context from config
    local context
    context=$(grep "^context:" "$config_file" | head -1 | sed 's/context:[[:space:]]*//')

    if [[ -z "$context" ]]; then
        context="default"
    fi

    printf '{"current": "%s"}\n' "$context"
}

# Switch doctl context
# Usage: nhb_doctl_switch <context>
nhb_doctl_switch() {
    local context="$1"

    if [[ -z "$context" ]]; then
        echo '{"error": "context required"}'
        return 1
    fi

    # Use doctl if available
    if command -v doctl &>/dev/null; then
        if doctl auth switch --context "$context" 2>/dev/null; then
            printf '{"success": true, "context": "%s"}\n' "$context"
            return 0
        else
            printf '{"error": "failed to switch context", "context": "%s"}\n' "$context"
            return 1
        fi
    fi

    echo '{"error": "doctl not installed"}'
    return 1
}

# Fetch digocean.json for context
# Usage: nhb_doctl_fetch [context]
nhb_doctl_fetch() {
    local context="${1:-}"

    # If no context specified, get current
    if [[ -z "$context" ]]; then
        context=$(nhb_doctl_current | jq -r '.current // "default"')
    fi

    local json_file="$NH_DIR/$context/digocean.json"

    # Check if Nodeholder available
    if ! nhb_check_available; then
        echo '{"error": "Nodeholder not installed"}'
        return 1
    fi

    # Switch context and fetch
    local nh_dir
    nh_dir=$(nhb_get_location)

    (
        cd "$nh_dir" || exit 1
        source bash/doctl.sh

        # Switch context
        doctl auth switch --context "$context" 2>/dev/null

        # Fetch all
        nh_doctl_get_all 2>/dev/null
    )

    if [[ -f "$json_file" ]]; then
        local age
        age=$(nhb_get_json_age "$json_file")
        printf '{"success": true, "context": "%s", "file": "%s", "age_days": %d}\n' \
            "$context" "$json_file" "$age"
    else
        printf '{"error": "fetch failed", "context": "%s"}\n' "$context"
        return 1
    fi
}

# Get JSON status for context (age, exists, size)
# Usage: nhb_doctl_json_status <context>
nhb_doctl_json_status() {
    local context="$1"

    if [[ -z "$context" ]]; then
        echo '{"error": "context required"}'
        return 1
    fi

    local json_file="$NH_DIR/$context/digocean.json"

    if [[ ! -f "$json_file" ]]; then
        printf '{"exists": false, "context": "%s"}\n' "$context"
        return 0
    fi

    local age size droplets domains
    age=$(nhb_get_json_age "$json_file")
    size=$(stat -f%z "$json_file" 2>/dev/null || stat -c%s "$json_file" 2>/dev/null)

    # Count droplets and domains
    droplets=$(jq -r '.[0].Droplets | length // 0' "$json_file" 2>/dev/null || echo 0)
    domains=$(jq -r '.[0].Domains | length // 0' "$json_file" 2>/dev/null || echo 0)

    printf '{"exists": true, "context": "%s", "age_days": %d, "size_bytes": %d, "droplets": %d, "domains": %d}\n' \
        "$context" "$age" "${size:-0}" "${droplets:-0}" "${domains:-0}"
}

# List all contexts with their JSON status
nhb_doctl_contexts_full() {
    local contexts_json
    contexts_json=$(nhb_doctl_contexts)

    local current_json
    current_json=$(nhb_doctl_current)
    local current
    current=$(echo "$current_json" | jq -r '.current // ""')

    printf '{"current": "%s", "contexts": [' "$current"

    local first=true
    while read -r ctx; do
        [[ -z "$ctx" ]] && continue
        $first || printf ','
        first=false

        local status
        status=$(nhb_doctl_json_status "$ctx")
        local is_current="false"
        [[ "$ctx" == "$current" ]] && is_current="true"

        printf '{"name": "%s", "current": %s, "status": %s}' "$ctx" "$is_current" "$status"
    done < <(echo "$contexts_json" | jq -r '.contexts[]')

    printf ']}\n'
}
