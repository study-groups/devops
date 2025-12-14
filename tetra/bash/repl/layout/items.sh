#!/usr/bin/env bash
# REPL Layout System - Item Grid Rendering
# Configurable grid display for completion items, menus, etc.

# Ensure regions.sh is loaded
if ! command -v repl_region_define >/dev/null 2>&1; then
    source "${TETRA_SRC}/bash/repl/layout/regions.sh"
fi

# Item display configuration
declare -g REPL_ITEMS_COLS=3
declare -g REPL_ITEMS_WIDTH=18
declare -g REPL_ITEMS_SELECTED_PREFIX="▶"
declare -g REPL_ITEMS_NORMAL_PREFIX=" "
declare -g REPL_ITEMS_SELECTED_COLOR=""    # ANSI color code for selected item
declare -g REPL_ITEMS_NORMAL_COLOR=""      # ANSI color code for normal items

# Configure items display
# Usage: repl_items_set_cols <num_cols>
repl_items_set_cols() {
    REPL_ITEMS_COLS="$1"
}

# Usage: repl_items_set_width <width>
repl_items_set_width() {
    REPL_ITEMS_WIDTH="$1"
}

# Usage: repl_items_set_prefix <selected> [normal]
repl_items_set_prefix() {
    REPL_ITEMS_SELECTED_PREFIX="$1"
    REPL_ITEMS_NORMAL_PREFIX="${2:- }"
}

# Usage: repl_items_set_colors <selected_color> [normal_color]
repl_items_set_colors() {
    REPL_ITEMS_SELECTED_COLOR="$1"
    REPL_ITEMS_NORMAL_COLOR="${2:-}"
}

# Calculate grid dimensions for an item count
# Usage: repl_items_calc_rows <count>
# Returns: number of rows needed
repl_items_calc_rows() {
    local count="$1"
    local cols="${REPL_ITEMS_COLS}"
    echo $(( (count + cols - 1) / cols ))
}

# Render items in grid layout within a region
# Usage: repl_items_render <items_array_name> [selected_index] [region_name]
# Items fill columns top-to-bottom (column-major order)
repl_items_render() {
    local -n items_ref="$1"
    local selected="${2:-0}"
    local region="${3:-items}"

    local cols="${REPL_ITEMS_COLS}"
    local width="${REPL_ITEMS_WIDTH}"
    local count="${#items_ref[@]}"

    if [[ $count -eq 0 ]]; then
        return 0
    fi

    local rows=$(( (count + cols - 1) / cols ))

    # Get region dimensions if available
    local region_width
    if repl_region_exists "$region" 2>/dev/null; then
        region_width=$(repl_region_get "$region" width)
        # Auto-adjust columns to fit region
        local max_cols=$((region_width / width))
        [[ $max_cols -lt 1 ]] && max_cols=1
        [[ $cols -gt $max_cols ]] && cols=$max_cols
        rows=$(( (count + cols - 1) / cols ))
    fi

    for ((row=0; row<rows; row++)); do
        for ((col=0; col<cols; col++)); do
            # Column-major indexing: fill columns top to bottom
            local idx=$((row + col * rows))

            if [[ $idx -lt $count ]]; then
                local item="${items_ref[$idx]}"
                local prefix="$REPL_ITEMS_NORMAL_PREFIX"
                local color_start=""
                local color_end=""

                if [[ $idx -eq $selected ]]; then
                    prefix="$REPL_ITEMS_SELECTED_PREFIX"
                    [[ -n "$REPL_ITEMS_SELECTED_COLOR" ]] && {
                        color_start="$REPL_ITEMS_SELECTED_COLOR"
                        color_end=$'\033[0m'
                    }
                else
                    [[ -n "$REPL_ITEMS_NORMAL_COLOR" ]] && {
                        color_start="$REPL_ITEMS_NORMAL_COLOR"
                        color_end=$'\033[0m'
                    }
                fi

                # Truncate item if too long
                local display_item="${item:0:$((width-2))}"

                # Format: prefix + padded item
                local formatted
                printf -v formatted '%s%s%-*s%s' "$color_start" "$prefix" $((width-1)) "$display_item" "$color_end"

                # Write to region or stdout
                if repl_region_exists "$region" 2>/dev/null; then
                    repl_cell_write "$region" "$row" $((col * width)) "$formatted"
                else
                    # Fallback: direct output
                    printf '%s' "$formatted"
                fi
            fi
        done

        # Newline if not using regions
        if ! repl_region_exists "$region" 2>/dev/null; then
            echo
        fi
    done
}

