#!/usr/bin/env bash

# TView Rendering - UI and display functions

# Render the header with mode selector and current environment
render_header() {
    # Compact header - single line with key info
    local header="${BOLD}${CYAN}TVIEW${RESET}"

    # Show org name instead of full path
    if [[ -n "$ACTIVE_ORG" && "$ACTIVE_ORG" != "No active organization" ]]; then
        header+=" ${BOLD}${YELLOW}$ACTIVE_ORG${RESET}"
    elif [[ -n "$ACTIVE_TOML" ]]; then
        local short_toml=$(basename "$ACTIVE_TOML")
        header+=" ${BOLD}${YELLOW}$short_toml${RESET}"
    fi

    # Add drill indicator if active
    if [[ $DRILL_LEVEL -eq 1 ]]; then
        header+=" ${BOLD}${YELLOW}[DRILL]${RESET}"
    fi

    echo "$header"

    # Compact environment and mode on one line
    local nav_line="Env: "
    for env in "${ENVIRONMENTS[@]}"; do
        if [[ "$env" == "$CURRENT_ENV" ]]; then
            nav_line+="[${BOLD}${BLUE}${env}${RESET}] "
        else
            nav_line+="${env} "
        fi
    done

    nav_line+="| Mode: "
    for mode in "${MODES[@]}"; do
        if [[ "$mode" == "$CURRENT_MODE" ]]; then
            nav_line+="[${BOLD}${GREEN}${mode}${RESET}] "
        else
            nav_line+="${mode} "
        fi
    done

    echo "$nav_line"
    echo "────────────────────────────────────────────────────────────────────────────"
}

# Render content based on current environment and mode
render_mode_environment_content() {
    # Show drilled-in view if applicable
    if [[ $DRILL_LEVEL -eq 1 ]]; then
        show_drilled_content
        return
    fi

    case "$CURRENT_ENV:$CURRENT_MODE" in
        "SYSTEM:TOML") render_toml_system ;;
        "LOCAL:TOML") render_toml_local ;;
        "DEV:TOML") render_toml_dev ;;
        "STAGING:TOML") render_toml_staging ;;
        "PROD:TOML") render_toml_prod ;;
        "SYSTEM:TKM") render_tkm_system ;;
        "LOCAL:TKM") render_tkm_local ;;
        "DEV:TKM") render_tkm_dev ;;
        "STAGING:TKM") render_tkm_staging ;;
        "PROD:TKM") render_tkm_prod ;;
        "SYSTEM:TSM") render_tsm_system ;;
        "LOCAL:TSM") render_tsm_local ;;
        "DEV:TSM") render_tsm_dev ;;
        "STAGING:TSM") render_tsm_staging ;;
        "PROD:TSM") render_tsm_prod ;;
        "SYSTEM:DEPLOY") render_deploy_system ;;
        "LOCAL:DEPLOY") render_deploy_local ;;
        "DEV:DEPLOY") render_deploy_dev ;;
        "STAGING:DEPLOY") render_deploy_staging ;;
        "PROD:DEPLOY") render_deploy_prod ;;
        "SYSTEM:ORG") render_org_system ;;
        "LOCAL:ORG") render_org_local ;;
        "DEV:ORG") render_org_dev ;;
        "STAGING:ORG") render_org_staging ;;
        "PROD:ORG") render_org_prod ;;
        *) echo "Unknown environment/mode combination: $CURRENT_ENV:$CURRENT_MODE" ;;
    esac
}

# Render status line with current selection context
render_status_line() {
    local context=$(get_current_selection_context)
    local max_items=$(get_max_items_for_current_context)

    if [[ $max_items -gt 1 ]]; then
        echo "Status: $context (item $((CURRENT_ITEM + 1))/$max_items)"
    else
        echo "Status: $context"
    fi
}

# Get context-aware status for current selection
get_current_selection_context() {
    case "$CURRENT_MODE:$CURRENT_ENV" in
        "TOML:SYSTEM")
            case $CURRENT_ITEM in
                0) echo "Active TOML: ${ACTIVE_TOML:-No TOML file detected}" ;;
                1) echo "Project: ${PROJECT_NAME:-Unknown}" ;;
                2) echo "Sync Status: ${TOML_SYNC_STATUS:-Unknown}" ;;
            esac ;;
        "TOML:LOCAL") echo "Local TOML configuration" ;;
        "TOML:DEV") echo "Dev environment: ${DEV_SERVER:-Unknown} (${DEV_IP:-Unknown})" ;;
        "TOML:STAGING") echo "Staging environment: ${STAGING_SERVER:-Unknown} (${STAGING_IP:-Unknown})" ;;
        "TOML:PROD") echo "Prod environment: ${PROD_SERVER:-Unknown} (${PROD_IP:-Unknown})" ;;
        "TKM:"*) echo "Tetra Key Manager - ${CURRENT_ENV}" ;;
        "TSM:"*) echo "Tetra Service Manager - ${CURRENT_ENV}" ;;
        "DEPLOY:"*) echo "Deployment Management - ${CURRENT_ENV}" ;;
        *) echo "$CURRENT_MODE mode - $CURRENT_ENV environment" ;;
    esac
}

