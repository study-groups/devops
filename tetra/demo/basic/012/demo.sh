#!/usr/bin/env bash

# Version 012: Action routing with @annotations
# Actions declare their output routing: @tui[component] or @app[stream]
# Router directs output based on signature

DEMO_DIR="$(dirname "${BASH_SOURCE[0]}")"

source "$DEMO_DIR/tui.conf"
source "$DEMO_DIR/action_registry.sh"
source "$DEMO_DIR/action_state.sh"
source "$DEMO_DIR/action_preview.sh"
source "$DEMO_DIR/modal.sh"
source "$DEMO_DIR/router.sh"
source "$DEMO_DIR/action_executor.sh"

# Application state
ENV_INDEX=0
MODE_INDEX=0
ACTION_INDEX=0

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
            echo "show:demo configure:demo test:demo show:config show:routes"
            ;;
        *)
            echo "show:help"
            ;;
    esac
}

# Component renderers

render_separator() {
    printf '%*s' "${1:-$TUI_SEPARATOR_WIDTH}" '' | tr ' ' "$TUI_SEPARATOR_CHAR"
    echo
}

render_header() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local actions=($(get_actions))

    echo "TUI Framework | $env $CROSS_OP $mode"

    # Env line
    echo -n "$TUI_LABEL_ENV "
    for i in "${!ENVIRONMENTS[@]}"; do
        if [[ $i -eq $ENV_INDEX ]]; then
            echo -n "${TUI_BRACKET_LEFT}${ENVIRONMENTS[$i]}${TUI_BRACKET_RIGHT} "
        else
            echo -n "${ENVIRONMENTS[$i]} "
        fi
    done
    echo

    # Mode line
    echo -n "$TUI_LABEL_MODE "
    for i in "${!MODES[@]}"; do
        if [[ $i -eq $MODE_INDEX ]]; then
            echo -n "${TUI_BRACKET_LEFT}${MODES[$i]}${TUI_BRACKET_RIGHT} "
        else
            echo -n "${MODES[$i]} "
        fi
    done
    echo

    # Action line with signature and state at end
    echo -n "$TUI_LABEL_ACTION "
    if [[ ${#actions[@]} -gt 0 ]]; then
        local current="${actions[$ACTION_INDEX]}"
        local action_name="${current//:/_}"
        local state=$(get_action_state "$current")
        local state_symbol=$(get_state_symbol "$state")

        # Get action details
        if declare -p "ACTION_${action_name}" &>/dev/null; then
            local -n _action="ACTION_${action_name}"
            local inputs="${_action[inputs]}"
            local output="${_action[output]}"
            local effects="${_action[effects]}"

            # Build signature parts
            local input_part="(${inputs})"
            local output_part="$output"
            [[ -n "$effects" ]] && output_part="$output where $effects"

            echo -n "${TUI_BRACKET_LEFT}${current}${TUI_BRACKET_RIGHT} $ENDPOINT_OP $input_part $FLOW_OP $output_part "
            echo "($(($ACTION_INDEX + 1))/${#actions[@]}) $state_symbol $state"
        else
            echo "${TUI_BRACKET_LEFT}${current}${TUI_BRACKET_RIGHT} ($(($ACTION_INDEX + 1))/${#actions[@]}) $state_symbol $state"
        fi
    else
        echo "[none]"
    fi
}

render_content() {
    render_separator

    if [[ -n "${TUI_BUFFERS[@tui[content]]}" ]]; then
        echo -e "${TUI_BUFFERS[@tui[content]]}"
    else
        echo "🎯 Demo 012: TES-Compliant Action Execution"
        echo ""
        echo "FEATURES:"
        echo "$TUI_BULLET_CHAR Actions declare signature: (inputs) $FLOW_OP output where effects"
        echo "$TUI_BULLET_CHAR State machine: idle $FLOW_OP executing $FLOW_OP success $FLOW_OP idle"
        echo "$TUI_BULLET_CHAR Visible state transitions (0.5s executing, 0.3s success)"
        echo "$TUI_BULLET_CHAR Observer pattern: executor updates buffers, main loop renders"
        echo "$TUI_BULLET_CHAR Unified logging to tetra.jsonl (try/success/fail)"
        echo ""
        echo "ACTION SIGNATURE FORMAT:"
        echo "  action $ENDPOINT_OP (inputs) $FLOW_OP output where effects"
        echo "  show:demo  $ENDPOINT_OP () $FLOW_OP @tui[content]"
        echo "  test:demo  $ENDPOINT_OP () $FLOW_OP @tui[content] where @tui[footer],@app[stdout]"
        echo ""
        echo "STATE LIFECYCLE:"
        echo "  1. Press Enter $FLOW_OP state changes to ▶ executing (0.5s delay)"
        echo "  2. Action executes $FLOW_OP state changes to ✓ success (0.3s delay)"
        echo "  3. Auto-return $FLOW_OP state changes to ● idle"
        echo ""
        echo "KEYBOARD SHORTCUTS:"
        echo "  f = cycle actions | Enter = execute action"
        echo "  r = routing table | s = app stream | l = log | c = clear"
        echo ""
        echo "Try: Press 'f' to select an action, then Enter to execute!"
    fi
}

render_footer() {
    render_separator 40

    if [[ -n "${TUI_BUFFERS[@tui[footer]]}" ]]; then
        echo -e "${TUI_TEXT_DIM}${TUI_BUFFERS[@tui[footer]]}${TUI_TEXT_NORMAL}"
    else
        echo "e=env d=mode f=action Enter=exec r=routes s=stream l=log c=clear q=quit"
    fi
}

render_screen() {
    [[ "$TUI_CLEAR_SCREEN" == "true" ]] && clear

    render_header
    render_content
    render_footer
}

# Action execution with routing

execute_action_impl() {
    local action="$1"
    local verb="${action%%:*}"
    local noun="${action##*:}"

    case "$action" in
        "show:demo")
            local sig=$(build_action_signature "$action")
            echo "📋 Demo 012: TES Action Execution\n"
            echo "$(render_separator)\n\n"
            echo "This action's full signature:\n"
            echo "  $sig\n\n"
            echo "Breakdown:\n"
            echo "  • Action: $action\n"
            echo "  • Inputs: () - no input resources\n"
            echo "  • Output: @tui[content] - primary display target\n"
            echo "  • Effects: (none) - no side effects\n\n"
            echo "State Lifecycle:\n"
            echo "  idle $FLOW_OP executing $FLOW_OP success $FLOW_OP idle\n"
            echo "  Watch the header status change as you cycle actions!\n\n"
            echo "Every execution is:\n"
            echo "  1. Logged to tetra.jsonl (try/success/fail)\n"
            echo "  2. Timed in milliseconds\n"
            echo "  3. Routed to output + effects\n\n"
            echo "Press 'l' to view the execution log!\n"
            ;;
        "show:routes")
            echo "$(list_action_signatures)\n\n"
            echo "Total registered actions: $(compgen -A variable | grep -c "^ACTION_")"
            ;;
        "show:config")
            echo "⚙️  Configuration\n"
            echo "$(render_separator)\n\n"
            echo "Operators:\n"
            echo "  CROSS_OP=$CROSS_OP\n"
            echo "  FLOW_OP=$FLOW_OP\n"
            echo "  ROUTE_OP=$ROUTE_OP\n"
            echo "  ENDPOINT_OP=$ENDPOINT_OP\n\n"
            echo "TUI Settings:\n"
            echo "  TUI_HEADER_HEIGHT=$TUI_HEADER_HEIGHT\n"
            echo "  TUI_SEPARATOR_WIDTH=$TUI_SEPARATOR_WIDTH\n"
            echo "  TUI_SEPARATOR_CHAR='$TUI_SEPARATOR_CHAR'\n"
            ;;
        "show:help")
            echo "❓ Help: TES Action System\n"
            echo "$(render_separator)\n\n"
            echo "Navigation:\n"
            echo "  e/E   - Cycle environments\n"
            echo "  d/D   - Cycle modes\n"
            echo "  f/F   - Cycle actions\n"
            echo "  Enter - Execute current action (watch state change!)\n\n"
            echo "Views:\n"
            echo "  r     - Show routing table (all action signatures)\n"
            echo "  s     - Show app stream (@app[stdout])\n"
            echo "  l     - Show execution log (tetra.jsonl)\n"
            echo "  c     - Clear content buffer\n\n"
            echo "Other:\n"
            echo "  q     - Quit demo\n\n"
            echo "State Transitions (Observable!):\n"
            echo "  ● idle $FLOW_OP ▶ executing $FLOW_OP ✓ success $FLOW_OP ● idle\n\n"
            echo "TES Compliance:\n"
            echo "  • Observer pattern: executor updates, main loop renders\n"
            echo "  • All executions logged with try/success/fail + timing\n"
            echo "  • Output routed to declared targets (output + effects)\n"
            ;;
        "configure:demo")
            echo "🔧 Configure Demo\n"
            echo "$(render_separator)\n\n"
            echo "This action demonstrates output vs effects:\n"
            echo "  • Output: @tui[content] (primary - you see it here)\n"
            echo "  • Effects: @app[stdout] (secondary - logged to stream)\n\n"
            echo "The distinction:\n"
            echo "  - Output is WHERE the result goes (main destination)\n"
            echo "  - Effects are side channels (logging, metrics, etc.)\n\n"
            echo "Check the app stream (press 's') to see the effect!\n"
            ;;
        "test:demo")
            echo "🧪 Test Demo\n"
            echo "$(render_separator)\n\n"
            echo "Running validation:\n"
            echo "  ✓ Config loaded\n"
            echo "  ✓ Action registry: $(compgen -A variable | grep -c "^ACTION_") actions\n"
            echo "  ✓ Routing system operational\n\n"
            echo "Signature: test:demo $ENDPOINT_OP () $FLOW_OP @tui[content] where @tui[footer],@app[stdout]\n\n"
            echo "This demonstrates:\n"
            echo "  • Output: @tui[content] (primary - this display)\n"
            echo "  • Effects: @tui[footer], @app[stdout] (secondaries)\n\n"
            echo "Check footer and stream (press 's') to see all effects!\n"
            ;;
        *)
            echo "Action: $action\n"
            echo "Not yet implemented.\n"
            ;;
    esac
}

