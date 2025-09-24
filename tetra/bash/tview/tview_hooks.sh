#!/usr/bin/env bash

# TView Drill Actions - Smart contextual drill behaviors
# Contains: Drill navigation, smart triggers, and context-specific actions

# Drill into selected item (L key) - Smart contextual actions
drill_into() {
    echo "DEBUG: drill_into called, DRILL_LEVEL=$DRILL_LEVEL, MODE=$CURRENT_MODE, ENV=$CURRENT_ENV" >> /tmp/tview_debug.log
    if [[ $DRILL_LEVEL -eq 0 ]]; then
        # Execute context-specific action based on current mode and environment
        echo "DEBUG: calling execute_drill_action $CURRENT_MODE $CURRENT_ENV" >> /tmp/tview_debug.log
        execute_drill_action "$CURRENT_MODE" "$CURRENT_ENV"
        DRILL_LEVEL=1
        echo "DEBUG: drill_into completed, DRILL_LEVEL now $DRILL_LEVEL" >> /tmp/tview_debug.log
    else
        echo "DEBUG: drill_into skipped, already at DRILL_LEVEL=$DRILL_LEVEL" >> /tmp/tview_debug.log
    fi
}

# Drill out of item (J key)
drill_out() {
    if [[ $DRILL_LEVEL -eq 1 ]]; then
        DRILL_LEVEL=0
    fi
}

# Execute smart drill action based on context
execute_drill_action() {
    local mode="$1"
    local env="$2"
    local action_key="${mode}:${env}"

    echo "DEBUG: execute_drill_action called with mode=$mode env=$env action_key=$action_key" >> /tmp/tview_debug.log

    case "$action_key" in
        "TOML:TETRA")
            # Drill into TETRA TOML mode opens span-based action execution
            echo "DEBUG: TOML:TETRA case matched, executing action for item $CURRENT_ITEM" >> /tmp/tview_debug.log
            echo "Executing TETRA TOML action: ${CURRENT_ITEM}"
            execute_current_action
            ;;
        "TOML:SYSTEM")
            # Drill into TOML system opens org selection REPL
            echo "Opening organization selection..."
            org_selection_repl
            ;;
        "TOML:LOCAL")
            # Drill into local TOML opens file editing
            echo "Opening local TOML editor..."
            toml_editor_repl
            ;;
        "TOML:DEV")
            if [[ -n "$DEV_IP" && "$DEV_IP" != "Unknown" ]]; then
                echo "Connecting to DEV environment..."
                ssh tetra@"$DEV_IP"
            else
                echo "DEV IP not configured"
            fi
            ;;
        "TOML:STAGING")
            if [[ -n "$STAGING_IP" && "$STAGING_IP" != "Unknown" ]]; then
                echo "Connecting to STAGING environment..."
                ssh tetra@"$STAGING_IP"
            else
                echo "STAGING IP not configured"
            fi
            ;;
        "TOML:PROD")
            if [[ -n "$PROD_IP" && "$PROD_IP" != "Unknown" ]]; then
                echo "Connecting to PROD environment..."
                ssh tetra@"$PROD_IP"
            else
                echo "PROD IP not configured"
            fi
            ;;
        "TSM:LOCAL")
            echo "Launching TSM REPL..."
            source "$TETRA_SRC/bash/tsm/tsm_repl.sh"
            tsm_repl_main
            ;;
        "TSM:DEV")
            if [[ -n "$DEV_IP" && "$DEV_IP" != "Unknown" ]]; then
                echo "Checking DEV services..."
                ssh tetra@"$DEV_IP" 'tsm list 2>/dev/null || echo "TSM not available on remote"'
            else
                echo "DEV IP not configured"
            fi
            ;;
        "TSM:STAGING")
            if [[ -n "$STAGING_IP" && "$STAGING_IP" != "Unknown" ]]; then
                echo "Checking STAGING services..."
                ssh tetra@"$STAGING_IP" 'tsm list 2>/dev/null || echo "TSM not available on remote"'
            else
                echo "STAGING IP not configured"
            fi
            ;;
        "TSM:PROD")
            if [[ -n "$PROD_IP" && "$PROD_IP" != "Unknown" ]]; then
                echo "Checking PROD services..."
                ssh tetra@"$PROD_IP" 'tsm list 2>/dev/null || echo "TSM not available on remote"'
            else
                echo "PROD IP not configured"
            fi
            ;;
        "TKM:DEV")
            if [[ -n "$DEV_IP" && "$DEV_IP" != "Unknown" ]]; then
                echo "Connecting to DEV as root for key management..."
                ssh root@"$DEV_IP"
            else
                echo "DEV IP not configured"
            fi
            ;;
        "TKM:STAGING")
            if [[ -n "$STAGING_IP" && "$STAGING_IP" != "Unknown" ]]; then
                echo "Connecting to STAGING as root for key management..."
                ssh root@"$STAGING_IP"
            else
                echo "STAGING IP not configured"
            fi
            ;;
        "TKM:PROD")
            if [[ -n "$PROD_IP" && "$PROD_IP" != "Unknown" ]]; then
                echo "Connecting to PROD as root for key management..."
                ssh root@"$PROD_IP"
            else
                echo "PROD IP not configured"
            fi
            ;;
        "ORG:DEV")
            if [[ -n "$ACTIVE_ORG" && "$ACTIVE_ORG" != "No active organization" ]]; then
                echo "Deploying $ACTIVE_ORG to DEV..."
                tetra org push "$ACTIVE_ORG" dev
            else
                echo "No active organization"
            fi
            ;;
        "ORG:STAGING")
            if [[ -n "$ACTIVE_ORG" && "$ACTIVE_ORG" != "No active organization" ]]; then
                echo "Deploying $ACTIVE_ORG to STAGING..."
                tetra org push "$ACTIVE_ORG" staging
            else
                echo "No active organization"
            fi
            ;;
        "ORG:PROD")
            if [[ -n "$ACTIVE_ORG" && "$ACTIVE_ORG" != "No active organization" ]]; then
                echo "Deploying $ACTIVE_ORG to PROD..."
                tetra org push "$ACTIVE_ORG" prod
            else
                echo "No active organization"
            fi
            ;;
        *)
            # Default drill behavior - just enter drill mode without action
            echo "Drilling into $mode - $env"
            ;;
    esac

    # Wait for user to see result before returning
    echo "Press any key to return to tview..."
    read -n1 -s
}

