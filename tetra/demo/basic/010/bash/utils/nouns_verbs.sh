#!/usr/bin/env bash

# Demo 010: TUI Mechanics Documentation System
# Pattern: verb × noun → module output for demo TUI mechanics

# Demo Noun categories (TUI components - using NOUNS palette colors)
declare -A NOUNS=(
    [demo]="0"        # Main demo application logic
    [colors]="1"      # Color palettes and themes
    [input]="2"       # Keyboard navigation and controls
    [tui]="3"         # TUI layout, padding, and rendering
    [Module]="4"      # Module system inspection
    [inspect]="5"     # Development introspection tools
)

# Demo Verb categories (TUI operations - using VERBS palette colors)
declare -A VERBS=(
    [show]="0"        # Display, render, present
    [configure]="1"   # Setup, customize, adjust
    [test]="2"        # Validate, check, verify
)

# Environment capabilities (App vs Dev contexts)
declare -A ENV_NOUNS=(
    [APP]="demo,colors,input,tui"        # App environment: user-facing features only
    [DEV]="demo,colors,input,tui,Module,inspect"  # Dev environment: all features + dev tools + testing
)

# Mode operations (Demo learning modes + Tetra Modules + Test mode)
declare -A MODE_VERBS=(
    [Learn]="show"                       # Learning: show only (exploration)
    [Try]="show,configure"               # Trying: show + configure (hands-on)
    [Tui]="show,configure,test"          # TUI Module: full development actions
    [Dmod]="show,configure,test"         # Demo Module manager: full development actions
    [Test]="show"                        # Test mode: single verb for TDD debugging (1 action)
)

# Environment-Mode compatibility matrix
declare -A ENV_MODE_COMPAT=(
    [APP]="Learn,Try"                    # App: user-focused modes only
    [DEV]="Learn,Try,Tui,Dmod,Test"      # Dev: all modes including testing
)

# Get compatible modes for current environment
get_compatible_modes() {
    local env="$1"
    local compatible_modes_str="${ENV_MODE_COMPAT[$env]:-LEARN,TEST,COLORS}"
    echo "${compatible_modes_str//,/ }"
}

# Check if mode is compatible with environment
is_mode_compatible() {
    local env="$1"
    local mode="$2"
    local compatible_modes=$(get_compatible_modes "$env")
    [[ " $compatible_modes " == *" $mode "* ]]
}

# Action execution modes
declare -A ACTION_EXECUTION_MODES=(
    # Immediate actions (execute on selection, no return key needed)
    ["show:header"]="immediate"
    ["show:palette"]="immediate"
    ["show:colors"]="immediate"
    ["show:demo"]="immediate"
    ["show:tui"]="immediate"            # TEST mode action - minimal TUI test
    ["cycle:header"]="immediate"
    ["cycle:colors"]="immediate"
    ["toggle:colors"]="immediate"
    ["reset:colors"]="immediate"

    # Return-required actions (need return key confirmation)
    ["test:header"]="return"
    ["test:palette"]="return"
    ["test:colors"]="return"
    ["configure:colors"]="return"
    ["configure:palette"]="return"
    ["analyze:header"]="return"
    ["document:demo"]="return"

    # Confirm-required actions (need additional confirmation)
    ["reset:demo"]="confirm"
    ["configure:demo"]="confirm"
)

# Demo Action outputs - what each verb×noun combination produces
# Format: "verb:noun" -> "module output description"
declare -A ACTION_VIEWS=(
    # Show actions (display TUI components)
    ["show:header"]="Display 4-line navigation header with ENV/MODE/ACTION selectors"
    ["show:palette"]="Render color palette examples with progressive desaturation"
    ["show:input"]="Show keyboard navigation help and control mapping"
    ["show:output"]="Display screen layout with header, content, and footer regions"
    ["show:repl"]="Present REPL prompt with command history and completion"
    ["show:colors"]="Show current color theme and palette assignments"
    ["show:symbols"]="Display Unicode symbol sets used in TUI decorations"
    ["show:demo"]="Present main demo application with all components active"
    ["show:tui"]="TEST mode: Minimal TUI stability validation with diagnostic output"

    # Test actions (validate TUI mechanics)
    ["test:header"]="Validate navigation state and selector synchronization"
    ["test:palette"]="Check color function outputs and theme consistency"
    ["test:input"]="Test keyboard event handling and navigation responses"
    ["test:output"]="Verify screen buffer rendering and terminal compatibility"
    ["test:repl"]="Test command parsing and REPL integration"
    ["test:colors"]="Validate color calculations and accessibility compliance"
    ["test:symbols"]="Check Unicode support and terminal character rendering"
    ["test:demo"]="Run complete demo validation and integration tests"

    # Cycle actions (navigate through options)
    ["cycle:header"]="Navigate through ENV→MODE→ACTION selection states"
    ["cycle:palette"]="Iterate through available color themes and palettes"
    ["cycle:input"]="Demonstrate gamepad vs REPL mode transitions"
    ["cycle:output"]="Show different layout configurations and sizes"
    ["cycle:repl"]="Cycle through REPL command history and completions"
    ["cycle:colors"]="Rotate through color themes (dark, light, solarized)"
    ["cycle:symbols"]="Browse symbol categories (solid, outline, mixed)"
    ["cycle:demo"]="Tour all demo features and capabilities"

    # Configure actions (customize TUI behavior)
    ["configure:header"]="Adjust header layout and information display"
    ["configure:palette"]="Customize color assignments and create themes"
    ["configure:input"]="Map keyboard shortcuts and navigation preferences"
    ["configure:output"]="Set screen regions, footer size, and layout options"
    ["configure:repl"]="Configure command prompt, history, and completion"
    ["configure:colors"]="Create custom color palettes and theme variants"
    ["configure:symbols"]="Select symbol sets and Unicode preferences"
    ["configure:demo"]="Adjust demo timing, content, and presentation"
)