execute_current_action() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local actions=($(get_actions))
    local action="${actions[$ACTION_INDEX]}"

    [[ -z "$action" ]] && return

    local current_state=$(get_action_state "$action")

    # Handle error state - require acknowledgment
    if [[ "$current_state" == "error" ]]; then
        # Reset to idle and clear error
        set_action_state "$action" "idle"
        clear_content
        TUI_BUFFERS[@tui[footer]]=""
        return
    fi

    # Handle success state - return to idle
    if [[ "$current_state" == "success" ]]; then
        set_action_state "$action" "idle"
        return
    fi

    # Clear content and footer before execution
    clear_content
    TUI_BUFFERS[@tui[footer]]=""

    # PHASE 1: Show executing state
    set_action_state "$action" "executing"
    render_screen
    sleep 0.5  # User sees ▶ executing in header

    # PHASE 2: Execute action (updates buffers via observer pattern)
    execute_action_with_feedback "$action"
    local exit_code=$?

    # PHASE 3: Show success state
    render_screen
    sleep 0.3  # User sees ✓ success with final output

    # PHASE 4: Return to idle
    if [[ $exit_code -eq 0 ]]; then
        set_action_state "$action" "idle"
    fi
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

    # Clear previous action's content when cycling
    clear_content
    TUI_BUFFERS[@tui[footer]]=""
}