# Render items with row-major ordering (left to right, then down)
# Usage: repl_items_render_row_major <items_array_name> [selected_index] [region_name]
repl_items_render_row_major() {
    local -n items_ref="$1"
    local selected="${2:-0}"
    local region="${3:-items}"

    local cols="${REPL_ITEMS_COLS}"
    local width="${REPL_ITEMS_WIDTH}"
    local count="${#items_ref[@]}"

    if [[ $count -eq 0 ]]; then
        return 0
    fi

    local rows=$(( (count + cols - 1) / cols ))

    for ((row=0; row<rows; row++)); do
        for ((col=0; col<cols; col++)); do
            # Row-major indexing
            local idx=$((row * cols + col))

            if [[ $idx -lt $count ]]; then
                local item="${items_ref[$idx]}"
                local prefix="$REPL_ITEMS_NORMAL_PREFIX"
                local color_start=""
                local color_end=""

                if [[ $idx -eq $selected ]]; then
                    prefix="$REPL_ITEMS_SELECTED_PREFIX"
                    [[ -n "$REPL_ITEMS_SELECTED_COLOR" ]] && {
                        color_start="$REPL_ITEMS_SELECTED_COLOR"
                        color_end=$'\033[0m'
                    }
                fi

                local display_item="${item:0:$((width-2))}"
                local formatted
                printf -v formatted '%s%s%-*s%s' "$color_start" "$prefix" $((width-1)) "$display_item" "$color_end"

                if repl_region_exists "$region" 2>/dev/null; then
                    repl_cell_write "$region" "$row" $((col * width)) "$formatted"
                else
                    printf '%s' "$formatted"
                fi
            fi
        done

        if ! repl_region_exists "$region" 2>/dev/null; then
            echo
        fi
    done
}

# Render a single item at specific position
# Usage: repl_item_render_at <item> <row> <col> [is_selected] [region_name]
repl_item_render_at() {
    local item="$1"
    local row="$2"
    local col="$3"
    local is_selected="${4:-0}"
    local region="${5:-items}"

    local width="${REPL_ITEMS_WIDTH}"
    local prefix="$REPL_ITEMS_NORMAL_PREFIX"
    local color_start=""
    local color_end=""

    if [[ "$is_selected" == "1" ]]; then
        prefix="$REPL_ITEMS_SELECTED_PREFIX"
        [[ -n "$REPL_ITEMS_SELECTED_COLOR" ]] && {
            color_start="$REPL_ITEMS_SELECTED_COLOR"
            color_end=$'\033[0m'
        }
    fi

    local display_item="${item:0:$((width-2))}"
    local formatted
    printf -v formatted '%s%s%-*s%s' "$color_start" "$prefix" $((width-1)) "$display_item" "$color_end"

    if repl_region_exists "$region" 2>/dev/null; then
        repl_cell_write "$region" "$row" $((col * REPL_ITEMS_WIDTH)) "$formatted"
    else
        printf '%s' "$formatted"
    fi
}

# Clear items region
# Usage: repl_items_clear [region_name]
repl_items_clear() {
    local region="${1:-items}"

    if repl_region_exists "$region" 2>/dev/null; then
        repl_region_clear "$region"
    fi
}

# Get item position from index (for navigation)
# Usage: repl_items_index_to_pos <index> <count>
# Returns: "row col" for the item
repl_items_index_to_pos() {
    local idx="$1"
    local count="$2"
    local cols="${REPL_ITEMS_COLS}"
    local rows=$(( (count + cols - 1) / cols ))

    # Column-major: idx = row + col * rows
    local col=$((idx / rows))
    local row=$((idx % rows))

    echo "$row $col"
}

# Get index from row/col position
# Usage: repl_items_pos_to_index <row> <col> <count>
# Returns: index or -1 if invalid
repl_items_pos_to_index() {
    local row="$1"
    local col="$2"
    local count="$3"
    local cols="${REPL_ITEMS_COLS}"
    local rows=$(( (count + cols - 1) / cols ))

    local idx=$((row + col * rows))

    if [[ $idx -ge 0 && $idx -lt $count ]]; then
        echo "$idx"
    else
        echo "-1"
    fi
}

# Navigate to next item (handles wrapping)
# Usage: repl_items_next <current_index> <count>
repl_items_next() {
    local current="$1"
    local count="$2"

    echo $(( (current + 1) % count ))
}

# Navigate to previous item (handles wrapping)
# Usage: repl_items_prev <current_index> <count>
repl_items_prev() {
    local current="$1"
    local count="$2"

    echo $(( (current - 1 + count) % count ))
}

# Navigate right (next column)
# Usage: repl_items_right <current_index> <count>
repl_items_right() {
    local current="$1"
    local count="$2"
    local cols="${REPL_ITEMS_COLS}"
    local rows=$(( (count + cols - 1) / cols ))

    local new_idx=$((current + rows))
    if [[ $new_idx -ge $count ]]; then
        # Wrap to first column, same relative row
        new_idx=$((current % rows))
    fi

    echo "$new_idx"
}

# Navigate left (previous column)
# Usage: repl_items_left <current_index> <count>
repl_items_left() {
    local current="$1"
    local count="$2"
    local cols="${REPL_ITEMS_COLS}"
    local rows=$(( (count + cols - 1) / cols ))

    local new_idx=$((current - rows))
    if [[ $new_idx -lt 0 ]]; then
        # Find last column that has this row
        local row=$((current % rows))
        local last_col=$(( (count - 1) / rows ))
        new_idx=$((row + last_col * rows))
        # Clamp to valid range
        [[ $new_idx -ge $count ]] && new_idx=$((count - 1))
    fi

    echo "$new_idx"
}

# Export functions
export -f repl_items_set_cols
export -f repl_items_set_width
export -f repl_items_set_prefix
export -f repl_items_set_colors
export -f repl_items_calc_rows
export -f repl_items_render
export -f repl_items_render_row_major
export -f repl_item_render_at
export -f repl_items_clear
export -f repl_items_index_to_pos
export -f repl_items_pos_to_index
export -f repl_items_next
export -f repl_items_prev
export -f repl_items_right
export -f repl_items_left
