#!/usr/bin/env bash

# Version 011: ENV-based configuration system
# All TUI design elements defined as ENV_VARs in config file
# Demonstrates clean separation for HTML/CSS generation

DEMO_DIR="$(dirname "${BASH_SOURCE[0]}")"

# Load configuration
source "$DEMO_DIR/tui.conf"

# Application state
ENV_INDEX=0
MODE_INDEX=0
ACTION_INDEX=0
CONTENT=""

ENVIRONMENTS=("APP" "DEV")
MODES=("Learn" "Try" "Test")

# Get actions for current context
get_actions() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"

    case "$env:$mode" in
        "APP:Learn")
            echo "show:demo show:help"
            ;;
        "APP:Try")
            echo "show:demo configure:demo show:help"
            ;;
        "DEV:"*)
            echo "show:demo configure:demo test:demo show:config"
            ;;
        *)
            echo "show:help"
            ;;
    esac
}

# Component renderers - use ENV_VARs for all styling

render_separator() {
    local width="${1:-$TUI_SEPARATOR_WIDTH}"
    printf '%*s' "$width" '' | tr ' ' "$TUI_SEPARATOR_CHAR"
    echo
}

render_env_line() {
    echo -n "$TUI_LABEL_ENV "
    for i in "${!ENVIRONMENTS[@]}"; do
        if [[ $i -eq $ENV_INDEX ]]; then
            echo -n "${TUI_BRACKET_LEFT}${ENVIRONMENTS[$i]}${TUI_BRACKET_RIGHT} "
        else
            echo -n "${ENVIRONMENTS[$i]} "
        fi
    done
    echo
}

render_mode_line() {
    echo -n "$TUI_LABEL_MODE "
    for i in "${!MODES[@]}"; do
        if [[ $i -eq $MODE_INDEX ]]; then
            echo -n "${TUI_BRACKET_LEFT}${MODES[$i]}${TUI_BRACKET_RIGHT} "
        else
            echo -n "${MODES[$i]} "
        fi
    done
    echo
}

