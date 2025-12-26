#!/usr/bin/env bash

# TSM Controls Integration
# Parse controls.json for automatic input routing setup (TDP)

# Validate controls.json structure
# Usage: tsm_controls_validate <controls_file>
tsm_controls_validate() {
    local controls_file="$1"

    if [[ ! -f "$controls_file" ]]; then
        echo "ERROR: File not found: $controls_file" >&2
        return 1
    fi

    # Check for valid JSON
    if ! jq empty "$controls_file" 2>/dev/null; then
        echo "ERROR: Invalid JSON in $controls_file" >&2
        return 1
    fi

    # Check required fields
    local name
    name=$(jq -r '.name // empty' "$controls_file" 2>/dev/null)
    if [[ -z "$name" ]]; then
        echo "ERROR: Missing 'name' field" >&2
        return 1
    fi

    local actions_count
    actions_count=$(jq -r '.actions | length' "$controls_file" 2>/dev/null)
    if [[ "$actions_count" == "0" || -z "$actions_count" ]]; then
        echo "ERROR: No actions defined" >&2
        return 1
    fi

    echo "OK: $name with $actions_count actions"
    return 0
}

# Get all action names from controls.json
# Usage: tsm_controls_get_actions <controls_file>
tsm_controls_get_actions() {
    local controls_file="${1:-controls.json}"
    jq -r '.actions | keys[]' "$controls_file" 2>/dev/null
}

# Get action details as JSON
# Usage: tsm_controls_get_action <controls_file> <action_name>
tsm_controls_get_action() {
    local controls_file="$1"
    local action="$2"
    jq -r ".actions.\"$action\"" "$controls_file" 2>/dev/null
}

# Get MIDI mapping for a specific action
# Usage: tsm_controls_get_midi_mapping <controls_file> <action_name>
tsm_controls_get_midi_mapping() {
    local controls_file="$1"
    local action="$2"
    jq -r ".defaults.midi.\"$action\" // empty" "$controls_file" 2>/dev/null
}

