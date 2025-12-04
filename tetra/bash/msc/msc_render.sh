#!/usr/bin/env bash

# MSC Render Engine
# ASCII rendering of message sequence charts
# No borders or vertical lines - focus on lanes, arrows, and readability

# Source dependencies
source "$TETRA_SRC/bash/utils/function_helpers.sh"
source "${MSC_SRC}/msc.sh"
source "${MSC_SRC}/msc_layout.sh"

# Source color system if available
tetra_source_if_exists "$TETRA_SRC/bash/color/color_core.sh"

# ============================================================================
# HEADER RENDERING
# ============================================================================

# Render entity headers (column names)
msc_render_header() {
    local output=""

    # First pass: entity names (centered, colored)
    for entity in "${MSC_ENTITIES[@]}"; do
        local width=$(msc_get_lane_width "$entity")
        local color=$(msc_get_entity_color "$entity")
        local centered=$(msc_center_text "$entity" "$width")

        # Apply color if available
        if tetra_function_exists text_color; then
            output+="$(text_color "$color")${centered}$(reset_color)"
        else
            output+="$centered"
        fi

        # Add arrow lane spacer (except after last entity)
        if [[ "$entity" != "${MSC_ENTITIES[-1]}" ]]; then
            local arrow_width=$(msc_get_arrow_width)
            output+="$(printf "%*s" "$arrow_width" "")"
        fi
    done

    echo "$output"

    # Second pass: lifeline indicators (vertical pipes)
    output=""
    for entity in "${MSC_ENTITIES[@]}"; do
        local width=$(msc_get_lane_width "$entity")
        local center=$((width / 2))

        # Pad to center, then add pipe
        output+="$(printf "%*s" "$center" "")|$(printf "%*s" $((width - center - 1)) "")"

        # Add arrow lane spacer
        if [[ "$entity" != "${MSC_ENTITIES[-1]}" ]]; then
            local arrow_width=$(msc_get_arrow_width)
            output+="$(printf "%*s" "$arrow_width" "")"
        fi
    done

    echo "$output"
}

# ============================================================================
# EVENT RENDERING
# ============================================================================

# Render a message arrow between entities
# Args: from_entity, to_entity, label
msc_render_message() {
    local from="$1"
    local to="$2"
    local label="$3"

    local from_index=$(msc_get_entity_index "$from")
    local to_index=$(msc_get_entity_index "$to")

    if [[ $from_index -eq -1 || $to_index -eq -1 ]]; then
        echo "Error: Invalid entities in msc_render_message" >&2
        return 1
    fi

    # Calculate positions
    local output=""
    local current_pos=0

    # Determine direction
    local direction="-->"
    local start_index=$from_index
    local end_index=$to_index

    if [[ $from_index -gt $to_index ]]; then
        direction="<--"
        start_index=$to_index
        end_index=$from_index
    fi

    # Build arrow line
    for i in $(seq 0 $(($(msc_get_entity_count) - 1))); do
        local entity="${MSC_ENTITIES[$i]}"
        local width=$(msc_get_lane_width "$entity")
        local center=$((width / 2))

        if [[ $i -eq $from_index ]]; then
            # Start of arrow
            output+="$(printf "%*s" "$center" "")|$(printf "%*s" $((width - center - 1)) "")"
        elif [[ $i -eq $to_index ]]; then
            # End of arrow
            output+="$(printf "%*s" "$center" "")|$(printf "%*s" $((width - center - 1)) "")"
        elif [[ $i -gt $start_index && $i -lt $end_index ]]; then
            # Middle of arrow path
            output+="$(printf "%*s" "$center" "")$(printf -- "-" 1)$(printf "%*s" $((width - center - 1)) "")"
        else
            # Not in arrow path
            output+="$(printf "%*s" "$center" "")|$(printf "%*s" $((width - center - 1)) "")"
        fi

        # Add arrow lane
        if [[ $i -lt $(($(msc_get_entity_count) - 1)) ]]; then
            local arrow_width=$(msc_get_arrow_width)

            if [[ $i -ge $start_index && $i -lt $end_index ]]; then
                # Draw arrow shaft
                if [[ $i -eq $((end_index - 1)) ]]; then
                    # Last segment: add arrowhead
                    if [[ "$direction" == "-->" ]]; then
                        output+="$(printf -- "-%.0s" $(seq 1 $((arrow_width - 1))))>"
                    else
                        output+="<$(printf -- "-%.0s" $(seq 1 $((arrow_width - 1))))"
                    fi
                else
                    output+="$(printf -- "-%.0s" $(seq 1 $arrow_width))"
                fi
            else
                # Empty arrow lane
                output+="$(printf "%*s" "$arrow_width" "")"
            fi
        fi
    done

    echo "$output"

    # Render label below arrow
    if [[ -n "$label" ]]; then
        output=""
        local label_printed=false

        for i in $(seq 0 $(($(msc_get_entity_count) - 1))); do
            local entity="${MSC_ENTITIES[$i]}"
            local width=$(msc_get_lane_width "$entity")
            local center=$((width / 2))

            # Print lifeline
            output+="$(printf "%*s" "$center" "")|$(printf "%*s" $((width - center - 1)) "")"

            # Add arrow lane with label
            if [[ $i -lt $(($(msc_get_entity_count) - 1)) ]]; then
                local arrow_width=$(msc_get_arrow_width)

                if [[ $i -ge $start_index && $i -lt $end_index && "$label_printed" == "false" ]]; then
                    # Print label in first arrow lane of path
                    local wrapped=$(msc_wrap_text "$label" $((arrow_width * (end_index - start_index))))
                    local first_line=$(echo "$wrapped" | head -n1)
                    output+="$(msc_pad_text "$first_line" "$arrow_width")"
                    label_printed=true
                else
                    output+="$(printf "%*s" "$arrow_width" "")"
                fi
            fi
        done

        echo "$output"
    fi

    # Add lifeline continuation
    msc_render_lifeline
}

