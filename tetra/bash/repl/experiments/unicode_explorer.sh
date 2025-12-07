#!/usr/bin/env bash

# unicode_explorer.sh - TDS-powered Unicode character explorer
#
# ARCHITECTURE:
#   Two-layer rendering system:
#   1. Content Model - What to display (data)
#   2. Layout Regions - Where to display (presentation)
#
# VISUAL ELEMENTS (press 'h' for interactive help):
#   - Specimen:        Large character display (the browsed glyph)
#   - Metadata Bar:    U+code, category name, position counter
#   - Controls Bar:    Keyboard shortcut hints
#   - State Bar:       Current state index and mapping string
#   - Separator:       Horizontal divider line
#   - Glyph Matrix:    2x2 grid of slots (the composition canvas)
#   - Delimiter:       Mode indicator (:: for explore, > for shell, Q: for qa)
#
# COMPONENTS:
#   - Character Inspector: The browser (scope-lens into UTF-8 space)
#   - Glyph Matrix: The canvas (2x2 composition artifact)
#   - Tetra Prompt: Complete composition (inspector + matrix)
#
# MODES:
#   - explorer: Full layout with browser
#   - qa: Question/Answer mode (Q: / A:)
#   - shell: Shell prompt mode (>)
#   - minimal: Matrix only
#
# LAYOUT SYSTEM:
#   - Top regions: numbered bottom-up (top_0 = above separator)
#   - Separator: active element (can hold glyphs, indicators)
#   - Bottom regions: the glyph matrix

# Source TDS
TDS_SRC="${TDS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../tds" && pwd)}"
if [[ -f "$TDS_SRC/tds.sh" ]]; then
    source "$TDS_SRC/tds.sh"
else
    echo "Error: TDS not found at $TDS_SRC" >&2
    exit 1
fi

SAVE_FILE="current_prompt.txt"

# Curated Unicode ranges organized into banks
declare -a BANKS=(
  "2800:256:Braille"
  "2500:128:Box"
  "2580:32:Block"
  "2590:16:BlockShade"
  "25E0:32:BlockGeom"
  "2596:16:BlockQuad"
  "2190:112:Arrow"
  "25A0:96:Geometric"
  "2600:100:Symbol"
  "2700:96:Dingbat"
)

# ============================================================================
# CONTENT MODEL - What to display
# ============================================================================

# Content model holds all displayable data (analogous to slots[])
declare -gA CONTENT_MODEL=(
    [candidate_glyph]=" "
    [candidate_code]="0000"
    [candidate_category]="None"
    [candidate_position]="0/0"
    [matrix_slot_1]=" "
    [matrix_slot_2]=" "
    [matrix_slot_3]=" "
    [matrix_slot_4]=" "
    [delimiter_symbol]="::"
    [state_index]="1"
    [mapping_string]="1234"
    [bank_name]="Braille"
    [bank_index]="0"
    [mode_name]="explorer"
    [separator_glyphs]=""
    [lock_1]="false"
    [lock_2]="false"
    [lock_3]="false"
    [lock_4]="false"
)

# Visual elements metadata - describes each UI component
declare -gA VISUAL_ELEMENTS=(
    [specimen]="Specimen|Large character display|The browsed glyph shown prominently"
    [metadata_bar]="Metadata Bar|U+code category [pos]|Unicode info for current character"
    [controls_bar]="Controls Bar|Keyboard hints|Available key commands"
    [state_bar]="State Bar|state:N map:XXXX|Current mapping state"
    [separator]="Separator|Horizontal line|Divides inspector from matrix"
    [glyph_matrix]="Glyph Matrix|2x2 slot grid|The composition canvas"
    [delimiter]="Delimiter|:: or > or Q:|Mode indicator after matrix"
    [slot_1]="Slot 1|Top-left|First glyph position"
    [slot_2]="Slot 2|Top-right|Second glyph position"
    [slot_3]="Slot 3|Bottom-left|Third glyph position"
    [slot_4]="Slot 4|Bottom-right|Fourth glyph position"
)

# Get element info: uex_element_info <element_name> [field]
# Fields: name (0), short (1), description (2)
uex_element_info() {
    local element="$1"
    local field="${2:-all}"
    local info="${VISUAL_ELEMENTS[$element]}"

    if [[ -z "$info" ]]; then
        echo "Unknown element: $element"
        return 1
    fi

    IFS='|' read -r name short desc <<< "$info"
    case "$field" in
        name|0) echo "$name" ;;
        short|1) echo "$short" ;;
        desc|2) echo "$desc" ;;
        all|*) printf "%s: %s - %s\n" "$name" "$short" "$desc" ;;
    esac
}

