#!/usr/bin/env bash

# MSC Layout Engine
# Smart lane width calculation with hybrid approach:
# - Minimum widths for readability
# - Proportional expansion based on terminal width
# - Prioritize text lanes over arrow lanes (70/30 split)

# Source dependencies
source "${MSC_SRC}/msc.sh"

# Layout Constants
MSC_TEXT_LANE_MIN=15      # Minimum width for entity text lanes
MSC_ARROW_LANE_MIN=7      # Minimum width for arrow lanes
MSC_TEXT_RATIO=0.70       # 70% of extra space goes to text lanes
MSC_ARROW_RATIO=0.30      # 30% of extra space goes to arrow lanes

# Layout State
declare -gA MSC_LANE_WIDTHS=()      # entity -> width
declare -g MSC_ARROW_WIDTH=0        # Calculated arrow lane width
declare -g MSC_TOTAL_WIDTH=0        # Total diagram width

# ============================================================================
# WIDTH CALCULATION
# ============================================================================

# Get terminal width (default 80 if not available)
msc_get_terminal_width() {
    local width="${COLUMNS:-80}"

    # Fallback to tput if COLUMNS not set
    if [[ "$width" == "80" ]] && command -v tput &>/dev/null; then
        width=$(tput cols 2>/dev/null || echo 80)
    fi

    echo "$width"
}

# Calculate lane widths based on hybrid approach
# Sets: MSC_LANE_WIDTHS, MSC_ARROW_WIDTH, MSC_TOTAL_WIDTH
msc_calculate_layout() {
    local terminal_width=$(msc_get_terminal_width)
    local entity_count=$(msc_get_entity_count)

    if [[ $entity_count -eq 0 ]]; then
        echo "Error: No entities defined" >&2
        return 1
    fi

    # Calculate number of lanes
    # N entities = N text lanes + (N-1) arrow lanes
    local text_lanes=$entity_count
    local arrow_lanes=$((entity_count - 1))

    # Calculate minimum required width
    local min_text_width=$((text_lanes * MSC_TEXT_LANE_MIN))
    local min_arrow_width=$((arrow_lanes * MSC_ARROW_LANE_MIN))
    local min_total=$((min_text_width + min_arrow_width))

    # Calculate available extra space
    local extra_space=$((terminal_width - min_total))

    # If we don't have enough space, use minimums and accept overflow
    if [[ $extra_space -lt 0 ]]; then
        extra_space=0
    fi

    # Distribute extra space: 70% to text, 30% to arrows
    local extra_text=$(printf "%.0f" "$(echo "$extra_space * $MSC_TEXT_RATIO" | bc)")
    local extra_arrow=$((extra_space - extra_text))

    # Calculate per-lane additions
    local text_per_lane=$((extra_text / text_lanes))
    local arrow_per_lane=0
    if [[ $arrow_lanes -gt 0 ]]; then
        arrow_per_lane=$((extra_arrow / arrow_lanes))
    fi

    # Set final widths
    local final_text_width=$((MSC_TEXT_LANE_MIN + text_per_lane))
    local final_arrow_width=$((MSC_ARROW_LANE_MIN + arrow_per_lane))

    # Store in state
    MSC_ARROW_WIDTH=$final_arrow_width
    MSC_LANE_WIDTHS=()

    for entity in "${MSC_ENTITIES[@]}"; do
        MSC_LANE_WIDTHS[$entity]=$final_text_width
    done

    # Calculate actual total width
    MSC_TOTAL_WIDTH=$(( (text_lanes * final_text_width) + (arrow_lanes * final_arrow_width) ))
}

# Get width for specific entity lane
msc_get_lane_width() {
    local entity="$1"
    echo "${MSC_LANE_WIDTHS[$entity]:-$MSC_TEXT_LANE_MIN}"
}

# Get arrow lane width
msc_get_arrow_width() {
    echo "$MSC_ARROW_WIDTH"
}

# Get total diagram width
msc_get_total_width() {
    echo "$MSC_TOTAL_WIDTH"
}

# ============================================================================
# TEXT WRAPPING
# ============================================================================

# Word-wrap text to fit in specified width
# Args: text, width
# Returns: multiline string
msc_wrap_text() {
    local text="$1"
    local width="$2"

    # Simple word wrapping (can be enhanced)
    local result=""
    local current_line=""
    local words=($text)

    for word in "${words[@]}"; do
        local test_line="$current_line $word"
        test_line="${test_line# }"  # Remove leading space

        if [[ ${#test_line} -le $width ]]; then
            current_line="$test_line"
        else
            # Current line is full, start new line
            if [[ -n "$result" ]]; then
                result="$result"$'\n'"$current_line"
            else
                result="$current_line"
            fi
            current_line="$word"
        fi
    done

    # Add last line
    if [[ -n "$current_line" ]]; then
        if [[ -n "$result" ]]; then
            result="$result"$'\n'"$current_line"
        else
            result="$current_line"
        fi
    fi

    echo "$result"
}

# Pad text to exact width (left-aligned)
msc_pad_text() {
    local text="$1"
    local width="$2"
    local pad_char="${3:- }"

    local text_len=${#text}
    local pad_needed=$((width - text_len))

    if [[ $pad_needed -le 0 ]]; then
        # Truncate if too long
        echo "${text:0:$width}"
    else
        # Pad with spaces
        printf "%s%*s" "$text" "$pad_needed" "" | tr ' ' "$pad_char"
    fi
}

# Center text in given width
msc_center_text() {
    local text="$1"
    local width="$2"

    local text_len=${#text}
    local pad_total=$((width - text_len))

    if [[ $pad_total -le 0 ]]; then
        echo "${text:0:$width}"
        return
    fi

    local pad_left=$((pad_total / 2))
    local pad_right=$((pad_total - pad_left))

    printf "%*s%s%*s" "$pad_left" "" "$text" "$pad_right" ""
}

# Export functions
export -f msc_calculate_layout msc_get_lane_width msc_get_arrow_width msc_get_total_width
export -f msc_wrap_text msc_pad_text msc_center_text msc_get_terminal_width
