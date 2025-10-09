#!/usr/bin/env bash

# Top status display with full equation rendering
# Shows the complete [Env x Mod][verb x noun] -> [tag:Type] equation

source "$DEMO_SRC/bash/tui/modules/colors/color_module.sh"

# Get result type based on verb:noun and mode configuration using unified @ types
get_result_type() {
    local verb="$1"
    local noun="$2"
    local mode="$3"

    # Mode-based result type mapping with Unix streams
    case "$mode:$verb:$noun" in
        "COLORS:show:palette") echo "stdout" ;;
        "COLORS:configure:"*) echo "file" ;;
        "COLORS:reset:"*) echo "file" ;;
        "TEST:test:"*) echo "stderr" ;;
        "TEST:cycle:"*) echo "pipe" ;;
        "LEARN:show:"*) echo "stdout" ;;
        "LEARN:analyze:"*) echo "stderr" ;;
        "LEARN:document:"*) echo "file" ;;
        *) echo "stdout" ;; # Default
    esac
}

# Get tag from mode configuration
get_mode_tag() {
    local mode="$1"
    local verb="$2"
    local noun="$3"

    # Generate tag based on mode.tag.output pattern
    case "$mode" in
        "COLORS") echo "palette" ;;
        "TEST") echo "result" ;;
        "LEARN") echo "info" ;;
        *) echo "output" ;;
    esac
}

# Unified @ type system for nouns and responses (Unix streams + extensions)
declare -A UNIFIED_TYPES=(
    # TUI Interface types -> Unix streams
    [header]="stdout"  # UI components -> standard output
    [input]="stdin"    # Input systems -> standard input
    [output]="stdout"  # Output systems -> standard output
    [repl]="dev"       # REPL systems -> development type

    # Data/Content types
    [palette]="data"   # Color/data structures
    [colors]="data"    # Color/data structures
    [symbols]="data"   # Symbol/data structures
    [demo]="stdout"    # Demo display -> standard output
    [default]="stdout" # Default fallback -> standard output

    # Standard Unix + extensions
    [config]="file"    # Configuration files
    [log]="file"       # Log files and diagnostics
    [error]="stderr"   # Error handling -> standard error
    [stream]="pipe"    # Pipe streams and data flow
    [backup]="file"    # Backup files
    [state]="file"     # State files
    [metrics]="pipe"   # Metrics streaming
)

# Map @ types to colors (Unix standard streams + extensions)
declare -A TYPE_COLORS=(
    # Unix standard streams
    [stdout]="0"   # Standard output - ENV palette color
    [stderr]="1"   # Standard error - MODE palette color
    [stdin]="2"    # Standard input - VERBS palette color
    [file]="3"     # File operations - NOUNS palette color

    # Extended types
    [pipe]="4"     # Pipe streams - complement color
    [dev]="5"      # Development tools - complement color
    [data]="6"     # Data structures - complement color
    [var]="7"      # Tetra variables - high contrast color
)

# Parse noun for @type format or ::tetraVar
parse_noun_components() {
    local noun="$1"
    local noun_type="" noun_value="" is_tetra_var=false at_type=""

    if [[ "$noun" == ::* ]]; then
        # Tetra variable: ::varName
        is_tetra_var=true
        noun_type="tetraVar"
        noun_value="${noun#::}"
        at_type="var"
    else
        # Map noun to unified @ type (sanitize for array access)
        local safe_noun="${noun//[^a-zA-Z0-9_]/_}"
        echo "DEBUG2: noun='$noun' safe_noun='$safe_noun'" >> /tmp/array_debug.log
        at_type="${UNIFIED_TYPES[$safe_noun]:-data}" 2>>/tmp/array_debug.log
        noun_type="$at_type"
        noun_value="$noun"
    fi

    echo "$noun_type $noun_value $is_tetra_var $at_type"
}

