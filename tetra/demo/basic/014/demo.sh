#!/usr/bin/env bash

# Demo 014: Harmonized TUI + Typed Actions
# Combines best of 010 (colors, rendering) and 013 (typed actions, TES)

# Source tetra first
source ~/tetra/tetra.sh

DEMO_DIR="$(dirname "${BASH_SOURCE[0]}")"

# Source modules
source "$DEMO_DIR/tui.conf"
source "$DEMO_DIR/bash/tui/typography.sh"
source "$DEMO_DIR/bash/tui/colors/color_core.sh"
source "$DEMO_DIR/bash/actions/state.sh"
source "$DEMO_DIR/bash/actions/router.sh"
source "$DEMO_DIR/bash/actions/registry.sh"
source "$DEMO_DIR/bash/actions/actions_impl.sh"
source "$DEMO_DIR/bash/actions/executor.sh"
source "$DEMO_DIR/bash/actions/module_discovery.sh"

# Application state
ENV_INDEX=0
MODE_INDEX=0
ACTION_INDEX=0
SHOW_DETAIL=false
VIEW_MODE=false
SCROLL_OFFSET=0

# Layout constants
TUI_HEIGHT=24
HEADER_LINES=5
SEPARATOR_LINES=1
FOOTER_LINES=5
CONTENT_VIEWPORT_HEIGHT=$((TUI_HEIGHT - HEADER_LINES - SEPARATOR_LINES - FOOTER_LINES))

# Execution contexts (where actions start from)
ENVIRONMENTS=("HELP" "Local" "Dev" "Staging" "Production")
MODES=("Inspect" "Transfer" "Execute")

# Get actions for current context
get_actions() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"

    local builtin_actions=""
    local module_actions=""

    # Built-in demo actions
    case "$env:$mode" in
        "HELP:"*)
            # HELP environment shows explanatory actions
            builtin_actions="help:signatures help:contexts help:modes help:operations"
            ;;
        "Local:Inspect")
            builtin_actions="show:demo show:help view:env view:toml status:local"
            ;;
        "Local:Transfer")
            builtin_actions="view:toml show:signatures"
            ;;
        "Local:Execute")
            builtin_actions="status:local show:signatures"
            ;;
        "Dev:Inspect")
            builtin_actions="view:env status:remote view:logs"
            ;;
        "Dev:Transfer")
            builtin_actions="fetch:config push:config sync:files"
            ;;
        "Dev:Execute")
            builtin_actions="status:remote view:logs"
            ;;
        "Staging:Inspect")
            builtin_actions="view:env status:remote view:logs"
            ;;
        "Staging:Transfer")
            builtin_actions="fetch:config push:config"
            ;;
        "Staging:Execute")
            builtin_actions="status:remote"
            ;;
        "Production:Inspect")
            builtin_actions="view:env status:remote"
            ;;
        "Production:Transfer")
            builtin_actions="fetch:config"
            ;;
        "Production:Execute")
            builtin_actions="status:remote"
            ;;
        *)
            builtin_actions="show:demo show:help"
            ;;
    esac

    # Get module actions
    module_actions=$(get_module_actions "$env" "$mode")

    # Combine built-in and module actions
    echo "$builtin_actions $module_actions"
}

