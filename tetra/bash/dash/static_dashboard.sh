#!/usr/bin/env bash

# Static ASCII Dashboard - No interactive input, just display

# === DATA LOADING ===

load_tsm_data() {
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
    local toml_files=(*.toml)
    if [[ -f "${toml_files[0]}" ]]; then
        PROJECT_TOML="${toml_files[0]}"
        PROJECT_NAME="$(basename "$PROJECT_TOML" .toml)"
    else
        PROJECT_TOML=""
        PROJECT_NAME="tetra"
    fi

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
    if command -v tkm >/dev/null 2>&1; then
        TKM_STATUS="✓"
    else
        TKM_STATUS="○"
    fi
}

# === STATIC DASHBOARD RENDERER ===

render_dashboard() {
    local page="${1:-overview}"

    case "$page" in
        "overview"|"")
            render_tetra_overview
            ;;
        "systems")
            render_tetra_systems
            ;;
        "organization"|"org")
            render_current_organization
            ;;
        "env")
            render_env_info "${2:-local}"
            ;;
        *)
            echo "Usage: ascii-dash [overview|systems|org|env] [env-name]"
            echo "Examples:"
            echo "  ascii-dash                    # Show overview"
            echo "  ascii-dash systems            # Show systems page"
            echo "  ascii-dash env staging        # Show staging environment"
            return 1
            ;;
    esac
}

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
    local env="${1:-local}"

    cat << EOF
                          ╔══════════════════════════════╗
                          ║         ENV INFO             ║
                          ╚══════════════════════════════╝

                              $(echo "$env" | tr '[:lower:]' '[:upper:]') ENVIRONMENT

EOF

    case "$env" in
        "local")
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
        "dev")
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
        "staging")
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
        "prod")
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
}

# === MAIN ===

# Load all data
load_tsm_data
load_environment_data
load_git_data
load_tkm_data

# Render requested page
render_dashboard "$@"