# Get color for a noun (returns NOUNS palette index)
get_noun_color() {
    local noun="$1"
    echo "${NOUNS[$noun]:-0}"
}

# Get color for a verb (returns VERBS palette index)
get_verb_color() {
    local verb="$1"
    echo "${VERBS[$verb]:-0}"
}

# Get available nouns for an environment
get_env_nouns() {
    local env="$1"
    # Return individual nouns on separate lines to avoid multi-word issues
    echo "${ENV_NOUNS[$env]}" | tr ',' '\n'
}

# Get available verbs for a mode
get_mode_verbs() {
    local mode="$1"
    # Return individual verbs on separate lines for consistency
    echo "${MODE_VERBS[$mode]}" | tr ',' '\n'
}

# Parse collection syntax: [noun1,noun2,noun3]
parse_collection_syntax() {
    local input="$1"

    # Check if input matches collection syntax
    if [[ "$input" =~ ^\[([^]]+)\]$ ]]; then
        local noun_list="${BASH_REMATCH[1]}"
        # Convert comma-separated to newline-separated for array processing
        echo "$noun_list" | tr ',' '\n'
        return 0
    fi

    return 1
}

# Generate actions for collection syntax: verb [noun1,noun2,noun3]
generate_collection_actions() {
    local verb="$1"
    local collection_expr="$2"

    local collection_nouns=($(parse_collection_syntax "$collection_expr"))
    if [[ $? -ne 0 ]]; then
        echo "Error: Invalid collection syntax: $collection_expr" >&2
        return 1
    fi

    # Generate verb:noun for each noun in collection
    for noun in "${collection_nouns[@]}"; do
        # Trim whitespace
        noun="${noun#"${noun%%[![:space:]]*}"}"
        noun="${noun%"${noun##*[![:space:]]}"}"
        echo "$verb:$noun"
    done
}

# Check if input uses collection syntax
is_collection_syntax() {
    local input="$1"
    [[ "$input" =~ ^\[.*\]$ ]]
}

# Get execution mode for an action
get_action_execution_mode() {
    local verb="$1"
    local noun="$2"
    echo "${ACTION_EXECUTION_MODES[$verb:$noun]:-return}"  # Default to return mode
}

# Check if action is immediate (executes on selection)
is_immediate_action() {
    local verb="$1"
    local noun="$2"
    local mode=$(get_action_execution_mode "$verb" "$noun")
    [[ "$mode" == "immediate" ]]
}

# Get description for an action:view combination
get_action_description() {
    local verb="$1"
    local noun="$2"
    echo "${ACTION_VIEWS[$verb:$noun]:-No description available}"
}

# List all verb:noun combinations for current ENV:MODE
list_available_actions() {
    local env="$1"
    local mode="$2"

    local env_nouns=($(get_env_nouns "$env"))
    local mode_verbs=($(get_mode_verbs "$mode"))

    echo "Available actions for $env:$mode:"
    echo "================================"

    for verb in "${mode_verbs[@]}"; do
        for noun in "${env_nouns[@]}"; do
            local verb_color_idx=$(get_verb_color "$verb")
            local noun_color_idx=$(get_noun_color "$noun")
            local description=$(get_action_description "$verb" "$noun")

            # Color the verb:noun pair using their respective palette colors
            printf "$(verbs_color $verb_color_idx)%s$(reset_color):$(nouns_color $noun_color_idx)%s$(reset_color) - %s\n" \
                "$verb" "$noun" "$description"
        done
    done
}

# Demo function to show the system in action
demo_nouns_verbs() {
    echo "Nouns and Verbs Documentation System"
    echo "===================================="
    echo

    # Show color mapping
    echo "Noun Categories (NOUNS palette):"
    for noun in "${!NOUNS[@]}"; do
        local color_idx="${NOUNS[$noun]}"
        printf "  $(nouns_color $color_idx)%s$(reset_color) (color %d)\n" "$noun" "$color_idx"
    done
    echo

    echo "Verb Categories (VERBS palette):"
    for verb in "${!VERBS[@]}"; do
        local color_idx="${VERBS[$verb]}"
        printf "  $(verbs_color $color_idx)%s$(reset_color) (color %d)\n" "$verb" "$color_idx"
    done
    echo

    # Show environment-specific capabilities
    echo "Environment Capabilities:"
    for env in DEMO LOCAL REMOTE; do
        echo "  $env: $(get_env_nouns "$env")"
    done
    echo

    echo "Mode Actions:"
    for mode in LEARN BUILD TEST; do
        echo "  $mode: $(get_mode_verbs "$mode")"
    done
    echo

    # Show example action combinations
    echo "Example: DEMO:LEARN combinations:"
    list_available_actions "DEMO" "LEARN"
}

# Source color system if not already loaded
if ! command -v reset_color >/dev/null 2>&1; then
    source "./colors.sh" 2>/dev/null || echo "Warning: Color system not available"
fi

# Run demo if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    demo_nouns_verbs
fi