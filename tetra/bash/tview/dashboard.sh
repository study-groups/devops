#!/usr/bin/env bash

# Tetra ASCII Dashboard - Fixed Version
# Navigation: a/d = pages, j/k = panels within page

# === DASHBOARD STATE ===
DASHBOARD_PAGES=("TETRA_OVERVIEW" "TETRA_SYSTEMS" "CURRENT_ORGANIZATION" "ENV_INFO")
CURRENT_PAGE=0
CURRENT_PANEL=0
DASHBOARD_RUNNING=true
REFRESH_NEEDED=true

# === DASHBOARD CONTROLLER ===

tetra_ascii_dashboard() {
    # Check if we're in a proper terminal
    if [[ ! -t 0 ]]; then
        echo "Error: Dashboard requires an interactive terminal"
        return 1
    fi

    # Initialize dashboard
    dashboard_init

    # Main dashboard loop
    while [[ "$DASHBOARD_RUNNING" == true ]]; do
        if [[ "$REFRESH_NEEDED" == true ]]; then
            dashboard_render
            REFRESH_NEEDED=false
        fi
        dashboard_handle_input
    done

    # Cleanup
    dashboard_cleanup
}

dashboard_init() {
    # Setup terminal only if interactive
    if [[ -t 0 && -t 1 ]]; then
        tput clear
        tput civis  # Hide cursor
        stty -echo  # Disable echo
        stty cbreak # Enable single char input
    fi

    # Trap cleanup on exit
    trap dashboard_cleanup EXIT INT TERM

    # Load dashboard data
    dashboard_load_data
    REFRESH_NEEDED=true
}

dashboard_cleanup() {
    # Restore terminal only if interactive
    if [[ -t 0 && -t 1 ]]; then
        stty echo   # Re-enable echo
        stty -cbreak # Restore normal input
        tput cnorm  # Show cursor
        tput clear
    fi
    echo "Dashboard closed."
}

dashboard_render() {
    if [[ -t 1 ]]; then
        tput clear
        tput cup 0 0
    fi

    # Render current page
    case "${DASHBOARD_PAGES[$CURRENT_PAGE]}" in
        "TETRA_OVERVIEW")
            render_tetra_overview
            ;;
        "TETRA_SYSTEMS")
            render_tetra_systems
            ;;
        "CURRENT_ORGANIZATION")
            render_current_organization
            ;;
        "ENV_INFO")
            render_env_info
            ;;
    esac

    # Render navigation help
    render_navigation_help
}

dashboard_handle_input() {
    local key
    # Use timeout to avoid hanging
    if read -n1 -s -t 0.1 key; then
        case "$key" in
            'a'|'A')
                # Previous page
                ((CURRENT_PAGE--))
                if [[ $CURRENT_PAGE -lt 0 ]]; then
                    CURRENT_PAGE=$((${#DASHBOARD_PAGES[@]} - 1))
                fi
                CURRENT_PANEL=0
                REFRESH_NEEDED=true
                ;;
            'd'|'D')
                # Next page
                ((CURRENT_PAGE++))
                if [[ $CURRENT_PAGE -ge ${#DASHBOARD_PAGES[@]} ]]; then
                    CURRENT_PAGE=0
                fi
                CURRENT_PANEL=0
                REFRESH_NEEDED=true
                ;;
            'j'|'J')
                # Next panel
                dashboard_next_panel
                REFRESH_NEEDED=true
                ;;
            'k'|'K')
                # Previous panel
                dashboard_prev_panel
                REFRESH_NEEDED=true
                ;;
            'q'|'Q'|$'\e')
                # Quit
                DASHBOARD_RUNNING=false
                ;;
            'r'|'R')
                # Refresh data
                dashboard_load_data
                REFRESH_NEEDED=true
                ;;
        esac
    fi
}

dashboard_next_panel() {
    local max_panels
    max_panels=$(get_max_panels_for_current_page)
    ((CURRENT_PANEL++))
    if [[ $CURRENT_PANEL -ge $max_panels ]]; then
        CURRENT_PANEL=0
    fi
}