# Utility functions
is_current_item() {
    local item_index="$1"
    if [[ $CURRENT_ITEM -eq $item_index ]]; then
        echo "true"
    else
        echo "false"
    fi
}

# Generic highlighting system
setup_colors() {
    BOLD=$(tput bold 2>/dev/null || echo "")
    RESET=$(tput sgr0 2>/dev/null || echo "")
    RED=$(tput setaf 1 2>/dev/null || echo "")
    GREEN=$(tput setaf 2 2>/dev/null || echo "")
    YELLOW=$(tput setaf 3 2>/dev/null || echo "")
    BLUE=$(tput setaf 4 2>/dev/null || echo "")
    MAGENTA=$(tput setaf 5 2>/dev/null || echo "")
    CYAN=$(tput setaf 6 2>/dev/null || echo "")
}

highlight_line() {
    local text="$1"
    local is_selected="$2"
    local color="${3:-$GREEN}"

    if [[ "$is_selected" == "true" ]]; then
        echo "    ► ${BOLD}${color}${text}${RESET}"
    else
        echo "      ${text}"
    fi
}

# Show drilled-in content for selected item
show_drilled_content() {
    echo
    echo "${BOLD}${YELLOW}>>> DRILLED INTO ITEM $((CURRENT_ITEM + 1)) <<<${RESET}"
    echo

    case "$CURRENT_ENV:$CURRENT_MODE" in
        "SYSTEM:TOML")
            show_toml_system_details
            ;;
        "LOCAL:TOML")
            show_toml_local_details
            ;;
        "DEV:TOML"|"STAGING:TOML"|"PROD:TOML")
            show_toml_environment_details "$CURRENT_ENV"
            ;;
        "LOCAL:TSM")
            show_tsm_local_details
            ;;
        "DEV:TSM"|"STAGING:TSM"|"PROD:TSM")
            show_tsm_remote_details "$CURRENT_ENV"
            ;;
        "SYSTEM:ORG")
            show_org_system_details
            ;;
        "LOCAL:ORG")
            show_org_local_details
            ;;
        "DEV:ORG"|"STAGING:ORG"|"PROD:ORG")
            show_org_environment_details "$CURRENT_ENV"
            ;;
        *)
            echo "    ${BOLD}Detailed view for $CURRENT_ENV:$CURRENT_MODE${RESET}"
            echo
            echo "        Environment: $CURRENT_ENV"
            echo "        Mode: $CURRENT_MODE"
            echo "        Selected Item: $((CURRENT_ITEM + 1))"
            echo
            echo "        Press 'j' to drill out"
            ;;
    esac

    echo
    echo "${BOLD}${YELLOW}Press 'j' to drill out${RESET}"
}

# Render file view content with scrolling
render_file_view_content() {
    if [[ "$FILE_VIEW_MODE" != "true" || -z "$FILE_VIEW_CONTENT" ]]; then
        echo "No file content available"
        return
    fi

    local max_lines=${LINES:-24}
    local content_lines=$((max_lines - 8))  # Reserve space for header and status

    echo
    echo "${BOLD}${CYAN}FILE VIEW: ${ACTIVE_TOML}${RESET}"
    echo "Lines: $FILE_VIEW_LINES | Scroll: $SCROLL_OFFSET | Use i,k to scroll, v to exit"
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo

    # Display file content with line numbers, starting from SCROLL_OFFSET
    echo "$FILE_VIEW_CONTENT" | nl -ba | sed -n "$((SCROLL_OFFSET + 1)),$((SCROLL_OFFSET + content_lines))p"

    echo
    if [[ $((SCROLL_OFFSET + content_lines)) -lt $FILE_VIEW_LINES ]]; then
        echo "${YELLOW}▼ More content below (press k to scroll down)${RESET}"
    fi
    if [[ $SCROLL_OFFSET -gt 0 ]]; then
        echo "${YELLOW}▲ More content above (press i to scroll up)${RESET}"
    fi
}