# List all visual elements
uex_list_elements() {
    echo "VISUAL ELEMENTS:"
    echo "================"
    for key in "${!VISUAL_ELEMENTS[@]}"; do
        uex_element_info "$key"
    done | sort
}

# Bank management
get_bank_count() {
    local bank_index=$1
    local bank_def="${BANKS[$bank_index]}"
    IFS=: read -r _ count _ <<< "$bank_def"
    echo "$count"
}

get_char_in_bank() {
    local bank_index=$1
    local offset=$2
    local bank_def="${BANKS[$bank_index]}"

    IFS=: read -r start count category <<< "$bank_def"

    if ((offset >= count)); then
        offset=$((offset % count))
    fi

    local codepoint=$((0x$start + offset))
    local hex=$(printf "%04X" $codepoint)
    printf "%s|%s|%s" "$(printf "\\U$hex")" "$hex" "$category"
}

# Update content model with current character
update_content_model() {
    local bank_index=$1
    local char_offset=$2
    local bank_count=$3

    IFS="|" read -r char hex category <<< "$(get_char_in_bank $bank_index $char_offset)"

    CONTENT_MODEL[candidate_glyph]="$char"
    CONTENT_MODEL[candidate_code]="$hex"
    CONTENT_MODEL[candidate_category]="$category"
    CONTENT_MODEL[candidate_position]="$((char_offset + 1))/$bank_count"
    CONTENT_MODEL[bank_name]="$category"
    CONTENT_MODEL[bank_index]="$bank_index"
}

# Save/load slots with optional remapping
save_slots() {
    local s1="$1" s2="$2" s3="$3" s4="$4"
    local mapping="${5:-1234}"

    local -a out=(" " " " " " " ")
    local -a slots=(" " "$s1" "$s2" "$s3" "$s4")

    for i in {1..4}; do
        local map_char="${mapping:$((i-1)):1}"
        if [[ "$map_char" =~ [1-4] ]]; then
            out[$i]="${slots[$map_char]}"
        else
            out[$i]=" "
        fi
    done

    printf "%s\n%s\n%s\n%s\n" "${out[1]}" "${out[2]}" "${out[3]}" "${out[4]}" > "$SAVE_FILE"
}

load_slots() {
    if [[ -f "$SAVE_FILE" ]]; then
        local -a loaded
        mapfile -t loaded < "$SAVE_FILE"
        echo "${loaded[0]:-}" "${loaded[1]:-}" "${loaded[2]:-}" "${loaded[3]:-}"
    else
        echo " " " " " " " "
    fi
}

# ============================================================================
# LAYOUT SYSTEM - Where to display
# ============================================================================

# Get terminal width breakpoint
get_breakpoint() {
    local cols="${COLUMNS:-80}"

    if ((cols >= 120)); then
        echo "wide"
    elif ((cols >= 80)); then
        echo "normal"
    elif ((cols >= 60)); then
        echo "compact"
    else
        echo "minimal"
    fi
}

# Determine which layout to use based on mode and breakpoint
select_layout() {
    local mode="$1"
    local breakpoint="${2:-$(get_breakpoint)}"

    case "$mode" in
        qa|shell)
            echo "$mode"
            ;;
        explorer)
            case "$breakpoint" in
                minimal) echo "minimal" ;;
                compact) echo "compact" ;;
                *) echo "explorer" ;;
            esac
            ;;
        *)
            echo "explorer"
            ;;
    esac
}

# ============================================================================
# RENDERING PIPELINE - TDS-powered output
# ============================================================================

# Render Character Inspector (the browser)
render_character_inspector() {
    local layout="$1"

    # Skip in non-explorer modes
    [[ "$layout" != "explorer" && "$layout" != "compact" ]] && return

    # Specimen line (large character)
    echo ""
    tds_text_color "uex.metadata.char"
    printf "  %s\n" "${CONTENT_MODEL[candidate_glyph]}"
    reset_color
    echo ""

    # Metadata line (code, category, position)
    if [[ "$layout" == "explorer" ]]; then
        printf "     "
        tds_text_color "uex.metadata.unicode"
        printf "U+%s" "${CONTENT_MODEL[candidate_code]}"
        reset_color
        printf "  "
        tds_text_color "uex.metadata.category"
        printf "%s" "${CONTENT_MODEL[candidate_category]}"
        reset_color
        printf "  "
        tds_text_color "uex.metadata.position"
        printf "[%s]" "${CONTENT_MODEL[candidate_position]}"
        reset_color
        tput el
        echo ""
    fi
}