dashboard_prev_panel() {
    local max_panels
    max_panels=$(get_max_panels_for_current_page)
    ((CURRENT_PANEL--))
    if [[ $CURRENT_PANEL -lt 0 ]]; then
        CURRENT_PANEL=$((max_panels - 1))
    fi
}

get_max_panels_for_current_page() {
    case "${DASHBOARD_PAGES[$CURRENT_PAGE]}" in
        "TETRA_OVERVIEW") echo 4 ;;      # 4 main systems
        "TETRA_SYSTEMS") echo 4 ;;       # TSM, TKM, ENV, DEPLOY
        "CURRENT_ORGANIZATION") echo 4 ;; # 4 environments
        "ENV_INFO") echo 4 ;;            # local, dev, staging, prod
        *) echo 1 ;;
    esac
}

# === DATA LOADING ===

dashboard_load_data() {
    # Load live TSM data
    load_tsm_data

    # Load environment data
    load_environment_data

    # Load git status
    load_git_data

    # Load TKM status
    load_tkm_data
}

load_tsm_data() {
    # Get TSM service list and status
    if command -v tsm >/dev/null 2>&1; then
        # Source tetra environment if not already loaded
        if ! declare -f tsm >/dev/null 2>&1; then
            source ~/tetra/tetra.sh >/dev/null 2>&1 || true
        fi

        TSM_SERVICES=$(tsm list 2>/dev/null | tail -n +3 || echo "")
        TSM_COUNT_RUNNING=$(echo "$TSM_SERVICES" | grep -c "online" 2>/dev/null || echo "0")
        TSM_COUNT_STOPPED=$(echo "$TSM_SERVICES" | grep -c "stopped\|offline" 2>/dev/null || echo "0")
    else
        TSM_SERVICES=""
        TSM_COUNT_RUNNING=0
        TSM_COUNT_STOPPED=0
    fi
}

load_environment_data() {
    # Discover project TOML
    local toml_files=(*.toml)
    if [[ -f "${toml_files[0]}" ]]; then
        PROJECT_TOML="${toml_files[0]}"
        PROJECT_NAME="$(basename "$PROJECT_TOML" .toml)"
    else
        PROJECT_TOML=""
        PROJECT_NAME="tetra"
    fi

    # Check environment files
    ENV_LOCAL_STATUS=$(check_env_file "local")
    ENV_DEV_STATUS=$(check_env_file "dev")
    ENV_STAGING_STATUS=$(check_env_file "staging")
    ENV_PROD_STATUS=$(check_env_file "prod")
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
    # Check if TKM is available and initialized
    if command -v tkm >/dev/null 2>&1; then
        TKM_STATUS="✓"
    else
        TKM_STATUS="○"
    fi
}

# === SIMPLIFIED PAGE RENDERERS ===

render_tetra_overview() {
    cat << 'EOF'
                          ╔══════════════════════════════╗
                          ║       TETRA OVERVIEW         ║
                          ╚══════════════════════════════╝

    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │     TSM     │    │     TKM     │    │     ENV     │    │   DEPLOY    │
    │   Service   │    │    Keys     │    │ Environment │    │   Workflow  │
    │  Manager    │    │  Manager    │    │   Manager   │    │   Engine    │
    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
         │                    │                    │                    │
EOF

    printf "    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐\n"
    printf "    │%s %2d running │    │%s TKM ready │    │%s dev.env   │    │%s git %s │\n" \
           "✓" "${TSM_COUNT_RUNNING:-0}" "${TKM_STATUS:-○}" "${ENV_DEV_STATUS:-○}" "${GIT_CLEAN:-○}" "${GIT_CLEAN:-○}"
    printf "    │%s %2d stopped │    │%s staging   │    │%s staging   │    │ → %-8s │\n" \
           "○" "${TSM_COUNT_STOPPED:-0}" "○" "${ENV_STAGING_STATUS:-○}" "${GIT_BRANCH:0:8}"
    printf "    │⚡ auto      │    │%s prod      │    │%s prod      │    │✗ conflicts │\n" \
           "○" "${ENV_PROD_STATUS:-○}"

    cat << EOF
    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘

            LOCAL                DEV               STAGING              PROD
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │${PROJECT_NAME:0:15}    │  │dev@dev.host...  │  │staging@prod...  │  │prod@prod.host   │
    │${GIT_BRANCH:0:15}    │  │ ✓ services up   │  │ ○ not deployed  │  │ ○ not deployed  │
    │${GIT_CLEAN} clean tree    │  │ ✓ data synced   │  │ ✗ data stale    │  │ ✗ data stale    │
    └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘

                          Ready: tetra deploy staging --dry-run

EOF

    # Show panel indicator
    if [[ -t 1 ]]; then
        tput cup 8 $((CURRENT_PANEL * 20 + 10))
        printf "▲"
    fi
}

