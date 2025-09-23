#!/usr/bin/env bash

# TView Layout Manager - Top-down interface with sticky elements
# Single responsibility: Terminal layout management and screen regions

# Layout constants
declare -g TOP_HEADER_LINES=4
declare -g BOTTOM_STATUS_LINES=3
declare -g MIN_RESULT_LINES=8  # Reduced for 80x24 compatibility

# Layout state
declare -gA LAYOUT_STATE=(
    ["result_content"]=""
    ["result_scroll"]="0"
    ["result_lines"]="0"
    ["show_results"]="false"
)

# Calculate available screen regions
calculate_layout_regions() {
    local terminal_height=${LINES:-24}
    local terminal_width=${COLUMNS:-80}

    # Fixed regions
    local header_end=$TOP_HEADER_LINES
    local status_start=$((terminal_height - BOTTOM_STATUS_LINES + 1))

    # Variable middle region
    local available_middle=$((status_start - header_end - 1))

    if [[ ${LAYOUT_STATE["show_results"]} == "true" ]]; then
        # Split middle region: actions list + results window
        # For 80x24, we have ~17 lines available (24 - 4 header - 3 status)
        # Allocate minimum 5 for actions, rest for results
        local action_lines=5  # Fixed compact size for actions
        local result_lines=$((available_middle - action_lines))

        # Ensure minimums based on terminal size
        if [[ $terminal_height -le 24 ]]; then
            # Compact layout for small terminals
            if [[ $result_lines -lt 6 ]]; then result_lines=6; fi
        else
            # More generous for larger terminals
            if [[ $action_lines -lt 8 ]]; then action_lines=8; fi
            if [[ $result_lines -lt $MIN_RESULT_LINES ]]; then result_lines=$MIN_RESULT_LINES; fi
        fi

        export LAYOUT_HEADER_START=1
        export LAYOUT_HEADER_END=$header_end
        export LAYOUT_ACTION_START=$((header_end + 1))
        export LAYOUT_ACTION_END=$((header_end + action_lines))
        export LAYOUT_RESULT_START=$((LAYOUT_ACTION_END + 1))
        export LAYOUT_RESULT_END=$((status_start - 1))
        export LAYOUT_STATUS_START=$status_start
        export LAYOUT_STATUS_END=$terminal_height
    else
        # Full middle region for actions
        export LAYOUT_HEADER_START=1
        export LAYOUT_HEADER_END=$header_end
        export LAYOUT_ACTION_START=$((header_end + 1))
        export LAYOUT_ACTION_END=$((status_start - 1))
        export LAYOUT_RESULT_START=0
        export LAYOUT_RESULT_END=0
        export LAYOUT_STATUS_START=$status_start
        export LAYOUT_STATUS_END=$terminal_height
    fi

    export LAYOUT_WIDTH=$terminal_width
    export LAYOUT_HEIGHT=$terminal_height
}

# Clear specific screen region
clear_region() {
    local start_line="$1"
    local end_line="$2"

    for ((line=start_line; line<=end_line; line++)); do
        printf "\033[${line};1H\033[K"
    done
}

# Render the fixed header (top 4 lines)
render_fixed_header() {
    printf "\033[${LAYOUT_HEADER_START};1H"
    render_header  # Use existing header function
}

# Render action list in the allocated space
render_action_list() {
    local start_line=$LAYOUT_ACTION_START
    local end_line=$LAYOUT_ACTION_END
    local available_lines=$((end_line - start_line + 1))

    printf "\033[${start_line};1H"

    # Generate action list based on current Env x Mode
    local action_content
    action_content=$(generate_mode_action_list)

    # Display actions with scrolling if needed
    echo "$action_content" | head -n "$available_lines"
}

# Generate action list for current Env x Mode combination
generate_mode_action_list() {
    local terminal_width=${COLUMNS:-80}

    echo
    if [[ $terminal_width -le 80 ]]; then
        echo "$CURRENT_MODE Actions:"
    else
        echo "$(colorize_mode "$CURRENT_MODE" "$CURRENT_MODE") Actions for $(colorize_env "$CURRENT_ENV" "$CURRENT_ENV"):"
    fi
    echo

    case "$CURRENT_MODE:$CURRENT_ENV" in
        "TSM:LOCAL")
            if [[ $terminal_width -le 80 ]]; then
                cat << EOF
