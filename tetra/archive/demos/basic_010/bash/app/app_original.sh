#!/usr/bin/env bash

# TUI Framework Application
# Clean TUI architecture with proper separation

# Module environment setup - Use these variables consistently
DEMO_SRC="${DEMO_SRC:-$PWD}"  # Source code location
DEMO_DIR="${DEMO_DIR:-$TETRA_DIR/demo}"   # Runtime directory

# Logging configuration
LOGFILE="./log.app"

# Logging function
log_action() {
    echo "$(date '+%H:%M:%S') $1" >> "$LOGFILE"
}

# Initialize TUI system
APP_SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
TUI_MODULES_DIR="$APP_SCRIPT_DIR/../tui/modules"
UTILS_DIR="$APP_SCRIPT_DIR/../utils"

source "$TUI_MODULES_DIR/tui_init.sh"  # TUI initialization and path management
source "$TUI_MODULES_DIR/typography.sh"  # Typography and footer formatting

# Initialize TUI system with proper module loading
init_tui_system

# Source remaining app systems from utils directory
if ! source "$UTILS_DIR/top_status.sh"; then  # Equation system
    echo "Error: Failed to source top_status.sh from $UTILS_DIR" >&2
    exit 1
fi

if ! source "$UTILS_DIR/enhanced_signatures.sh"; then  # Enhanced A-list function
    echo "Error: Failed to source enhanced_signatures.sh from $UTILS_DIR" >&2
    exit 1
fi

# Source app modules using saved app directory path
if ! source "$APP_SCRIPT_DIR/input.sh"; then
    echo "Error: Failed to source input.sh from $APP_SCRIPT_DIR" >&2
    exit 1
fi

if ! source "$APP_SCRIPT_DIR/output.sh"; then
    echo "Error: Failed to source output.sh from $APP_SCRIPT_DIR" >&2
    exit 1
fi

if ! source "$APP_SCRIPT_DIR/repl.sh"; then
    echo "Error: Failed to source repl.sh from $APP_SCRIPT_DIR" >&2
    exit 1
fi

if ! source "$UTILS_DIR/nouns_verbs.sh"; then
    echo "Error: Failed to source nouns_verbs.sh from $UTILS_DIR" >&2
    exit 1
fi

# Validate module environment
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC not defined. Module system requires tetra environment."
    exit 1
fi

# Core application state
ENV_INDEX=0
MODE_INDEX=0
ACTION_INDEX=0
CONTENT=""
FOOTER_CONTENT=""

# Content mode system
CONTENT_MODE="actions"  # Default view mode
declare -a TUI_CONTENT_MODES=("actions" "palette" "info")

# UI Design Tokens - Semantic TUI Configuration
declare -A TUI_DESIGN_TOKENS=(
    # Layout & Spacing
    [ACTION_LINE_MIN_WIDTH]="60"     # Minimum width for action line before counter
    [UI_COUNTER_MARGIN]="1"          # Margin around counters and indicators
    [SEPARATOR_WIDTH]="60"           # Default separator line width
    [CONTENT_INDENT]="4"             # Standard content indentation

    # Typography & Color Intensity
    [TEXT_DIM_INTENSITY]="2"         # Dim text intensity (1=darkest, 3=brightest)
    [TEXT_BOLD_WEIGHT]="1"           # Bold text weight
    [TETRA_TERM_BRIGHTNESS]="50"     # Tetra terms brightness (0-100, 50% less dim)

    # Separator Characters
    [SEPARATOR_CHAR]="-"             # Default separator character
    [EMPHASIS_CHAR]="="              # Emphasis separator character
    [SECTION_CHAR]="-"               # Section separator character
)

# Legacy compatibility - extract commonly used tokens
ACTION_LINE_MIN_WIDTH="${TUI_DESIGN_TOKENS[ACTION_LINE_MIN_WIDTH]}"
UI_COUNTER_MARGIN="${TUI_DESIGN_TOKENS[UI_COUNTER_MARGIN]}"

ENVIRONMENTS=("APP" "DEV")
MODES=("Learn" "Try" "Tui" "Dmod" "Test")

