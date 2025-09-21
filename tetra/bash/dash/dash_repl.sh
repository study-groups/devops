#!/usr/bin/env bash

# Dashboard REPL - Interactive navigation with WASD and JIKL keys

# Global state
CURRENT_PAGE="overview"
CURRENT_PANEL=0
CURRENT_ITEM=0

# Dashboard REPL main function
dash_repl() {
    local content_lines=0
    local terminal_lines=${LINES:-24}

    while true; do
        # Load fresh data BEFORE clearing screen
        load_tsm_data
        load_environment_data
        load_git_data
        load_tkm_data

        # Generate ALL content in buffer first (complete double-buffering)
        local full_display=""

        # Render main content
        full_display+=$(render_dashboard_page "$CURRENT_PAGE")
        content_lines=$(echo "$full_display" | wc -l)

        # Add padding to push prompt to bottom (reserve 5 lines for status + nav)
        local padding_needed=$((terminal_lines - content_lines - 5))
        if [[ $padding_needed -gt 0 ]]; then
            for ((i=0; i<$padding_needed; i++)); do
                full_display+=$'\n'
            done
        fi

        # Add context-aware status (split into status and navigation info)
        local context_info=$(get_current_context)
        local status_line=$(echo "$context_info" | cut -d'(' -f1 | sed 's/ *$//')
        local nav_info=$(echo "$context_info" | grep -o '(.*)')

        full_display+="Status: $status_line"$'\n'
        full_display+="$nav_info"$'\n\n'

        # Add navigation prompt
        full_display+="[$CURRENT_PAGE] Navigate: a,d (pages) w,s (panels) j,i,k,l (items)"$'\n'
        full_display+="Commands: <enter> (details) r (refresh) q (quit) h (help) t (tsm) g (git)"$'\n'

        # NOW clear and display everything at once
        clear
        echo -n "$full_display"
        read -p "> " -n1 key

        case "$key" in
            'a'|'A')
                navigate_page "left"
                ;;
            'd'|'D')
                navigate_page "right"
                ;;
            'w'|'W')
                navigate_panel "up"
                ;;
            's'|'S')
                navigate_panel "down"
                ;;
            'j'|'J')
                navigate_item "left"
                ;;
            'i'|'I')
                navigate_item "up"
                ;;
            'k'|'K')
                navigate_item "down"
                ;;
            'l'|'L')
                navigate_item "right"
                ;;
            '')  # Enter key
                show_item_modal
                ;;
            'q'|'Q')
                echo "Exiting dashboard..."
                break
                ;;
            'r'|'R')
                # Just continue to refresh
                ;;
            'h'|'H')
                show_dashboard_help
                ;;
            't'|'T')
                echo "Executing: tsm list"
                tsm list 2>/dev/null || echo "TSM not available"
                echo "Press any key to continue..."
                read -n1 -s
                ;;
            'g'|'G')
                echo "Executing: git status"
                git status 2>/dev/null || echo "Not a git repository"
                echo "Press any key to continue..."
                read -n1 -s
                ;;
            *)
                # Silently ignore unknown keys to maintain display flow
                ;;
        esac
    done
}

# Show dashboard help
show_dashboard_help() {
    clear
    cat << EOF

╔══════════════════════════════════════════════════════════╗
║                    TETRA DASHBOARD HELP                 ║
╚══════════════════════════════════════════════════════════╝

NAVIGATION:
  a, d        Navigate between pages (overview, systems, env)
  w, s        Navigate between panels within a page
  j, i, k, l  Navigate between items within a panel

ACTIONS:
  Enter       Show detailed modal for selected item
  r           Refresh dashboard data
  q           Quit dashboard

COMMANDS (single key):
  h           Show this help screen
  t           Execute 'tsm list' command
  g           Execute 'git status' command

PAGES:
  overview    Infrastructure overview with 4 environments
  systems     System health and service details
  env         Environment infrastructure details

Press any key to return to dashboard...
EOF
    read -n1 -s
}

# Navigate between pages
navigate_page() {
    local direction="$1"
    local pages=("overview" "systems" "env")
    local current_idx

    # Find current page index
    for i in "${!pages[@]}"; do
        if [[ "${pages[$i]}" == "$CURRENT_PAGE" ]]; then
            current_idx=$i
            break
        fi
    done

    if [[ "$direction" == "left" ]]; then
        current_idx=$((current_idx - 1))
        if [[ $current_idx -lt 0 ]]; then
            current_idx=$((${#pages[@]} - 1))
        fi
    else
        current_idx=$((current_idx + 1))
        if [[ $current_idx -ge ${#pages[@]} ]]; then
            current_idx=0
        fi
    fi

    CURRENT_PAGE="${pages[$current_idx]}"
    CURRENT_PANEL=0
    CURRENT_ITEM=0
}

# Navigate panels within page
navigate_panel() {
    local direction="$1"
    local max_panels

    case "$CURRENT_PAGE" in
        "overview") max_panels=4 ;;  # TSM, TKM, ENV, DEPLOY
        "systems") max_panels=4 ;;   # Infrastructure, TSM, Services, Status
        "env") max_panels=3 ;;       # Local, Remote(DEV/STAGING/PROD), Actions
        *) max_panels=1 ;;
    esac

    if [[ "$direction" == "down" ]]; then
        CURRENT_PANEL=$((CURRENT_PANEL + 1))
        if [[ $CURRENT_PANEL -ge $max_panels ]]; then
            CURRENT_PANEL=0
        fi
    else
        CURRENT_PANEL=$((CURRENT_PANEL - 1))
        if [[ $CURRENT_PANEL -lt 0 ]]; then
            CURRENT_PANEL=$((max_panels - 1))
        fi
    fi
    CURRENT_ITEM=0  # Reset item when changing panels
}

# Navigate items within panel
navigate_item() {
    local direction="$1"
    local max_items

    # Get max items for current panel
    case "$CURRENT_PAGE:$CURRENT_PANEL" in
        "overview:0") max_items=2 ;;  # TSM: running, stopped
        "overview:1") max_items=1 ;;  # TKM: ready
        "overview:2") max_items=3 ;;  # ENV: dev, staging, prod
        "overview:3") max_items=2 ;;  # DEPLOY: git, project
        "systems:0") max_items=3 ;;   # Infrastructure: server, memory, domain
        "systems:1") max_items=2 ;;   # TSM: running, stopped
        "systems:2")
            if [[ -n "$TSM_SERVICES" && "${TSM_COUNT_RUNNING:-0}" -gt 0 ]]; then
                max_items=$(echo "$TSM_SERVICES" | head -5 | wc -l)
            else
                max_items=1
            fi
            ;;  # Services list
        "systems:3") max_items=3 ;;   # Status: TKM, ENV, GIT
        "env:0") max_items=3 ;;       # Local: project, status, config
        "env:1") max_items=3 ;;       # Remote: dev, staging, prod
        "env:2") max_items=1 ;;       # Actions: deploy
        *) max_items=1 ;;
    esac

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

