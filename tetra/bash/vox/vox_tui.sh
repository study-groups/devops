#!/usr/bin/env bash

# Vox TUI - Color elements and progress feedback
# Following demo/basic/013 color system patterns

# Vox color elements (semantic, not state-based)
declare -gA VOX_ELEMENT_COLORS=(
    # Vox module elements
    [vox_action]="FF0044"     # Red/orange - action verbs (from VERBS_PRIMARY)
    [vox_voice]="AA00AA"      # Purple - voice profile names (from NOUNS_PRIMARY)
    [vox_qa_id]="4488AA"      # Steel blue - QA identifiers
    [vox_progress]="0088FF"   # Blue - progress indicators (from MODE_PRIMARY)
    [vox_cost]="FFAA00"       # Orange - cost/pricing info
    [vox_duration]="00AA00"   # Green - timing info (from ENV_PRIMARY)

    # Status-specific colors
    [vox_cached]="888888"     # Gray - cached items
    [vox_generating]="00AAFF" # Bright blue - active generation
    [vox_playing]="22DD22"    # Bright green - playback
)

# Check if demo/013 color system is available (disabled for now due to bugs)
# if [[ -f "$TETRA_SRC/demo/basic/013/colors/color_core.sh" ]]; then
#     source "$TETRA_SRC/demo/basic/013/colors/color_core.sh" 2>/dev/null || true
# fi

# Color functions for vox (self-contained)
if ! declare -f hex_to_256 &>/dev/null; then
    # Override broken function
    hex_to_256() {
        local hex="${1#\#}"

        # Convert hex to RGB
        local r=$((16#${hex:0:2}))
        local g=$((16#${hex:2:2}))
        local b=$((16#${hex:4:2}))

        # Simple 256-color approximation
        if [[ $r -eq $g && $g -eq $b ]]; then
            # Grayscale
            local gray=$(( r * 23 / 255 + 232 ))
            echo "$gray"
        else
            # Color cube
            local r6=$(( r * 5 / 255 ))
            local g6=$(( g * 5 / 255 ))
            local b6=$(( b * 5 / 255 ))
            echo $(( 16 + r6 * 36 + g6 * 6 + b6 ))
        fi
    }

    text_color() {
        local hex="$1"
        local color256=$(hex_to_256 "$hex")
        printf "\033[38;5;%dm" "$color256"
    }

    reset_color() {
        printf "\033[0m"
    }

    theme_aware_dim() {
        local hex="$1"
        local level="$2"
        # Simple dimming: reduce each component
        local r=$((16#${hex:0:2}))
        local g=$((16#${hex:2:2}))
        local b=$((16#${hex:4:2}))

        local factor=$(( 7 - level ))
        r=$(( r * factor / 7 ))
        g=$(( g * factor / 7 ))
        b=$(( b * factor / 7 ))

        printf "%02X%02X%02X" "$r" "$g" "$b"
    }
fi

# Get vox element color
vox_get_element_color() {
    local element="$1"
    local state="${2:-normal}"

    local base_color="${VOX_ELEMENT_COLORS[$element]}"
    [[ -z "$base_color" ]] && base_color="FFFFFF"

    case "$state" in
        normal)
            echo "$base_color"
            ;;
        selected|bright)
            # Brighten for emphasis
            echo "$base_color"  # TODO: implement brighten
            ;;
        dim|muted)
            theme_aware_dim "$base_color" 4
            ;;
        disabled)
            theme_aware_dim "$base_color" 6
            ;;
        *)
            echo "$base_color"
            ;;
    esac
}

# Vox element text styling
vox_element_text() {
    local element="$1"
    local state="${2:-normal}"
    local use_bold="${3:-false}"

    local color=$(vox_get_element_color "$element" "$state")

    [[ "$use_bold" == "true" ]] && printf "\033[1m"
    text_color "$color"
}

# Vox action text (always bold)
vox_action_text() {
    local state="${1:-normal}"
    printf "\033[1m"
    vox_element_text "vox_action" "$state" false
}

# Vox voice profile text
vox_voice_text() {
    local state="${1:-normal}"
    vox_element_text "vox_voice" "$state" false
}

# Vox QA ID text
vox_qa_id_text() {
    local state="${1:-normal}"
    vox_element_text "vox_qa_id" "$state" false
}

# Vox progress indicator text (bold)
vox_progress_text() {
    local state="${1:-normal}"
    printf "\033[1m"
    vox_element_text "vox_progress" "$state" false
}

# Vox cost text
vox_cost_text() {
    vox_element_text "vox_cost" "normal" false
}

# Vox duration text
vox_duration_text() {
    vox_element_text "vox_duration" "normal" false
}

# State symbol with color (following demo/013 pattern)
vox_state_symbol_colored() {
    local state="$1"

    case "$state" in
        idle)
            printf "$(text_color 888888)●$(reset_color)"
            ;;
        template)
            printf "$(text_color 888888)○$(reset_color)"
            ;;
        qualified)
            vox_progress_text "dim"
            printf "◐"
            reset_color
            ;;
        ready)
            vox_progress_text "normal"
            printf "◉"
            reset_color
            ;;
        executing)
            vox_element_text "vox_generating" "bright"
            printf "\033[1m▶"
            reset_color
            ;;
        caching)
            vox_progress_text "normal"
            printf "⚙"
            reset_color
            ;;
        playing)
            vox_element_text "vox_playing" "bright"
            printf "\033[1m♪"
            reset_color
            ;;
        success)
            text_color "22DD22"
            printf "\033[1m✓"
            reset_color
            ;;
        error)
            text_color "FF4444"
            printf "\033[1m✗"
            reset_color
            ;;
        *)
            printf "●"
            ;;
    esac
}