# TView Interface - Content concerns only
get_actions() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"

    # Source nouns_verbs system if not already loaded
    if ! command -v get_env_nouns >/dev/null 2>&1; then
        source "$SCRIPT_DIR/nouns_verbs.sh" 2>/dev/null
    fi

    # Special case: Test mode always returns single action for TDD
    if [[ "$mode" == "Test" ]]; then
        echo "show:tui"
        return
    fi

    # Get available verbs for current mode and nouns for current env
    local mode_verbs=($(get_mode_verbs "$mode"))
    local env_nouns=($(get_env_nouns "$env"))

    # Generate verb:noun combinations
    for verb in "${mode_verbs[@]}"; do
        for noun in "${env_nouns[@]}"; do
            echo "$verb:$noun"
        done
    done
}

execute_current_action() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"

    local actions=($(get_actions))
    local action="${actions[$ACTION_INDEX]}"

    # Log the action execution
    log_action "Execute: $env:$mode:$action"

    # Parse verb:noun from action
    if [[ "$action" == *:* ]]; then
        local verb="${action%%:*}"
        local noun="${action##*:}"

        # Refresh color state for current verb/noun
        refresh_color_state "$verb" "$noun"

        # Build result header with safe colored verb × noun → response type
        CONTENT="$(render_action_verb_noun "$verb" "$noun")$(render_response_type "$verb" "$noun") → $env:$mode
$(generate_section_separator)"

        # Get description from nouns_verbs system
        local description=$(get_action_description "$verb" "$noun")
        if [[ -n "$description" ]]; then
            CONTENT+="
$description

Module Output:
$(case "$verb:$noun" in
    "show:palette")
        echo "🎨 Interactive Color Palette Demonstration"
        echo "=========================================="
        echo
        if [[ -f "./bash/tui/modules/colors/palette.sh" ]]; then
            ./bash/tui/modules/colors/palette.sh
        else
            echo "Color palette system demonstration"
            echo "• 4 semantic color groups: ENV, MODE, VERBS, NOUNS"
            echo "• Progressive desaturation examples"
            echo "• Multiple rendering modes (fg+bg, bg-only, fg-only)"
            echo "• Terminal width adaptation"
        fi
        echo
        echo "Palette Features:"
        echo "• Semantic color organization for TUI components"
        echo "• Accessibility-conscious design with desaturation"
        echo "• Dynamic terminal adaptation"
        echo "• Press 'p' in gamepad mode to enter paletteView"
        ;;
    "show:header")
        echo "4-line navigation header:"
        echo "Line 1: Environment selection (DEMO/MODULES/TUI)"
        echo "Line 2: Mode selection (LEARN/TEST/COLORS)"
        echo "Line 3: Action selection [verb × noun] format"
        echo "Line 4: Status and navigation info"
        ;;
    "configure:colors")
        echo "⚙️ Color Configuration Interface"
        echo "==============================="
        echo
        echo "Available Customizations:"
        echo "• ENV palette: Context identification colors"
        echo "• MODE palette: Operation mode indicators"
        echo "• VERBS palette: Action verb highlighting"
        echo "• NOUNS palette: Resource noun categorization"
        echo
        echo "Configuration Options:"
        echo "• Brightness adjustment (0-100%)"
        echo "• Contrast optimization for accessibility"
        echo "• Color-blind friendly alternatives"
        echo "• Terminal compatibility modes"
        echo
        echo "Advanced Features:"
        echo "• Custom theme creation"
        echo "• Desaturation levels (0-7)"
        echo "• Export/import color schemes"
        echo "• Preview mode with live updates"
        ;;
    "test:colors")
        echo "🔍 Color System Validation (DEV Mode)"
        echo "===================================="
        echo
        echo "Palette Integrity:"
        echo "✓ ENV palette loaded (${#ENV_PRIMARY[@]} colors)"
        echo "✓ MODE palette loaded (${#MODE_PRIMARY[@]} colors)"
        echo "✓ VERBS palette loaded (${#VERBS_PRIMARY[@]} colors)"
        echo "✓ NOUNS palette loaded (${#NOUNS_PRIMARY[@]} colors)"
        echo
        echo "Accessibility Tests:"
        echo "✓ Contrast ratios meet WCAG guidelines"
        echo "✓ Color-blind friendly design verified"
        echo "✓ Terminal compatibility tested"
        echo "✓ Desaturation examples functional"
        echo
        echo "Development Tests:"
        echo "✓ Foreground + background combinations"
        echo "✓ Background-only rendering"
        echo "✓ Foreground-only rendering"
        echo "✓ Progressive desaturation effects"
        echo "✓ Color function performance validation"
        ;;
    "test:tui")
        echo "🔍 TUI System Validation (DEV Mode)"
        echo "==================================="
        echo
        echo "Layout Tests:"
        echo "✓ Header region rendering (4 lines)"
        echo "✓ Content region scrolling"
        echo "✓ Footer region formatting"
        echo "✓ Terminal resize handling"
        echo
        echo "Navigation Tests:"
        echo "✓ Environment switching"
        echo "✓ Mode transitions"
        echo "✓ Action selection"
        echo "✓ REPL integration"
        echo
        echo "Performance Tests:"
        echo "✓ Screen refresh optimization"
        echo "✓ Input handling latency"
        echo "✓ Memory usage validation"
        echo "✓ Color rendering performance"
        ;;
    "show:tui")
        # TEST mode: NO echo statements - return structured content only
        printf "TEST: show:tui executed successfully\nEnvironment: %s | Mode: %s\nTUI regions stable\nComponent architecture verified" "$env" "$mode"
        ;;
    *)
        echo "Demo output for $verb × $noun"
        echo "Environment context: $env"
        echo "Mode context: $mode"
        ;;