# Render a simple lifeline (just vertical pipes)
msc_render_lifeline() {
    local output=""

    for entity in "${MSC_ENTITIES[@]}"; do
        local width=$(msc_get_lane_width "$entity")
        local center=$((width / 2))

        output+="$(printf "%*s" "$center" "")|$(printf "%*s" $((width - center - 1)) "")"

        if [[ "$entity" != "${MSC_ENTITIES[-1]}" ]]; then
            local arrow_width=$(msc_get_arrow_width)
            output+="$(printf "%*s" "$arrow_width" "")"
        fi
    done

    echo "$output"
}

# Render a note on an entity
# Args: entity, text
msc_render_note() {
    local entity="$1"
    local text="$2"

    local entity_index=$(msc_get_entity_index "$entity")
    if [[ $entity_index -eq -1 ]]; then
        echo "Error: Invalid entity in msc_render_note" >&2
        return 1
    fi

    local output=""

    # Render note indicator
    for i in $(seq 0 $(($(msc_get_entity_count) - 1))); do
        local e="${MSC_ENTITIES[$i]}"
        local width=$(msc_get_lane_width "$e")
        local center=$((width / 2))

        if [[ $i -eq $entity_index ]]; then
            # Note position
            local note_text="[${text}]"
            if [[ ${#note_text} -gt $width ]]; then
                note_text="${text:0:$((width-5))}...]"
            fi
            output+="$(msc_center_text "$note_text" "$width")"
        else
            # Lifeline
            output+="$(printf "%*s" "$center" "")|$(printf "%*s" $((width - center - 1)) "")"
        fi

        if [[ $i -lt $(($(msc_get_entity_count) - 1)) ]]; then
            local arrow_width=$(msc_get_arrow_width)
            output+="$(printf "%*s" "$arrow_width" "")"
        fi
    done

    echo "$output"

    # Add lifeline continuation
    msc_render_lifeline
}

# ============================================================================
# MAIN RENDER FUNCTION
# ============================================================================

# Render complete MSC diagram
msc_render() {
    # Calculate layout first
    msc_calculate_layout

    # Render header
    echo ""
    msc_render_header
    echo ""

    # Render events
    for event in "${MSC_EVENTS[@]}"; do
        IFS='|' read -r type arg1 arg2 arg3 <<< "$event"

        case "$type" in
            message)
                msc_render_message "$arg1" "$arg2" "$arg3"
                ;;
            note)
                msc_render_note "$arg1" "$arg2"
                ;;
            activate|deactivate)
                # Just render lifeline for now
                msc_render_lifeline
                ;;
            *)
                echo "Warning: Unknown event type: $type" >&2
                ;;
        esac
    done

    echo ""
}

# Export functions
export -f msc_render msc_render_header msc_render_message msc_render_note msc_render_lifeline
