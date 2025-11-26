#!/usr/bin/env bash
# nh_ws.sh - Worksheet State Management
#
# Manages worksheet progress stored in ~/nh/<context>/worksheet.env
# Works with WORKSHEET.md parsed by nh_md.sh
#
# State format (worksheet.env):
#   WS_COMPLETED="01 02 03"
#
# Usage:
#   nh ws              # List steps with completion status
#   nh ws 01           # Show step 01
#   nh ws check 01     # Mark step 01 complete
#   nh ws uncheck 01   # Mark step 01 incomplete
#   nh ws status       # Summary: "3/15 steps complete"
#   nh ws reset        # Clear all progress

# =============================================================================
# STATE FILE
# =============================================================================

# Get path to worksheet.env for current context
_nh_ws_env_path() {
    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    if [[ -z "$ctx" ]]; then
        echo ""
        return 1
    fi
    echo "$NH_DIR/$ctx/worksheet.env"
}

# Load completed steps into WS_COMPLETED variable
_nh_ws_load() {
    local env_file=$(_nh_ws_env_path)
    WS_COMPLETED=""

    if [[ -f "$env_file" ]]; then
        source "$env_file"
    fi
}

# Save WS_COMPLETED to worksheet.env
_nh_ws_save() {
    local env_file=$(_nh_ws_env_path)

    if [[ -z "$env_file" ]]; then
        echo "No context set. Run: nh switch <context>"
        return 1
    fi

    # Ensure directory exists
    mkdir -p "$(dirname "$env_file")"

    cat > "$env_file" << EOF
# NH Worksheet Progress
# Location: $env_file
# Edit freely - space-separated step numbers

WS_COMPLETED="$WS_COMPLETED"
EOF
}

# Check if a step is completed
_nh_ws_is_complete() {
    local step="$1"
    _nh_ws_load
    [[ " $WS_COMPLETED " == *" $step "* ]]
}

# =============================================================================
# COMMANDS
# =============================================================================

# Mark a step as complete
nh_ws_check() {
    local step="$1"

    [[ -z "$step" ]] && { echo "Usage: nh ws check <step>"; return 1; }

    # Validate step exists
    if [[ ! -v NH_MD_START["$step"] ]]; then
        echo "Unknown step: $step"
        echo "Available: $(nh_md_step_keys | tr '\n' ' ')"
        return 1
    fi

    _nh_ws_load

    # Check if already complete
    if [[ " $WS_COMPLETED " == *" $step "* ]]; then
        echo "Step $step already complete"
        return 0
    fi

    # Add to completed list (maintain sorted order)
    if [[ -z "$WS_COMPLETED" ]]; then
        WS_COMPLETED="$step"
    else
        # Add and sort
        WS_COMPLETED=$(echo "$WS_COMPLETED $step" | tr ' ' '\n' | sort -n | tr '\n' ' ' | xargs)
    fi

    _nh_ws_save
    echo "[x] Step $step: ${NH_MD_TITLE[$step]}"
}

# Mark a step as incomplete
nh_ws_uncheck() {
    local step="$1"

    [[ -z "$step" ]] && { echo "Usage: nh ws uncheck <step>"; return 1; }

    _nh_ws_load

    # Check if was complete
    if [[ " $WS_COMPLETED " != *" $step "* ]]; then
        echo "Step $step was not marked complete"
        return 0
    fi

    # Remove from completed list
    WS_COMPLETED=$(echo "$WS_COMPLETED" | tr ' ' '\n' | grep -v "^${step}$" | tr '\n' ' ' | xargs)

    _nh_ws_save
    echo "[ ] Step $step: ${NH_MD_TITLE[$step]}"
}