$(highlight_line "Service Status" "$(is_current_item 0)" "$ACTION_SERVICE_COLOR")
$(highlight_line "Config Check" "$(is_current_item 1)" "$ACTION_CONFIG_COLOR")
$(highlight_line "Service List" "$(is_current_item 2)" "$ACTION_VIEW_COLOR")
$(highlight_line "View Logs" "$(is_current_item 3)" "$ACTION_VIEW_COLOR")
EOF
            else
                cat << EOF
$(highlight_line "Service Status" "$(is_current_item 0)" "$ACTION_SERVICE_COLOR")     ${UI_MUTED_COLOR}Check local services${COLOR_RESET}
$(highlight_line "Configuration Check" "$(is_current_item 1)" "$ACTION_CONFIG_COLOR")  ${UI_MUTED_COLOR}Validate config${COLOR_RESET}
$(highlight_line "Service List" "$(is_current_item 2)" "$ACTION_VIEW_COLOR")        ${UI_MUTED_COLOR}Show running services${COLOR_RESET}
$(highlight_line "View Logs" "$(is_current_item 3)" "$ACTION_VIEW_COLOR")          ${UI_MUTED_COLOR}Local service logs${COLOR_RESET}
EOF
            fi
            ;;
        "TSM:DEV"|"TSM:STAGING"|"TSM:PROD"|"TSM:QA")
            if [[ $terminal_width -le 80 ]]; then
                cat << EOF
$(highlight_line "SSH Test" "$(is_current_item 0)" "$ACTION_SSH_COLOR")
$(highlight_line "Service Status" "$(is_current_item 1)" "$ACTION_SERVICE_COLOR")
$(highlight_line "Service List" "$(is_current_item 2)" "$ACTION_SERVICE_COLOR")
$(highlight_line "Tail Logs" "$(is_current_item 3)" "$ACTION_VIEW_COLOR")
$(highlight_line "Enter REPL" "$(is_current_item 4)" "$ACTION_SSH_COLOR")
EOF
            else
                cat << EOF
$(highlight_line "SSH Test" "$(is_current_item 0)" "$ACTION_SSH_COLOR")           ${UI_MUTED_COLOR}Test connection${COLOR_RESET}
$(highlight_line "Service Status" "$(is_current_item 1)" "$ACTION_SERVICE_COLOR")     ${UI_MUTED_COLOR}Check systemctl${COLOR_RESET}
$(highlight_line "Service List" "$(is_current_item 2)" "$ACTION_SERVICE_COLOR")      ${UI_MUTED_COLOR}List all services${COLOR_RESET}
$(highlight_line "Tail Logs" "$(is_current_item 3)" "$ACTION_VIEW_COLOR")          ${UI_MUTED_COLOR}View recent logs${COLOR_RESET}
$(highlight_line "Enter REPL" "$(is_current_item 4)" "$ACTION_SSH_COLOR")         ${UI_MUTED_COLOR}Interactive shell${COLOR_RESET}
EOF
            fi
            ;;
        "RCM:LOCAL")
            cat << EOF
$(highlight_line "Direct Execution" "$(is_current_item 0)" "$ACTION_VIEW_COLOR")    ${UI_MUTED_COLOR}Run commands locally${COLOR_RESET}
$(highlight_line "Command History" "$(is_current_item 1)" "$ACTION_VIEW_COLOR")     ${UI_MUTED_COLOR}Previous commands${COLOR_RESET}
EOF
            ;;
        "RCM:DEV"|"RCM:STAGING"|"RCM:PROD"|"RCM:QA")
            # Show available remote commands
            local selected_commands=($(printf '%s\n' "${!RCM_COMMANDS[@]}" | sort))
            local index=0
            for cmd_name in "${selected_commands[@]}"; do
                echo "$(highlight_line "$cmd_name" "$(is_current_item $index)" "$ACTION_SSH_COLOR")     ${UI_MUTED_COLOR}${RCM_COMMANDS[$cmd_name]}${COLOR_RESET}"
                ((index++))
            done
            ;;
        "TKM:"*)
            cat << EOF
