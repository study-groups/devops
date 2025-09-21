#!/usr/bin/env bash

# Dashboard - Simple one-shot views for REPL integration

# Simple dashboard renderer for REPL integration
tetra_repl_dashboard() {
    local page="${1:-overview}"

    # Load current data
    load_tsm_data
    load_environment_data
    load_git_data
    load_tkm_data

    # Clear screen and paint dashboard
    clear

    case "$page" in
        "systems")
            render_repl_systems
            ;;
        "env")
            render_repl_env
            ;;
        *)
            render_repl_overview
            ;;
    esac

    # Return to prompt
    echo
}

# Simple list overview for REPL
render_repl_overview() {
    cat << EOF

    TETRA OVERVIEW

    TSM Service Manager
      ✓ ${TSM_COUNT_RUNNING:-0} running
      ○ ${TSM_COUNT_STOPPED:-0} stopped

    TKM Key Manager
      ${TKM_STATUS:-○} Ready

    ENV Environment Manager
      ${ENV_DEV_STATUS:-○} dev.env
      ${ENV_STAGING_STATUS:-○} staging.env
      ${ENV_PROD_STATUS:-○} prod.env

    DEPLOY Workflow Engine
      ${GIT_CLEAN:-○} Git status
      Project: ${PROJECT_NAME:-tetra} (${GIT_BRANCH:-main})

EOF
}

# Simple systems view for REPL
render_repl_systems() {
    cat << EOF

    TETRA SYSTEMS

    TSM Service Manager
      Running: ${TSM_COUNT_RUNNING:-0}
      Stopped: ${TSM_COUNT_STOPPED:-0}

EOF

    if [[ -n "$TSM_SERVICES" ]]; then
        echo "    Active Services:"
        echo "$TSM_SERVICES" | head -5 | while IFS= read -r line; do
            printf "      %s\n" "$line"
        done
    else
        echo "    Active Services:"
        echo "      No services running"
    fi

    cat << EOF

    System Status
      TKM: ${TKM_STATUS:-○} Keys ready
      ENV: ${ENV_DEV_STATUS:-○} Dev ${ENV_STAGING_STATUS:-○} Staging ${ENV_PROD_STATUS:-○} Prod
      GIT: ${GIT_CLEAN:-○} ${GIT_BRANCH:-main}

EOF
}

# Simple environment view for REPL
render_repl_env() {
    cat << EOF

    ENVIRONMENT STATUS

    Local Environment
      Project: ${PROJECT_NAME:-tetra}
      Branch: ${GIT_BRANCH:-main}
      Status: ${GIT_CLEAN} Clean working tree
      Services: ${TSM_COUNT_RUNNING:-0} running, ${TSM_COUNT_STOPPED:-0} stopped

    Remote Environments
      DEV: ${ENV_DEV_STATUS:-○} Config ready, services running
      STAGING: ${ENV_STAGING_STATUS:-○} Config ready, not deployed
      PROD: ${ENV_PROD_STATUS:-○} Config ready, not deployed

    Next Actions
      Ready: tetra deploy staging --dry-run

EOF
}

# Data loading functions (same as static version)
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