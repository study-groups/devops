#!/usr/bin/env bash

# Action Registry with Routing Annotations + State Machine
# Demo 012: Actions declare routing, execution mode, and capabilities

# Explicit action registry (avoids iteration issues)
declare -a ACTION_REGISTRY=(
    "show_demo"
    "show_help"
    "show_routes"
    "configure_demo"
    "test_demo"
    "show_config"
)

# Helper function to declare actions
declare_action() {
    local action_name="$1"
    shift

    # Create associative array for this action
    declare -gA "ACTION_${action_name}"
    local -n action_def="ACTION_${action_name}"

    # Default values
    action_def[state]="idle"
    action_def[immediate]="true"
    action_def[inputs]=""
    action_def[output]=""
    action_def[effects]=""
    action_def[can]=""
    action_def[cannot]=""

    # Parse key=value pairs
    while [[ $# -gt 0 ]]; do
        local key="${1%%=*}"
        local value="${1#*=}"
        action_def["$key"]="$value"
        shift
    done
}

# Register actions with routing annotations + state machine fields

# Simple content display (immediate execution)
declare_action "show_demo" \
    "verb=show" \
    "noun=demo" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=" \
    "immediate=true" \
    "can=Display demo information and routing examples" \
    "cannot=Modify system state or configuration"

# Show help (immediate)
declare_action "show_help" \
    "verb=show" \
    "noun=help" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=" \
    "immediate=true" \
    "can=Display navigation help and keyboard shortcuts" \
    "cannot=Execute actions or change settings"

# Show routing table (immediate, output + effects)
declare_action "show_routes" \
    "verb=show" \
    "noun=routes" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=@tui[footer]" \
    "immediate=true" \
    "can=Display all registered action signatures" \
    "cannot=Modify action registry"

# Configure demo (deferred execution)
declare_action "configure_demo" \
    "verb=configure" \
    "noun=demo" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=@app[stdout]" \
    "immediate=false" \
    "can=Update demo configuration settings" \
    "cannot=Access system files or deploy to remote servers"

# Test with multiple effects (deferred)
declare_action "test_demo" \
    "verb=test" \
    "noun=demo" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=@tui[footer],@app[stdout]" \
    "immediate=false" \
    "can=Validate action registry and routing system" \
    "cannot=Modify production systems or external services"

# Show config (immediate)
declare_action "show_config" \
    "verb=show" \
    "noun=config" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=" \
    "immediate=true" \
    "can=Display current TUI configuration values" \
    "cannot=Persist changes to disk"

# Get action signature (defensive)
get_action_signature() {
    local action="$1"
    local action_name="${action//:/_}"

    # Validate action exists
    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        echo "@tui[content]"  # default
        return
    fi

    local -n _action_ref="ACTION_${action_name}"

    # Build full signature
    local output="${_action_ref[output]:-@tui[content]}"

    echo "$output"
}

# Get all routing targets (output + effects)
get_action_routes() {
    local action="$1"
    local action_name="${action//:/_}"

    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        echo "@tui[content]"
        return
    fi

    local -n _action_ref="ACTION_${action_name}"
    local output="${_action_ref[output]}"
    local effects="${_action_ref[effects]}"

    if [[ -n "$effects" ]]; then
        echo "${output},${effects}"
    else
        echo "$output"
    fi
}

# List all registered actions with signatures (DEFENSIVE - fixes 3:3 bug)
list_action_signatures() {
    echo "Action Registry - Routing Signatures"
    echo "────────────────────────────────────────"
    echo ""

    # Use explicit registry to avoid iteration issues
    for action_name in "${ACTION_REGISTRY[@]}"; do
        # Validate action exists
        if ! declare -p "ACTION_${action_name}" &>/dev/null; then
            continue
        fi

        # Use unique nameref name to avoid collisions
        local -n _reg_action="ACTION_${action_name}"

        # Validate required fields
        [[ -z "${_reg_action[verb]}" || -z "${_reg_action[noun]}" ]] && continue

        local verb="${_reg_action[verb]}"
        local noun="${_reg_action[noun]}"
        local inputs="${_reg_action[inputs]}"
        local output="${_reg_action[output]}"
        local effects="${_reg_action[effects]}"
        local immediate="${_reg_action[immediate]}"

        # Build signature
        local input_sig="(${inputs})"
        local output_sig="$output"
        [[ -n "$effects" ]] && output_sig="$output where $effects"

        # Show signature with execution mode indicator
        local mode_indicator=""
        if [[ "$immediate" == "true" ]]; then
            mode_indicator=" [auto]"
        else
            mode_indicator=" [manual]"
        fi

        printf "  %-20s $ENDPOINT_OP %-45s%s\n" "$verb:$noun" "$input_sig $FLOW_OP $output_sig" "$mode_indicator"
    done
}
