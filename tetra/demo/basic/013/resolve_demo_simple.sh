#!/usr/bin/env bash
# demo/basic/013/resolve_demo_simple.sh
# Simple TES Resolution Demo (standalone, no tetra.sh dependency)

# Set required environment variables
export TETRA_SRC="${TETRA_SRC:-/Users/mricos/src/devops/tetra}"
export TETRA_DIR="${TETRA_DIR:-/Users/mricos/tetra}"

# Source resolve module
source "$TETRA_SRC/bash/resolve/resolve.sh"

# Demo state
declare -A STATE=(
    [symbol]="@local"
    [level]=0
)

# TES level names
LEVELS=("Symbol" "Address" "Channel" "Connector" "Handle" "Locator" "Binding" "Plan")

# Get current resolution data
get_resolution() {
    local symbol="${STATE[symbol]}"
    local level="${STATE[level]}"

    declare -A data
    if resolve_to_level "$symbol" "$level" data 2>/dev/null; then
        echo "level:$level"
        for key in symbol address channel connector handle_status locator binding plan; do
            [[ -n "${data[$key]}" ]] && echo "$key:${data[$key]}"
        done
    else
        echo "error:Resolution failed at level $level"
    fi
}

# Render screen
render() {
    clear
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║              TES RESOLUTION DEMO (Demo 013)                    ║"
    echo "║  Progressive Resolution: Symbol → Plan (8 Levels)              ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""

    local level="${STATE[level]}"
    local symbol="${STATE[symbol]}"

    echo "Current: Level $level - ${LEVELS[$level]}"
    echo "Symbol: $symbol"
    echo ""
    echo "Resolution Chain:"

    # Get resolution data
    local resolution_output
    resolution_output=$(get_resolution)

    if echo "$resolution_output" | grep -q "^error:"; then
        local error_msg=$(echo "$resolution_output" | grep "^error:" | cut -d: -f2-)
        echo "  ERROR: $error_msg"
    else
        # Parse and display each level
        for ((i=0; i<=level; i++)); do
            local marker="✓"
            [[ $i -eq $level ]] && marker="→"

            case $i in
                0)
                    local val=$(echo "$resolution_output" | grep "^symbol:" | cut -d: -f2-)
                    echo "  $marker Symbol:    ${val:-$symbol}"
                    ;;
                1)
                    local val=$(echo "$resolution_output" | grep "^address:" | cut -d: -f2-)
                    echo "  $marker Address:   $val"
                    ;;
                2)
                    local val=$(echo "$resolution_output" | grep "^channel:" | cut -d: -f2-)
                    echo "  $marker Channel:   $val"
                    ;;
                3)
                    local val=$(echo "$resolution_output" | grep "^connector:" | cut -d: -f2-)
                    echo "  $marker Connector: $val"
                    ;;
                4)
                    local val=$(echo "$resolution_output" | grep "^handle_status:" | cut -d: -f2-)
                    echo "  $marker Handle:    $val"
                    ;;
                5)
                    local val=$(echo "$resolution_output" | grep "^locator:" | cut -d: -f2-)
                    echo "  $marker Locator:   $val"
                    ;;
                6)
                    local val=$(echo "$resolution_output" | grep "^binding:" | cut -d: -f2-)
                    echo "  $marker Binding:   $val"
                    ;;
                7)
                    local val=$(echo "$resolution_output" | grep "^plan:" | cut -d: -f2-)
                    echo "  $marker Plan:      $val"
                    ;;
            esac
        done
    fi

    echo ""
    echo "$(printf '─%.0s' {1..64})"

    # Show available actions
    if [[ $level -eq 0 ]]; then
        echo "Actions: step info | q=quit"
    elif [[ $level -eq 7 ]]; then
        echo "Actions: back reset info | q=quit"
    else
        echo "Actions: step back info | q=quit"
    fi
}

# Execute action
execute() {
    local action=$1
    local level="${STATE[level]}"

    case "$action" in
        step)
            if [[ $level -lt 7 ]]; then
                STATE[level]=$((level + 1))
            fi
            ;;
        back)
            if [[ $level -gt 0 ]]; then
                STATE[level]=$((level - 1))
            fi
            ;;
        reset)
            STATE[level]=0
            ;;
        info)
            echo ""
            explain_level "$level"
            echo ""
            read -p "Press Enter to continue..."
            ;;
    esac
}

# Main loop
main() {
    while true; do
        render

        read -r -p "> " input

        case "$input" in
            q|quit|exit)
                echo "Exiting demo..."
                break
                ;;
            "")
                continue
                ;;
            *)
                execute "$input"
                ;;
        esac
    done
}

# Run
main
