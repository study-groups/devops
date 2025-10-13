#!/usr/bin/env bash

# Action Registry with Routing Annotations + State Machine + TES Resolution
# Demo 013: Actions declare routing, execution mode, capabilities, and TES metadata
#
# TES (Tetra Endpoint Specification) v2.1 - Progressive Resolution Levels:
#   Level 0: Symbol      - Logical name (@dev, @prod, @staging)
#   Level 1: Address     - IP address or hostname (137.184.226.163)
#   Level 2: Channel     - User@host combo (dev@137.184.226.163)
#   Level 3: Connector   - Dual-role auth (root:dev@host -i key)
#   Level 4: Handle      - Validated connector (SSH tested)
#   Level 5: Locator     - Full resource path (dev@host:~/path/to/file)
#   Level 6: Binding     - Operation + locator + validation
#   Level 7: Plan        - Executable command (ready to run)
#
# TES Operations:
#   - read:    Retrieve remote data (scp, ssh cat, etc)
#   - write:   Deploy/push data to remote (scp, rsync, etc)
#   - execute: Run remote command (ssh)
#
# Action Metadata Fields:
#   - tes_level:     Resolution level this action uses (local, symbol, plan, etc)
#   - tes_target:    Target symbol (@dev, @prod, @local)
#   - tes_operation: What operation to perform (read, write, execute)
#   - tes_requires:  Minimum resolution level required (connector, handle, binding)

# Explicit action registry (avoids iteration issues)
declare -a ACTION_REGISTRY=(
    # System:Monitor
    "view_toml"
    "view_services"
    "view_org"
    # System:Control
    "refresh_cache"
    "edit_toml"
    # Local/Dev:Monitor
    "status_tsm"
    "status_watchdog"
    "view_logs"
    "view_remote"
    # Local/Dev:Control
    "start_tsm"
    "stop_tsm"
    "restart_tsm"
    "start_watchdog"
    "stop_watchdog"
    # Deploy
    "deploy_local"
    "deploy_dev"
    "deploy_staging"
    "deploy_prod"
)