# Drill mode navigation (AWSD controls)
drill_navigate() {
    local direction="$1"
    case "$direction" in
        "up"|"down")
            # Scroll content in drill mode
            scroll_content "$direction"
            ;;
        "left"|"right")
            # Navigate between drill items if applicable
            navigate_item "$direction"
            ;;
    esac
}

# Get maximum items for current environment+mode combination
get_max_items_for_current_context() {
    case "$CURRENT_ENV:$CURRENT_MODE" in
        "TETRA:TOML") echo 3 ;;      # View configuration, Edit configuration, Validate TOML
        "TETRA:TKM") echo 3 ;;       # SSH Key Status, Test Connection, Key Management
        "TETRA:TSM") echo 4 ;;       # Service Status, Config Check, Service List, View Logs
        "TETRA:DEPLOY") echo 4 ;;    # Deploy Status, Validate Config, Execute Deploy, Rollback
        "TETRA:ORG") echo 3 ;;       # Organization Info, Switch Org, Sync Config
        "TETRA:RCM") echo 2 ;;       # Direct Execution, Command History
        "SYSTEM:TOML") echo 4 ;;     # TOML file, organization, project, status
        "LOCAL:TOML") echo 4 ;;      # Local config items
        "DEV:TOML") echo 5 ;;        # Dev server infrastructure items
        "STAGING:TOML") echo 5 ;;    # Staging server infrastructure items
        "PROD:TOML") echo 5 ;;       # Prod server infrastructure items
        "SYSTEM:TKM") echo 2 ;;      # Key status, known hosts
        "LOCAL:TKM") echo 3 ;;       # Local keys, SSH config, status
        *":TKM") echo 2 ;;           # SSH connectivity, key deployment
        "SYSTEM:TSM") echo 2 ;;      # Service manager status
        "LOCAL:TSM")
            if [[ -n "$TSM_SERVICES" ]]; then
                echo $(echo "$TSM_SERVICES" | wc -l)
            else
                echo 1
            fi
            ;;
        *":TSM") echo 2 ;;           # Remote service status (if SSH connected)
        "SYSTEM:DEPLOY") echo 2 ;;   # Deploy status overview
        "LOCAL:DEPLOY") echo 3 ;;    # Git status, artifacts, deploy readiness
        *":DEPLOY") echo 3 ;;        # Deployment status, last deploy, actions
        "SYSTEM:ORG") echo 3 ;;      # Organization overview, total orgs, status
        "LOCAL:ORG") echo 4 ;;       # Create, switch, templates, settings
        *":ORG") echo 3 ;;           # Push/pull config, sync status
        *) echo 1 ;;
    esac
}