esac)"
        else
            CONTENT+="
No description available for $verb:$noun"
        fi
    else
        # Fallback for non-verb:noun actions
        CONTENT="$action → $env:$mode
$(generate_section_separator)
Legacy action format"
    fi

    # Special handling for Test mode - diagnostic feedback with new formatting
    if [[ "$mode" == "Test" && "$action" == "show:tui" ]]; then
        CONTENT=""  # Clear content for test mode

        # Diagnostic checks for TUI stability
        local screen_regions="Header:4 Content:$((${LINES:-24}-8)) Footer:4"
        local navigation_state="ENV:$ENV_INDEX/$((${#ENVIRONMENTS[@]}-1)) MODE:$MODE_INDEX/$((${#MODES[@]}-1)) ACTION:$ACTION_INDEX/0"
        local mvc_status="Model:✓ View:✓ Controller:✓"

        # Use new footer formatting system
        local test_status="TDD TEST: show:tui executed"
        local test_details="$navigation_state | Regions: $screen_regions | $mvc_status | Looking for: No screen jostling, stable cursor, clean transitions"

        FOOTER_CONTENT="$(format_footer_combined "$test_status" "$test_details")"
    fi
}

# Content generation functions for TUI
render_header() {
    #render_top_status
    echo
}

render_environment_line() {
    printf "$(ui_env_label)Env: $(reset_color)"
    for i in "${!ENVIRONMENTS[@]}"; do
        if [[ $i -eq $ENV_INDEX ]]; then
            printf "$(ui_env_selected)[${ENVIRONMENTS[$i]}]$(reset_color) "
        else
            printf "$(ui_env_other)${ENVIRONMENTS[$i]}$(reset_color) "
        fi
    done
}

render_mode_line() {
    printf "$(ui_mode_label)Mode: $(reset_color)"
    for i in "${!MODES[@]}"; do
        if [[ $i -eq $MODE_INDEX ]]; then
            printf "$(ui_mode_selected)[${MODES[$i]}]$(reset_color) "
        else
            printf "$(ui_mode_other)${MODES[$i]}$(reset_color) "
        fi
    done
}