# Render control hints
render_controls() {
    local layout="$1"

    [[ "$layout" != "explorer" ]] && return

    printf "     "
    tds_text_color "uex.controls.arrow"
    printf "↑↓"
    reset_color
    printf " "
    tds_text_color "uex.controls.description"
    printf "nav"
    reset_color
    tds_text_color "uex.controls.separator"
    printf " | "
    reset_color
    tds_text_color "uex.controls.arrow"
    printf "← →"
    reset_color
    printf " "
    tds_text_color "uex.controls.description"
    printf "banks"
    reset_color
    tds_text_color "uex.controls.separator"
    printf " | "
    reset_color
    tds_text_color "uex.controls.key"
    printf "1,2,3,4"
    reset_color
    tds_text_color "uex.controls.separator"
    printf " | "
    reset_color
    tds_text_color "uex.controls.description"
    printf "11,22,33,44 lock"
    reset_color
    tds_text_color "uex.controls.separator"
    printf " | "
    reset_color
    tds_text_color "uex.controls.description"
    printf "random, save, quit"
    reset_color
    tput el
    echo ""
}

# Render state information
render_state_info() {
    local layout="$1"

    [[ "$layout" != "explorer" ]] && return

    printf "     "
    tds_text_color "uex.state.label"
    printf "state:"
    reset_color
    tds_text_color "uex.state.value"
    printf "%s" "${CONTENT_MODEL[state_index]}"
    reset_color
    printf " "
    tds_text_color "uex.state.label"
    printf "map:"
    reset_color
    tds_text_color "uex.state.mapping"
    printf "%s" "${CONTENT_MODEL[mapping_string]}"
    reset_color
    tds_text_color "uex.controls.separator"
    printf " | "
    reset_color
    tds_text_color "uex.controls.description"
    printf "s=save m=edit-map []=cycle-state"
    reset_color
    tput el
    echo ""
}

# Render separator line
render_separator() {
    local layout="$1"
    local sep_char="─"
    local width="${COLUMNS:-80}"

    printf " "
    tds_text_color "uex.separator.line"
    for ((i=0; i<width-2; i++)); do
        printf "%s" "$sep_char"
    done
    reset_color
    echo ""
}

# Render glyph matrix (the canvas)
render_glyph_matrix() {
    local layout="$1"
    local -a display_slots=(" " " " " " " " " ")

    # Apply current mapping to get display slots
    local mapping="${CONTENT_MODEL[mapping_string]}"
    for i in {1..4}; do
        local map_char="${mapping:$((i-1)):1}"
        if [[ "$map_char" =~ [1-4] ]]; then
            display_slots[$i]="${CONTENT_MODEL[matrix_slot_$map_char]}"
        else
            display_slots[$i]=" "
        fi
    done

    # Determine delimiter based on mode
    local delimiter="${CONTENT_MODEL[delimiter_symbol]}"

    # Line 1: slots 1,2 with delimiter
    printf " "
    if [[ "${CONTENT_MODEL[lock_1]}" == "true" ]]; then
        tds_text_color "uex.slot.primary_locked"
    else
        tds_text_color "uex.slot.primary"
    fi
    printf "%s" "${display_slots[1]}"
    reset_color
    if [[ "${CONTENT_MODEL[lock_2]}" == "true" ]]; then
        tds_text_color "uex.slot.primary_locked"
    else
        tds_text_color "uex.slot.primary"
    fi
    printf "%s" "${display_slots[2]}"
    reset_color
    printf " "

    # Delimiter
    case "${CONTENT_MODEL[mode_name]}" in
        qa)
            tds_text_color "uex.delimiter.qa"
            printf "%s" "$delimiter"
            reset_color
            ;;
        shell)
            tds_text_color "uex.delimiter.shell"
            printf "%s" "$delimiter"
            reset_color
            ;;
        *)
            tds_text_color "uex.delimiter.explore"
            printf "%s" "$delimiter"
            reset_color
            ;;
    esac
    tput el
    echo ""

    # Line 2: slots 3,4 (hide in shell mode)
    if [[ "$layout" != "shell" ]]; then
        printf " "
        if [[ "${CONTENT_MODEL[lock_3]}" == "true" ]]; then
            tds_text_color "uex.slot.secondary_locked"
        else
            tds_text_color "uex.slot.secondary"
        fi
        printf "%s" "${display_slots[3]}"
        reset_color
        if [[ "${CONTENT_MODEL[lock_4]}" == "true" ]]; then
            tds_text_color "uex.slot.secondary_locked"
        else
            tds_text_color "uex.slot.secondary"
        fi
        printf "%s" "${display_slots[4]}"
        reset_color
        tput el
        echo ""
    fi
}