# Get context-aware status info
get_current_context() {
    local context=""
    local max_items=1

    # Calculate max items for current panel (same logic as navigate_item)
    case "$CURRENT_PAGE:$CURRENT_PANEL" in
        "overview:0") max_items=2 ;;
        "overview:1") max_items=1 ;;
        "overview:2") max_items=3 ;;
        "overview:3") max_items=2 ;;
        "systems:0") max_items=3 ;;
        "systems:1") max_items=2 ;;
        "systems:2")
            if [[ -n "$TSM_SERVICES" && "${TSM_COUNT_RUNNING:-0}" -gt 0 ]]; then
                max_items=$(echo "$TSM_SERVICES" | head -5 | wc -l)
            else
                max_items=1
            fi
            ;;
        "systems:3") max_items=3 ;;
        "env:0") max_items=3 ;;
        "env:1") max_items=3 ;;
        "env:2") max_items=1 ;;
        *) max_items=1 ;;
    esac

    case "$CURRENT_PAGE:$CURRENT_PANEL:$CURRENT_ITEM" in
        "overview:0:0") context="TSM: ${TSM_COUNT_RUNNING:-0} services currently running" ;;
        "overview:0:1") context="TSM: ${TSM_COUNT_STOPPED:-0} services currently stopped" ;;
        "overview:1:0") context="TKM: Key manager status - ${TKM_STATUS:-○}" ;;
        "overview:2:0") context="ENV: dev.env status - ${ENV_DEV_STATUS:-○}" ;;
        "overview:2:1") context="ENV: staging.env status - ${ENV_STAGING_STATUS:-○}" ;;
        "overview:2:2") context="ENV: prod.env status - ${ENV_PROD_STATUS:-○}" ;;
        "overview:3:0") context="DEPLOY: Git working tree - ${GIT_CLEAN:-○}" ;;
        "overview:3:1") context="DEPLOY: Project ${PROJECT_NAME:-tetra} on branch ${GIT_BRANCH:-main}" ;;
        "systems:0:0") context="Infrastructure: ${DEV_SERVER:-Unknown} (${DEV_IP:-Unknown})" ;;
        "systems:0:1") context="Infrastructure: Memory ${DEV_MEMORY:-Unknown} | Region ${DEV_REGION:-Unknown}" ;;
        "systems:0:2") context="Infrastructure: Domain ${DEV_DOMAIN:-Unknown}" ;;
        "systems:1:0") context="TSM: ${TSM_COUNT_RUNNING:-0} services running" ;;
        "systems:1:1") context="TSM: ${TSM_COUNT_STOPPED:-0} services stopped" ;;
        "systems:2:"*)
            if [[ $max_items -gt 1 ]]; then
                context="Services: Line $((CURRENT_ITEM + 1)) of $max_items"
            else
                context="Services: No active services"
            fi
            ;;
        "systems:3:0") context="Status: TKM key management - ${TKM_STATUS:-○}" ;;
        "systems:3:1") context="Status: Environment files - ${ENV_DEV_STATUS:-○}${ENV_STAGING_STATUS:-○}${ENV_PROD_STATUS:-○}" ;;
        "systems:3:2") context="Status: Git repository - ${GIT_CLEAN:-○} ${GIT_BRANCH:-main}" ;;
        "env:0:0") context="Local: Project ${PROJECT_NAME:-tetra} | Branch ${GIT_BRANCH:-main}" ;;
        "env:0:1") context="Local: Status ${GIT_CLEAN:-○} | Services ${TSM_COUNT_RUNNING:-0}/${TSM_COUNT_STOPPED:-0}" ;;
        "env:0:2") context="Local: Port ${DEFAULT_PORT:-8000} | User ${DEPLOY_USER:-tetra}" ;;
        "env:1:0") context="Remote: DEV ${DEV_SERVER:-Unknown} (${DEV_IP:-Unknown})" ;;
        "env:1:1") context="Remote: STAGING ${STAGING_SERVER:-Unknown} (${STAGING_IP:-Unknown})" ;;
        "env:1:2") context="Remote: PROD ${PROD_SERVER:-Unknown} (${PROD_IP:-Unknown})" ;;
        "env:2:0") context="Actions: Deploy to staging" ;;
        *) context="Panel $CURRENT_PANEL, Item $((CURRENT_ITEM + 1))/$max_items" ;;
    esac

    if [[ $max_items -eq 1 ]]; then
        echo "Status: $context (single item - use w,s for panels)"
    else
        echo "Status: $context (item $((CURRENT_ITEM + 1))/$max_items - use j,i,k,l to navigate)"
    fi
}

# Render dashboard page with panel highlighting
render_dashboard_page() {
    local page="$1"

    case "$page" in
        "overview")
            render_overview_with_highlight
            ;;
        "systems")
            render_systems_with_highlight
            ;;
        "env")
            render_env_with_highlight
            ;;
    esac
}