render_tetra_systems() {
    cat << EOF
                          ╔══════════════════════════════╗
                          ║       TETRA SYSTEMS          ║
                          ╚══════════════════════════════╝

                              SYSTEM HEALTH OVERVIEW

    ┌─────────────────────────────────────────────────────────────────────────┐
    │                              TSM - SERVICE MANAGER                      │
    ├─────────────────────────────────────────────────────────────────────────┤
    │ Running: ${TSM_COUNT_RUNNING:-0} services    Stopped: ${TSM_COUNT_STOPPED:-0} services    Auto-start: enabled │
    │                                                                         │
    │ Active Services:                                                        │
EOF

    # Show services (simplified)
    if [[ -n "$TSM_SERVICES" ]]; then
        echo "$TSM_SERVICES" | head -3 | while IFS= read -r line; do
            printf "    │   %-65s │\n" "${line:0:65}"
        done
    else
        printf "    │   %-65s │\n" "No services running"
        printf "    │   %-65s │\n" ""
        printf "    │   %-65s │\n" ""
    fi

    cat << EOF
    └─────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
    │       TKM       │       ENV       │     DEPLOY      │     STATUS      │
    ├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
    │${TKM_STATUS} Keys deployed  │${ENV_DEV_STATUS} Environments  │${GIT_CLEAN} Git clean     │ OPERATIONAL     │
    │✓ SSH access    │✓ Templates     │✓ Ready deploy  │ $(date +%H:%M:%S)       │
    └─────────────────┴─────────────────┴─────────────────┴─────────────────┘

EOF
}

render_current_organization() {
    cat << EOF
                          ╔══════════════════════════════╗
                          ║     CURRENT ORGANIZATION     ║
                          ╚══════════════════════════════╝

                           ENVIRONMENT DEPLOYMENT STATUS

    ┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
    │      LOCAL      │       DEV       │     STAGING     │      PROD       │
    ├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
    │${PROJECT_NAME:0:15}  │ dev@dev.host    │ staging@prod    │ prod@prod.host  │
    │${GIT_BRANCH:0:15}  │ ✓ ${TSM_COUNT_RUNNING} running     │ ○ not deployed  │ ○ not deployed  │
    │${GIT_CLEAN} clean tree    │ ✓ data fresh    │ ✗ data stale    │ ✗ data stale    │
    │                 │ ✓ services up   │ ○ services down │ ○ services down │
    └─────────────────┴─────────────────┴─────────────────┴─────────────────┘

                              SERVICE DISTRIBUTION

    Services by Environment:
EOF

    if [[ -n "$TSM_SERVICES" ]]; then
        echo "$TSM_SERVICES" | head -5 | while IFS= read -r line; do
            printf "      %-66s\n" "${line:0:66}"
        done
    else
        echo "      No services currently running"
    fi

    echo
    echo "                             Ready for deployment"
}

