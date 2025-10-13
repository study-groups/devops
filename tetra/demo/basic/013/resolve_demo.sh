#!/usr/bin/env bash
# demo/basic/013/resolve_demo.sh
# Interactive TES Resolution Demo
# Demonstrates progressive resolution: Symbol → Address → ... → Plan

source ~/tetra/tetra.sh
source "$TETRA_SRC/bash/resolve/resolve.sh"

# Demo state
declare -A RESOLUTION_STATE=(
    [current_symbol]="@local"
    [level]=0
    [resource_path]="~/.ssh/authorized_keys"
    [operation]="read"
    [show_internals]="false"
)

# Store resolved data at each level
declare -A RESOLUTION_DATA

# TES level names
LEVELS=(
    "Symbol"
    "Address"
    "Channel"
    "Connector"
    "Handle"
    "Locator"
    "Binding"
    "Plan"
)

# UI settings
HEADER_HEIGHT=4
FOOTER_HEIGHT=1

# Get actions available at current level
get_level_actions() {
    local level=$1
    case $level in
        0) echo "step symbols info ls:PATH cmd:COMMAND" ;;  # Symbol level
        1) echo "step back info" ;;                  # Address
        2) echo "step back info" ;;                  # Channel
        3) echo "step back validate info" ;;         # Connector
        4) echo "step back test info" ;;             # Handle
        5) echo "step back info path:PATH" ;;        # Locator
        6) echo "step back validate info op:read|write" ;;  # Binding
        7) echo "execute back reset info" ;;         # Plan (ready)
    esac
}

# Execute the current action
execute_action() {
    local action=$1
    local level=${RESOLUTION_STATE[level]}
    local symbol=${RESOLUTION_STATE[current_symbol]}

    case "$action" in
        step)
            # Progress to next resolution level
            if [[ $level -lt 7 ]]; then
                RESOLUTION_STATE[level]=$((level + 1))
                update_resolution_data
            fi
            ;;
        back)
            # Go back one level
            if [[ $level -gt 0 ]]; then
                RESOLUTION_STATE[level]=$((level - 1))
            fi
            ;;
        validate)
            # Run validation at current level
            if [[ $level -ge 3 ]]; then
                local connector="${RESOLUTION_DATA[connector]}"
                if validate_connector "$connector" 2>/dev/null; then
                    RESOLUTION_DATA[validation_status]="✓ Valid"
                else
                    RESOLUTION_DATA[validation_status]="✗ Failed"
                fi
            fi
            ;;
        test)
            # Test connectivity
            if validate_quick "$symbol"; then
                RESOLUTION_DATA[test_status]="✓ Reachable"
            else
                RESOLUTION_DATA[test_status]="✗ Unreachable"
            fi
            ;;
        execute)
            # Execute the plan (level 7 only)
            if [[ $level -eq 7 ]]; then
                local plan="${RESOLUTION_DATA[plan]}"
                RESOLUTION_DATA[exec_result]="Executing: $plan"
                RESOLUTION_DATA[exec_output]=$(eval "$plan" 2>&1)
                RESOLUTION_DATA[exec_status]=$?
            fi
            ;;
        info)
            # Show what happens at this level
            RESOLUTION_DATA[info]=$(explain_level "$level")
            ;;
        symbols)
            # List available symbols
            RESOLUTION_DATA[symbols_list]=$(list_symbols 2>/dev/null || echo "No org configured")
            ;;
        reset)
            # Start over
            RESOLUTION_STATE[level]=0
            RESOLUTION_DATA=()
            update_resolution_data
            ;;
        ls:*)
            # Quick command: ls path
            local path="${action#ls:}"
            [[ -z "$path" ]] && path="~/tetra"
            # Expand tilde
            path="${path/#\~/$HOME}"
            RESOLUTION_STATE[resource_path]="$path"
            RESOLUTION_STATE[operation]="read"
            RESOLUTION_STATE[level]=7
            update_resolution_data
            # Auto-resolve to plan with ls command
            local connector="${RESOLUTION_DATA[connector]}"
            if [[ "$symbol" == "@local" || "$connector" == *"localhost"* ]]; then
                RESOLUTION_DATA[plan]="ls -la $path"
            else
                RESOLUTION_DATA[plan]="ssh $connector \"ls -la $path\""
            fi
            ;;
        cmd:*)
            # Quick command: custom command
            local cmd="${action#cmd:}"
            [[ -z "$cmd" ]] && cmd="pwd"
            RESOLUTION_STATE[resource_path]="/tmp/cmd_output"
            RESOLUTION_STATE[operation]="read"
            RESOLUTION_STATE[level]=7
            update_resolution_data
            # Auto-resolve to plan with custom command
            local connector="${RESOLUTION_DATA[connector]}"
            if [[ "$symbol" == "@local" || "$connector" == *"localhost"* ]]; then
                RESOLUTION_DATA[plan]="$cmd"
            else
                RESOLUTION_DATA[plan]="ssh $connector \"$cmd\""
            fi
            ;;
        path:*)
            # Set custom resource path
            local new_path="${action#path:}"
            [[ -n "$new_path" ]] && RESOLUTION_STATE[resource_path]="$new_path"
            update_resolution_data
            ;;
        op:*)
            # Set operation
            local new_op="${action#op:}"
            if [[ "$new_op" =~ ^(read|write|append|delete)$ ]]; then
                RESOLUTION_STATE[operation]="$new_op"
                update_resolution_data
            fi
            ;;
    esac
}

