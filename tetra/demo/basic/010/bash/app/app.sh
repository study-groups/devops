#!/usr/bin/env bash

# TUI Framework Application - Enhanced with Component System
# Integrates double buffering, components, and view controllers

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

# Source new component system
source "$APP_SCRIPT_DIR/rendering/double_buffer.sh"
source "$APP_SCRIPT_DIR/components/component_system.sh"
source "$APP_SCRIPT_DIR/controllers/view_controllers.sh"
source "$APP_SCRIPT_DIR/input/game_input.sh"
source "$APP_SCRIPT_DIR/action_router.sh"

# Source existing TUI system
source "$TUI_MODULES_DIR/tui_init.sh"
source "$TUI_MODULES_DIR/typography.sh"

# Initialize TUI system with proper module loading
init_tui_system

# Source remaining app systems from utils directory
if ! source "$UTILS_DIR/top_status.sh"; then
    echo "Error: Failed to source top_status.sh from $UTILS_DIR" >&2
    exit 1
fi

if ! source "$UTILS_DIR/enhanced_signatures.sh"; then
    echo "Error: Failed to source enhanced_signatures.sh from $UTILS_DIR" >&2
    exit 1
fi

# Source legacy systems (will be gradually replaced)
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
CONTENT_MODE="actions"
declare -a TUI_CONTENT_MODES=("actions" "palette" "info")

# UI Design Tokens
declare -A TUI_DESIGN_TOKENS=(
    [ACTION_LINE_MIN_WIDTH]="60"
    [UI_COUNTER_MARGIN]="1"
    [SEPARATOR_WIDTH]="60"
    [CONTENT_INDENT]="4"
    [TEXT_DIM_INTENSITY]="2"
    [TEXT_BOLD_WEIGHT]="1"
    [TETRA_TERM_BRIGHTNESS]="50"
    [SEPARATOR_CHAR]="-"
    [EMPHASIS_CHAR]="="
    [SECTION_CHAR]="-"
)

# Legacy compatibility
ACTION_LINE_MIN_WIDTH="${TUI_DESIGN_TOKENS[ACTION_LINE_MIN_WIDTH]}"
UI_COUNTER_MARGIN="${TUI_DESIGN_TOKENS[UI_COUNTER_MARGIN]}"

ENVIRONMENTS=("APP" "DEV")
ALL_MODES=("Learn" "Try" "Tui" "Dmod" "Test")

# Get compatible modes for current environment
get_current_modes() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    case "$env" in
        "APP") echo "Learn Try" ;;
        "DEV") echo "Learn Try Tui Dmod Test" ;;
        *) echo "Learn Try" ;;
    esac
}

# REPL state
declare -a REPL_HISTORY=()
declare REPL_HISTORY_INDEX=0
declare REPL_INPUT=""
declare REPL_CURSOR_POS=0