# Show vox action signature (TES format, with colors)
vox_show_signature() {
    local qa_id="$1"
    local voice="$2"

    # vox.speak :: (qa_id, voice) → @tui[audio]
    vox_action_text "normal"
    printf "vox.speak"
    reset_color

    printf " "
    text_color "666666"
    printf "::"
    reset_color
    printf " "

    printf "("
    vox_qa_id_text "normal"
    printf "#%s" "$qa_id"
    reset_color
    printf ", "
    vox_voice_text "normal"
    printf "%s" "$voice"
    reset_color
    printf ")"

    printf " "
    text_color "666666"
    printf "→"
    reset_color
    printf " "

    text_color "888888"
    printf "@tui[audio_player]"
    reset_color
}

# Progress indicator with state
vox_show_progress() {
    local state="$1"
    local message="$2"

    vox_state_symbol_colored "$state"
    printf " "

    case "$state" in
        executing|caching|playing)
            vox_progress_text "bright"
            printf "%s" "$message"
            reset_color
            ;;
        success)
            text_color "22DD22"
            printf "%s" "$message"
            reset_color
            ;;
        error)
            text_color "FF4444"
            printf "%s" "$message"
            reset_color
            ;;
        *)
            printf "%s" "$message"
            ;;
    esac
}

# Show vox generation summary
vox_show_summary() {
    local qa_id="$1"
    local voice="$2"
    local duration_sec="$3"
    local file_size_bytes="$4"
    local cost_usd="$5"
    local char_count="$6"

    echo
    vox_show_signature "$qa_id" "$voice"
    echo
    echo

    printf "  "
    vox_duration_text
    printf "Duration:   "
    reset_color
    printf "%ds\n" "$duration_sec"

    printf "  "
    text_color "888888"
    printf "Size:       "
    reset_color
    local size_mb=$(echo "scale=1; $file_size_bytes / 1048576" | bc 2>/dev/null || echo "0")
    printf "%.1f MB\n" "$size_mb"

    printf "  "
    text_color "888888"
    printf "Characters: "
    reset_color
    printf "%d\n" "$char_count"

    printf "  "
    vox_cost_text
    printf "Cost:       "
    reset_color
    printf "\$%.4f\n" "$cost_usd"

    echo
}

# Show cached indicator
vox_show_cached() {
    vox_element_text "vox_cached" "normal"
    printf "⚡ Using cached audio"
    reset_color
}

# Show API call progress with text length
vox_show_api_progress() {
    local char_count="$1"
    local provider="$2"
    local model="$3"

    vox_show_progress "executing" "Calling ${provider}/${model} API..."
    echo
    printf "  "
    text_color "888888"
    printf "Text length: %d characters" "$char_count"
    reset_color
}

# Show truncation warning
vox_show_truncation_warning() {
    local original="$1"
    local truncated="$2"

    echo
    printf "  "
    text_color "FFAA00"
    printf "\033[1m⚠ Warning:"
    reset_color
    printf " Text truncated from %d to %d characters\n" "$original" "$truncated"
}

# Show color palette for vox elements
vox_show_palette() {
    echo
    printf "\033[1m"
    text_color "4488AA"
    echo "Vox Color Elements"
    reset_color
    echo

    echo "Module Elements:"
    printf "  ACTION:   "; vox_action_text; printf "█████"; reset_color; echo " (${VOX_ELEMENT_COLORS[vox_action]})"
    printf "  VOICE:    "; vox_voice_text; printf "█████"; reset_color; echo " (${VOX_ELEMENT_COLORS[vox_voice]})"
    printf "  QA_ID:    "; vox_qa_id_text; printf "█████"; reset_color; echo " (${VOX_ELEMENT_COLORS[vox_qa_id]})"
    printf "  PROGRESS: "; vox_progress_text; printf "█████"; reset_color; echo " (${VOX_ELEMENT_COLORS[vox_progress]})"
    printf "  COST:     "; vox_cost_text; printf "█████"; reset_color; echo " (${VOX_ELEMENT_COLORS[vox_cost]})"
    printf "  DURATION: "; vox_duration_text; printf "█████"; reset_color; echo " (${VOX_ELEMENT_COLORS[vox_duration]})"
    echo

    echo "State Symbols:"
    for state in idle template qualified ready executing caching playing success error; do
        printf "  %-10s " "$state:"
        vox_state_symbol_colored "$state"
        echo
    done
    echo
}