# Get all MIDI CC numbers used in controls.json
# Usage: tsm_controls_get_midi_ccs <controls_file>
tsm_controls_get_midi_ccs() {
    local controls_file="$1"

    jq -r '
        .defaults.midi // {} |
        to_entries |
        map(.value | select(type == "object")) |
        map(.left_cc // empty, .right_cc // empty, .cc // empty) |
        flatten | unique | sort[]
    ' "$controls_file" 2>/dev/null
}

# Generate midi-mp subscription filter from controls.json
# Usage: tsm_controls_to_midi_filter <controls_file>
tsm_controls_to_midi_filter() {
    local controls_file="$1"
    local ccs
    ccs=$(tsm_controls_get_midi_ccs "$controls_file" | tr '\n' ',')
    ccs="${ccs%,}"  # Remove trailing comma
    echo "$ccs"
}

# Generate OSC address patterns from controls.json
# Usage: tsm_controls_to_osc_patterns <controls_file> [channel]
tsm_controls_to_osc_patterns() {
    local controls_file="$1"
    local channel="${2:-1}"

    local ccs
    ccs=$(tsm_controls_get_midi_ccs "$controls_file")

    local patterns=()
    while IFS= read -r cc; do
        [[ -n "$cc" ]] && patterns+=("/midi/raw/cc/$channel/$cc")
    done <<< "$ccs"

    printf '%s\n' "${patterns[@]}"
}

# Get gamepad mappings from controls.json
# Usage: tsm_controls_get_gamepad_mappings <controls_file>
tsm_controls_get_gamepad_mappings() {
    local controls_file="$1"
    jq -r '.defaults.gamepad // {}' "$controls_file" 2>/dev/null
}

# Get transform definition
# Usage: tsm_controls_get_transform <controls_file> <transform_name>
tsm_controls_get_transform() {
    local controls_file="$1"
    local transform="$2"
    jq -r ".transforms.\"$transform\" // empty" "$controls_file" 2>/dev/null
}

# Get TDP configuration section
# Usage: tsm_controls_get_tdp <controls_file>
tsm_controls_get_tdp() {
    local controls_file="$1"
    # Support both 'tdp' (new) and 'tucp' (legacy) section names
    jq -r '.tdp // .tucp // empty' "$controls_file" 2>/dev/null
}

# Check if controls.json has TDP section
# Usage: tsm_controls_has_tdp <controls_file>
tsm_controls_has_tdp() {
    local controls_file="$1"
    local tdp
    # Support both 'tdp' (new) and 'tucp' (legacy) section names
    tdp=$(jq -r '.tdp // .tucp // empty' "$controls_file" 2>/dev/null)
    [[ -n "$tdp" && "$tdp" != "null" ]]
}

# Get TDP topic from controls.json
# Usage: tsm_controls_get_tdp_topic <controls_file>
tsm_controls_get_tdp_topic() {
    local controls_file="$1"
    # Support both 'tdp' (new) and 'tucp' (legacy) section names
    jq -r '.tdp.topic // .tucp.topic // .tucp.channel // empty' "$controls_file" 2>/dev/null
}

# Get TDP publish topics from controls.json
# Usage: tsm_controls_get_tdp_publish <controls_file>
tsm_controls_get_tdp_publish() {
    local controls_file="$1"
    # Support both 'tdp' (new) and 'tucp' (legacy) section names
    jq -r '(.tdp.publish // .tucp.topics // []) | join(",")' "$controls_file" 2>/dev/null
}

# Get TDP subscribe patterns from controls.json
# Usage: tsm_controls_get_tdp_subscribe <controls_file>
tsm_controls_get_tdp_subscribe() {
    local controls_file="$1"
    # Support both 'tdp' (new) and 'tucp' (legacy) section names
    jq -r '(.tdp.subscribe // .tucp.subscribe // []) | join(",")' "$controls_file" 2>/dev/null
}

# Display controls.json summary
# Usage: tsm_controls_info <controls_file>
tsm_controls_info() {
    local controls_file="$1"

    if [[ ! -f "$controls_file" ]]; then
        echo "File not found: $controls_file" >&2
        return 1
    fi

    local name version description
    name=$(jq -r '.name // "unknown"' "$controls_file")
    version=$(jq -r '.version // "0.0.0"' "$controls_file")
    description=$(jq -r '.description // ""' "$controls_file")

    echo "Controls: $name v$version"
    [[ -n "$description" ]] && echo "  $description"
    echo ""

    echo "Actions:"
    local actions
    actions=$(tsm_controls_get_actions "$controls_file")
    while IFS= read -r action; do
        local type
        type=$(jq -r ".actions.\"$action\".type // \"trigger\"" "$controls_file")
        printf "  %-20s (%s)\n" "$action" "$type"
    done <<< "$actions"
    echo ""

    echo "Input Sources:"
    local has_keyboard has_midi has_gamepad
    has_keyboard=$(jq -r '.defaults.keyboard // empty | length' "$controls_file")
    has_midi=$(jq -r '.defaults.midi // empty | length' "$controls_file")
    has_gamepad=$(jq -r '.defaults.gamepad // empty | length' "$controls_file")

    [[ -n "$has_keyboard" && "$has_keyboard" != "0" ]] && echo "  - Keyboard ($has_keyboard mappings)"
    [[ -n "$has_midi" && "$has_midi" != "0" ]] && echo "  - MIDI ($has_midi mappings)"
    [[ -n "$has_gamepad" && "$has_gamepad" != "0" ]] && echo "  - Gamepad ($has_gamepad mappings)"
    echo ""

    if tsm_controls_has_tdp "$controls_file"; then
        echo "TDP Configuration:"
        local topic publish subscribe
        topic=$(tsm_controls_get_tdp_topic "$controls_file")
        publish=$(tsm_controls_get_tdp_publish "$controls_file")
        subscribe=$(tsm_controls_get_tdp_subscribe "$controls_file")

        [[ -n "$topic" ]] && echo "  Topic: $topic"
        [[ -n "$publish" ]] && echo "  Publish: $publish"
        [[ -n "$subscribe" ]] && echo "  Subscribe: $subscribe"
    else
        echo "TDP: Not configured (using legacy MIDI detection)"
        local ccs
        ccs=$(tsm_controls_get_midi_ccs "$controls_file" | tr '\n' ',' | sed 's/,$//')
        [[ -n "$ccs" ]] && echo "  Detected CCs: $ccs"
    fi
}

# Export functions
export -f tsm_controls_validate
export -f tsm_controls_get_actions
export -f tsm_controls_get_action
export -f tsm_controls_get_midi_mapping
export -f tsm_controls_get_midi_ccs
export -f tsm_controls_to_midi_filter
export -f tsm_controls_to_osc_patterns
export -f tsm_controls_get_gamepad_mappings
export -f tsm_controls_get_transform
export -f tsm_controls_get_tdp
export -f tsm_controls_has_tdp
export -f tsm_controls_get_tdp_topic
export -f tsm_controls_get_tdp_publish
export -f tsm_controls_get_tdp_subscribe
export -f tsm_controls_info
