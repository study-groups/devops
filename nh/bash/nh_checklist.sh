#!/usr/bin/env bash
# nh_checklist.sh - Checklist State Management
#
# Manages checklist progress stored in ~/nh/<context>/checklist.env
# Works with WORKSHEET.md parsed by nh_md.sh
#
# State format (checklist.env):
#   CL_COMPLETED="01 02 03"
#
# Usage:
#   nh cl              # List steps with completion status
#   nh cl 01           # Show step 01
#   nh cl check 01     # Mark step 01 complete
#   nh cl uncheck 01   # Mark step 01 incomplete
#   nh cl status       # Summary: "3/15 steps complete"
#   nh cl reset        # Clear all progress

# =============================================================================
# STATE FILE
# =============================================================================

# Get path to checklist.env for current context
_nh_cl_env_path() {
    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    if [[ -z "$ctx" ]]; then
        echo ""
        return 1
    fi
    echo "$NH_DIR/$ctx/checklist.env"
}

# Load completed steps into CL_COMPLETED variable
_nh_cl_load() {
    local env_file=$(_nh_cl_env_path)
    CL_COMPLETED=""

    if [[ -f "$env_file" ]]; then
        source "$env_file"
    fi
}

# Save CL_COMPLETED to checklist.env
_nh_cl_save() {
    local env_file=$(_nh_cl_env_path)

    if [[ -z "$env_file" ]]; then
        echo "No context set. Run: nh switch <context>"
        return 1
    fi

    # Ensure directory exists
    mkdir -p "$(dirname "$env_file")"

    cat > "$env_file" << EOF
# NH Checklist Progress
# Location: $env_file
# Edit freely - space-separated step numbers

CL_COMPLETED="$CL_COMPLETED"
EOF
}

# Check if a step is completed
_nh_cl_is_complete() {
    local step="$1"
    _nh_cl_load
    [[ " $CL_COMPLETED " == *" $step "* ]]
}

# =============================================================================
# COMMANDS
# =============================================================================

# Mark a step as complete
nh_cl_check() {
    local step="$1"

    [[ -z "$step" ]] && { echo "Usage: nh cl check <step>"; return 1; }

    # Validate step exists
    if [[ ! -v NH_MD_START["$step"] ]]; then
        echo "Unknown step: $step"
        echo "Available: $(nh_md_step_keys | tr '\n' ' ')"
        return 1
    fi

    _nh_cl_load

    # Check if already complete
    if [[ " $CL_COMPLETED " == *" $step "* ]]; then
        echo "Step $step already complete"
        return 0
    fi

    # Add to completed list (maintain sorted order)
    if [[ -z "$CL_COMPLETED" ]]; then
        CL_COMPLETED="$step"
    else
        # Add and sort
        CL_COMPLETED=$(echo "$CL_COMPLETED $step" | tr ' ' '\n' | sort -n | tr '\n' ' ' | xargs)
    fi

    _nh_cl_save
    echo "[x] Step $step: ${NH_MD_TITLE[$step]}"
}

# Mark a step as incomplete
nh_cl_uncheck() {
    local step="$1"

    [[ -z "$step" ]] && { echo "Usage: nh cl uncheck <step>"; return 1; }

    _nh_cl_load

    # Check if was complete
    if [[ " $CL_COMPLETED " != *" $step "* ]]; then
        echo "Step $step was not marked complete"
        return 0
    fi

    # Remove from completed list
    CL_COMPLETED=$(echo "$CL_COMPLETED" | tr ' ' '\n' | grep -v "^${step}$" | tr '\n' ' ' | xargs)

    _nh_cl_save
    echo "[ ] Step $step: ${NH_MD_TITLE[$step]}"
}

