#!/usr/bin/env bash
# Estovox TUI Renderer
# Renders facial state to terminal using TDS components

source_if_exists() {
    [[ -f "$1" ]] && source "$1"
}

# Try to source TDS components
source_if_exists "$TETRA_SRC/bash/tds/core/ansi.sh"
source_if_exists "$TETRA_SRC/bash/tds/core/semantic_colors.sh"

# === SCREEN UTILITIES ===

estovox_to_screen_y() {
    local normalized=$1
    local min_y=$2
    local max_y=$3
    local inverted=${4:-1}

    if (( inverted )); then
        normalized=$(bc -l <<< "1.0 - $normalized")
    fi

    bc -l <<< "$min_y + ($max_y - $min_y) * $normalized" | awk '{printf "%.0f\n", $1}'
}

estovox_to_screen_x() {
    local normalized=$1
    local min_x=$2
    local max_x=$3

    bc -l <<< "$min_x + ($max_x - $min_x) * $normalized" | awk '{printf "%.0f\n", $1}'
}

# === CHARACTER SELECTION ===

estovox_get_eyebrow_char() {
    local arch=$1
    local is_left=$2

    if (( $(bc -l <<< "$arch > 0.7") )); then
        if (( is_left )); then
            echo "/"
        else
            echo "\\"
        fi
    elif (( $(bc -l <<< "$arch < 0.3") )); then
        echo "─"
    else
        if (( is_left )); then
            echo "/"
        else
            echo "\\"
        fi
    fi
}

estovox_get_eye_char() {
    local openness=$1

    if (( $(bc -l <<< "$openness > 0.8") )); then
        echo "●"
    elif (( $(bc -l <<< "$openness > 0.5") )); then
        echo "○"
    elif (( $(bc -l <<< "$openness > 0.2") )); then
        echo "─"
    else
        echo "─"
    fi
}

estovox_get_mouth_shape() {
    local jaw=$ESTOVOX_JAW_OPENNESS
    local rounding=$ESTOVOX_LIP_ROUNDING
    local corner=$ESTOVOX_LIP_CORNER_HEIGHT
    local compression=$ESTOVOX_LIP_COMPRESSION

    if (( $(bc -l <<< "$jaw < 0.15") )); then
        if (( $(bc -l <<< "$compression > 0.6") )); then
            echo "═"
        elif (( $(bc -l <<< "$corner > 0.7") )); then
            echo "‿"
        elif (( $(bc -l <<< "$corner < 0.3") )); then
            echo "⌢"
        elif (( $(bc -l <<< "$rounding > 0.6") )); then
            echo "o"
        else
            echo "─"
        fi
    elif (( $(bc -l <<< "$jaw < 0.4") )); then
        if (( $(bc -l <<< "$rounding > 0.6") )); then
            echo "o"
        else
            echo "○"
        fi
    elif (( $(bc -l <<< "$jaw < 0.7") )); then
        if (( $(bc -l <<< "$rounding > 0.6") )); then
            echo "O"
        else
            echo "◯"
        fi
    else
        echo "⭘"
    fi
}

# === FRAME RENDERING ===