# Overview with panel highlighting
render_overview_with_highlight() {
    local lines=()
    local bold_start=$(tput bold 2>/dev/null || echo "")
    local bold_end=$(tput sgr0 2>/dev/null || echo "")
    local color_red=$(tput setaf 1 2>/dev/null || echo "")
    local color_green=$(tput setaf 2 2>/dev/null || echo "")
    local color_yellow=$(tput setaf 3 2>/dev/null || echo "")
    local color_reset=$(tput sgr0 2>/dev/null || echo "")

    lines+=("")
    lines+=("    TETRA OVERVIEW")
    lines+=("")

    # Panel 0: TSM
    if [[ $CURRENT_PANEL -eq 0 ]]; then
        lines+=("  → TSM Service Manager")
        if [[ $CURRENT_ITEM -eq 0 ]]; then
            lines+=("    ► ${bold_start}${color_green}✓ ${TSM_COUNT_RUNNING:-0} running${color_reset}${bold_end}")
        else
            lines+=("      ✓ ${TSM_COUNT_RUNNING:-0} running")
        fi
        if [[ $CURRENT_ITEM -eq 1 ]]; then
            lines+=("    ► ${bold_start}${color_yellow}○ ${TSM_COUNT_STOPPED:-0} stopped${color_reset}${bold_end}")
        else
            lines+=("      ○ ${TSM_COUNT_STOPPED:-0} stopped")
        fi
    else
        lines+=("    TSM Service Manager")
        lines+=("      ✓ ${TSM_COUNT_RUNNING:-0} running")
        lines+=("      ○ ${TSM_COUNT_STOPPED:-0} stopped")
    fi
    lines+=("")

    # Panel 1: TKM
    if [[ $CURRENT_PANEL -eq 1 ]]; then
        lines+=("  → TKM Key Manager")
        lines+=("    ► ${bold_start}${color_green}${TKM_STATUS:-○} Ready${color_reset}${bold_end}")
    else
        lines+=("    TKM Key Manager")
        lines+=("      ${TKM_STATUS:-○} Ready")
    fi
    lines+=("")

    # Panel 2: ENV
    if [[ $CURRENT_PANEL -eq 2 ]]; then
        lines+=("  → ENV Environment Manager")
        if [[ $CURRENT_ITEM -eq 0 ]]; then
            lines+=("    ► ${bold_start}${color_green}${ENV_DEV_STATUS:-○} dev.env${color_reset}${bold_end}")
        else
            lines+=("      ${ENV_DEV_STATUS:-○} dev.env")
        fi
        if [[ $CURRENT_ITEM -eq 1 ]]; then
            lines+=("    ► ${bold_start}${color_green}${ENV_STAGING_STATUS:-○} staging.env${color_reset}${bold_end}")
        else
            lines+=("      ${ENV_STAGING_STATUS:-○} staging.env")
        fi
        if [[ $CURRENT_ITEM -eq 2 ]]; then
            lines+=("    ► ${bold_start}${color_yellow}${ENV_PROD_STATUS:-○} prod.env${color_reset}${bold_end}")
        else
            lines+=("      ${ENV_PROD_STATUS:-○} prod.env")
        fi
    else
        lines+=("    ENV Environment Manager")
        lines+=("      ${ENV_DEV_STATUS:-○} dev.env")
        lines+=("      ${ENV_STAGING_STATUS:-○} staging.env")
        lines+=("      ${ENV_PROD_STATUS:-○} prod.env")
    fi
    lines+=("")

    # Panel 3: DEPLOY
    if [[ $CURRENT_PANEL -eq 3 ]]; then
        lines+=("  → DEPLOY Workflow Engine")
        if [[ $CURRENT_ITEM -eq 0 ]]; then
            lines+=("    ► ${bold_start}${color_red}${GIT_CLEAN:-○} Git status${color_reset}${bold_end}")
        else
            lines+=("      ${GIT_CLEAN:-○} Git status")
        fi
        if [[ $CURRENT_ITEM -eq 1 ]]; then
            lines+=("    ► ${bold_start}${color_green}Project: ${PROJECT_NAME:-tetra} (${GIT_BRANCH:-main})${color_reset}${bold_end}")
        else
            lines+=("      Project: ${PROJECT_NAME:-tetra} (${GIT_BRANCH:-main})")
        fi
    else
        lines+=("    DEPLOY Workflow Engine")
        lines+=("      ${GIT_CLEAN:-○} Git status")
        lines+=("      Project: ${PROJECT_NAME:-tetra} (${GIT_BRANCH:-main})")
    fi
    lines+=("")

    # Output all lines at once
    printf '%s\n' "${lines[@]}"
}

# Enhanced overview with rich infrastructure data
render_overview_enhanced() {
    setup_colors

    cat << EOF

    TETRA INFRASTRUCTURE OVERVIEW

    $(highlight_line "TSM Service Manager" "$([[ $CURRENT_PANEL -eq 0 ]] && echo true || echo false)")
$(highlight_line "✓ ${TSM_COUNT_RUNNING:-0} running" "$([[ $CURRENT_PANEL -eq 0 && $CURRENT_ITEM -eq 0 ]] && echo true || echo false)" "$GREEN")
$(highlight_line "○ ${TSM_COUNT_STOPPED:-0} stopped" "$([[ $CURRENT_PANEL -eq 0 && $CURRENT_ITEM -eq 1 ]] && echo true || echo false)" "$YELLOW")

    $(highlight_line "TKM Key Manager" "$([[ $CURRENT_PANEL -eq 1 ]] && echo true || echo false)")
$(highlight_line "${TKM_STATUS:-○} SSH Keys Ready" "$([[ $CURRENT_PANEL -eq 1 ]] && echo true || echo false)" "$GREEN")

    ENVIRONMENTS
    ═══════════════════════════════════════════════════════════

    $(highlight_line "LOCAL Environment" "$([[ $CURRENT_PANEL -eq 2 && $CURRENT_ITEM -eq 0 ]] && echo true || echo false)" "$CYAN")
$(highlight_line "Project: ${PROJECT_NAME:-tetra} | Branch: ${GIT_BRANCH:-main} | Port: ${DEFAULT_PORT:-8000}" "$([[ $CURRENT_PANEL -eq 2 && $CURRENT_ITEM -eq 0 ]] && echo true || echo false)" "$CYAN")

    $(highlight_line "DEV Environment" "$([[ $CURRENT_PANEL -eq 2 && $CURRENT_ITEM -eq 1 ]] && echo true || echo false)" "$GREEN")
$(highlight_line "${ENV_DEV_STATUS:-○} ${DEV_DOMAIN:-dev.localhost} | ${DEV_IP:-Unknown} | ${DEV_MEMORY:-Unknown}" "$([[ $CURRENT_PANEL -eq 2 && $CURRENT_ITEM -eq 1 ]] && echo true || echo false)" "$GREEN")

    $(highlight_line "STAGING Environment" "$([[ $CURRENT_PANEL -eq 2 && $CURRENT_ITEM -eq 2 ]] && echo true || echo false)" "$YELLOW")
$(highlight_line "${ENV_STAGING_STATUS:-○} ${STAGING_DOMAIN:-staging.localhost} | ${STAGING_IP:-Unknown} | ${STAGING_MEMORY:-Unknown}" "$([[ $CURRENT_PANEL -eq 2 && $CURRENT_ITEM -eq 2 ]] && echo true || echo false)" "$YELLOW")

    $(highlight_line "PROD Environment" "$([[ $CURRENT_PANEL -eq 2 && $CURRENT_ITEM -eq 3 ]] && echo true || echo false)" "$RED")
$(highlight_line "${ENV_PROD_STATUS:-○} ${PROD_DOMAIN:-localhost} | ${PROD_IP:-Unknown} | ${PROD_MEMORY:-Unknown}" "$([[ $CURRENT_PANEL -eq 2 && $CURRENT_ITEM -eq 3 ]] && echo true || echo false)" "$RED")

    DEPLOYMENT STATUS
    ═══════════════════════════════════════════════════════════

    $(highlight_line "Git Repository" "$([[ $CURRENT_PANEL -eq 3 && $CURRENT_ITEM -eq 0 ]] && echo true || echo false)" "$([[ ${GIT_CLEAN:-○} == "✓" ]] && echo $GREEN || echo $RED)")
$(highlight_line "${GIT_CLEAN:-○} Working tree | Deploy user: ${DEPLOY_USER:-tetra}" "$([[ $CURRENT_PANEL -eq 3 && $CURRENT_ITEM -eq 0 ]] && echo true || echo false)" "$([[ ${GIT_CLEAN:-○} == "✓" ]] && echo $GREEN || echo $RED)")

EOF
}