# Navigation functions
navigate_env_right() {
    ENV_INDEX=$(( (ENV_INDEX + 1) % ${#ENVIRONMENTS[@]} ))
    MODE_INDEX=0  # Reset to first mode for new environment
    ACTION_INDEX=0
    mark_component_dirty "header"
    mark_component_dirty "content"
    log_action "Navigation: Environment -> ${ENVIRONMENTS[$ENV_INDEX]}"
}

navigate_env_left() {
    ENV_INDEX=$(( (ENV_INDEX - 1 + ${#ENVIRONMENTS[@]}) % ${#ENVIRONMENTS[@]} ))
    MODE_INDEX=0  # Reset to first mode for new environment
    ACTION_INDEX=0
    mark_component_dirty "header"
    mark_component_dirty "content"
    log_action "Navigation: Environment <- ${ENVIRONMENTS[$ENV_INDEX]}"
}

navigate_mode_right() {
    local current_modes=($(get_current_modes))
    MODE_INDEX=$(( (MODE_INDEX + 1) % ${#current_modes[@]} ))
    ACTION_INDEX=0
    mark_component_dirty "header"
    mark_component_dirty "content"
    log_action "Navigation: Mode -> ${current_modes[$MODE_INDEX]}"
}

navigate_mode_left() {
    local current_modes=($(get_current_modes))
    MODE_INDEX=$(( (MODE_INDEX - 1 + ${#current_modes[@]}) % ${#current_modes[@]} ))
    ACTION_INDEX=0
    mark_component_dirty "header"
    mark_component_dirty "content"
    log_action "Navigation: Mode <- ${current_modes[$MODE_INDEX]}"
}

navigate_action_right() {
    local actions=($(get_actions))
    if [[ ${#actions[@]} -gt 0 ]]; then
        ACTION_INDEX=$(( (ACTION_INDEX + 1) % ${#actions[@]} ))
        mark_component_dirty "header"
        mark_component_dirty "content"
        log_action "Navigation: Action -> ${actions[$ACTION_INDEX]}"
    fi
}

navigate_action_left() {
    local actions=($(get_actions))
    if [[ ${#actions[@]} -gt 0 ]]; then
        ACTION_INDEX=$(( (ACTION_INDEX - 1 + ${#actions[@]}) % ${#actions[@]} ))
        mark_component_dirty "header"
        mark_component_dirty "content"
        log_action "Navigation: Action <- ${actions[$ACTION_INDEX]}"
    fi
}

navigate_action_up() {
    navigate_action_left
}

navigate_action_down() {
    navigate_action_right
}

# Check if action executes immediately
is_immediate_action() {
    local verb="$1"
    local noun="$2"

    case "$verb:$noun" in
        "show:"*) return 0 ;;  # show actions are immediate
        *) return 1 ;;
    esac
}

# Initialize enhanced TUI system
init_enhanced_tui() {
    init_double_buffer
    init_view_controllers
    init_game_input_system
    mount_default_components

    # Apply optimizations
    HEX_TO_256_CACHE=()  # Initialize color cache

    log_action "Enhanced TUI: System initialized"
}

# REPL functions
get_repl_prompt() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local current_modes=($(get_current_modes))
    local mode="${current_modes[$MODE_INDEX]}"
    echo "$env:$mode> "
}

execute_repl_command() {
    local input="$1"

    case "$input" in
        "exit"|"q"|"quit")
            switch_view_mode "$VIEW_ACTIONS"
            ;;
        "help"|"/help")
            CONTENT="REPL Help:
• env [name] - Switch environment
• mode [name] - Switch mode
• fire <action> - Execute action
• ls - List actions
• exit - Return to gamepad mode"
            mark_component_dirty "content"
            ;;
        env*)
            local env_name="${input#env }"
            env_name="${env_name// /}"
            for i in "${!ENVIRONMENTS[@]}"; do
                if [[ "${ENVIRONMENTS[$i],,}" == "${env_name,,}" ]]; then
                    ENV_INDEX=$i
                    MODE_INDEX=0
                    ACTION_INDEX=0
                    CONTENT="Switched to environment: ${ENVIRONMENTS[$i]}"
                    mark_component_dirty "header"
                    mark_component_dirty "content"
                    return
                fi
            done
            CONTENT="Unknown environment: $env_name"
            mark_component_dirty "content"
            ;;
        mode*)
            local mode_name="${input#mode }"
            mode_name="${mode_name// /}"
            local current_modes=($(get_current_modes))
            for i in "${!current_modes[@]}"; do
                if [[ "${current_modes[$i],,}" == "${mode_name,,}" ]]; then
                    MODE_INDEX=$i
                    ACTION_INDEX=0
                    CONTENT="Switched to mode: ${current_modes[$i]}"
                    mark_component_dirty "header"
                    mark_component_dirty "content"
                    return
                fi
            done
            CONTENT="Unknown mode: $mode_name"
            mark_component_dirty "content"
            ;;
        fire*)
            local action_name="${input#fire }"
            local actions=($(get_actions))
            for i in "${!actions[@]}"; do
                if [[ "${actions[$i]}" == "$action_name" ]]; then
                    ACTION_INDEX=$i
                    # Parse verb:noun from action
                    if [[ "$action_name" == *:* ]]; then
                        local verb="${action_name%%:*}"
                        local noun="${action_name##*:}"
                        route_action_execution "$verb" "$noun"
                    else
                        execute_current_action
                    fi
                    mark_component_dirty "header"
                    mark_component_dirty "content"
                    return
                fi
            done
            CONTENT="Unknown action: $action_name"
            mark_component_dirty "content"
            ;;
        "ls"|"list")
            local actions=($(get_actions))
            CONTENT="Available actions:
"
            for action in "${actions[@]}"; do
                CONTENT+="• $action
"
            done
            mark_component_dirty "content"
            ;;
        *)
            CONTENT="Unknown command: $input (type 'help' for commands)"
            mark_component_dirty "content"
            ;;
    esac
}

# Legacy functions preserved for compatibility
get_actions() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local current_modes=($(get_current_modes))
    local mode="${current_modes[$MODE_INDEX]}"

    # Source nouns_verbs system if not already loaded
    if ! command -v get_env_nouns >/dev/null 2>&1; then
        source "$UTILS_DIR/nouns_verbs.sh" 2>/dev/null
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

# Execute current action using modern handler system
execute_current_action() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local current_modes=($(get_current_modes))
    local mode="${current_modes[$MODE_INDEX]}"

    local actions=($(get_actions))
    local action="${actions[$ACTION_INDEX]}"

    log_action "Execute: $env:$mode:$action"

    # Parse verb:noun from action
    if [[ "$action" == *:* ]]; then
        local verb="${action%%:*}"
        local noun="${action##*:}"

        # Use handler system via router
        route_action_execution "$verb" "$noun"
        return $?
    fi

    # Fallback for non-standard actions
    execute_current_action_legacy "$verb" "$noun"
}

# Legacy execution function (backup for compatibility)
execute_current_action_legacy() {
    local verb="$1"
    local noun="$2"
    local env="${ENVIRONMENTS[$ENV_INDEX]:-APP}"
    local current_modes=($(get_current_modes))
    local mode="${current_modes[$MODE_INDEX]:-Learn}"

    if [[ -z "$verb" || -z "$noun" ]]; then
        CONTENT="Error: Invalid action format"
        return 1
    fi

    # Fallback to router system
    route_action_execution "$verb" "$noun"
}

# Enhanced content generation functions
render_header() {
    echo
}

# Responsive action line rendering with width management
render_action_line_responsive() {
    local actions=("$@")
    local term_width=${COLUMNS:-80}

    if [[ ${#actions[@]} -eq 0 ]]; then
        printf "[no actions available]"
        return
    fi

    if [[ $ACTION_INDEX -ge ${#actions[@]} ]]; then
        ACTION_INDEX=0
    fi

    local action="${actions[$ACTION_INDEX]}"
    local action_prefix="["
    local action_suffix="] ($((ACTION_INDEX + 1))/${#actions[@]})"

    # Calculate available space for action content
    local prefix_suffix_length=$((${#action_prefix} + ${#action_suffix}))
    local available_width=$((term_width - prefix_suffix_length - 20))  # 20 char margin for "Action: " and colors

    if [[ "$action" == *:* ]]; then
        local verb="${action%%:*}"
        local noun="${action##*:}"

        # Check if full action fits
        local full_action="${verb}×${noun}"
        if [[ ${#full_action} -le $available_width ]]; then
            # Full action fits - use normal rendering
            refresh_color_state_cached "$verb" "$noun" 2>/dev/null || true
            printf "%s" "$action_prefix"
            render_action_verb_noun "$verb" "$noun" 2>/dev/null || printf "%s×%s" "$verb" "$noun"
            printf "%s" "$action_suffix"
        else
            # Action too long - use smart truncation
            local max_noun_length=$((available_width - ${#verb} - 3))  # 3 for "×" and "..."
            if [[ $max_noun_length -gt 3 ]]; then
                local truncated_noun="${noun:0:$max_noun_length}..."
                printf "%s%s×%s%s" "$action_prefix" "$verb" "$truncated_noun" "$action_suffix"
            else
                # Very tight space - just show verb
                printf "%s%s×...%s" "$action_prefix" "$verb" "$action_suffix"
            fi
        fi
    else
        # Non-standard action format
        if [[ ${#action} -le $available_width ]]; then
            printf "%s%s%s" "$action_prefix" "$action" "$action_suffix"
        else
            local truncated="${action:0:$((available_width - 3))}..."
            printf "%s%s%s" "$action_prefix" "$truncated" "$action_suffix"
        fi
    fi
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
    local current_modes=($(get_current_modes))
    printf "$(ui_mode_label)Mode: $(reset_color)"
    for i in "${!current_modes[@]}"; do
        if [[ $i -eq $MODE_INDEX ]]; then
            printf "$(ui_mode_selected)[${current_modes[$i]}]$(reset_color) "
        else
            printf "$(ui_mode_other)${current_modes[$i]}$(reset_color) "
        fi
    done
}

render_action_line() {
    local actions=($(get_actions))
    local term_width=${COLUMNS:-80}

    # Responsive action line rendering
    printf "%s" "$(ui_action_label)Action: $(reset_color)"

    if [[ ${#actions[@]} -gt 0 && $ACTION_INDEX -lt ${#actions[@]} ]]; then
        render_action_line_responsive "${actions[@]}"
    else
        printf "[no actions available]"
    fi
    echo

    # Show equation on separate line
    if [[ ${#actions[@]} -gt 0 && $ACTION_INDEX -lt ${#actions[@]} ]]; then
        local action="${actions[$ACTION_INDEX]}"
        if [[ "$action" == *:* ]]; then
            local verb="${action%%:*}"
            local noun="${action##*:}"
            local env="${ENVIRONMENTS[$ENV_INDEX]}"
            local current_modes=($(get_current_modes))
            local mode="${current_modes[$MODE_INDEX]}"

            local app_path="$DEMO_DIR/basic/010"
            printf "        "
            render_equation "$env" "$mode" "$verb" "$noun"
            printf " | %s" "$(basename "$app_path")"
            echo

            # Display view mode indicator
            local view_mode_text="$(get_current_view_mode)"
            local display_indicator="[view: $view_mode_text]"
            local padding=$(((term_width - ${#display_indicator})))
            [[ $padding -lt 0 ]] && padding=0

            printf "\033[2m%*s%s\033[0m" $padding "" "$display_indicator"
            echo

            # Add prominent view mode indicator
            local view_indicator="VIEW: $(get_current_view_mode | tr '[:lower:]' '[:upper:]')"
            printf "\033[1;35m        %s\033[0m" "$view_indicator"
            echo
        fi
    fi
}

render_footer() {
    render_dynamic_footer
}

# Enhanced clear function
clear_content() {
    local term_width=${COLUMNS:-80}
    local message="✨ Content cleared - Enhanced TUI: ${COLUMNS}×${LINES}"
    local padding=$(((term_width - ${#message}) / 2))
    [[ $padding -lt 0 ]] && padding=0

    CONTENT="$(printf '%*s%s' $padding '' "$message")"
    CONTENT_MODE=""

    mark_component_dirty "content"
}

# View-specific functions (enhanced)
show_actions_view() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local current_modes=($(get_current_modes))
    local mode="${current_modes[$MODE_INDEX]}"
    local actions=($(get_actions))

    if [[ ${#actions[@]} -gt 0 && $ACTION_INDEX -lt ${#actions[@]} ]]; then
        local current_action="${actions[$ACTION_INDEX]}"

        if [[ -n "$CONTENT" ]]; then
            : # CONTENT already set by execute_current_action
        else
            CONTENT="📋 Available Actions for $env × $mode (Enhanced)
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
• Number keys (1-5) for quick view switching
• Home row: e/d/a for env/mode/action navigation
• Enter to execute, r for refresh
• Enhanced: 60fps rendering with double buffering"
        fi
    else
        CONTENT="No actions available for $env × $mode"
    fi

    local current_view=$(get_current_view_mode)
    local view_title="${current_view^} View"  # Capitalize first letter
    FOOTER_CONTENT="$(format_footer_combined "$view_title" "e/d/a=nav i/k=select | c=clear | 1-4=views | Enter=exec | View: $current_view")"
}

show_palette_demonstration() {
    CONTENT="🎨 TUI Color Palette System
===========================

$(generate_section_separator)

🌈 Live Color Demonstration:

ENV Palette (Environment Colors):
$(ui_env_label)■ APP$(reset_color) $(ui_env_selected)■ DEV$(reset_color) $(ui_env_other)■ TEST$(reset_color)

MODE Palette (Operation Mode Colors):
$(ui_mode_label)■ Learn$(reset_color) $(ui_mode_selected)■ Try$(reset_color) $(ui_mode_other)■ Tui$(reset_color) $(ui_mode_other)■ Dmod$(reset_color) $(ui_mode_other)■ Test$(reset_color)

ACTION Palette (Verb × Noun Colors):
$(printf '\033[32m■ show\033[0m') $(printf '\033[33m■ configure\033[0m') $(printf '\033[31m■ test\033[0m')
$(printf '\033[34m■ demo\033[0m') $(printf '\033[35m■ colors\033[0m') $(printf '\033[36m■ input\033[0m') $(printf '\033[37m■ tui\033[0m')

$(generate_section_separator)

🎯 Current Action Colors:
$(render_action_verb_noun show demo) $(render_action_verb_noun configure colors) $(render_action_verb_noun test tui)

$(generate_section_separator)

🚀 Enhanced Features:
• tui::cache - Optimized color calculations (${#HEX_TO_256_CACHE[@]} cached)
• tui::components - Lifecycle-managed rendering
• tui::rendering - Zero-flicker double buffering

$(generate_section_separator)

📊 Palette Statistics:
• Color Functions: 12+ semantic color helpers
• Cache Efficiency: Eliminates redundant hex calculations
• Terminal Compatibility: 256-color and 16-color modes
• Performance: Sub-millisecond color lookups"

    FOOTER_CONTENT="$(format_footer_combined "Palette View" "i/k=nav | 1=actions 2=palette 3=info 4=repl | View: $(get_current_view_mode)")"
}

show_info_view() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local current_modes=($(get_current_modes))
    local mode="${current_modes[$MODE_INDEX]}"
    local actions=($(get_actions))

    CONTENT="ℹ️  TUI Module System Information
$(generate_section_separator)

📍 Current Context: $env × $mode
$(generate_section_separator)

🏗️  Module Architecture:
"

    # Show per-module actions and properties
    case "$env:$mode" in
        "APP:Learn")
            CONTENT+="tui::demo     - Core demo application (4 actions)
  └── show:demo      → @output  Main application showcase
  └── show:colors    → @output  Color palette demonstration
  └── show:input     → @output  Input system overview
  └── show:tui       → @output  TUI layout demonstration

tui::colors   - Semantic color system (1 action)
  └── show:colors    → @output  Interactive palette display

Properties:
• Environment: User-focused demonstration mode
• Capability: Read-only exploration of TUI features
• Module Count: 2 active modules
• Action Types: show → @output (display/presentation)"
            ;;
        "APP:Try")
            CONTENT+="tui::demo     - Interactive demo system (6 actions)
  └── show:demo      → @output  Application state display
  └── configure:demo → @input   Customize demo settings
  └── show:colors    → @output  Color system showcase
  └── configure:colors → @input Configure color themes
  └── show:input     → @output  Input system documentation
  └── show:tui       → @output  Layout system overview

Properties:
• Environment: Hands-on configuration mode
• Capability: Configuration and customization
• Module Count: 1 active module
• Action Types: show → @output, configure → @input"
            ;;
        "DEV:Learn"|"DEV:Try"|"DEV:Tui"|"DEV:Dmod"|"DEV:Test")
            CONTENT+="tui::demo     - Full development demo (${#actions[@]} actions)
"
            for action in "${actions[@]}"; do
                if [[ "$action" == *:* ]]; then
                    local verb="${action%%:*}"
                    local noun="${action##*:}"
                    local result_type="output"
                    if command -v get_result_type >/dev/null 2>&1; then
                        result_type=$(get_result_type "$verb" "$noun" "$mode" 2>/dev/null || echo "output")
                    fi
                    CONTENT+="  └── $verb:$noun → @$result_type
"
                fi
            done

            CONTENT+="
tui::colors   - Advanced color management
tui::input    - Enhanced input processing
tui::Module   - Development introspection tools
tui::inspect  - System debugging capabilities

Properties:
• Environment: Full development access
• Capability: Development, testing, introspection
• Module Count: 6 active modules
• Action Types: show → @output, configure → @input, test → @validation"
            ;;
    esac

    CONTENT+="

$(generate_section_separator)

🚀 Enhanced Architecture:
• tui::rendering  - Double-buffered frame system
• tui::components - Lifecycle-managed UI elements
• tui::controllers - View state management
• tui::input      - Game-like input mapping
• tui::cache      - Performance optimization (${#HEX_TO_256_CACHE[@]} entries)

$(generate_section_separator)

🎮 Navigation System:
• e/d/a = env/mode/action navigation
• 1-5 = instant view switching
• c = clear content
• Enter = execute current action
• ESC/q = context-sensitive exit

$(generate_section_separator)

📊 Performance Metrics:
• Active Components: $(echo "${!COMPONENTS[@]}" | wc -w)
• Cached Colors: ${#HEX_TO_256_CACHE[@]} calculations
• Current Action: $((ACTION_INDEX + 1))/${#actions[@]}
• View Mode: $(get_current_view_mode)
• Input Mode: $CURRENT_INPUT_MODE"

    FOOTER_CONTENT="$(format_footer_combined "Module Info" "i/k=nav | 1=actions 2=palette 3=info 4=repl | View: $(get_current_view_mode)")"
}

# Action catalog (restored from original)
show_action_catalog() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local current_modes=($(get_current_modes))
    local mode="${current_modes[$MODE_INDEX]}"
    local actions=($(get_actions))

    CONTENT="📋 Action Catalog for $env × $mode
$(generate_section_separator)

Available Actions with Signatures:

"
    for i in "${!actions[@]}"; do
        local action="${actions[$i]}"
        local prefix="  "
        if [[ $i -eq $ACTION_INDEX ]]; then
            prefix="► "
        fi

        if [[ "$action" == *:* ]]; then
            local verb="${action%%:*}"
            local noun="${action##*:}"

            # Get response type for signature
            local result_type="output"  # Default
            if command -v get_result_type >/dev/null 2>&1; then
                result_type=$(get_result_type "$verb" "$noun" "$mode" 2>/dev/null || echo "output")
            fi

            # Colorized signature with routing
            local routing=$(get_action_routing "$verb" "$noun")
            CONTENT+="$prefix$(printf "%2d" $((i+1))). $(render_action_verb_noun "$verb" "$noun") :: $routing
"
        else
            CONTENT+="$prefix$(printf "%2d" $((i+1))). $action
"
        fi
    done

    CONTENT+="
$(generate_section_separator)

Navigation:
• ↑↓ arrows or a/A to change actions
• Enter to execute current action
• 1-5 to switch views
• e/d for env/mode navigation"

    FOOTER_CONTENT="$(format_footer_combined "Action Catalog" "i/k=select | a=toggle | Enter=exec | 1-4=views | View: actions")"
    mark_component_dirty "content"
    mark_component_dirty "footer"
}

# Main application with enhanced architecture
main() {
    # Check for command line arguments
    if [[ "$1" == "repl" ]]; then
        run_standalone_repl
        return $?
    fi

    echo "Starting Enhanced TUI Framework - Component Architecture"
    echo "Features: Double-buffering, Components, Game-like Input"
    echo "DEMO_SRC: $DEMO_SRC"
    sleep 2

    # Initialize enhanced systems
    init_enhanced_tui
    init_terminal
    trap 'cleanup_terminal' EXIT

    # Start in actions view
    switch_view_mode "$VIEW_ACTIONS"

    # Run enhanced input loop
    run_game_input_loop

    echo "Enhanced TUI Framework ended - Component architecture demonstrated!"
}

main "$@"