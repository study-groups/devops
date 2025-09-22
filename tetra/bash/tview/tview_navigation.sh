#!/usr/bin/env bash

# TView Navigation - Navigation functions and AWSD contextual movement
# Contains: Environment/mode switching, item navigation, context-aware AWSD

# Navigate between modes (A/D keys or m key)
navigate_mode() {
    local direction="$1"
    local current_idx

    # Find current mode index
    for i in "${!MODES[@]}"; do
        if [[ "${MODES[$i]}" == "$CURRENT_MODE" ]]; then
            current_idx=$i
            break
        fi
    done

    if [[ "$direction" == "left" ]]; then
        current_idx=$((current_idx - 1))
        if [[ $current_idx -lt 0 ]]; then
            current_idx=$((${#MODES[@]} - 1))
        fi
    else
        current_idx=$((current_idx + 1))
        if [[ $current_idx -ge ${#MODES[@]} ]]; then
            current_idx=0
        fi
    fi

    CURRENT_MODE="${MODES[$current_idx]}"
    CURRENT_ITEM=0  # Reset item when changing modes
    DRILL_LEVEL=0   # Reset drill level when changing modes
}

# Navigate between environments (W/E keys or e key)
navigate_environment() {
    local direction="$1"
    local current_idx

    # Find current environment index
    for i in "${!ENVIRONMENTS[@]}"; do
        if [[ "${ENVIRONMENTS[$i]}" == "$CURRENT_ENV" ]]; then
            current_idx=$i
            break
        fi
    done

    if [[ "$direction" == "left" || "$direction" == "up" ]]; then
        current_idx=$((current_idx - 1))
        if [[ $current_idx -lt 0 ]]; then
            current_idx=$((${#ENVIRONMENTS[@]} - 1))
        fi
    else
        current_idx=$((current_idx + 1))
        if [[ $current_idx -ge ${#ENVIRONMENTS[@]} ]]; then
            current_idx=0
        fi
    fi

    CURRENT_ENV="${ENVIRONMENTS[$current_idx]}"
    CURRENT_ITEM=0  # Reset item when changing environments
    DRILL_LEVEL=0   # Reset drill level when changing environments
}

# Navigate items within current mode+environment (J/I/K/L keys)
navigate_item() {
    local direction="$1"
    local max_items=$(get_max_items_for_current_context)

    if [[ $max_items -le 1 ]]; then
        return  # No navigation needed for single items
    fi

    if [[ "$direction" == "down" || "$direction" == "right" ]]; then
        CURRENT_ITEM=$((CURRENT_ITEM + 1))
        if [[ $CURRENT_ITEM -ge $max_items ]]; then
            CURRENT_ITEM=0
        fi
    else
        CURRENT_ITEM=$((CURRENT_ITEM - 1))
        if [[ $CURRENT_ITEM -lt 0 ]]; then
            CURRENT_ITEM=$((max_items - 1))
        fi
    fi
}

# AWSD contextual navigation based on current mode
awsd_navigate() {
    local direction="$1"

    case "$CURRENT_MODE" in
        "TOML")
            # TOML mode: Infrastructure-focused navigation
            case "$direction" in
                "left"|"right")
                    # Navigate between environments in infrastructure order
                    navigate_environment "$direction"
                    ;;
                "up"|"down")
                    # Navigate through config sections or drill levels
                    if [[ $DRILL_LEVEL -eq 1 ]]; then
                        scroll_content "$direction"
                    else
                        navigate_item "$direction"
                    fi
                    ;;
            esac
            ;;
        "TSM")
            # TSM mode: Service management navigation
            case "$direction" in
                "left"|"right")
                    # Switch between service types or environments
                    navigate_environment "$direction"
                    ;;
                "up"|"down")
                    # Navigate through service list
                    navigate_item "$direction"
                    ;;
            esac
            ;;
        "TKM")
            # TKM mode: Key/user focused navigation
            case "$direction" in
                "left"|"right")
                    # Switch between SSH users (when in drill mode) or environments
                    if [[ $DRILL_LEVEL -eq 1 ]]; then
                        # Cycle through SSH users: tetra → root → dev → tetra
                        cycle_ssh_user "$direction"
                    else
                        navigate_environment "$direction"
                    fi
                    ;;
                "up"|"down")
                    # Navigate through keys or actions
                    navigate_item "$direction"
                    ;;
            esac
            ;;
        "ORG")
            # ORG mode: Organization navigation
            case "$direction" in
                "left"|"right")
                    # Switch between organizations
                    cycle_organization "$direction"
                    ;;
                "up"|"down")
                    # Navigate deployment history or actions
                    navigate_item "$direction"
                    ;;
            esac
            ;;
        "DEPLOY")
            # DEPLOY mode: Deployment navigation
            case "$direction" in
                "left"|"right")
                    # Navigate between environments
                    navigate_environment "$direction"
                    ;;
                "up"|"down")
                    # Navigate through deployment actions
                    navigate_item "$direction"
                    ;;
            esac
            ;;
        *)
            # Fallback to standard navigation
            case "$direction" in
                "left"|"right")
                    navigate_environment "$direction"
                    ;;
                "up"|"down")
                    navigate_item "$direction"
                    ;;
            esac
            ;;
    esac
}