# Enhanced systems view with detailed specs
render_systems_enhanced() {
    setup_colors

    cat << EOF

    TETRA SYSTEM HEALTH

    $(highlight_line "Service Manager (TSM)" "$([[ $CURRENT_PANEL -eq 0 ]] && echo true || echo false)")
$(highlight_line "Running: ${TSM_COUNT_RUNNING:-0} | Stopped: ${TSM_COUNT_STOPPED:-0}" "$([[ $CURRENT_PANEL -eq 0 ]] && echo true || echo false)" "$GREEN")

    $(highlight_line "Active Services" "$([[ $CURRENT_PANEL -eq 1 ]] && echo true || echo false)")
EOF

    if [[ -n "$TSM_SERVICES" && $CURRENT_PANEL -eq 1 ]]; then
        local line_num=0
        echo "$TSM_SERVICES" | head -5 | while IFS= read -r line; do
            highlight_line "$line" "$([[ $line_num -eq $CURRENT_ITEM ]] && echo true || echo false)" "$GREEN"
            ((line_num++))
        done
    elif [[ $CURRENT_PANEL -eq 1 ]]; then
        highlight_line "No services running" "true" "$YELLOW"
    else
        if [[ -n "$TSM_SERVICES" ]]; then
            echo "$TSM_SERVICES" | head -3 | while IFS= read -r line; do
                echo "      $line"
            done
        else
            echo "      No services running"
        fi
    fi

    cat << EOF

    $(highlight_line "Infrastructure Status" "$([[ $CURRENT_PANEL -eq 2 ]] && echo true || echo false)")
$(highlight_line "TKM: ${TKM_STATUS:-○} Keys | ENV: ${ENV_DEV_STATUS:-○}${ENV_STAGING_STATUS:-○}${ENV_PROD_STATUS:-○} | GIT: ${GIT_CLEAN:-○}" "$([[ $CURRENT_PANEL -eq 2 ]] && echo true || echo false)" "$GREEN")

EOF
}

# Enhanced environment view with full infrastructure details
render_env_enhanced() {
    setup_colors

    cat << EOF

    ENVIRONMENT INFRASTRUCTURE

    $(highlight_line "LOCAL Development" "$([[ $CURRENT_PANEL -eq 0 ]] && echo true || echo false)" "$CYAN")
$(highlight_line "Project: ${PROJECT_NAME:-tetra} | Branch: ${GIT_BRANCH:-main}" "$([[ $CURRENT_PANEL -eq 0 && $CURRENT_ITEM -eq 0 ]] && echo true || echo false)" "$CYAN")
$(highlight_line "Status: ${GIT_CLEAN} | Services: ${TSM_COUNT_RUNNING:-0}/${TSM_COUNT_STOPPED:-0}" "$([[ $CURRENT_PANEL -eq 0 && $CURRENT_ITEM -eq 1 ]] && echo true || echo false)" "$CYAN")
$(highlight_line "Port: ${DEFAULT_PORT:-8000} | Deploy User: ${DEPLOY_USER:-tetra}" "$([[ $CURRENT_PANEL -eq 0 && $CURRENT_ITEM -eq 2 ]] && echo true || echo false)" "$CYAN")

    REMOTE ENVIRONMENTS
    ═══════════════════════════════════════════════════════════

    $(highlight_line "DEV Server" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 0 ]] && echo true || echo false)" "$GREEN")
$(highlight_line "${ENV_DEV_STATUS:-○} ${DEV_DOMAIN:-dev.localhost}" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 0 ]] && echo true || echo false)" "$GREEN")
$(highlight_line "Host: ${DEV_SERVER:-Unknown} | IP: ${DEV_IP:-Unknown}" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 0 ]] && echo true || echo false)" "$GREEN")
$(highlight_line "Memory: ${DEV_MEMORY:-Unknown} | Region: ${DEV_REGION:-Unknown}" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 0 ]] && echo true || echo false)" "$GREEN")

    $(highlight_line "STAGING Server" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 1 ]] && echo true || echo false)" "$YELLOW")
$(highlight_line "${ENV_STAGING_STATUS:-○} ${STAGING_DOMAIN:-staging.localhost}" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 1 ]] && echo true || echo false)" "$YELLOW")
$(highlight_line "Host: ${STAGING_SERVER:-Unknown} | IP: ${STAGING_IP:-Unknown}" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 1 ]] && echo true || echo false)" "$YELLOW")
$(highlight_line "Memory: ${STAGING_MEMORY:-Unknown} | Region: ${STAGING_REGION:-Unknown}" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 1 ]] && echo true || echo false)" "$YELLOW")

    $(highlight_line "PROD Server" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 2 ]] && echo true || echo false)" "$RED")