render_action_line() {
    local actions=($@)
    echo -n "$TUI_LABEL_ACTION "

    if [[ ${#actions[@]} -gt 0 ]]; then
        local current="${actions[$ACTION_INDEX]}"
        echo -n "${TUI_BRACKET_LEFT}${current}${TUI_BRACKET_RIGHT} "
        echo "($(($ACTION_INDEX + 1))/${#actions[@]})"
    else
        echo "[none]"
    fi
}

render_header() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local actions=($(get_actions))

    echo "TUI Framework | $env × $mode"
    render_env_line
    render_mode_line
    render_action_line "${actions[@]}"
}

render_content() {
    render_separator

    if [[ -n "$CONTENT" ]]; then
        echo -e "$CONTENT"
    else
        echo "🎯 Demo 011: ENV-Based Configuration"
        echo ""
        echo "All design elements configured via ENV_VARs in tui.conf:"
        echo ""
        echo "$TUI_BULLET_CHAR Layout: HEADER(${TUI_HEADER_HEIGHT}) + CONTENT + CLI(${TUI_CLI_HEIGHT}) + FOOTER(${TUI_FOOTER_HEIGHT})"
        echo "$TUI_BULLET_CHAR Separator: '${TUI_SEPARATOR_CHAR}' × ${TUI_SEPARATOR_WIDTH}"
        echo "$TUI_BULLET_CHAR Indent: ${TUI_CONTENT_INDENT} spaces"
        echo "$TUI_BULLET_CHAR Bullets: '${TUI_BULLET_CHAR}'"
        echo ""
        echo "This design makes HTML/CSS generation straightforward:"
        echo "  TUI_HEADER_HEIGHT → .tui-header { line-height: ${TUI_HEADER_HEIGHT}em }"
        echo "  TUI_SEPARATOR_CHAR → .separator::before { content: '${TUI_SEPARATOR_CHAR}' }"
        echo ""
        echo "Execute an action to see results here."
    fi
}

render_footer() {
    render_separator 40
    echo "e=env d=mode f=action Enter=exec c=clear q=quit"
}

render_screen() {
    [[ "$TUI_CLEAR_SCREEN" == "true" ]] && clear

    render_header
    render_content
    render_footer
}

# Action execution
execute_current_action() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local actions=($(get_actions))
    local action="${actions[$ACTION_INDEX]}"

    if [[ -z "$action" ]]; then
        CONTENT="Error: No action selected"
        return
    fi

    local verb="${action%%:*}"
    local noun="${action##*:}"

    CONTENT="🚀 Executed: $verb × $noun\n"
    CONTENT+="$(render_separator)\n\n"

    case "$action" in
        "show:demo")
            CONTENT+="📋 Demo Information\n\n"
            CONTENT+="Context: $env × $mode\n"
            CONTENT+="This demonstrates ENV-based configuration.\n"
            ;;
        "show:config")
            CONTENT+="⚙️  Configuration Values\n\n"
            CONTENT+="TUI_HEADER_HEIGHT=$TUI_HEADER_HEIGHT\n"
            CONTENT+="TUI_SEPARATOR_WIDTH=$TUI_SEPARATOR_WIDTH\n"
            CONTENT+="TUI_SEPARATOR_CHAR='$TUI_SEPARATOR_CHAR'\n"
            CONTENT+="TUI_CONTENT_INDENT=$TUI_CONTENT_INDENT\n"
            ;;
        "show:help")
            CONTENT+="❓ Help\n\n"
            CONTENT+="Navigation:\n"
            CONTENT+="  e/E - Cycle environments\n"
            CONTENT+="  d/D - Cycle modes\n"
            CONTENT+="  f/F - Cycle actions\n"
            CONTENT+="  Enter - Execute action\n"
            CONTENT+="  c - Clear content\n"
            CONTENT+="  q - Quit\n"
            ;;
        "configure:demo")
            CONTENT+="🔧 Configure Demo\n\n"
            CONTENT+="In a real implementation, this would:\n"
            CONTENT+="  - Allow editing ENV_VARs\n"
            CONTENT+="  - Update tui.conf\n"
            CONTENT+="  - Reload UI with new settings\n"
            ;;
        "test:demo")
            CONTENT+="🧪 Test Demo\n\n"
            CONTENT+="Running validation:\n"
            CONTENT+="  ✓ Config loaded\n"
            CONTENT+="  ✓ All ENV_VARs defined\n"
            CONTENT+="  ✓ Components rendering\n"
            ;;
        *)
            CONTENT+="Action: $action\n"
            CONTENT+="Not yet implemented.\n"
            ;;
    esac
}

# Navigation
nav_env_right() {
    ENV_INDEX=$(( (ENV_INDEX + 1) % ${#ENVIRONMENTS[@]} ))
    ACTION_INDEX=0
}

nav_mode_right() {
    MODE_INDEX=$(( (MODE_INDEX + 1) % ${#MODES[@]} ))
    ACTION_INDEX=0
}

nav_action_right() {
    local actions=($(get_actions))
    [[ ${#actions[@]} -gt 0 ]] && ACTION_INDEX=$(( (ACTION_INDEX + 1) % ${#actions[@]} ))
}

clear_content() {
    CONTENT=""
}

# Main loop
main() {
    echo "Starting TUI Framework Demo 011..."
    echo "ENV-based configuration system"
    sleep 1

    while true; do
        render_screen
        read -n1 -s key

        case "$key" in
            'e'|'E') nav_env_right ;;
            'd'|'D') nav_mode_right ;;
            'f'|'F') nav_action_right ;;
            $'\n'|$'\r') execute_current_action ;;
            'c'|'C') clear_content ;;
            'q'|'Q') break ;;
        esac
    done

    clear
    echo "Demo 011 complete!"
}

main "$@"