# Render header with colorized action
render_header() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local actions=($(get_actions))

    # Title - emphasize ENV as execution context
    printf "Demo 014: Action Signatures | [\033[1;33m%s\033[0m %s \033[1;32m%s\033[0m]\n" "$env" "$CROSS_OP" "$mode"

    # Environment line - use tab for alignment
    printf "\033[36mEnvironment:\033[0m\t"
    for i in "${!ENVIRONMENTS[@]}"; do
        if [[ $i -eq $ENV_INDEX ]]; then
            printf "\033[1;33m%s%s%s\033[0m " "$TUI_BRACKET_LEFT" "${ENVIRONMENTS[$i]}" "$TUI_BRACKET_RIGHT"
        else
            echo -n "${ENVIRONMENTS[$i]} "
        fi
    done
    echo

    # Mode line - use tab for alignment
    printf "\033[35mMode:\033[0m\t\t"
    for i in "${!MODES[@]}"; do
        if [[ $i -eq $MODE_INDEX ]]; then
            printf "\033[1;32m%s%s%s\033[0m " "$TUI_BRACKET_LEFT" "${MODES[$i]}" "$TUI_BRACKET_RIGHT"
        else
            echo -n "${MODES[$i]} "
        fi
    done
    echo

    # Action line with colorized verb:noun - use tab
    printf "\033[36mAction:\033[0m\t\t"
    if [[ ${#actions[@]} -gt 0 ]]; then
        local current="${actions[$ACTION_INDEX]}"
        local verb="${current%%:*}"
        local noun="${current##*:}"
        local state=$(get_action_state "$current")
        local state_symbol=$(get_state_symbol "$state")

        # Refresh colors
        refresh_color_state_cached "$verb" "$noun"

        # Display as verb:noun :: (count)
        render_action_verb_noun "$verb" "$noun"
        printf " %s (%d/%d)" "$BIND_OP" $(($ACTION_INDEX + 1)) ${#actions[@]}

        # Show detail indicator
        if [[ "$SHOW_DETAIL" == "true" ]]; then
            echo -n " [detail]"
        fi
        echo
    else
        echo "[none]"
    fi

    # Status line - shows detail signature when toggled, or content title when idle
    printf "\033[36mStatus:\033[0m\t\t"
    if [[ ${#actions[@]} -gt 0 ]]; then
        local current="${actions[$ACTION_INDEX]}"
        local state=$(get_action_state "$current")
        local state_symbol=$(get_state_symbol "$state")

        if [[ "$SHOW_DETAIL" == "true" ]]; then
            # Show action signature detail
            local action_name="${current//:/_}"
            if declare -p "ACTION_${action_name}" &>/dev/null; then
                local -n _action="ACTION_${action_name}"
                printf "%s %s - " "$state_symbol" "$state"
                printf "(%s) → %s" "${_action[inputs]:-}" "${_action[output]}"
                [[ -n "${_action[effects]}" ]] && printf " [where %s]" "${_action[effects]}"
                echo
            else
                echo "$state_symbol $state"
            fi
        else
            # Show state, and if idle, show content title
            if [[ "$state" == "idle" && -n "${TUI_BUFFERS["@tui[content]"]}" ]]; then
                # Extract first line as title
                local content_title=$(echo -e "${TUI_BUFFERS["@tui[content]"]}" | head -n1)
                printf "%s %s - %s\n" "$state_symbol" "$state" "$content_title"
            else
                echo "$state_symbol $state"
            fi
        fi
    else
        echo "○ idle"
    fi
    render_separator
}

# Render content with viewport constraints
render_content() {
    # Get content
    local content=""
    if [[ -n "${TUI_BUFFERS["@tui[content]"]}" ]]; then
        content="${TUI_BUFFERS["@tui[content]"]}"
    else
        local env="${ENVIRONMENTS[$ENV_INDEX]}"
        content="🎯 Demo 014: Action Signatures & File Transfer

Execution Context: $env
  • Actions execute from @${env,,} context
  • Remote operations use @{context} as target
  • File transfers show source → target endpoints

Navigation:
  e - Cycle environment (Local/Dev/Staging/Production)
  m - Cycle mode (Inspect/Transfer/Execute)
  f - Cycle action
  i - Toggle action detail view
  v - View mode (scroll long content)
  ↑/↓ - Scroll in view mode
  Enter - Execute action

Features:
  • Clear I/O signatures: (inputs) → output [where effects]
  • Endpoint-aware operations (@local, @dev, @staging, @prod)
  • TES operation types (read, write, execute)"
    fi

    # In view mode, show scroll indicator and apply viewport
    if [[ "$VIEW_MODE" == "true" ]]; then
        # Count total lines
        local total_lines=$(echo -e "$content" | wc -l)
        local viewport_content_lines=$((CONTENT_VIEWPORT_HEIGHT - 1))  # Reserve 1 line for scroll indicator
        local max_offset=$((total_lines - viewport_content_lines))
        [[ $max_offset -lt 0 ]] && max_offset=0

        # Show viewport window with scroll position
        echo -e "$content" | tail -n +$((SCROLL_OFFSET + 1)) | head -n $viewport_content_lines

        # Always show scroll indicator in view mode
        local end_line=$((SCROLL_OFFSET + viewport_content_lines))
        [[ $end_line -gt $total_lines ]] && end_line=$total_lines
        echo -e "${TUI_TEXT_DIM}[Viewing $((SCROLL_OFFSET + 1))-${end_line} of $total_lines lines | ↑/↓=scroll ESC=back]${TUI_TEXT_NORMAL}"
    else
        # Normal mode: truncate to viewport height, reserve 1 line for truncation message if needed
        local line_count=$(echo -e "$content" | wc -l)
        if [[ $line_count -gt $CONTENT_VIEWPORT_HEIGHT ]]; then
            local display_lines=$((CONTENT_VIEWPORT_HEIGHT - 1))
            echo -e "$content" | head -n $display_lines
            echo -e "${TUI_TEXT_DIM}[Content truncated - press 'v' to view all]${TUI_TEXT_NORMAL}"
        else
            echo -e "$content"
        fi
    fi
}

# Render footer (grey text, no separator)
render_footer() {
    echo ""  # Blank line instead of separator

    if [[ -n "${TUI_BUFFERS["@tui[footer]"]}" ]]; then
        echo -e "${TUI_TEXT_DIM}${TUI_BUFFERS["@tui[footer]"]}${TUI_TEXT_NORMAL}"
    else
        if [[ "$VIEW_MODE" == "true" ]]; then
            echo -e "${TUI_TEXT_DIM}$(center_text "↑/↓=scroll  ESC=back  q=quit" 50)${TUI_TEXT_NORMAL}"
        else
            echo -e "${TUI_TEXT_DIM}$(center_text "e=env  m=mode  f=action  i=detail  v=view" 50)${TUI_TEXT_NORMAL}"
            echo -e "${TUI_TEXT_DIM}$(center_text "Enter=exec  s=sigs  l=log  c=clear  q=quit" 50)${TUI_TEXT_NORMAL}"
        fi
        echo ""
    fi
}

# Render full screen
render_screen() {
    clear
    render_header
    render_content
    render_footer
}

# Execute current action
execute_current_action() {
    local actions=($(get_actions))
    local action="${actions[$ACTION_INDEX]}"

    [[ -z "$action" ]] && return

    local current_state=$(get_action_state "$action")

    # Handle error state - clear on next execute
    if [[ "$current_state" == "error" ]]; then
        set_action_state "$action" "idle"
        clear_content
        return
    fi

    # Handle success state - clear on next execute
    if [[ "$current_state" == "success" ]]; then
        set_action_state "$action" "idle"
        return
    fi

    # Execute
    set_action_state "$action" "executing"
    render_screen
    sleep 0.3

    # Check if this is a module action
    if is_module_action "$action"; then
        # Execute through module system
        local output=$(execute_module_action "$action" 2>&1)
        local exit_code=$?

        if [[ $exit_code -eq 0 ]]; then
            TUI_BUFFERS["@tui[content]"]="$output"
            set_action_state "$action" "success"
        else
            TUI_BUFFERS["@tui[content]"]="Error executing $action:\n$output"
            set_action_state "$action" "error"
        fi
    else
        # Execute built-in demo action
        execute_action_with_feedback "$action"
        exit_code=$?
    fi

    render_screen
    sleep 0.3

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
}

# Show execution log
show_execution_log() {
    if [[ ! -f "$EXEC_LOG_FILE" ]]; then
        TUI_BUFFERS["@tui[content]"]="No execution log found."
        return
    fi

    local log_display="Recent Actions:\n"

    tail -10 "$EXEC_LOG_FILE" | while IFS= read -r line; do
        local timestamp=$(echo "$line" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4)
        local verb=$(echo "$line" | grep -o '"verb":"[^"]*"' | cut -d'"' -f4)
        local subject=$(echo "$line" | grep -o '"subject":"[^"]*"' | cut -d'"' -f4)
        local status=$(echo "$line" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

        refresh_color_state_cached "$verb" "$subject"
        printf "${timestamp:11:8} "
        render_action_verb_noun "$verb" "$subject"
        printf " - %s\n" "$status"
    done > /tmp/demo014_log_output

    log_display+=$(cat /tmp/demo014_log_output)
    TUI_BUFFERS["@tui[content]"]="$log_display"
}

# Main loop
main() {
    echo "🎯 Demo 014: Action Signatures & File Transfer"
    echo "Discovering tetra modules..."
    discover_tetra_modules
    echo "Starting in 1 second..."
    sleep 1

    while true; do
        render_screen

        read -rsn1 key

        # Handle ESC sequences (arrow keys, ESC)
        if [[ "$key" == $'\x1b' ]]; then
            read -rsn2 -t 0.01 key2
            if [[ -z "$key2" ]]; then
                # Pure ESC - exit view mode
                if [[ "$VIEW_MODE" == "true" ]]; then
                    VIEW_MODE=false
                    SCROLL_OFFSET=0
                    continue
                fi
            else
                # ESC sequence (arrow key, etc)
                key="$key$key2"
            fi
        fi

        case "$key" in
            'e'|'E')
                VIEW_MODE=false
                SCROLL_OFFSET=0
                nav_env_right
                SHOW_DETAIL=false
                clear_content
                ;;
            'm'|'M')
                VIEW_MODE=false
                SCROLL_OFFSET=0
                nav_mode_right
                SHOW_DETAIL=false
                clear_content
                ;;
            'f'|'F')
                nav_action_right
                [[ "$SHOW_DETAIL" == "true" ]] && continue  # Update detail view
                ;;
            'i'|'I')
                # Toggle detail view
                if [[ "$SHOW_DETAIL" == "true" ]]; then
                    SHOW_DETAIL=false
                    clear_content
                else
                    SHOW_DETAIL=true
                fi
                ;;
            'v'|'V')
                # Toggle view mode
                if [[ "$VIEW_MODE" == "true" ]]; then
                    VIEW_MODE=false
                    SCROLL_OFFSET=0
                else
                    VIEW_MODE=true
                    SCROLL_OFFSET=0
                fi
                ;;
            $'\x1b[A')
                # Up arrow - scroll up in view mode
                if [[ "$VIEW_MODE" == "true" ]]; then
                    [[ $SCROLL_OFFSET -gt 0 ]] && ((SCROLL_OFFSET--))
                fi
                ;;
            $'\x1b[B')
                # Down arrow - scroll down in view mode
                if [[ "$VIEW_MODE" == "true" ]]; then
                    local content="${TUI_BUFFERS["@tui[content]"]}"
                    local total_lines=$(echo -e "$content" | wc -l)
                    local viewport_content_lines=$((CONTENT_VIEWPORT_HEIGHT - 1))
                    local max_offset=$((total_lines - viewport_content_lines))
                    [[ $max_offset -lt 0 ]] && max_offset=0
                    [[ $SCROLL_OFFSET -lt $max_offset ]] && ((SCROLL_OFFSET++))
                fi
                ;;
            ''|$'\n')
                VIEW_MODE=false
                SCROLL_OFFSET=0
                SHOW_DETAIL=false
                execute_current_action
                ;;
            's'|'S')
                VIEW_MODE=false
                SCROLL_OFFSET=0
                SHOW_DETAIL=false
                TUI_BUFFERS["@tui[content]"]="$(list_action_signatures)"
                ;;
            'l'|'L')
                VIEW_MODE=false
                SCROLL_OFFSET=0
                SHOW_DETAIL=false
                show_execution_log
                ;;
            'c'|'C')
                VIEW_MODE=false
                SCROLL_OFFSET=0
                SHOW_DETAIL=false
                clear_content
                ;;
            'q'|'Q') break ;;
        esac
    done

    clear
    echo "Demo 014 complete."
}

main "$@"