$(highlight_line "${ENV_PROD_STATUS:-○} ${PROD_DOMAIN:-localhost}" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 2 ]] && echo true || echo false)" "$RED")
$(highlight_line "Host: ${PROD_SERVER:-Unknown} | IP: ${PROD_IP:-Unknown}" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 2 ]] && echo true || echo false)" "$RED")
$(highlight_line "Memory: ${PROD_MEMORY:-Unknown} | Region: ${PROD_REGION:-Unknown}" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 2 ]] && echo true || echo false)" "$RED")

    DEPLOYMENT ACTIONS
    ═══════════════════════════════════════════════════════════

    $(highlight_line "Ready: tetra deploy staging --dry-run" "$([[ $CURRENT_PANEL -eq 2 ]] && echo true || echo false)" "$MAGENTA")

EOF
}

# Systems with panel highlighting
render_systems_with_highlight() {
    echo
    echo "    TETRA SYSTEMS"
    echo

    # Panel 0: TSM counts
    if [[ $CURRENT_PANEL -eq 0 ]]; then
        echo "  → TSM Service Manager"
        if [[ $CURRENT_ITEM -eq 0 ]]; then
            echo "      $(printf '\033[1mRunning: %d\033[0m' "${TSM_COUNT_RUNNING:-0}")"
        else
            echo "      Running: ${TSM_COUNT_RUNNING:-0}"
        fi
        if [[ $CURRENT_ITEM -eq 1 ]]; then
            echo "      $(printf '\033[1mStopped: %d\033[0m' "${TSM_COUNT_STOPPED:-0}")"
        else
            echo "      Stopped: ${TSM_COUNT_STOPPED:-0}"
        fi
    else
        echo "    TSM Service Manager"
        echo "      Running: ${TSM_COUNT_RUNNING:-0}"
        echo "      Stopped: ${TSM_COUNT_STOPPED:-0}"
    fi
    echo

    # Panel 1: Active Services
    if [[ $CURRENT_PANEL -eq 1 ]]; then
        echo "  → Active Services"
        if [[ -n "$TSM_SERVICES" ]]; then
            local line_num=0
            echo "$TSM_SERVICES" | head -3 | while IFS= read -r line; do
                if [[ $line_num -eq $CURRENT_ITEM ]]; then
                    echo "      $(printf '\033[1m%s\033[0m' "$line")"
                else
                    echo "      $line"
                fi
                ((line_num++))
            done
        else
            echo "      $(printf '\033[1mNo services running\033[0m')"
        fi
    else
        echo "    Active Services"
        if [[ -n "$TSM_SERVICES" ]]; then
            echo "$TSM_SERVICES" | head -3 | while IFS= read -r line; do
                echo "      $line"
            done
        else
            echo "      No services running"
        fi
    fi
    echo

    # Panel 2: System Status
    if [[ $CURRENT_PANEL -eq 2 ]]; then
        echo "  → System Status"
        if [[ $CURRENT_ITEM -eq 0 ]]; then
            echo "      $(printf '\033[1mTKM: %s Keys ready\033[0m' "${TKM_STATUS:-○}")"
        else
            echo "      TKM: ${TKM_STATUS:-○} Keys ready"
        fi
        if [[ $CURRENT_ITEM -eq 1 ]]; then
            echo "      $(printf '\033[1mENV: %s Dev %s Staging %s Prod\033[0m' "${ENV_DEV_STATUS:-○}" "${ENV_STAGING_STATUS:-○}" "${ENV_PROD_STATUS:-○}")"
        else
            echo "      ENV: ${ENV_DEV_STATUS:-○} Dev ${ENV_STAGING_STATUS:-○} Staging ${ENV_PROD_STATUS:-○} Prod"
        fi
        if [[ $CURRENT_ITEM -eq 2 ]]; then
            echo "      $(printf '\033[1mGIT: %s %s\033[0m' "${GIT_CLEAN:-○}" "${GIT_BRANCH:-main}")"
        else
            echo "      GIT: ${GIT_CLEAN:-○} ${GIT_BRANCH:-main}"
        fi
    else
        echo "    System Status"
        echo "      TKM: ${TKM_STATUS:-○} Keys ready"
        echo "      ENV: ${ENV_DEV_STATUS:-○} Dev ${ENV_STAGING_STATUS:-○} Staging ${ENV_PROD_STATUS:-○} Prod"
        echo "      GIT: ${GIT_CLEAN:-○} ${GIT_BRANCH:-main}"
    fi
    echo
}

# Environment with panel highlighting
render_env_with_highlight() {
    echo
    echo "    ENVIRONMENT STATUS"
    echo

    # Panel 0: Local Environment
    if [[ $CURRENT_PANEL -eq 0 ]]; then
        echo "  → Local Environment"
    else
        echo "    Local Environment"
    fi
    echo "      Project: ${PROJECT_NAME:-tetra}"
    echo "      Branch: ${GIT_BRANCH:-main}"
    echo "      Status: ${GIT_CLEAN} Clean working tree"
    echo "      Services: ${TSM_COUNT_RUNNING:-0} running, ${TSM_COUNT_STOPPED:-0} stopped"
    echo "      Port: ${DEFAULT_PORT:-8000}"
    echo

    # Panel 1: Remote Environments
    if [[ $CURRENT_PANEL -eq 1 ]]; then
        echo "  → Remote Environments"
    else
        echo "    Remote Environments"
    fi
    echo "      DEV: ${ENV_DEV_STATUS:-○} ${DEV_DOMAIN:-dev.localhost} (${DEV_MEMORY:-Unknown})"
    echo "           ${DEV_SERVER:-Unknown} @ ${DEV_REGION:-Unknown}"
    echo "      STAGING: ${ENV_STAGING_STATUS:-○} ${STAGING_DOMAIN:-staging.localhost} (${STAGING_MEMORY:-Unknown})"
    echo "               ${STAGING_SERVER:-Unknown} @ ${STAGING_REGION:-Unknown}"
    echo "      PROD: ${ENV_PROD_STATUS:-○} ${PROD_DOMAIN:-localhost} (${PROD_MEMORY:-Unknown})"
    echo "            ${PROD_SERVER:-Unknown} @ ${PROD_REGION:-Unknown}"
    echo

    # Panel 2: Infrastructure Details
    if [[ $CURRENT_PANEL -eq 2 ]]; then
        echo "  → Infrastructure Details"
    else
        echo "    Infrastructure Details"
    fi
    echo "      Domain Base: ${DOMAIN_BASE:-localhost}"
    echo "      Deploy User: ${DEPLOY_USER:-tetra}"
    echo "      Default Port: ${DEFAULT_PORT:-8000}"
    echo "      Ready: tetra deploy staging --dry-run"
    echo
}