show_routing_table() {
    TUI_BUFFERS[@tui[content]]="$(list_action_signatures)"
}

show_app_stream() {
    local stream_output=$(get_app_stream "@app[stdout]")

    if [[ -z "$stream_output" ]]; then
        TUI_BUFFERS[@tui[content]]="@app[stdout] Stream\n$(render_separator)\n\nNo entries yet.\n\nActions that route to @app[stdout] will appear here."
    else
        TUI_BUFFERS[@tui[content]]="@app[stdout] Stream\n$(render_separator)\n\n$stream_output"
    fi
}

show_execution_log_view() {
    local log_content=$(show_execution_log)
    TUI_BUFFERS[@tui[content]]="$log_content"
}

# Main loop
main() {
    echo "Starting TUI Framework Demo 012..."
    echo "Action routing with @annotations + State Machine + Observer Pattern"
    echo ""
    echo "Features:"
    echo "  • All actions require Enter to execute"
    echo "  • Visible state transitions: ● idle → ▶ executing → ✓ success → ● idle"
    echo "  • Observer pattern: executor updates buffers, main loop renders"
    echo "  • New signature format: (inputs) → output where effects"
    echo "  • Clean separation: output (primary) vs effects (secondary)"
    sleep 2

    while true; do
        render_screen
        read -n1 -s key

        case "$key" in
            'e'|'E') nav_env_right ;;
            'd'|'D') nav_mode_right ;;
            'f'|'F') nav_action_right ;;
            $'\n'|$'\r') execute_current_action ;;
            'r'|'R') show_routing_table ;;
            's'|'S') show_app_stream ;;
            'l'|'L') show_execution_log_view ;;
            'c'|'C') clear_content ;;
            'q'|'Q') break ;;
        esac
    done

    clear
    echo "Demo 012 complete!"
}

main "$@"