$(highlight_line "SSH Key Status" "$(is_current_item 0)" "$ACTION_VIEW_COLOR")      ${UI_MUTED_COLOR}Check key access${COLOR_RESET}
$(highlight_line "Test Connection" "$(is_current_item 1)" "$ACTION_SSH_COLOR")      ${UI_MUTED_COLOR}Verify SSH${COLOR_RESET}
$(highlight_line "Key Management" "$(is_current_item 2)" "$ACTION_CONFIG_COLOR")    ${UI_MUTED_COLOR}Manage keys${COLOR_RESET}
EOF
            ;;
        "DEPLOY:"*)
            cat << EOF
$(highlight_line "Deploy Status" "$(is_current_item 0)" "$ACTION_VIEW_COLOR")       ${UI_MUTED_COLOR}Check deployment${COLOR_RESET}
$(highlight_line "Validate Config" "$(is_current_item 1)" "$ACTION_CONFIG_COLOR")   ${UI_MUTED_COLOR}Pre-deploy check${COLOR_RESET}
$(highlight_line "Execute Deploy" "$(is_current_item 2)" "$ACTION_DEPLOY_COLOR")    ${UI_MUTED_COLOR}Run deployment${COLOR_RESET}
$(highlight_line "Rollback" "$(is_current_item 3)" "$ACTION_DEPLOY_COLOR")        ${UI_MUTED_COLOR}Revert changes${COLOR_RESET}
EOF
            ;;
        "ORG:"*)
            cat << EOF
$(highlight_line "Organization Info" "$(is_current_item 0)" "$ACTION_VIEW_COLOR")   ${UI_MUTED_COLOR}Current org details${COLOR_RESET}
$(highlight_line "Switch Org" "$(is_current_item 1)" "$ACTION_CONFIG_COLOR")      ${UI_MUTED_COLOR}Change organization${COLOR_RESET}
$(highlight_line "Sync Config" "$(is_current_item 2)" "$ACTION_CONFIG_COLOR")     ${UI_MUTED_COLOR}Update config${COLOR_RESET}
EOF
            ;;
        "TOML:"*)
            cat << EOF
$(highlight_line "View Configuration" "$(is_current_item 0)" "$ACTION_VIEW_COLOR")  ${UI_MUTED_COLOR}Show TOML content${COLOR_RESET}
$(highlight_line "Edit Configuration" "$(is_current_item 1)" "$ACTION_EDIT_COLOR")  ${UI_MUTED_COLOR}Modify settings${COLOR_RESET}
$(highlight_line "Validate TOML" "$(is_current_item 2)" "$ACTION_CONFIG_COLOR")    ${UI_MUTED_COLOR}Check syntax${COLOR_RESET}
EOF
            ;;
        *)
            echo "$(highlight_line "Navigate to specific mode for actions" "$(is_current_item 0)" "$UI_MUTED_COLOR")"
            ;;
    esac
}

# Show results in the results window
show_results() {
    local content="$1"
    LAYOUT_STATE["result_content"]="$content"
    LAYOUT_STATE["result_lines"]=$(echo "$content" | wc -l)
    LAYOUT_STATE["result_scroll"]="0"
    LAYOUT_STATE["show_results"]="true"

    # Recalculate layout with results visible
    calculate_layout_regions

    # Render results window
    render_results_window
}

# Hide results and return to full action list
hide_results() {
    LAYOUT_STATE["show_results"]="false"
    LAYOUT_STATE["result_content"]=""
    LAYOUT_STATE["result_scroll"]="0"

    # Recalculate layout without results
    calculate_layout_regions
}

# Render the results window with scrolling
render_results_window() {
    if [[ ${LAYOUT_STATE["show_results"]} != "true" ]]; then
        return
    fi

    local start_line=$LAYOUT_RESULT_START
    local end_line=$LAYOUT_RESULT_END
    local available_lines=$((end_line - start_line + 1))
    local scroll_offset=${LAYOUT_STATE["result_scroll"]}

    # Clear results region
    clear_region "$start_line" "$end_line"

    # Render results header
    printf "\033[${start_line};1H"
    echo "${COLOR_BOLD}${UI_BORDER_COLOR}═══ Results ═══${COLOR_RESET}"

    # Render content with scrolling
    local content_start=$((start_line + 1))
    local content_lines=$((available_lines - 1))

    printf "\033[${content_start};1H"
    echo "${LAYOUT_STATE["result_content"]}" | sed -n "$((scroll_offset + 1)),$((scroll_offset + content_lines))p"

    # Show scroll indicator if needed
    local total_lines=${LAYOUT_STATE["result_lines"]}
    if [[ $((scroll_offset + content_lines)) -lt $total_lines ]]; then
        printf "\033[${end_line};1H${UI_MUTED_COLOR}▼ More content below (scroll with j/k)${COLOR_RESET}"
    fi
}