estovox_build_frame() {
    local buffer=""
    local center_x=$((COLUMNS / 2))
    local center_y=$((LINES / 2))

    # Calculate positions
    local eyebrow_y_l=$(estovox_to_screen_y "$ESTOVOX_EYEBROW_L_HEIGHT" $((center_y - 4)) $((center_y - 7)) 1)
    local eyebrow_y_r=$(estovox_to_screen_y "$ESTOVOX_EYEBROW_R_HEIGHT" $((center_y - 4)) $((center_y - 7)) 1)

    local eye_l_x=$((center_x - 10))
    local eye_r_x=$((center_x + 10))
    local eye_y=$((center_y - 2))

    # Gaze offset
    local gaze_offset_x=$(estovox_to_screen_x "$ESTOVOX_GAZE_H" -2 2)
    local gaze_offset_y=$(estovox_to_screen_y "$ESTOVOX_GAZE_V" -1 1 0)

    local mouth_y=$((center_y + 4))

    # Get characters
    local eyebrow_l_char=$(estovox_get_eyebrow_char "$ESTOVOX_EYEBROW_L_ARCH" 1)
    local eyebrow_r_char=$(estovox_get_eyebrow_char "$ESTOVOX_EYEBROW_R_ARCH" 0)
    local eye_l_char=$(estovox_get_eye_char "$ESTOVOX_EYE_L_OPENNESS")
    local eye_r_char=$(estovox_get_eye_char "$ESTOVOX_EYE_R_OPENNESS")
    local mouth_char=$(estovox_get_mouth_shape)

    # Build buffer with positioning
    buffer+="$(tput cup "$eyebrow_y_l" $((eye_l_x - 3)))${eyebrow_l_char}${eyebrow_l_char}${eyebrow_l_char}${eyebrow_l_char}"
    buffer+="$(tput cup "$eyebrow_y_r" $((eye_r_x - 1)))${eyebrow_r_char}${eyebrow_r_char}${eyebrow_r_char}${eyebrow_r_char}"

    # Eyes with gaze
    buffer+="$(tput cup $((eye_y + gaze_offset_y)) $((eye_l_x + gaze_offset_x)))${eye_l_char}"
    buffer+="$(tput cup $((eye_y + gaze_offset_y)) $((eye_r_x + gaze_offset_x)))${eye_r_char}"

    # Mouth
    local mouth_width=$(bc -l <<< "$ESTOVOX_JAW_OPENNESS * 5 + 1" | awk '{printf "%.0f", $1}')
    mouth_width=${mouth_width:-1}
    local mouth_str=$(printf "%${mouth_width}s" | tr ' ' "$mouth_char")
    buffer+="$(tput cup "$mouth_y" $((center_x - mouth_width / 2)))${mouth_str}"

    # Status panel at bottom
    buffer+="$(tput cup $((LINES - 6)) 0)"
    buffer+="$(tput el)"
    buffer+="╭─ Articulator State "
    buffer+="$(printf '─%.0s' $(seq 1 $((COLUMNS - 22))))"
    buffer+="╮"

    buffer+="$(tput cup $((LINES - 5)) 0)"
    buffer+="│ $(printf "JAW:%.2f RND:%.2f CRN:%.2f CMP:%.2f" \
        "$ESTOVOX_JAW_OPENNESS" "$ESTOVOX_LIP_ROUNDING" \
        "$ESTOVOX_LIP_CORNER_HEIGHT" "$ESTOVOX_LIP_COMPRESSION")"
    buffer+="$(tput cup $((LINES - 5)) $((COLUMNS - 1)))│"

    buffer+="$(tput cup $((LINES - 4)) 0)"
    buffer+="│ $(printf "TNG_H:%.2f TNG_F:%.2f GRV:%.2f VEL:%.2f" \
        "$ESTOVOX_TONGUE_HEIGHT" "$ESTOVOX_TONGUE_FRONTNESS" \
        "$ESTOVOX_TONGUE_GROOVED" "$ESTOVOX_VELUM_LOWERED")"
    buffer+="$(tput cup $((LINES - 4)) $((COLUMNS - 1)))│"

    buffer+="$(tput cup $((LINES - 3)) 0)"
    buffer+="╰"
    buffer+="$(printf '─%.0s' $(seq 1 $((COLUMNS - 2))))"
    buffer+="╯"

    echo "$buffer"
}

estovox_render_frame() {
    local frame_buffer
    frame_buffer=$(estovox_build_frame)

    # Clear center area only (preserve REPL prompt)
    tput cup 0 0

    echo -n "$frame_buffer"
}

estovox_clear_screen() {
    tput clear
}

estovox_init_screen() {
    tput smcup      # Save screen
    tput civis      # Hide cursor
    tput clear
}

estovox_restore_screen() {
    tput rmcup      # Restore screen
    tput cnorm      # Show cursor
}
