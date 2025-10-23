#!/usr/bin/env bash

# TDS Interactive TUI Demo
# Navigate through themes and see all TDS features in real-time

# Load TDS
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tds.sh" 2>/dev/null

# Demo state
CURRENT_THEME_INDEX=0
THEMES=(default tokyo-night neon)
CURRENT_VIEW="overview"
VIEWS=(overview status panels borders colors)

# Get current theme name
get_current_theme() {
    echo "${THEMES[$CURRENT_THEME_INDEX]}"
}

# Get current view name
get_current_view() {
    echo "${VIEWS[$CURRENT_VIEW_INDEX]}"
}

# Cycle theme forward/backward
cycle_theme() {
    local direction="$1"

    if [[ "$direction" == "next" ]]; then
        CURRENT_THEME_INDEX=$(( (CURRENT_THEME_INDEX + 1) % ${#THEMES[@]} ))
    else
        CURRENT_THEME_INDEX=$(( (CURRENT_THEME_INDEX - 1 + ${#THEMES[@]}) % ${#THEMES[@]} ))
    fi

    tds_switch_theme "${THEMES[$CURRENT_THEME_INDEX]}" 2>/dev/null
}

# Render header with theme selector
render_header() {
    local theme=$(get_current_theme)
    local theme_display=$(echo "$theme" | tr '-' ' ' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1')

    tds_border_top 80 "double"
    tds_border_line "$(tds_color "primary" "TDS - Tetra Design System Interactive Demo")" 80 "center" "double"
    tds_border_line "" 80 "center" "double"

    local theme_selector="Theme: [$(tds_color "secondary" "$theme_display")] (← → to switch)"
    tds_border_line "$theme_selector" 80 "center" "double"
    tds_border_bottom 80 "double"
    echo
}

# Render navigation help
render_footer() {
    tds_hr 80 "─"
    local help_text="Navigation: ← → Switch Theme | 1-5 Switch View | q Quit | r Refresh"
    echo "$(tds_color "text.secondary" "$help_text")"
    tds_hr 80 "─"
}

# View: Overview
render_overview() {
    echo "$(tds_color "info" "Overview: All TDS Features")"
    echo

    # Status indicators
    tds_panel_info "Status Indicators" \
        "$(tds_status "success" "Operation completed successfully")" \
        "$(tds_status "error" "Connection failed")" \
        "$(tds_status "warning" "Disk space low")" \
        "$(tds_status "info" "New update available")" \
        "$(tds_status "pending" "Processing request...")"
    echo

    # Badges
    local badges="Env: "
    badges+="$(tds_env_badge "local") "
    badges+="$(tds_env_badge "dev") "
    badges+="$(tds_env_badge "staging") "
    badges+="$(tds_env_badge "prod")"

    tds_border_top 60 "simple"
    tds_border_line "$badges" 60 "center" "simple"
    tds_border_bottom 60 "simple"
    echo

    # Dashboard
    tds_panel_dashboard "prod" "service" \
        "$(tds_status "success" "nginx: active")" \
        "$(tds_status "success" "postgresql: active")" \
        "$(tds_status "error" "redis: inactive")" \
        "$(tds_status "warning" "disk: 85% used")"
}

# View: Status Indicators
render_status() {
    echo "$(tds_color "info" "Status Indicators & Badges")"
    echo

    echo "Status Types:"
    tds_vspace sm
    tds_status "success" "Build completed successfully"
    echo
    tds_status "error" "Connection timeout"
    echo
    tds_status "warning" "Memory usage high"
    echo
    tds_status "info" "Update available"
    echo
    tds_status "pending" "Processing..."
    echo
    tds_vspace md

    echo "Environment Badges:"
    tds_vspace sm
    echo -n "  "
    tds_env_badge "local"
    echo -n " Local Development"
    echo
    echo -n "  "
    tds_env_badge "dev"
    echo -n " Development Server"
    echo
    echo -n "  "
    tds_env_badge "staging"
    echo -n " Staging Environment"
    echo
    echo -n "  "
    tds_env_badge "prod"
    echo -n " Production (Live!)"
    echo
    tds_vspace md

    echo "Mode Badges:"
    tds_vspace sm
    echo -n "  "
    tds_mode_badge "config"
    echo " Configuration"
    echo -n "  "
    tds_mode_badge "service"
    echo " Service Management"
    echo -n "  "
    tds_mode_badge "deploy"
    echo " Deployment"
    echo -n "  "
    tds_mode_badge "keys"
    echo " Key Management"
}

# View: Panel Types
render_panels() {
    echo "$(tds_color "info" "Panel Components")"
    echo

    tds_panel_success "Deployment" "Successfully deployed to staging"
    tds_vspace sm

    tds_panel_error "Build Failed" "Compilation error in module auth.ts:42"
    tds_vspace sm

    tds_panel_info "System Information" \
        "  Hostname: tetra-prod-01" \
        "  Uptime: 42 days, 13:24" \
        "  Load: 0.45, 0.52, 0.48" \
        "  Memory: 8.2 GB / 16 GB"
    tds_vspace sm

    tds_panel_code "Recent Logs" \
        "2025-01-21 20:15:32 INFO  Application started" \
        "2025-01-21 20:15:33 INFO  Database connected" \
        "2025-01-21 20:15:34 WARN  Cache miss rate: 15%" \
        "2025-01-21 20:15:35 ERROR Connection timeout"
}

# View: Borders & Layout
render_borders() {
    echo "$(tds_color "info" "Borders & Layout")"
    echo

    echo "Border Styles:"
    tds_vspace sm

    tds_border_top 50 "double"
    tds_border_line "Double Border (Formal)" 50 "center" "double"
    tds_border_bottom 50 "double"
    tds_vspace sm

    tds_border_top 50 "simple"
    tds_border_line "Simple Border (Casual)" 50 "center" "simple"
    tds_border_bottom 50 "simple"
    tds_vspace md

    echo "Text Alignment (ANSI-aware):"
    tds_vspace sm
    local colored_text=$(tds_color "primary" "Colored Text")
    tds_border_top 60 "simple"
    tds_border_line "$colored_text - Left" 60 "left" "simple"
    tds_border_line "$colored_text - Center" 60 "center" "simple"
    tds_border_line "$colored_text - Right" 60 "right" "simple"
    tds_border_bottom 60 "simple"
    tds_vspace md

    echo "Horizontal Rules:"
    tds_vspace sm
    tds_hr 60 "─"
    tds_hr 60 "="
    tds_hr 60 "━"
}

# View: Color Tokens
render_colors() {
    echo "$(tds_color "info" "Semantic Color Tokens")"
    echo

    tds_show_semantic_colors
}

# Main render function
render_screen() {
    clear
    render_header

    case "$CURRENT_VIEW" in
        overview)   render_overview ;;
        status)     render_status ;;
        panels)     render_panels ;;
        borders)    render_borders ;;
        colors)     render_colors ;;
    esac

    echo
    render_footer
}

# Read single key
read_key() {
    local key
    IFS= read -rsn1 key

    # Handle escape sequences (arrow keys)
    if [[ "$key" == $'\x1b' ]]; then
        read -rsn2 -t 0.1 key
        case "$key" in
            '[C') echo "right" ;;
            '[D') echo "left" ;;
            '[A') echo "up" ;;
            '[B') echo "down" ;;
            *) echo "escape" ;;
        esac
    else
        echo "$key"
    fi
}

# Main loop
main() {
    # Initial render
    render_screen

    while true; do
        local key=$(read_key)

        case "$key" in
            q|Q)
                clear
                echo "Thanks for exploring TDS!"
                exit 0
                ;;
            right)
                cycle_theme "next"
                render_screen
                ;;
            left)
                cycle_theme "prev"
                render_screen
                ;;
            1)
                CURRENT_VIEW="overview"
                render_screen
                ;;
            2)
                CURRENT_VIEW="status"
                render_screen
                ;;
            3)
                CURRENT_VIEW="panels"
                render_screen
                ;;
            4)
                CURRENT_VIEW="borders"
                render_screen
                ;;
            5)
                CURRENT_VIEW="colors"
                render_screen
                ;;
            r|R)
                render_screen
                ;;
        esac
    done
}

# Run
main