# Render sticky bottom status
render_sticky_status() {
    local start_line=$LAYOUT_STATUS_START
    local end_line=$LAYOUT_STATUS_END
    local terminal_width=${COLUMNS:-80}

    # Clear status region
    clear_region "$start_line" "$end_line"

    # Compact status for 80 columns, more detail for wider terminals
    if [[ $terminal_width -le 80 ]]; then
        # Compact 80-column layout - position each line precisely
        local connection_symbol=""
        case "$CURRENT_ENV" in
            "LOCAL") connection_symbol="⌂" ;;
            "DEV"|"STAGING"|"PROD"|"QA") connection_symbol="→" ;;
            "SYSTEM") connection_symbol="◉" ;;
        esac

        local short_context="${CURRENT_MODE}:${CURRENT_ENV}${connection_symbol}"
        printf "\033[${start_line};1H%s" "${short_context} | ${UI_MUTED_COLOR}e/m${COLOR_RESET}=env/mode ${UI_MUTED_COLOR}i/k${COLOR_RESET}=select ${UI_MUTED_COLOR}r${COLOR_RESET}=reset"

        # Line 2: Compact action
        local action_verb=$(generate_compact_action)
        printf "\033[$((start_line + 1));1H%s" "${action_verb}"

        # Line 3: Compact controls
        if [[ ${LAYOUT_STATE["show_results"]} == "true" ]]; then
            printf "\033[$((start_line + 2));1H%s" "${UI_MUTED_COLOR}j/k${COLOR_RESET}=scroll ${UI_MUTED_COLOR}ESC${COLOR_RESET}=hide ${UI_MUTED_COLOR}Enter${COLOR_RESET}=exec ${UI_MUTED_COLOR}/${COLOR_RESET}=repl ${UI_MUTED_COLOR}q${COLOR_RESET}=quit"
        else
            printf "\033[$((start_line + 2));1H%s" "${UI_MUTED_COLOR}Enter${COLOR_RESET}=execute ${UI_MUTED_COLOR}/${COLOR_RESET}=repl ${UI_MUTED_COLOR}?${COLOR_RESET}=help ${UI_MUTED_COLOR}q${COLOR_RESET}=quit"
        fi
    else
        # Wide terminal layout with precise positioning
        local context=$(get_current_selection_context)
        local connection_info="$(get_connection_context)"
        printf "\033[${start_line};1H%s" "Status: $context | Connection: $connection_info | Navigation: ${UI_MUTED_COLOR}e/m${COLOR_RESET} env/mode, ${UI_MUTED_COLOR}i/k${COLOR_RESET} actions, ${UI_MUTED_COLOR}r${COLOR_RESET} reset"

        local action_command=$(generate_semantic_action)
        printf "\033[$((start_line + 1));1H%s" "Action: $action_command"

        if [[ ${LAYOUT_STATE["show_results"]} == "true" ]]; then
            printf "\033[$((start_line + 2));1H%s" "Results: ${UI_MUTED_COLOR}j/k${COLOR_RESET} scroll, ${UI_MUTED_COLOR}ESC${COLOR_RESET} hide | ${UI_MUTED_COLOR}Enter${COLOR_RESET} execute, ${UI_MUTED_COLOR}/${COLOR_RESET} REPL"
        else
            printf "\033[$((start_line + 2));1H%s" "Ready: ${UI_MUTED_COLOR}Enter${COLOR_RESET} execute action, ${UI_MUTED_COLOR}/${COLOR_RESET} REPL mode, ${UI_MUTED_COLOR}?${COLOR_RESET} help"
        fi
    fi
}