render_env_info() {
    local envs=("LOCAL" "DEV" "STAGING" "PROD")
    local current_env="${envs[$CURRENT_PANEL]}"

    cat << EOF
                          ╔══════════════════════════════╗
                          ║         ENV INFO             ║
                          ╚══════════════════════════════╝

                              ${current_env} ENVIRONMENT

EOF

    case "$current_env" in
        "LOCAL")
            cat << EOF
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                             LOCAL ENVIRONMENT                           │
    ├─────────────────────────────────────────────────────────────────────────┤
    │ Project: ${PROJECT_NAME}                                                │
    │ Branch:  ${GIT_BRANCH}                                                  │
    │ Status:  ${GIT_CLEAN} Clean working directory                           │
    │                                                                         │
    │ Environment Files:                                                      │
    │   dev.env:     ${ENV_DEV_STATUS} Available                              │
    │   staging.env: ${ENV_STAGING_STATUS} Available                          │
    │   prod.env:    ${ENV_PROD_STATUS} Available                             │
    │                                                                         │
    │ Services Running: ${TSM_COUNT_RUNNING}                                  │
    │ Services Stopped: ${TSM_COUNT_STOPPED}                                  │
    └─────────────────────────────────────────────────────────────────────────┘
EOF
            ;;
        "DEV")
            cat << EOF
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                              DEV ENVIRONMENT                            │
    ├─────────────────────────────────────────────────────────────────────────┤
    │ Target:    dev@dev.pixeljamarcade.com                                   │
    │ Services:  ${TSM_COUNT_RUNNING} running, ${TSM_COUNT_STOPPED} stopped    │
    │ Data:      ✓ PD_DIR synchronized                                        │
    │ Uptime:    Active development environment                               │
    │                                                                         │
    │ Active Services:                                                        │
EOF
            if [[ -n "$TSM_SERVICES" ]]; then
                echo "$TSM_SERVICES" | head -4 | while IFS= read -r line; do
                    printf "    │   %-65s │\n" "${line:0:65}"
                done
            else
                printf "    │   %-65s │\n" "No services running"
            fi
            echo "    └─────────────────────────────────────────────────────────────────────────┘"
            ;;
        "STAGING")
            cat << 'EOF'
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                           STAGING ENVIRONMENT                           │
    ├─────────────────────────────────────────────────────────────────────────┤
    │ Target:    staging@prod.server (shared with prod)                      │
    │ Services:  ○ Not deployed                                               │
    │ Data:      ✗ PD_DIR needs sync                                          │
    │ Branch:    staging (not merged)                                         │
    │                                                                         │
    │ Deployment Required:                                                    │
    │   1. Sync data: tkm sync-data staging                                   │
    │   2. Deploy:    tetra deploy staging                                    │
    │   3. Verify:    tetra deploy status staging                            │
    │                                                                         │
    └─────────────────────────────────────────────────────────────────────────┘
EOF
            ;;
        "PROD")
            cat << 'EOF'
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                           PRODUCTION ENVIRONMENT                        │
    ├─────────────────────────────────────────────────────────────────────────┤
    │ Target:    prod@prod.server                                             │
    │ Services:  ○ Not deployed                                               │
    │ Data:      ✗ PD_DIR needs sync                                          │
    │ Branch:    prod (not merged)                                            │
    │                                                                         │
    │ Production Deployment:                                                  │
    │   1. Test staging first                                                 │
    │   2. Sync data: tkm sync-data prod                                      │
    │   3. Deploy:    tetra deploy prod                                       │
    │   4. Monitor:   Production health checks                               │
    │                                                                         │
    └─────────────────────────────────────────────────────────────────────────┘
EOF
            ;;
    esac

    # Environment navigation indicators
    printf "\n    Environments: "
    for i in "${!envs[@]}"; do
        if [[ $i -eq $CURRENT_PANEL ]]; then
            printf "[%s] " "${envs[$i]}"
        else
            printf " %s  " "${envs[$i]}"
        fi
    done
    echo
}

render_navigation_help() {
    if [[ -t 1 ]]; then
        local lines=$(tput lines)
        tput cup $((lines - 2)) 0
    fi
    printf "Navigation: [a/d] Pages  [j/k] Panels  [r] Refresh  [q] Quit"
    printf " | Page: %s (%d/%d)" \
           "${DASHBOARD_PAGES[$CURRENT_PAGE]}" \
           $((CURRENT_PAGE + 1)) \
           "${#DASHBOARD_PAGES[@]}"
}

# === ENTRY POINT ===

# Start dashboard if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    tetra_ascii_dashboard
fi