# Render help overlay showing visual element names
render_help() {
    tput cup 0 0
    tput ed

    echo ""
    echo "  VISUAL ELEMENTS"
    echo "  ==============="
    echo ""
    echo "  [Specimen]        - Large character display (browsed glyph)"
    echo "  [Metadata Bar]    - U+code, category, position"
    echo "  [Controls Bar]    - Keyboard shortcut hints"
    echo "  [State Bar]       - state:N map:XXXX"
    echo "  [Separator]       - Horizontal divider line"
    echo "  [Glyph Matrix]    - 2x2 composition grid:"
    echo "                        [Slot 1][Slot 2] [Delimiter]"
    echo "                        [Slot 3][Slot 4]"
    echo ""
    echo "  KEYBOARD:"
    echo "  ↑↓        Navigate characters in bank"
    echo "  ← →       Switch unicode banks"
    echo "  1-4       Assign current char to slot"
    echo "  11,22...  Double-tap to lock slot"
    echo "  r         Random fill unlocked slots"
    echo "  [ ]       Cycle mapping states"
    echo "  m         Edit mapping"
    echo "  s         Save to file"
    echo "  ?         Q&A mode"
    echo "  :         Shell mode"
    echo "  h         This help"
    echo "  q         Quit"
    echo ""
    echo "  Press any key to continue..."

    IFS= read -rsn1
}

# Main render function - orchestrate full frame
render_frame() {
    local layout="$1"

    tput cup 0 0
    tput ed

    # Render regions based on layout
    render_character_inspector "$layout"
    render_controls "$layout"
    render_state_info "$layout"
    render_separator "$layout"
    render_glyph_matrix "$layout"
}

# ============================================================================
# INPUT HANDLING
# ============================================================================

# Handle slot assignment (refactored to use loops)
handle_slot_assignment() {
    local slot_num=$1
    local char="$2"
    local -a current_mappings=("${@:3}")
    local current_state=$4
    local -a slots=("${@:5:4}")

    if ((slot_num >= 1 && slot_num <= 4)); then
        slots[$slot_num]="$char"
        CONTENT_MODEL[matrix_slot_$slot_num]="$char"
        save_slots "${slots[1]}" "${slots[2]}" "${slots[3]}" "${slots[4]}" "${current_mappings[$current_state]}"
    fi
}

# Toggle lock with double-tap detection
handle_lock_toggle() {
    local slot_num=$1

    if ((slot_num >= 1 && slot_num <= 4)); then
        if [[ "${CONTENT_MODEL[lock_$slot_num]}" == "true" ]]; then
            CONTENT_MODEL[lock_$slot_num]="false"
        else
            CONTENT_MODEL[lock_$slot_num]="true"
        fi
    fi
}

# ============================================================================
# MAIN REPL LOOP
# ============================================================================