# Generate compact action description for 80-column terminals
generate_compact_action() {
    case "$CURRENT_MODE:$CURRENT_ENV" in
        "TSM:LOCAL")
            case $CURRENT_ITEM in
                0) echo "tetra service status" ;;
                1) echo "tetra config check" ;;
                2) echo "tetra service list" ;;
                3) echo "tetra logs view" ;;
                *) echo "tetra service" ;;
            esac
            ;;
        "TSM:DEV"|"TSM:STAGING"|"TSM:PROD"|"TSM:QA")
            case $CURRENT_ITEM in
                0) echo "tetra ssh test $(echo $CURRENT_ENV | tr '[:upper:]' '[:lower:]')" ;;
                1) echo "tetra service status $CURRENT_ENV" ;;
                2) echo "tetra service list $CURRENT_ENV" ;;
                3) echo "tetra logs tail $CURRENT_ENV" ;;
                4) echo "tetra ssh repl $CURRENT_ENV" ;;
                *) echo "tetra service $CURRENT_ENV" ;;
            esac
            ;;
        "RCM:LOCAL")
            echo "tetra exec local"
            ;;
        "RCM:"*)
            local selected_commands=($(printf '%s\n' "${!RCM_COMMANDS[@]}" | sort))
            if [[ $CURRENT_ITEM -lt ${#selected_commands[@]} ]]; then
                local cmd_name="${selected_commands[$CURRENT_ITEM]}"
                echo "tetra ssh $CURRENT_ENV '$cmd_name'"
            else
                echo "tetra ssh $CURRENT_ENV"
            fi
            ;;
        "TKM:"*)
            case $CURRENT_ITEM in
                0) echo "tetra keys status $CURRENT_ENV" ;;
                1) echo "tetra ssh test $CURRENT_ENV" ;;
                2) echo "tetra keys manage $CURRENT_ENV" ;;
                *) echo "tetra keys $CURRENT_ENV" ;;
            esac
            ;;
        "DEPLOY:"*)
            case $CURRENT_ITEM in
                0) echo "tetra deploy status $CURRENT_ENV" ;;
                1) echo "tetra deploy validate $CURRENT_ENV" ;;
                2) echo "tetra deploy run $CURRENT_ENV" ;;
                3) echo "tetra deploy rollback $CURRENT_ENV" ;;
                *) echo "tetra deploy $CURRENT_ENV" ;;
            esac
            ;;
        "ORG:"*)
            case $CURRENT_ITEM in
                0) echo "tetra org info $CURRENT_ENV" ;;
                1) echo "tetra org switch $CURRENT_ENV" ;;
                2) echo "tetra org sync $CURRENT_ENV" ;;
                *) echo "tetra org $CURRENT_ENV" ;;
            esac
            ;;
        "TOML:"*)
            case $CURRENT_ITEM in
                0) echo "tetra config view $CURRENT_ENV" ;;
                1) echo "tetra config edit $CURRENT_ENV" ;;
                2) echo "tetra config validate $CURRENT_ENV" ;;
                *) echo "tetra config $CURRENT_ENV" ;;
            esac
            ;;
        *)
            echo "Navigate: e/m=env/mode i/k=items"
            ;;
    esac
}

# Scroll results window
scroll_results() {
    local direction="$1"  # "up" or "down"
    local scroll_amount="${2:-1}"

    if [[ ${LAYOUT_STATE["show_results"]} != "true" ]]; then
        return
    fi

    local current_scroll=${LAYOUT_STATE["result_scroll"]}
    local total_lines=${LAYOUT_STATE["result_lines"]}
    local visible_lines=$((LAYOUT_RESULT_END - LAYOUT_RESULT_START))
    local max_scroll=$((total_lines - visible_lines + 1))

    if [[ $max_scroll -lt 0 ]]; then max_scroll=0; fi

    case "$direction" in
        "up")
            local new_scroll=$((current_scroll - scroll_amount))
            if [[ $new_scroll -lt 0 ]]; then new_scroll=0; fi
            ;;
        "down")
            local new_scroll=$((current_scroll + scroll_amount))
            if [[ $new_scroll -gt $max_scroll ]]; then new_scroll=$max_scroll; fi
            ;;
        *)
            return
            ;;
    esac

    LAYOUT_STATE["result_scroll"]="$new_scroll"
    render_results_window
}

# Full screen redraw (optimized to avoid flash)
redraw_screen() {
    calculate_layout_regions

    # Clear only the content areas, not the entire screen
    clear_region "$LAYOUT_HEADER_START" "$LAYOUT_STATUS_END"

    render_fixed_header
    render_action_list
    if [[ ${LAYOUT_STATE["show_results"]} == "true" ]]; then
        render_results_window
    fi
    render_sticky_status
}

# Reset to initial state
reset_interface() {
    hide_results
    CURRENT_ITEM=0
    redraw_screen
}