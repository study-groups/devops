#!/usr/bin/env bash

# TOML Editor Cursor Navigation
# Implements multispan cursor tracking for hierarchical TOML navigation

# Global cursor state
declare -g CURRENT_ITEM=0
declare -ga ACTIVE_MULTISPANS=()
declare -gA MULTISPAN_LOCATIONS=()

# Move cursor down (increment with bounds checking)
move_cursor_down() {
    local max_items=${#ACTIVE_MULTISPANS[@]}

    if [[ $max_items -gt 0 ]]; then
        CURRENT_ITEM=$(( (CURRENT_ITEM + 1) % max_items ))
        echo "Cursor moved to item $CURRENT_ITEM: ${ACTIVE_MULTISPANS[$CURRENT_ITEM]}"
        return 0
    else
        echo "No items to navigate"
        return 1
    fi
}

# Move cursor up (decrement with bounds checking)
move_cursor_up() {
    local max_items=${#ACTIVE_MULTISPANS[@]}

    if [[ $max_items -gt 0 ]]; then
        CURRENT_ITEM=$(( (CURRENT_ITEM - 1 + max_items) % max_items ))
        echo "Cursor moved to item $CURRENT_ITEM: ${ACTIVE_MULTISPANS[$CURRENT_ITEM]}"
        return 0
    else
        echo "No items to navigate"
        return 1
    fi
}

# Jump to specific item by index
jump_to_item() {
    local target_index="$1"
    local max_items=${#ACTIVE_MULTISPANS[@]}

    if [[ -n "$target_index" && "$target_index" -ge 0 && "$target_index" -lt "$max_items" ]]; then
        CURRENT_ITEM="$target_index"
        echo "Cursor jumped to item $CURRENT_ITEM: ${ACTIVE_MULTISPANS[$CURRENT_ITEM]}"
        return 0
    else
        echo "Invalid item index: $target_index (max: $((max_items - 1)))"
        return 1
    fi
}

# Get current selection
get_current_selection() {
    local max_items=${#ACTIVE_MULTISPANS[@]}

    if [[ $max_items -gt 0 && $CURRENT_ITEM -ge 0 && $CURRENT_ITEM -lt $max_items ]]; then
        echo "${ACTIVE_MULTISPANS[$CURRENT_ITEM]}"
        return 0
    else
        echo ""
        return 1
    fi
}

# Get current selection location
get_current_location() {
    local current_selection
    current_selection=$(get_current_selection)

    if [[ -n "$current_selection" && -n "${MULTISPAN_LOCATIONS[$current_selection]}" ]]; then
        echo "${MULTISPAN_LOCATIONS[$current_selection]}"
        return 0
    else
        echo ""
        return 1
    fi
}

# Initialize cursor navigation for TOML file
init_toml_cursor() {
    local toml_file="${1:-$ACTIVE_TOML}"

    if [[ ! -f "$toml_file" ]]; then
        echo "TOML file not found: $toml_file"
        return 1
    fi

    # Clear existing state
    ACTIVE_MULTISPANS=()
    MULTISPAN_LOCATIONS=()
    CURRENT_ITEM=0

    # Build section list
    while IFS= read -r section; do
        if [[ -n "$section" ]]; then
            ACTIVE_MULTISPANS+=("$section")
            local line_num=$(grep -n "\\[$section\\]" "$toml_file" | cut -d: -f1)
            MULTISPAN_LOCATIONS["$section"]="$toml_file:$line_num"
        fi
    done < <(awk -F'[][]' '/^\[/{print $2}' "$toml_file" | sort -u)

    echo "Initialized cursor navigation: ${#ACTIVE_MULTISPANS[@]} sections"
    return 0
}

# Find section containing a specific variable
find_variable_section() {
    local var_name="$1"
    local toml_file="${2:-$ACTIVE_TOML}"

    if [[ -z "$var_name" || ! -f "$toml_file" ]]; then
        return 1
    fi

    local current_section=""
    local found_section=""

    while IFS= read -r line; do
        # Check for section header
        if [[ "$line" =~ ^\[([^\]]+)\] ]]; then
            current_section="${BASH_REMATCH[1]}"
        # Check for variable definition
        elif [[ "$line" =~ ^[[:space:]]*"$var_name"[[:space:]]*= ]]; then
            found_section="$current_section"
            break
        fi
    done < "$toml_file"

    echo "$found_section"
    return 0
}

# Jump cursor to section containing variable
jump_to_variable() {
    local var_name="$1"

    local section
    section=$(find_variable_section "$var_name")

    if [[ -n "$section" ]]; then
        # Find section index in ACTIVE_MULTISPANS
        for i in "${!ACTIVE_MULTISPANS[@]}"; do
            if [[ "${ACTIVE_MULTISPANS[$i]}" == "$section" ]]; then
                jump_to_item "$i"
                echo "Found variable '$var_name' in section [$section]"
                return 0
            fi
        done
    fi

    echo "Variable '$var_name' not found"
    return 1
}