# Show completion status
nh_cl_status() {
    local env_file=$(_nh_cl_env_path)

    if [[ -z "$env_file" ]]; then
        echo "No context set. Run: nh switch <context>"
        return 1
    fi

    _nh_cl_load

    local total=${#NH_MD_STEPS[@]}
    local completed=0

    for step in "${NH_MD_STEPS[@]}"; do
        if [[ " $CL_COMPLETED " == *" $step "* ]]; then
            ((completed++))
        fi
    done

    echo "Checklist Progress: $completed/$total steps complete"
    echo "State file: $env_file"

    if [[ -n "$CL_COMPLETED" ]]; then
        echo "Completed: $CL_COMPLETED"
    fi

    # Show next incomplete step
    for step in "${NH_MD_STEPS[@]}"; do
        if [[ " $CL_COMPLETED " != *" $step "* ]]; then
            echo "Next: $step - ${NH_MD_TITLE[$step]}"
            break
        fi
    done
}

# Reset all progress
nh_cl_reset() {
    local env_file=$(_nh_cl_env_path)

    if [[ -z "$env_file" ]]; then
        echo "No context set"
        return 1
    fi

    CL_COMPLETED=""
    _nh_cl_save
    echo "Checklist progress reset"
}

# Show checklist.env contents
nh_cl_env() {
    local env_file=$(_nh_cl_env_path)

    if [[ -z "$env_file" ]]; then
        echo "No context set"
        return 1
    fi

    if [[ -f "$env_file" ]]; then
        cat "$env_file"
    else
        echo "No checklist.env yet (will be created on first check)"
        echo "Path: $env_file"
    fi
}

# =============================================================================
# DISPLAY
# =============================================================================

# List steps with completion status from .env
nh_cl_list() {
    [[ ${#NH_MD_STEPS[@]} -eq 0 ]] && { echo "No steps parsed. Run nh_md_parse first"; return 1; }

    _nh_cl_load

    # Header
    local total=${#NH_MD_STEPS[@]}
    local completed=0
    for step in "${NH_MD_STEPS[@]}"; do
        [[ " $CL_COMPLETED " == *" $step "* ]] && ((completed++))
    done

    echo "Checklist: $completed/$total complete"
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
            if [[ " $CL_COMPLETED " == *" $key "* ]]; then
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
# Usage: nh cl browse [start_step]
nh_cl_browse() {
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

    # Check if chroma is available
    local use_chroma=0
    local chroma_hint=""
    if [[ $(type -t chroma) == "function" ]]; then
        use_chroma=1
    else
        chroma_hint="Hint: source tetra.sh for colored output"
    fi

    _nh_cl_load

    # Main loop
    while true; do
        local step="${NH_MD_STEPS[$idx]}"
        local start=${NH_MD_START[$step]}
        local end=${NH_MD_END[$step]}

        # Clear and reset cursor
        printf '\033[2J\033[H'

        # Header with navigation info
        local checkbox="[ ]"
        [[ " $CL_COMPLETED " == *" $step "* ]] && checkbox="[x]"

        echo "Step $((idx + 1))/$total  $checkbox  j/k navigate  c=check  u=uncheck  q=quit"
        echo "------------------------------------------------------------"
        echo ""

        # Show step content with checkbox updated on first line
        local content
        content=$(sed -n "${start},${end}p" "$NH_MD_FILE")

        # Replace [ ] or [x] on first line with current checkbox state
        content=$(echo "$content" | sed "1s/- \[.\]/- $checkbox/")

        if (( use_chroma )); then
            echo "$content" | chroma -n 2>/dev/null
        else
            echo "$content"
        fi

        # Show hint at bottom if chroma not available
        if [[ -n "$chroma_hint" ]]; then
            echo ""
            printf '\033[2m%s\033[0m\n' "$chroma_hint"
        fi

        # Read key
        read -rsn1 key

        case "$key" in
            $'\x1b')  # Escape sequence
                read -rsn2 -t 0.1 seq
                case "$seq" in
                    '[C'|'[B')  # Right or Down arrow
                        ((idx < total - 1)) && ((idx++))
                        ;;
                    '[D'|'[A')  # Left or Up arrow
                        ((idx > 0)) && ((idx--))
                        ;;
                esac
                ;;
            'c'|'C')  # Check current step
                nh_cl_check "$step" >/dev/null
                _nh_cl_load
                ;;
            'u'|'U')  # Uncheck current step
                nh_cl_uncheck "$step" >/dev/null
                _nh_cl_load
                ;;
            'n'|'N'|'j')  # Next
                ((idx < total - 1)) && ((idx++))
                ;;
            'p'|'P'|'k')  # Previous
                ((idx > 0)) && ((idx--))
                ;;
            'q'|'Q')  # Quit
                printf '\033[2J\033[H'
                echo "Exited checklist browser"
                nh_cl_status
                return 0
                ;;
        esac
    done
}

# Export functions
export -f _nh_cl_env_path _nh_cl_load _nh_cl_save _nh_cl_is_complete
export -f nh_cl_check nh_cl_uncheck nh_cl_status nh_cl_reset nh_cl_env nh_cl_list
export -f nh_cl_browse