unicode_explorer_repl() {
    local char_offset=0
    local current_bank=0
    local -a slots=(" " " " " " " ")
    local -a mappings=("" "1234" "2143" "3412" "4321")
    local current_state=1
    local current_mode="explorer"
    local last_key=""
    local last_key_time=0

    # Load saved slots
    read -r slots[1] slots[2] slots[3] slots[4] <<< "$(load_slots)"
    CONTENT_MODEL[matrix_slot_1]="${slots[1]}"
    CONTENT_MODEL[matrix_slot_2]="${slots[2]}"
    CONTENT_MODEL[matrix_slot_3]="${slots[3]}"
    CONTENT_MODEL[matrix_slot_4]="${slots[4]}"
    CONTENT_MODEL[mapping_string]="${mappings[$current_state]}"
    CONTENT_MODEL[state_index]="$current_state"

    local bank_count=$(get_bank_count $current_bank)

    tput civis
    tput clear

    while true; do
        # Update content model
        update_content_model "$current_bank" "$char_offset" "$bank_count"
        CONTENT_MODEL[mode_name]="$current_mode"

        # Select layout and render
        local layout=$(select_layout "$current_mode")
        render_frame "$layout"

        # Read input
        IFS= read -rsn1 key
        # Use milliseconds for portability (BSD date doesn't support %N)
        local current_time=$(($(date +%s) * 1000))

        # Double-tap detection for locks
        if [[ "$key" == "$last_key" ]] && [[ "$key" =~ [1-4] ]]; then
            local time_diff=$((current_time - last_key_time))
            if ((time_diff < 500)); then
                handle_lock_toggle "$key"
                last_key=""
                continue
            fi
        fi

        case "$key" in
            $'\x1b')  # Escape sequence
                read -rsn2 -t 0.01 key
                case "$key" in
                    "[A")  # Up
                        ((char_offset--))
                        ((char_offset < 0)) && char_offset=$((bank_count - 1))
                        ;;
                    "[B")  # Down
                        ((char_offset++))
                        ((char_offset >= bank_count)) && char_offset=0
                        ;;
                    "[C")  # Right - next bank
                        ((current_bank++))
                        ((current_bank >= ${#BANKS[@]})) && current_bank=0
                        bank_count=$(get_bank_count $current_bank)
                        char_offset=0
                        ;;
                    "[D")  # Left - previous bank
                        ((current_bank--))
                        ((current_bank < 0)) && current_bank=$((${#BANKS[@]} - 1))
                        bank_count=$(get_bank_count $current_bank)
                        char_offset=0
                        ;;
                esac
                last_key=""
                ;;

            [1-4])  # Slot assignment
                slots[$key]="${CONTENT_MODEL[candidate_glyph]}"
                CONTENT_MODEL[matrix_slot_$key]="${CONTENT_MODEL[candidate_glyph]}"
                save_slots "${slots[1]}" "${slots[2]}" "${slots[3]}" "${slots[4]}" "${mappings[$current_state]}"
                last_key="$key"
                last_key_time="$current_time"
                ;;

            "[")  # Cycle to previous state
                ((current_state--))
                ((current_state < 1)) && current_state=4
                CONTENT_MODEL[state_index]="$current_state"
                CONTENT_MODEL[mapping_string]="${mappings[$current_state]}"
                save_slots "${slots[1]}" "${slots[2]}" "${slots[3]}" "${slots[4]}" "${mappings[$current_state]}"
                last_key=""
                ;;

            "]")  # Cycle to next state
                ((current_state++))
                ((current_state > 4)) && current_state=1
                CONTENT_MODEL[state_index]="$current_state"
                CONTENT_MODEL[mapping_string]="${mappings[$current_state]}"
                save_slots "${slots[1]}" "${slots[2]}" "${slots[3]}" "${slots[4]}" "${mappings[$current_state]}"
                last_key=""
                ;;

            "?")  # Q&A mode
                current_mode="qa"
                CONTENT_MODEL[delimiter_symbol]="Q:"
                last_key=""
                ;;

            ":")  # Shell mode
                current_mode="shell"
                CONTENT_MODEL[delimiter_symbol]=">"
                last_key=""
                ;;

            $'\x1b')  # ESC - back to explorer
                current_mode="explorer"
                CONTENT_MODEL[delimiter_symbol]="::"
                last_key=""
                ;;

            "r"|"R")  # Random
                for i in 1 2 3 4; do
                    if [[ "${CONTENT_MODEL[lock_$i]}" != "true" ]]; then
                        local random_offset=$((RANDOM % bank_count))
                        local random_char=$(get_char_in_bank $current_bank $random_offset | cut -d'|' -f1)
                        slots[$i]="$random_char"
                        CONTENT_MODEL[matrix_slot_$i]="$random_char"
                    fi
                done
                save_slots "${slots[1]}" "${slots[2]}" "${slots[3]}" "${slots[4]}" "${mappings[$current_state]}"
                last_key=""
                ;;

            "s"|"S")  # Save
                save_slots "${slots[1]}" "${slots[2]}" "${slots[3]}" "${slots[4]}" "${mappings[$current_state]}"
                last_key=""
                ;;

            "h"|"H")  # Help
                render_help
                last_key=""
                ;;

            "m"|"M")  # Edit mapping
                tput cup 8 0
                printf " Edit mapping: "
                tput cnorm
                read -r user_mapping
                tput civis
                if [[ -n "$user_mapping" ]]; then
                    mappings[$current_state]="$user_mapping"
                    CONTENT_MODEL[mapping_string]="$user_mapping"
                fi
                last_key=""
                ;;

            "q"|"Q")  # Quit
                tput clear
                tput cnorm
                break
                ;;

            *)
                last_key=""
                ;;
        esac
    done

    tput cnorm
}

# Export
export -f unicode_explorer_repl

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    unicode_explorer_repl
fi