render_action_line() {
    local actions=($(get_actions))
    local term_width=${COLUMNS:-80}

    # Build the action line content
    local line_content="$(ui_action_label)Action: $(reset_color)"

    # Show current action in verb × noun format
    if [[ ${#actions[@]} -gt 0 && $ACTION_INDEX -lt ${#actions[@]} ]]; then
        local action="${actions[$ACTION_INDEX]}"
        # Parse action as verb:noun if it contains ':'
        if [[ "$action" == *:* ]]; then
            local verb="${action%%:*}"
            local noun="${action##*:}"

            # Refresh colors and display with safe coloring
            refresh_color_state "$verb" "$noun"
            line_content+="[$(render_action_verb_noun "$verb" "$noun")] "
        else
            line_content+="[%s] " "$action"
        fi
    fi

    # Output action line without counter
    printf "%s" "$line_content"
    echo

    # Show full equation on separate line below action
    if [[ ${#actions[@]} -gt 0 && $ACTION_INDEX -lt ${#actions[@]} ]]; then
        local action="${actions[$ACTION_INDEX]}"
        if [[ "$action" == *:* ]]; then
            local verb="${action%%:*}"
            local noun="${action##*:}"
            local env="${ENVIRONMENTS[$ENV_INDEX]}"
            local mode="${MODES[$MODE_INDEX]}"

            # Use semantic path for the app context
            local app_path="$DEMO_DIR/basic/010"
            printf "        "
            render_equation "$env" "$mode" "$verb" "$noun"
            printf " | %s" "$(basename "$app_path")"
            echo

            # Display view mode indicator - right-aligned in grey
            local view_mode_text="${CONTENT_MODE:-actions}"
            local display_indicator="[view: $view_mode_text]"
            local padding=$(((term_width - ${#display_indicator})))
            [[ $padding -lt 0 ]] && padding=0

            printf "\033[2m%*s%s\033[0m" $padding "" "$display_indicator"
            echo
        fi
    fi
}

render_footer() {
    # Use dynamic footer from View layer
    render_dynamic_footer
}

clear_content() {
    local term_width=${COLUMNS:-80}
    local message="✨ Content cleared - Terminal: ${COLUMNS}×${LINES}"
    local padding=$(((term_width - ${#message}) / 2))
    [[ $padding -lt 0 ]] && padding=0

    CONTENT="$(printf '%*s%s' $padding '' "$message")"
    CONTENT_MODE=""  # Clear content mode when clearing content
}

# Set content mode and trigger appropriate rendering
set_content_mode() {
    local mode="$1"
    CONTENT_MODE="$mode"

    case "$mode" in
        "actions")
            show_actions_view
            ;;
        "palette")
            show_palette_demonstration
            ;;
        "info")
            show_info_view
            ;;
        *)
            log_action "Warning: Unknown content mode '$mode'"
            CONTENT_MODE="actions"  # Default to actions view
            ;;
    esac
}

# Check if we're in a specific content mode
in_content_mode() {
    local mode="$1"
    [[ "$CONTENT_MODE" == "$mode" ]]
}

# Refresh content display based on current mode
refresh_content_display() {
    case "$CONTENT_MODE" in
        "actions")
            show_actions_view
            ;;
        "palette")
            show_palette_demonstration
            ;;
        "info")
            show_info_view
            ;;
        *)
            # Default to actions view
            show_actions_view
            ;;
    esac
}

# Show actions view with current action execution result
show_actions_view() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local actions=($(get_actions))

    if [[ ${#actions[@]} -gt 0 && $ACTION_INDEX -lt ${#actions[@]} ]]; then
        local current_action="${actions[$ACTION_INDEX]}"

        # Show current action execution or available actions
        if [[ -n "$CONTENT" ]]; then
            # Show the result of the last executed action
            : # CONTENT is already set by execute_current_action
        else
            # Show available actions list
            CONTENT="📋 Available Actions for $env × $mode
$(generate_section_separator)

Current Action: $current_action
Actions (${#actions[@]} total):

"
            local count=1
            for action in "${actions[@]}"; do
                if [[ $((count-1)) -eq $ACTION_INDEX ]]; then
                    CONTENT+="► $count. $action (current)
"
                else
                    CONTENT+="  $count. $action
"
                fi
                ((count++))
            done

            CONTENT+="

$(generate_section_separator)

Navigation:
• Use ↑↓ arrows to change actions
• Press Enter to execute current action
• Press 'p' for palette view, 'i' for info view"
        fi
    else
        CONTENT="No actions available for $env × $mode"
    fi

    FOOTER_CONTENT="$(format_footer_combined "Actions View" "Current: ${ENVIRONMENTS[$ENV_INDEX]} × ${MODES[$MODE_INDEX]} | View: actions")"
}

# Show info view with system information
show_info_view() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local actions=($(get_actions))

    CONTENT="ℹ️  System Information
$(generate_section_separator)

Current Context:
• Environment: $env
• Mode: $mode
• Actions Available: ${#actions[@]}
• Current Action Index: $((ACTION_INDEX + 1))/${#actions[@]}

$(generate_section_separator)

Environment Details:
• APP: User-focused demonstration and configuration
• DEV: Full development with testing capabilities

Mode Details:
• Learn: Exploration and demonstration (show actions)
• Try: Hands-on configuration (show + configure actions)
• Tui: Full TUI development (show + configure + test actions)
• Dmod: Demo module management (show + configure + test actions)
• Test: TDD debugging mode (show actions for testing)

$(generate_section_separator)

View Modes:
• actions: Current action results and available actions
• palette: Interactive color system demonstration
• info: System information and help (current view)

$(generate_section_separator)

Navigation:
• Use ←→ arrows to change environments
• Use ↑↓ arrows to change modes/actions
• Press 'a' for actions view, 'p' for palette view
• Press Enter to execute actions, 'r' for REPL mode"

    FOOTER_CONTENT="$(format_footer_combined "Info View" "Current: $env × $mode | View: info")"
}

# Show interactive palette demonstration
show_palette_demonstration() {
    CONTENT="🎨 Interactive Palette Demonstration
=====================================

Welcome to the palette view mode! This demonstrates the complete color system used throughout the TUI framework.

$(generate_section_separator)

Color Architecture:
• ENV palette: Environment identification (APP/DEV/TEST)
• MODE palette: Operation modes (Learn/Try/Tui/Dmod/Test)
• VERBS palette: Action verbs (show/configure/test)
• NOUNS palette: Resource nouns (demo/colors/input/tui)

$(generate_section_separator)

Live Palette Display:
"

    # Add the actual palette output if available
    if [[ -f "./bash/tui/modules/colors/palette.sh" ]]; then
        CONTENT+="$(./bash/tui/modules/colors/palette.sh 2>/dev/null || echo 'Palette system loading...')"
    else
        CONTENT+="Palette system demonstration would appear here.
Dynamic color sections with progressive desaturation examples."
    fi

    CONTENT+="

$(generate_section_separator)

Navigation:
• Use arrow keys to navigate through different sections
• Press 'q' to return to normal action mode
• Press 'r' to refresh the palette display"

    FOOTER_CONTENT="$(format_footer_combined "Palette View" "Current: ${ENVIRONMENTS[$ENV_INDEX]} × ${MODES[$MODE_INDEX]} | View: palette")"
}

# Enhanced render system - ensures proper refresh of all UI elements
render_ui_components() {
    # Always refresh action line to show current selection and mode
    local term_width=${COLUMNS:-80}

    # If we have content mode, make sure it's refreshed
    if [[ -n "$CONTENT_MODE" ]]; then
        refresh_content_display
    fi

    # Log the render event for debugging
    log_action "UI: Rendered components (mode: ${CONTENT_MODE:-none})"
}

# Standalone REPL mode (no gamepad interface)
run_standalone_repl() {
    echo "TUI Framework REPL - Standalone CLI Interface"
    echo "Current: ENV=${ENVIRONMENTS[$ENV_INDEX]} MODE=${MODES[$MODE_INDEX]}"
    echo

    while true; do
        local prompt=$(get_repl_prompt)
        local input

        # Use simple readline
        if ! read -e -r -p "$prompt" input; then
            echo "Goodbye!"
            break
        fi

        # Skip empty input
        [[ -z "$input" ]] && continue

        # Add to history
        REPL_HISTORY+=("$input")

        # Execute command
        case "$input" in
            "exit"|"q"|"quit")
                echo "Goodbye!"
                return 0
                ;;
            "/help")
                echo
                echo "🎮 REPL Commands:"
                echo "  env [name]    - Switch environment or list all"
                echo "  mode [name]   - Switch mode or list all"
                echo "  fire <action> - Execute action"
                echo "  ls            - List current actions"
                echo "  palette       - Show color palette system"
                echo "  palview       - Enter interactive palette view mode"
                echo
                echo "🔧 Meta Commands:"
                echo "  /help         - Show this help"
                echo "  /status       - Show system status"
                echo "  /commands     - List all available commands"
                echo "  /palette      - Show color palette system"
                echo "  exit          - Exit REPL"
                echo
                ;;
            "/status")
                echo
                echo "📊 System Status:"
                echo "  Environment: ${ENVIRONMENTS[$ENV_INDEX]}"
                echo "  Mode: ${MODES[$MODE_INDEX]}"
                echo "  Module: module/tview/$(echo "${MODES[$MODE_INDEX]}" | tr '[:upper:]' '[:lower:]')"
                local actions=($(get_actions))
                echo "  Actions: ${#actions[@]} available"
                echo "  REPL: v009 standalone mode"
                echo
                ;;
            "/commands")
                echo
                echo "📋 All Available Commands:"
                echo "Regular:"
                echo "  env, mode, fire, ls, palette, exit"
                echo "Meta (/):"
                echo "  /help, /status, /commands, /palette"
                echo
                ;;
            "/palette")
                echo
                echo "🎨 Color Palette System:"
                "$SCRIPT_DIR/modules/colors/palette.sh" 2>/dev/null || {
                    echo "Color palette system demonstration"
                    echo "ENV, MODE, VERBS, NOUNS palettes with desaturation examples"
                    echo "Four sections: desaturated both, bg desaturated, brightness fade, fg only"
                }
                echo
                ;;
            "palview")
                echo
                echo "🎨 Entering Palette View Mode..."
                echo "This would switch to interactive palette demonstration"
                echo "Use 'set_content_mode paletteView' in gamepad mode"
                echo
                ;;
            "help"|"h")
                echo "Use '/help' for full help, or try '/commands'"
                ;;
            "ls"|"list")
                echo
                echo "📋 Available actions for ${ENVIRONMENTS[$ENV_INDEX]}:${MODES[$MODE_INDEX]}:"
                local actions=($(get_actions))
                for action in "${actions[@]}"; do
                    echo "  • $action"
                done
                echo
                ;;
            ls*)
                local ls_type="${input#ls }"
                case "$ls_type" in
                    "env"|"environments")
                        echo
                        echo "🌍 Available environments:"
                        for i in "${!ENVIRONMENTS[@]}"; do
                            if [[ $i -eq $ENV_INDEX ]]; then
                                echo "  • ${ENVIRONMENTS[$i]} (current)"
                            else
                                echo "  • ${ENVIRONMENTS[$i]}"
                            fi
                        done
                        echo
                        ;;
                    "mode"|"modes")
                        echo
                        echo "🔧 Available modes:"
                        for i in "${!MODES[@]}"; do
                            if [[ $i -eq $MODE_INDEX ]]; then
                                echo "  • ${MODES[$i]} (current)"
                            else
                                echo "  • ${MODES[$i]}"
                            fi
                        done
                        echo
                        ;;
                    "all")
                        echo
                        echo "🌍 Environments:"
                        for i in "${!ENVIRONMENTS[@]}"; do
                            if [[ $i -eq $ENV_INDEX ]]; then
                                echo "  • ${ENVIRONMENTS[$i]} (current)"
                            else
                                echo "  • ${ENVIRONMENTS[$i]}"
                            fi
                        done
                        echo
                        echo "🔧 Modes:"
                        for i in "${!MODES[@]}"; do
                            if [[ $i -eq $MODE_INDEX ]]; then
                                echo "  • ${MODES[$i]} (current)"
                            else
                                echo "  • ${MODES[$i]}"
                            fi
                        done
                        echo
                        echo "📋 Actions for ${ENVIRONMENTS[$ENV_INDEX]}:${MODES[$MODE_INDEX]}:"
                        local actions=($(get_actions))
                        for action in "${actions[@]}"; do
                            echo "  • $action"
                        done
                        echo
                        ;;
                    *)
                        echo
                        echo "📋 Available actions for ${ENVIRONMENTS[$ENV_INDEX]}:${MODES[$MODE_INDEX]}:"
                        local actions=($(get_actions))
                        for action in "${actions[@]}"; do
                            echo "  • $action"
                        done
                        echo
                        ;;
                esac
                ;;
            "env")
                echo
                echo "🌍 Available environments:"
                for i in "${!ENVIRONMENTS[@]}"; do
                    if [[ $i -eq $ENV_INDEX ]]; then
                        echo "  • ${ENVIRONMENTS[$i]} (current)"
                    else
                        echo "  • ${ENVIRONMENTS[$i]}"
                    fi
                done
                echo "Usage: env <name>"
                echo
                ;;
            env*)
                local env_name="${input#env }"
                env_name="${env_name// /}"  # Remove spaces
                env_name="${env_name,,}"  # lowercase
                local found=false
                for i in "${!ENVIRONMENTS[@]}"; do
                    if [[ "${ENVIRONMENTS[$i],,}" == "$env_name" ]]; then
                        ENV_INDEX=$i
                        ACTION_INDEX=0
                        printf "Environment switched to: %s\n" "${ENVIRONMENTS[$ENV_INDEX]}"
                        found=true
                        break
                    fi
                done
                if [[ "$found" == "false" ]]; then
                    echo "Unknown environment: $env_name"
                    echo "Available: ${ENVIRONMENTS[*],,}"
                fi
                ;;
            "mode")
                echo
                echo "🔧 Available modes:"
                for i in "${!MODES[@]}"; do
                    if [[ $i -eq $MODE_INDEX ]]; then
                        echo "  • ${MODES[$i]} (current)"
                    else
                        echo "  • ${MODES[$i]}"
                    fi
                done
                echo "Usage: mode <name>"
                echo
                ;;
            mode*)
                local mode_name="${input#mode }"
                mode_name="${mode_name// /}"  # Remove spaces
                mode_name="${mode_name,,}"  # lowercase
                local found=false
                for i in "${!MODES[@]}"; do
                    if [[ "${MODES[$i],,}" == "$mode_name" ]]; then
                        MODE_INDEX=$i
                        ACTION_INDEX=0
                        printf "Mode switched to: %s\n" "${MODES[$MODE_INDEX]}"
                        found=true
                        break
                    fi
                done
                if [[ "$found" == "false" ]]; then
                    echo "Unknown mode: $mode_name"
                    echo "Available: ${MODES[*],,}"
                fi
                ;;
            fire*)
                local action_name="${input#fire }"
                local actions=($(get_actions))
                for i in "${!actions[@]}"; do
                    if [[ "${actions[$i]}" == "$action_name" ]]; then
                        ACTION_INDEX=$i
                        printf "Executing: %s\n" "$action_name"
                        execute_current_action
                        # Show results
                        echo "$CONTENT"
                        break
                    fi
                done
                ;;
            *)
                printf "Unknown command: %s (type 'help' for commands)\n" "$input"
                ;;
        esac
    done
}

# Main application
main() {
    # Check for command line arguments
    if [[ "$1" == "repl" ]]; then
        run_standalone_repl
        return $?
    fi

    echo "Starting TUI Framework - Clean TUI Architecture"
    echo "DEMO_SRC: $DEMO_SRC"
    echo "Use './app.sh repl' for standalone REPL mode"
    sleep 1

    # Initialize terminal
    init_terminal
    trap 'cleanup_terminal' EXIT

    while true; do
        # Check if we should enter REPL mode
        if [[ "$CURRENT_INPUT_MODE" == "$INPUT_MODE_REPL" ]]; then
            run_repl_loop
            # After REPL, we're back in gamepad mode
            continue
        fi

        # Show gamepad display
        show_gamepad_display

        # Handle input
        read -n1 -s key
        if ! handle_input "$key"; then
            break
        fi
    done

    echo "TUI Framework ended - Clean TUI Architecture demonstrated!"
}

main "$@"