# Helper function to declare actions
declare_action() {
    local action_name="$1"
    shift

    # Create associative array for this action
    declare -gA "ACTION_${action_name}"
    local -n action_def="ACTION_${action_name}"

    # Default values
    action_def[state]="idle"
    action_def[immediate]="true"
    action_def[inputs]=""
    action_def[output]=""
    action_def[effects]=""
    action_def[can]=""
    action_def[cannot]=""

    # TES Resolution (Tetra Endpoint Specification v2.1)
    action_def[tes_level]="local"        # local, symbol, address, channel, connector, handle, locator, binding, plan
    action_def[tes_target]=""            # Target symbol (@dev, @prod, @staging, @local, etc)
    action_def[tes_operation]=""         # TES operation (read, write, execute)
    action_def[tes_requires]=""          # Required TES resolution level

    # Parse key=value pairs
    while [[ $# -gt 0 ]]; do
        local key="${1%%=*}"
        local value="${1#*=}"
        action_def["$key"]="$value"
        shift
    done
}

# Register actions with routing annotations + state machine fields

# ========== SYSTEM:MONITOR ==========
declare_action "view_toml" \
    "verb=view" \
    "noun=toml" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=" \
    "immediate=true" \
    "can=Display tetra.toml configuration file" \
    "cannot=Modify configuration"

declare_action "view_services" \
    "verb=view" \
    "noun=services" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=" \
    "immediate=true" \
    "can=List registered Tetra services from tsm" \
    "cannot=Start or stop services"

declare_action "view_org" \
    "verb=view" \
    "noun=org" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=" \
    "immediate=true" \
    "can=Show organization directory structure" \
    "cannot=Modify files or directories"

# ========== SYSTEM:CONTROL ==========
declare_action "refresh_cache" \
    "verb=refresh" \
    "noun=cache" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=@app[stdout]" \
    "immediate=false" \
    "can=Clear cached system data" \
    "cannot=Delete persistent data"

declare_action "edit_toml" \
    "verb=edit" \
    "noun=toml" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=@app[stdout]" \
    "immediate=false" \
    "can=Edit tetra.toml configuration with vim" \
    "cannot=Validate TOML syntax automatically"

# ========== LOCAL/DEV:MONITOR ==========
declare_action "status_tsm" \
    "verb=status" \
    "noun=tsm" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=" \
    "immediate=true" \
    "can=Check TSM service status" \
    "cannot=Modify service state"

declare_action "status_watchdog" \
    "verb=status" \
    "noun=watchdog" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=" \
    "immediate=true" \
    "can=Check watchdog process status" \
    "cannot=Start or stop watchdog"

declare_action "view_logs" \
    "verb=view" \
    "noun=logs" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=" \
    "immediate=true" \
    "can=Display recent log entries" \
    "cannot=Delete or modify logs"

declare_action "view_remote" \
    "verb=view" \
    "noun=remote" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=" \
    "immediate=true" \
    "can=Show remote dev server information" \
    "cannot=Execute remote commands"

# ========== LOCAL/DEV:CONTROL ==========
declare_action "start_tsm" \
    "verb=start" \
    "noun=tsm" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=@app[stdout]" \
    "immediate=false" \
    "can=Start TSM service manager" \
    "cannot=Modify TSM configuration"

declare_action "stop_tsm" \
    "verb=stop" \
    "noun=tsm" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=@app[stdout]" \
    "immediate=false" \
    "can=Stop TSM service manager" \
    "cannot=Force kill processes"

declare_action "restart_tsm" \
    "verb=restart" \
    "noun=tsm" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=@app[stdout]" \
    "immediate=false" \
    "can=Restart TSM service manager" \
    "cannot=Modify service configuration"

declare_action "start_watchdog" \
    "verb=start" \
    "noun=watchdog" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=@app[stdout]" \
    "immediate=false" \
    "can=Start watchdog monitoring service" \
    "cannot=Modify watchdog configuration"

declare_action "stop_watchdog" \
    "verb=stop" \
    "noun=watchdog" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=@app[stdout]" \
    "immediate=false" \
    "can=Stop watchdog monitoring service" \
    "cannot=Force kill watchdog"

# ========== DEPLOY ACTIONS ==========
declare_action "deploy_local" \
    "verb=deploy" \
    "noun=local" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=@app[stdout],@app[deploy-log]" \
    "immediate=false" \
    "can=Deploy to LOCAL environment" \
    "cannot=Deploy to remote environments"

declare_action "deploy_dev" \
    "verb=deploy" \
    "noun=dev" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=@app[stdout],@app[deploy-log]" \
    "immediate=false" \
    "tes_level=plan" \
    "tes_target=@dev" \
    "tes_operation=write" \
    "tes_requires=connector" \
    "can=Deploy to DEV environment" \
    "cannot=Deploy to production"

declare_action "deploy_staging" \
    "verb=deploy" \
    "noun=staging" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=@app[stdout],@app[deploy-log]" \
    "immediate=false" \
    "tes_level=plan" \
    "tes_target=@staging" \
    "tes_operation=write" \
    "tes_requires=handle" \
    "can=Deploy to STAGING environment (requires confirmation)" \
    "cannot=Skip deployment validation"

declare_action "deploy_prod" \
    "verb=deploy" \
    "noun=prod" \
    "inputs=" \
    "output=@tui[content]" \
    "effects=@app[stdout],@app[deploy-log],@app[alert]" \
    "immediate=false" \
    "tes_level=plan" \
    "tes_target=@prod" \
    "tes_operation=write" \
    "tes_requires=binding" \
    "can=Deploy to PRODUCTION (requires explicit confirmation + rollback plan)" \
    "cannot=Skip safety checks or confirmation"

# Get action signature (defensive)
get_action_signature() {
    local action="$1"
    local action_name="${action//:/_}"

    # Validate action exists
    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        echo "@tui[content]"  # default
        return
    fi

    local -n _action_ref="ACTION_${action_name}"

    # Build full signature
    local output="${_action_ref[output]:-@tui[content]}"

    echo "$output"
}

# Get all routing targets (output + effects)
get_action_routes() {
    local action="$1"
    local action_name="${action//:/_}"

    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        echo "@tui[content]"
        return
    fi

    local -n _action_ref="ACTION_${action_name}"
    local output="${_action_ref[output]}"
    local effects="${_action_ref[effects]}"

    if [[ -n "$effects" ]]; then
        echo "${output},${effects}"
    else
        echo "$output"
    fi
}

# List all registered actions with signatures (DEFENSIVE - fixes 3:3 bug)
list_action_signatures() {
    echo "Action Registry - Routing Signatures with TES Metadata"
    echo "────────────────────────────────────────────────────────"
    echo ""

    # Use explicit registry to avoid iteration issues
    for action_name in "${ACTION_REGISTRY[@]}"; do
        # Validate action exists
        if ! declare -p "ACTION_${action_name}" &>/dev/null; then
            continue
        fi

        # Use unique nameref name to avoid collisions
        local -n _reg_action="ACTION_${action_name}"

        # Validate required fields
        [[ -z "${_reg_action[verb]}" || -z "${_reg_action[noun]}" ]] && continue

        local verb="${_reg_action[verb]}"
        local noun="${_reg_action[noun]}"
        local inputs="${_reg_action[inputs]}"
        local output="${_reg_action[output]}"
        local effects="${_reg_action[effects]}"
        local immediate="${_reg_action[immediate]}"
        local tes_target="${_reg_action[tes_target]}"
        local tes_operation="${_reg_action[tes_operation]}"
        local tes_requires="${_reg_action[tes_requires]}"

        # Build signature
        local input_sig="(${inputs})"
        local output_sig="$output"
        [[ -n "$effects" ]] && output_sig="$output where $effects"

        # Show signature with execution mode indicator
        local mode_indicator=""
        if [[ "$immediate" == "true" ]]; then
            mode_indicator=" [auto]"
        else
            mode_indicator=" [manual]"
        fi

        printf "  %-20s $ENDPOINT_OP %-45s%s" "$verb:$noun" "$input_sig $FLOW_OP $output_sig" "$mode_indicator"

        # Add TES metadata if present
        if [[ -n "$tes_target" ]]; then
            printf " tes(%s:%s→%s)" "$tes_target" "$tes_operation" "$tes_requires"
        fi
        echo
    done
}