# Load data functions (reuse from existing)
load_tsm_data() {
    if command -v tsm >/dev/null 2>&1; then
        TSM_SERVICES=$(tsm list 2>/dev/null | tail -n +3 || echo "")
        TSM_COUNT_RUNNING=$(echo "$TSM_SERVICES" | grep -c "online" 2>/dev/null)
        TSM_COUNT_STOPPED=$(echo "$TSM_SERVICES" | grep -c "stopped\|offline" 2>/dev/null)
    else
        TSM_SERVICES=""
        TSM_COUNT_RUNNING=0
        TSM_COUNT_STOPPED=0
    fi
}

load_environment_data() {
    local toml_files=(*.toml)
    if [[ -f "${toml_files[0]}" ]]; then
        PROJECT_TOML="${toml_files[0]}"
        PROJECT_NAME="$(basename "$PROJECT_TOML" .toml)"
        parse_toml_data "$PROJECT_TOML"
    else
        PROJECT_TOML=""
        PROJECT_NAME="tetra"
        # Set defaults if no TOML
        DEV_DOMAIN="dev.localhost"
        STAGING_DOMAIN="staging.localhost"
        PROD_DOMAIN="localhost"
        DEV_MEMORY="Unknown"
        STAGING_MEMORY="Unknown"
        PROD_MEMORY="Unknown"
    fi

    ENV_DEV_STATUS=$(check_env_file "dev")
    ENV_STAGING_STATUS=$(check_env_file "staging")
    ENV_PROD_STATUS=$(check_env_file "prod")
}

# Parse TOML file for rich infrastructure data
parse_toml_data() {
    local toml_file="$1"

    # Extract infrastructure info
    DEV_SERVER=$(grep "^dev_server" "$toml_file" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
    DEV_IP=$(grep "^dev_ip" "$toml_file" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
    DEV_MEMORY=$(grep "^dev_memory" "$toml_file" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
    DEV_REGION=$(grep "^dev_region" "$toml_file" | cut -d'"' -f2 2>/dev/null || echo "Unknown")

    STAGING_SERVER=$(grep "^qa_server" "$toml_file" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
    STAGING_IP=$(grep "^qa_ip" "$toml_file" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
    STAGING_MEMORY=$(grep "^qa_memory" "$toml_file" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
    STAGING_REGION=$(grep "^qa_region" "$toml_file" | cut -d'"' -f2 2>/dev/null || echo "Unknown")

    PROD_SERVER=$(grep "^prod_server" "$toml_file" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
    PROD_IP=$(grep "^prod_ip" "$toml_file" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
    PROD_MEMORY=$(grep "^prod_memory" "$toml_file" | cut -d'"' -f2 2>/dev/null || echo "Unknown")
    PROD_REGION=$(grep "^prod_region" "$toml_file" | cut -d'"' -f2 2>/dev/null || echo "Unknown")

    # Extract domain configuration
    DOMAIN_BASE=$(grep "^domain_base" "$toml_file" | cut -d'"' -f2 2>/dev/null || echo "localhost")
    DEV_DOMAIN="dev.$DOMAIN_BASE"
    STAGING_DOMAIN="staging.$DOMAIN_BASE"
    PROD_DOMAIN="$DOMAIN_BASE"

    # Extract port and other config
    DEFAULT_PORT=$(grep "^default_port" "$toml_file" | awk '{print $3}' 2>/dev/null || echo "8000")
    DEPLOY_USER=$(grep "^deploy_user" "$toml_file" | cut -d'"' -f2 2>/dev/null || echo "tetra")
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

# Generic line highlighting function
highlight_line() {
    local text="$1"
    local is_selected="$2"
    local color="${3:-$GREEN}"  # Default to green if no color specified

    if [[ "$is_selected" == "true" ]]; then
        echo "    ► ${BOLD}${color}${text}${RESET}"
    else
        echo "      ${text}"
    fi
}

# Enhanced render with better buffering strategy
render_dashboard_page() {
    local page="$1"

    # Setup colors once
    setup_colors

    # Use better buffering - capture to variable instead of array for speed
    local output
    case "$page" in
        "overview")
            output=$(render_overview_enhanced)
            ;;
        "systems")
            output=$(render_systems_final)
            ;;
        "env")
            output=$(render_env_final)
            ;;
    esac

    # Single output to reduce flicker
    echo "$output"
}

# Modal system for detailed views
show_item_modal() {
    clear
    local modal_content
    local modal_title

    # Get modal content based on current selection
    case "$CURRENT_PAGE:$CURRENT_PANEL:$CURRENT_ITEM" in
        "overview:0:0")
            modal_title="TSM Running Services Details"
            modal_content=$(get_tsm_running_details)
            ;;
        "overview:0:1")
            modal_title="TSM Stopped Services Details"
            modal_content=$(get_tsm_stopped_details)
            ;;
        "overview:2:0")
            modal_title="DEV Environment Details"
            modal_content=$(get_env_details "dev")
            ;;
        "overview:2:1")
            modal_title="STAGING Environment Details"
            modal_content=$(get_env_details "staging")
            ;;
        "overview:2:2")
            modal_title="PROD Environment Details"
            modal_content=$(get_env_details "prod")
            ;;
        "systems:1:"*)
            modal_title="Service Details"
            modal_content=$(get_service_details "$CURRENT_ITEM")
            ;;
        "env:1:0")
            modal_title="DEV Infrastructure Details"
            modal_content=$(get_infrastructure_details "dev")
            ;;
        "env:1:1")
            modal_title="STAGING Infrastructure Details"
            modal_content=$(get_infrastructure_details "staging")
            ;;
        "env:1:2")
            modal_title="PROD Infrastructure Details"
            modal_content=$(get_infrastructure_details "prod")
            ;;
        *)
            modal_title="Item Details"
            modal_content="No detailed view available for this item.

Current Location: Page $CURRENT_PAGE, Panel $CURRENT_PANEL, Item $CURRENT_ITEM"
            ;;
    esac

    # Render modal
    echo
    echo "    ╔══════════════════════════════════════════════════════════╗"
    echo "    ║  $modal_title"
    echo "    ╚══════════════════════════════════════════════════════════╝"
    echo
    echo "$modal_content"
    echo
    echo "    ─────────────────────────────────────────────────────────"
    echo "    Press any key to return to dashboard, 'h' for hooks..."

    read -p "    > " -n1 modal_key

    case "$modal_key" in
        'h'|'H')
            execute_item_hook
            ;;
    esac
}