# Show completion status
nh_ws_status() {
    local env_file=$(_nh_ws_env_path)

    if [[ -z "$env_file" ]]; then
        echo "No context set. Run: nh switch <context>"
        return 1
    fi

    _nh_ws_load

    local total=${#NH_MD_STEPS[@]}
    local completed=0

    for step in "${NH_MD_STEPS[@]}"; do
        if [[ " $WS_COMPLETED " == *" $step "* ]]; then
            ((completed++))
        fi
    done

    echo "Worksheet Progress: $completed/$total steps complete"
    echo "State file: $env_file"

    if [[ -n "$WS_COMPLETED" ]]; then
        echo "Completed: $WS_COMPLETED"
    fi

    # Show next incomplete step
    for step in "${NH_MD_STEPS[@]}"; do
        if [[ " $WS_COMPLETED " != *" $step "* ]]; then
            echo "Next: $step - ${NH_MD_TITLE[$step]}"
            break
        fi
    done
}

# Reset all progress
nh_ws_reset() {
    local env_file=$(_nh_ws_env_path)

    if [[ -z "$env_file" ]]; then
        echo "No context set"
        return 1
    fi

    WS_COMPLETED=""
    _nh_ws_save
    echo "Worksheet progress reset"
}

# Show worksheet.env contents
nh_ws_env() {
    local env_file=$(_nh_ws_env_path)

    if [[ -z "$env_file" ]]; then
        echo "No context set"
        return 1
    fi

    if [[ -f "$env_file" ]]; then
        cat "$env_file"
    else
        echo "No worksheet.env yet (will be created on first check)"
        echo "Path: $env_file"
    fi
}

# =============================================================================
# DISPLAY
# =============================================================================

# List steps with completion status from .env
nh_ws_list() {
    [[ ${#NH_MD_STEPS[@]} -eq 0 ]] && { echo "No steps parsed. Run nh_md_parse first"; return 1; }

    _nh_ws_load

    # Header
    local total=${#NH_MD_STEPS[@]}
    local completed=0
    for step in "${NH_MD_STEPS[@]}"; do
        [[ " $WS_COMPLETED " == *" $step "* ]] && ((completed++))
    done

    echo "Worksheet: $completed/$total complete"
    echo ""

    local current_phase=""

    for key in "${NH_MD_ORDER[@]}"; do
        local item_type=${NH_MD_TYPE[$key]}

        if [[ "$item_type" == "header" ]]; then
            # Show phase headers
            if [[ "$key" =~ ^phase ]]; then
                echo ""
                echo "## ${NH_MD_TITLE[$key]}"
            fi
        elif [[ "$item_type" == "step" ]]; then
            # Show step with checkbox
            local checkbox="[ ]"
            if [[ " $WS_COMPLETED " == *" $key "* ]]; then
                checkbox="[x]"
            fi
            printf "  %s %s %s\n" "$checkbox" "$key" "${NH_MD_TITLE[$key]}"
        fi
    done
    echo ""
}

# =============================================================================
# INTERACTIVE BROWSER
# =============================================================================

# Browse steps with arrow key navigation
# Usage: nh ws browse [start_step]
nh_ws_browse() {
    local current="${1:-01}"
    local total=${#NH_MD_STEPS[@]}
    local idx=0

    # Find index of current step
    for i in "${!NH_MD_STEPS[@]}"; do
        if [[ "${NH_MD_STEPS[$i]}" == "$current" ]]; then
            idx=$i
            break
        fi
    done

    # Check if glow is available
    local renderer="cat"
    command -v glow &>/dev/null && renderer="glow -s dark"

    _nh_ws_load

    # Display function
    _show_step() {
        local step="${NH_MD_STEPS[$idx]}"
        local start=${NH_MD_START[$step]}
        local end=${NH_MD_END[$step]}

        clear

        # Header with navigation info
        local checkbox="[ ]"
        [[ " $WS_COMPLETED " == *" $step "* ]] && checkbox="[x]"

        echo "Step $((idx + 1))/$total  $checkbox  ←/→ navigate  c=check  u=uncheck  q=quit"
        echo "────────────────────────────────────────────────────────────"
        echo ""

        # Show step content through renderer
        sed -n "${start},${end}p" "$NH_MD_FILE" | $renderer
    }

    # Initial display
    _show_step

    # Read keys
    while true; do
        read -rsn1 key

        case "$key" in
            $'\x1b')  # Escape sequence
                read -rsn2 -t 0.1 seq
                case "$seq" in
                    '[C'|'[D')  # Right or Left arrow
                        if [[ "$seq" == '[C' ]]; then
                            ((idx < total - 1)) && ((idx++))
                        else
                            ((idx > 0)) && ((idx--))
                        fi
                        _show_step
                        ;;
                    '[A'|'[B')  # Up/Down - same as left/right
                        if [[ "$seq" == '[B' ]]; then
                            ((idx < total - 1)) && ((idx++))
                        else
                            ((idx > 0)) && ((idx--))
                        fi
                        _show_step
                        ;;
                esac
                ;;
            'c'|'C')  # Check current step
                local step="${NH_MD_STEPS[$idx]}"
                nh_ws_check "$step" >/dev/null
                _nh_ws_load
                _show_step
                ;;
            'u'|'U')  # Uncheck current step
                local step="${NH_MD_STEPS[$idx]}"
                nh_ws_uncheck "$step" >/dev/null
                _nh_ws_load
                _show_step
                ;;
            'n'|'N'|'j')  # Next
                ((idx < total - 1)) && ((idx++))
                _show_step
                ;;
            'p'|'P'|'k')  # Previous
                ((idx > 0)) && ((idx--))
                _show_step
                ;;
            'q'|'Q')  # Quit
                clear
                echo "Exited worksheet browser"
                nh_ws_status
                return 0
                ;;
            '')  # Enter - show full content
                local step="${NH_MD_STEPS[$idx]}"
                nh_md_show "$step" 100 | $renderer
                echo ""
                echo "Press any key to continue..."
                read -rsn1
                _show_step
                ;;
        esac
    done
}

# Export functions
export -f _nh_ws_env_path _nh_ws_load _nh_ws_save _nh_ws_is_complete
export -f nh_ws_check nh_ws_uncheck nh_ws_status nh_ws_reset nh_ws_env nh_ws_list
export -f nh_ws_browse