# Get tetra variable color (maximum distance from verb × noun using advanced algorithms)
get_tetra_var_color() {
    local var_name="$1"
    local verb_color="${CURRENT_COLOR_STATE[verb_color]}"
    local noun_bg="${CURRENT_COLOR_STATE[noun_bg]}"

    # Calculate maximum distance color using advanced three-way distance
    local optimal_color
    if [[ -n "$verb_color" && -n "$noun_bg" ]]; then
        # Use advanced algorithm for maximum perceptual separation
        optimal_color=$(find_max_distance_color_advanced "$verb_color" "$noun_bg" "ENV_PRIMARY" "three_way")
    elif [[ -n "$verb_color" ]]; then
        # Single color avoidance with contrast optimization
        optimal_color=$(find_max_distance_color_advanced "$verb_color" "" "ENV_PRIMARY" "contrast")
    else
        # Fallback to high-contrast color from palette
        optimal_color="${ENV_PRIMARY[5]}"
    fi

    # Apply tetra variable styling with distinctive appearance
    printf "\033[1m\033[4m"  # Bold + underline for tetra vars
    text_color "$optimal_color"
    printf "::%s" "$var_name"
    reset_color
}

# Render the TetraScript equation: ENV × Module / verb × @type[value] → @type[result]
render_equation() {
    local env="${1:-DEMO}"
    local mode="${2:-LEARN}"
    local verb="${3:-show}"
    local noun="${4:-demo}"

    local result_type=$(get_result_type "$verb" "$noun" "$mode")
    local tag=$(get_mode_tag "$mode" "$verb" "$noun")

    # Parse noun components
    read -r noun_type noun_value is_tetra_var < <(parse_noun_components "$noun")

    # Refresh color state for optimal separation
    refresh_color_state "$verb" "$noun_type"

    # ENV
    demo_env_text "selected"
    printf "%s" "$env"
    reset_color
    printf " × "

    # Module
    demo_mode_text "selected"
    printf "%s" "$mode"
    reset_color
    printf " / "

    # verb
    safe_verb_display "$verb"
    printf " × "

    # @type[value] input format
    if [[ "$is_tetra_var" == "true" ]]; then
        get_tetra_var_color "$noun_value"
        printf "@var[::%s]" "$noun_value"
        reset_color
    else
        # Sanitize noun_value for array access
        local safe_noun="${noun_value//[^a-zA-Z0-9_]/_}"
        # Ensure safe_noun is not empty
        if [[ -z "$safe_noun" ]]; then
            safe_noun="default"
        fi
        local at_type="${UNIFIED_TYPES[$safe_noun]:-stdout}"
        get_response_type_color "$at_type"
        printf "@%s[%s]" "$at_type" "$noun_value"
        reset_color
    fi

    printf " → "

    # @type[result] output format
    get_response_type_color "$result_type"
    printf "@%s[%s]" "$result_type" "$tag"
    reset_color
}

# Show current equation in header format
show_equation_header() {
    local env="${ENVIRONMENTS[$ENV_INDEX]:-DEMO}"
    local mode="${MODES[$MODE_INDEX]:-LEARN}"
    local actions=($(get_actions))

    if [[ ${#actions[@]} -gt 0 && $ACTION_INDEX -lt ${#actions[@]} ]]; then
        local action="${actions[$ACTION_INDEX]}"
        if [[ "$action" == *:* ]]; then
            local verb="${action%%:*}"
            local noun="${action##*:}"

            echo "Current Equation:"
            render_equation "$env" "$mode" "$verb" "$noun"
            echo
        fi
    fi
}

# Status line for top of screen
render_top_status() {
    local term_width=${COLUMNS:-80}

    # Left: Equation
    local equation=$(render_equation "${ENVIRONMENTS[$ENV_INDEX]}" "${MODES[$MODE_INDEX]}" "show" "demo")

    # Right: Context info
    local context="demo/basic/010 | $(date '+%H:%M:%S')"

    # Calculate spacing
    local equation_clean=$(echo "$equation" | sed 's/\x1b\[[0-9;]*m//g')  # Strip ANSI codes
    local equation_len=${#equation_clean}
    local context_len=${#context}
    local spacing=$((term_width - equation_len - context_len))
    [[ $spacing -lt 1 ]] && spacing=1

    printf "%s%*s%s" "$equation" $spacing "" "$context"
    echo
}

# Demo function to show various equations
demo_equations() {
    echo "=== Equation System Demo ==="
    echo

    local examples=(
        "DEMO:LEARN:show:palette"
        "MODULES:TEST:test:colors"
        "TUI:COLORS:configure:theme"
        "DEMO:LEARN:analyze:header"
    )

    for example in "${examples[@]}"; do
        IFS=':' read -r env mode verb noun <<< "$example"
        render_equation "$env" "$mode" "$verb" "$noun"
        echo
    done
}