# Hook system for actions
execute_item_hook() {
    local hook_action=""
    local hook_result=""

    case "$CURRENT_PAGE:$CURRENT_PANEL:$CURRENT_ITEM" in
        "overview:0:0")
            hook_action="tsm list"
            ;;
        "overview:2:0")
            hook_action="cat env/dev.env 2>/dev/null || echo 'No dev.env file found'"
            ;;
        "overview:2:1")
            hook_action="cat env/staging.env 2>/dev/null || echo 'No staging.env file found'"
            ;;
        "overview:2:2")
            hook_action="cat env/prod.env 2>/dev/null || echo 'No prod.env file found'"
            ;;
        "env:1:0")
            hook_action="ping -c 1 $DEV_IP 2>/dev/null && echo 'DEV server reachable' || echo 'DEV server unreachable'"
            ;;
        "env:1:1")
            hook_action="ping -c 1 $STAGING_IP 2>/dev/null && echo 'STAGING server reachable' || echo 'STAGING server unreachable'"
            ;;
        "env:1:2")
            hook_action="ping -c 1 $PROD_IP 2>/dev/null && echo 'PROD server reachable' || echo 'PROD server unreachable'"
            ;;
        *)
            hook_action="echo 'No hook available for this item'"
            ;;
    esac

    clear
    echo
    echo "    ╔══════════════════════════════════════════════════════════╗"
    echo "    ║  EXECUTING HOOK: $hook_action"
    echo "    ╚══════════════════════════════════════════════════════════╝"
    echo

    # Execute the hook
    eval "$hook_action"

    echo
    echo "    ─────────────────────────────────────────────────────────"
    echo "    Press any key to return to dashboard..."
    read -p "    > " -n1
}

# Modal content generators
get_tsm_running_details() {
    if [[ -n "$TSM_SERVICES" ]]; then
        echo "    Running Services ($TSM_COUNT_RUNNING):"
        echo
        echo "$TSM_SERVICES" | grep "online" | while IFS= read -r line; do
            echo "      $line"
        done
    else
        echo "    No services currently running."
        echo
        echo "    Use 'tsm start <service>' to start a service."
    fi
}

get_tsm_stopped_details() {
    if [[ -n "$TSM_SERVICES" ]]; then
        echo "    Stopped Services ($TSM_COUNT_STOPPED):"
        echo
        echo "$TSM_SERVICES" | grep -E "stopped|offline" | while IFS= read -r line; do
            echo "      $line"
        done
    else
        echo "    No stopped services found."
    fi
}

get_env_details() {
    local env="$1"
    echo "    Environment: $env"
    echo
    if [[ -f "env/${env}.env" ]]; then
        echo "    Configuration file: env/${env}.env"
        echo "    File size: $(wc -l < "env/${env}.env") lines"
        echo "    Last modified: $(stat -c %y "env/${env}.env" 2>/dev/null || echo "Unknown")"
        echo
        echo "    Sample variables:"
        head -5 "env/${env}.env" | while IFS= read -r line; do
            if [[ "$line" =~ ^[A-Z_]+=.* ]]; then
                var_name=$(echo "$line" | cut -d'=' -f1)
                echo "      $var_name=<configured>"
            fi
        done
    else
        echo "    ✗ Configuration file missing: env/${env}.env"
        echo
        echo "    To create: tetra env generate $env"
    fi
}

get_infrastructure_details() {
    local env="$1"
    case "$env" in
        "dev")
            echo "    DEV Infrastructure Details:"
            echo
            echo "      Server: $DEV_SERVER"
            echo "      IP Address: $DEV_IP"
            echo "      Memory: $DEV_MEMORY"
            echo "      Region: $DEV_REGION"
            echo "      Domain: $DEV_DOMAIN"
            echo "      Port: $DEFAULT_PORT"
            echo
            echo "      SSH Access: ssh $DEPLOY_USER@$DEV_IP"
            ;;
        "staging")
            echo "    STAGING Infrastructure Details:"
            echo
            echo "      Server: $STAGING_SERVER"
            echo "      IP Address: $STAGING_IP"
            echo "      Memory: $STAGING_MEMORY"
            echo "      Region: $STAGING_REGION"
            echo "      Domain: $STAGING_DOMAIN"
            echo "      Port: $DEFAULT_PORT"
            echo
            echo "      SSH Access: ssh $DEPLOY_USER@$STAGING_IP"
            ;;
        "prod")
            echo "    PROD Infrastructure Details:"
            echo
            echo "      Server: $PROD_SERVER"
            echo "      IP Address: $PROD_IP"
            echo "      Memory: $PROD_MEMORY"
            echo "      Region: $PROD_REGION"
            echo "      Domain: $PROD_DOMAIN"
            echo "      Port: $DEFAULT_PORT"
            echo
            echo "      SSH Access: ssh $DEPLOY_USER@$PROD_IP"
            ;;
    esac
}

get_service_details() {
    local service_idx="$1"
    if [[ -n "$TSM_SERVICES" ]]; then
        local service_line=$(echo "$TSM_SERVICES" | sed -n "$((service_idx + 1))p")
        echo "    Service Details:"
        echo
        echo "      $service_line"
        echo
        echo "    Available actions:"
        echo "      - tsm start <service_name>"
        echo "      - tsm stop <service_name>"
        echo "      - tsm restart <service_name>"
        echo "      - tsm logs <service_name>"
    else
        echo "    No service details available."
    fi
}

# Final systems view with generic highlighting and rich data
render_systems_final() {
    cat << EOF

${BOLD}${CYAN}TETRA SYSTEM HEALTH${RESET}

Infrastructure Overview
═══════════════════════════════════════════════════════════
$(highlight_line "Dev Server: ${DEV_SERVER:-Unknown} (${DEV_IP:-Unknown})" "$([[ $CURRENT_PANEL -eq 0 && $CURRENT_ITEM -eq 0 ]] && echo true || echo false)" "$GREEN")
$(highlight_line "Memory: ${DEV_MEMORY:-Unknown} | Region: ${DEV_REGION:-Unknown}" "$([[ $CURRENT_PANEL -eq 0 && $CURRENT_ITEM -eq 1 ]] && echo true || echo false)" "$GREEN")
$(highlight_line "Domain: ${DEV_DOMAIN:-Unknown}" "$([[ $CURRENT_PANEL -eq 0 && $CURRENT_ITEM -eq 2 ]] && echo true || echo false)" "$GREEN")

Service Manager (TSM)
═══════════════════════════════════════════════════════════
$(highlight_line "Running: ${TSM_COUNT_RUNNING:-0} services" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 0 ]] && echo true || echo false)" "$GREEN")
$(highlight_line "Stopped: ${TSM_COUNT_STOPPED:-0} services" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 1 ]] && echo true || echo false)" "$RED")