# Cycle through SSH users for TKM mode
cycle_ssh_user() {
    local direction="$1"
    # This would cycle through available SSH users for current environment
    # Implementation depends on how SSH users are stored
    echo "SSH user cycling not yet implemented"
}

# Cycle through organizations for ORG mode
cycle_organization() {
    local direction="$1"
    # This would cycle through available organizations
    # Implementation depends on organization storage
    echo "Organization cycling not yet implemented"
}

# Scrolling functionality
scroll_content() {
    local direction="$1"
    local max_lines=${LINES:-24}
    local content_lines=$((max_lines - 8))  # Reserve space for header and status

    if [[ "$FILE_VIEW_MODE" == "true" ]]; then
        # Scrolling in file view mode
        if [[ "$direction" == "up" ]]; then
            SCROLL_OFFSET=$((SCROLL_OFFSET - 3))
            if [[ $SCROLL_OFFSET -lt 0 ]]; then
                SCROLL_OFFSET=0
            fi
        else
            local max_scroll=$((FILE_VIEW_LINES - content_lines))
            if [[ $max_scroll -lt 0 ]]; then max_scroll=0; fi
            SCROLL_OFFSET=$((SCROLL_OFFSET + 3))
            if [[ $SCROLL_OFFSET -gt $max_scroll ]]; then
                SCROLL_OFFSET=$max_scroll
            fi
        fi
    else
        # Regular content scrolling - for future implementation
        # Currently just reset scroll when changing contexts
        if [[ "$direction" == "up" ]]; then
            SCROLL_OFFSET=$((SCROLL_OFFSET - 1))
            if [[ $SCROLL_OFFSET -lt 0 ]]; then
                SCROLL_OFFSET=0
            fi
        else
            SCROLL_OFFSET=$((SCROLL_OFFSET + 1))
            # Limit scrolling based on content
            if [[ $SCROLL_OFFSET -gt 10 ]]; then
                SCROLL_OFFSET=10
            fi
        fi
    fi
}

# Enter full file view mode
enter_file_view() {
    local file_path="$1"
    if [[ -f "$file_path" ]]; then
        FILE_VIEW_MODE=true
        FILE_VIEW_CONTENT=$(cat "$file_path")
        FILE_VIEW_LINES=$(echo "$FILE_VIEW_CONTENT" | wc -l)
        SCROLL_OFFSET=0
    fi
}

# Exit file view mode
exit_file_view() {
    FILE_VIEW_MODE=false
    FILE_VIEW_CONTENT=""
    FILE_VIEW_LINES=0
    SCROLL_OFFSET=0
}