# Update resolution data based on current level
update_resolution_data() {
    local symbol=${RESOLUTION_STATE[current_symbol]}
    local level=${RESOLUTION_STATE[level]}
    local resource_path=${RESOLUTION_STATE[resource_path]}
    local operation=${RESOLUTION_STATE[operation]}

    # Resolve up to current level
    declare -A res_data
    # Pre-populate with inputs so they flow through resolution
    res_data[resource_path]="$resource_path"
    res_data[operation]="$operation"

    if resolve_to_level "$symbol" "$level" res_data 2>/dev/null; then
        # Copy results
        for key in "${!res_data[@]}"; do
            RESOLUTION_DATA[$key]="${res_data[$key]}"
        done
    else
        RESOLUTION_DATA[error]="Resolution failed at level $level"
    fi
}

# Render the content area
render_content() {
    local level=${RESOLUTION_STATE[level]}
    local symbol=${RESOLUTION_STATE[current_symbol]}

    echo "TES Resolution Demo: Progressive Symbol Resolution"
    echo ""
    echo "Current: Level $level - ${LEVELS[$level]}"
    echo "Symbol: $symbol"

    # Show error if any
    if [[ -n "${RESOLUTION_DATA[error]}" ]]; then
        echo ""
        echo "ERROR: ${RESOLUTION_DATA[error]}"
        return
    fi

    echo ""
    echo "Resolution Chain:"

    # Show each level up to current
    for ((i=0; i<=level; i++)); do
        local marker="✓"
        [[ $i -eq $level ]] && marker="→"

        case $i in
            0) echo "  $marker Symbol:    ${RESOLUTION_DATA[symbol]:-$symbol}" ;;
            1) echo "  $marker Address:   ${RESOLUTION_DATA[address]}" ;;
            2) echo "  $marker Channel:   ${RESOLUTION_DATA[channel]}" ;;
            3) echo "  $marker Connector: ${RESOLUTION_DATA[connector]}" ;;
            4) echo "  $marker Handle:    ${RESOLUTION_DATA[handle_status]}" ;;
            5) echo "  $marker Locator:   ${RESOLUTION_DATA[locator]}" ;;
            6) echo "  $marker Binding:   ${RESOLUTION_DATA[binding]}" ;;
            7) echo "  $marker Plan:      ${RESOLUTION_DATA[plan]}" ;;
        esac
    done

    # Show additional info if requested
    if [[ -n "${RESOLUTION_DATA[info]}" ]]; then
        echo ""
        echo "Level Information:"
        echo "${RESOLUTION_DATA[info]}"
    fi

    if [[ -n "${RESOLUTION_DATA[symbols_list]}" ]]; then
        echo ""
        echo "${RESOLUTION_DATA[symbols_list]}"
    fi

    if [[ -n "${RESOLUTION_DATA[validation_status]}" ]]; then
        echo ""
        echo "Validation: ${RESOLUTION_DATA[validation_status]}"
    fi

    if [[ -n "${RESOLUTION_DATA[test_status]}" ]]; then
        echo ""
        echo "Connection: ${RESOLUTION_DATA[test_status]}"
    fi

    # Show execution results
    if [[ -n "${RESOLUTION_DATA[exec_result]}" ]]; then
        echo ""
        echo "Execution:"
        echo "  Command: ${RESOLUTION_DATA[exec_result]#Executing: }"
        if [[ -n "${RESOLUTION_DATA[exec_output]}" ]]; then
            echo "  Output:"
            echo "${RESOLUTION_DATA[exec_output]}" | head -20 | sed 's/^/    /'
            local line_count=$(echo "${RESOLUTION_DATA[exec_output]}" | wc -l)
            [[ $line_count -gt 20 ]] && echo "    ... ($((line_count - 20)) more lines)"
        fi
        echo "  Status: ${RESOLUTION_DATA[exec_status]:-unknown}"
    fi

    # Show current inputs (path/operation)
    if [[ $level -ge 5 ]]; then
        echo ""
        echo "Inputs:"
        echo "  Path: ${RESOLUTION_STATE[resource_path]}"
        echo "  Operation: ${RESOLUTION_STATE[operation]}"
    fi
}

# Render header
render_header() {
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║              TES RESOLUTION DEMO (Demo 013)                    ║"
    echo "║  Progressive Resolution: Symbol → Plan (8 Levels)              ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
}

# Render footer
render_footer() {
    local actions=$(get_level_actions ${RESOLUTION_STATE[level]})
    echo "Actions: $actions | q=quit"
}

# Main render function
render() {
    clear
    render_header
    echo ""
    render_content
    echo ""
    echo "$(printf '─%.0s' {1..64})"
    render_footer
}

# Main loop
main() {
    # Initialize resolution data
    update_resolution_data

    while true; do
        render

        # Read input
        read -r -p "> " input

        case "$input" in
            q|quit|exit)
                echo "Exiting demo..."
                break
                ;;
            "")
                # Ignore empty input
                continue
                ;;
            *)
                # Execute as action
                execute_action "$input"
                ;;
        esac
    done
}

# Run main
main