Active Services
═══════════════════════════════════════════════════════════
EOF

    if [[ -n "$TSM_SERVICES" && "${TSM_COUNT_RUNNING:-0}" -gt 0 ]]; then
        local service_index=0
        echo "$TSM_SERVICES" | head -5 | while IFS= read -r line; do
            highlight_line "$line" "$([[ $CURRENT_PANEL -eq 2 && $CURRENT_ITEM -eq $service_index ]] && echo true || echo false)" "$CYAN"
            ((service_index++))
        done
    else
        highlight_line "No services currently running" "$([[ $CURRENT_PANEL -eq 2 ]] && echo true || echo false)" "$YELLOW"
    fi

    cat << EOF

System Status
═══════════════════════════════════════════════════════════
$(highlight_line "TKM: ${TKM_STATUS:-○} SSH Keys Ready" "$([[ $CURRENT_PANEL -eq 3 && $CURRENT_ITEM -eq 0 ]] && echo true || echo false)" "$GREEN")
$(highlight_line "ENV Files: ${ENV_DEV_STATUS:-○} Dev ${ENV_STAGING_STATUS:-○} Staging ${ENV_PROD_STATUS:-○} Prod" "$([[ $CURRENT_PANEL -eq 3 && $CURRENT_ITEM -eq 1 ]] && echo true || echo false)" "$GREEN")
$(highlight_line "GIT: ${GIT_CLEAN:-○} Working tree | Branch: ${GIT_BRANCH:-main}" "$([[ $CURRENT_PANEL -eq 3 && $CURRENT_ITEM -eq 2 ]] && echo true || echo false)" "$([[ ${GIT_CLEAN:-○} == "✓" ]] && echo $GREEN || echo $RED)")

EOF
}

# Final environment view with generic highlighting and 4 amigos visibility
render_env_final() {
    cat << EOF

${BOLD}${CYAN}ENVIRONMENT INFRASTRUCTURE${RESET}

LOCAL Development
═══════════════════════════════════════════════════════════
$(highlight_line "Project: ${PROJECT_NAME:-tetra} | Branch: ${GIT_BRANCH:-main}" "$([[ $CURRENT_PANEL -eq 0 && $CURRENT_ITEM -eq 0 ]] && echo true || echo false)" "$CYAN")
$(highlight_line "Status: ${GIT_CLEAN} Working tree | Services: ${TSM_COUNT_RUNNING:-0}/${TSM_COUNT_STOPPED:-0}" "$([[ $CURRENT_PANEL -eq 0 && $CURRENT_ITEM -eq 1 ]] && echo true || echo false)" "$CYAN")
$(highlight_line "Port: ${DEFAULT_PORT:-8000} | Deploy User: ${DEPLOY_USER:-tetra}" "$([[ $CURRENT_PANEL -eq 0 && $CURRENT_ITEM -eq 2 ]] && echo true || echo false)" "$CYAN")

DEV Environment
═══════════════════════════════════════════════════════════
$(highlight_line "${ENV_DEV_STATUS:-○} ${DEV_DOMAIN:-dev.localhost}" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 0 ]] && echo true || echo false)" "$GREEN")
$(highlight_line "Host: ${DEV_SERVER:-Unknown} | IP: ${DEV_IP:-Unknown}" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 0 ]] && echo true || echo false)" "$GREEN")
$(highlight_line "Memory: ${DEV_MEMORY:-Unknown} | Region: ${DEV_REGION:-Unknown}" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 0 ]] && echo true || echo false)" "$GREEN")

STAGING Environment
═══════════════════════════════════════════════════════════
$(highlight_line "${ENV_STAGING_STATUS:-○} ${STAGING_DOMAIN:-staging.localhost}" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 1 ]] && echo true || echo false)" "$YELLOW")
$(highlight_line "Host: ${STAGING_SERVER:-Unknown} | IP: ${STAGING_IP:-Unknown}" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 1 ]] && echo true || echo false)" "$YELLOW")
$(highlight_line "Memory: ${STAGING_MEMORY:-Unknown} | Region: ${STAGING_REGION:-Unknown}" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 1 ]] && echo true || echo false)" "$YELLOW")

PROD Environment
═══════════════════════════════════════════════════════════
$(highlight_line "${ENV_PROD_STATUS:-○} ${PROD_DOMAIN:-localhost}" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 2 ]] && echo true || echo false)" "$RED")
$(highlight_line "Host: ${PROD_SERVER:-Unknown} | IP: ${PROD_IP:-Unknown}" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 2 ]] && echo true || echo false)" "$RED")
$(highlight_line "Memory: ${PROD_MEMORY:-Unknown} | Region: ${PROD_REGION:-Unknown}" "$([[ $CURRENT_PANEL -eq 1 && $CURRENT_ITEM -eq 2 ]] && echo true || echo false)" "$RED")

DEPLOYMENT ACTIONS
═══════════════════════════════════════════════════════════
$(highlight_line "Ready: tetra deploy staging --dry-run" "$([[ $CURRENT_PANEL -eq 2 ]] && echo true || echo false)" "$MAGENTA")

EOF
}

check_env_file() {
    local env="$1"
    if [[ -f "env/${env}.env" ]]; then
        echo "✓"
    else
        echo "○"
    fi
}

load_git_data() {
    if git rev-parse --git-dir >/dev/null 2>&1; then
        GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
        GIT_STATUS=$(git status --porcelain 2>/dev/null)
        if [[ -z "$GIT_STATUS" ]]; then
            GIT_CLEAN="✓"
        else
            GIT_CLEAN="✗"
        fi
    else
        GIT_BRANCH="main"
        GIT_CLEAN="○"
    fi
}

load_tkm_data() {
    if command -v tkm >/dev/null 2>&1; then
        TKM_STATUS="✓"
    else
        TKM_STATUS="○"
    fi
}