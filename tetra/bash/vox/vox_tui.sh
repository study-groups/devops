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

#==============================================================================
# INTERACTIVE PHONEME EDITOR TUI
#==============================================================================

: "${VOX_SRC:=$TETRA_SRC/bash/vox}"
: "${VOX_DIR:=$TETRA_DIR/vox}"

# TUI state
declare -g _VOX_TUI_DOC_ID=""
declare -g _VOX_TUI_CURSOR=0
declare -g _VOX_TUI_PHONEME_CURSOR=0
declare -g _VOX_TUI_MODE="word"  # word | phoneme | edit
declare -g _VOX_TUI_TOKENS=()
declare -g _VOX_TUI_MODIFIED=0
declare -g _VOX_TUI_MESSAGE=""

#==============================================================================
# TERMINAL HELPERS
#==============================================================================

_vox_tui_setup() {
    stty -echo -icanon
    printf '\033[?25l'        # Hide cursor
    printf '\033[?1049h'      # Alt screen buffer
    printf '\033[2J'          # Clear screen
}

_vox_tui_cleanup() {
    printf '\033[?1049l'      # Restore screen buffer
    printf '\033[?25h'        # Show cursor
    stty echo icanon
}

_vox_tui_clear() {
    printf '\033[2J\033[H'
}

_vox_tui_goto() {
    local row="$1" col="$2"
    printf '\033[%d;%dH' "$row" "$col"
}

_vox_tui_width() {
    tput cols 2>/dev/null || echo 80
}

_vox_tui_height() {
    tput lines 2>/dev/null || echo 24
}

#==============================================================================
# DATA LOADING
#==============================================================================

_vox_tui_load() {
    local doc_id="$1"
    _VOX_TUI_DOC_ID="$doc_id"

    if ! vox_annotate_exists "$doc_id"; then
        echo "Document not found: $doc_id" >&2
        return 1
    fi

    local phonemes
    phonemes=$(vox_annotate_read "$doc_id" "phonemes") || return 1

    _VOX_TUI_TOKENS=()
    while IFS= read -r token; do
        _VOX_TUI_TOKENS+=("$token")
    done < <(echo "$phonemes" | jq -c '.tokens[]')

    _VOX_TUI_CURSOR=0
    _VOX_TUI_PHONEME_CURSOR=0
    _VOX_TUI_MODE="word"
    _VOX_TUI_MODIFIED=0
    _VOX_TUI_MESSAGE=""

    return 0
}

_vox_tui_save() {
    if (( ! _VOX_TUI_MODIFIED )); then
        _VOX_TUI_MESSAGE="No changes to save"
        return 0
    fi

    local path
    path=$(vox_annotate_path "$_VOX_TUI_DOC_ID" "phonemes")

    cp "$path" "${path}.bak"

    local tokens_json=""
    for token in "${_VOX_TUI_TOKENS[@]}"; do
        [[ -n "$tokens_json" ]] && tokens_json+=","
        tokens_json+="$token"
    done

    jq -n --argjson tokens "[$tokens_json]" '{
        version: "1.0",
        doc_id: "'"$_VOX_TUI_DOC_ID"'",
        modified: (now | todate),
        tokens: $tokens
    }' > "$path"

    _VOX_TUI_MODIFIED=0
    _VOX_TUI_MESSAGE="Saved!"
}

#==============================================================================
# CURRENT TOKEN HELPERS
#==============================================================================

_vox_tui_current_token() {
    echo "${_VOX_TUI_TOKENS[$_VOX_TUI_CURSOR]}"
}

_vox_tui_current_word() {
    _vox_tui_current_token | jq -r '.word'
}

_vox_tui_current_ipa() {
    _vox_tui_current_token | jq -r '.ipa'
}

_vox_tui_phoneme_count() {
    _vox_tui_current_token | jq '.phonemes | length'
}

#==============================================================================
# RENDERING
#==============================================================================

_vox_tui_render() {
    _vox_tui_clear

    local width=$(_vox_tui_width)
    local height=$(_vox_tui_height)

    # Header using vox colors
    _vox_tui_goto 1 1
    printf '\033[44m\033[37m\033[1m'
    printf " VOX Phoneme Editor"
    printf "%*s" $((width - 19)) ""
    reset_color
    echo

    # Document info
    _vox_tui_goto 2 1
    text_color "888888"
    printf " Document: %s | Words: %d | Mode: %s" \
        "$_VOX_TUI_DOC_ID" "${#_VOX_TUI_TOKENS[@]}" "$_VOX_TUI_MODE"
    (( _VOX_TUI_MODIFIED )) && printf " [modified]"
    reset_color
    echo

    # Separator
    _vox_tui_goto 3 1
    printf '%*s\n' "$width" '' | tr ' ' '─'

    # Word list (left panel)
    _vox_tui_render_word_list 4 1 30 $((height - 8))

    # Detail panel (right)
    _vox_tui_render_detail_panel 4 35 $((width - 36)) $((height - 8))

    # Status bar
    _vox_tui_goto $((height - 2)) 1
    printf '%*s\n' "$width" '' | tr ' ' '─'

    _vox_tui_goto $((height - 1)) 1
    text_color "888888"
    printf " ↑↓:nav  ←→:phoneme  e:edit  d:duration  s:save  q:quit"
    reset_color

    # Message line
    if [[ -n "$_VOX_TUI_MESSAGE" ]]; then
        _vox_tui_goto "$height" 1
        text_color "22DD22"
        printf " %s" "$_VOX_TUI_MESSAGE"
        reset_color
        _VOX_TUI_MESSAGE=""
    fi
}

_vox_tui_render_word_list() {
    local start_row="$1" start_col="$2" width="$3" height="$4"

    local visible_start=$(( _VOX_TUI_CURSOR - height / 2 ))
    (( visible_start < 0 )) && visible_start=0

    local visible_end=$(( visible_start + height ))
    (( visible_end > ${#_VOX_TUI_TOKENS[@]} )) && visible_end=${#_VOX_TUI_TOKENS[@]}

    local row=$start_row
    for ((i = visible_start; i < visible_end; i++)); do
        _vox_tui_goto "$row" "$start_col"

        local token="${_VOX_TUI_TOKENS[$i]}"
        local word=$(echo "$token" | jq -r '.word')
        local ipa=$(echo "$token" | jq -r '.ipa')

        if (( i == _VOX_TUI_CURSOR )); then
            printf '\033[48;5;236m\033[37m\033[1m'
            printf "▸"
        else
            printf " "
        fi

        printf " %-12s " "$word"
        reset_color

        if (( i == _VOX_TUI_CURSOR )); then
            vox_qa_id_text
        else
            text_color "888888"
        fi
        printf "%-10s" "[$ipa]"
        reset_color

        ((row++))
    done
}

_vox_tui_render_detail_panel() {
    local start_row="$1" start_col="$2" width="$3" height="$4"

    local token=$(_vox_tui_current_token)
    local word=$(echo "$token" | jq -r '.word')
    local ipa=$(echo "$token" | jq -r '.ipa')
    local dur=$(echo "$token" | jq -r '.duration_ms')

    # Word header
    _vox_tui_goto "$start_row" "$start_col"
    printf "\033[1m"
    printf "Word: "
    vox_voice_text
    printf "%s" "$word"
    reset_color

    # IPA
    _vox_tui_goto $((start_row + 1)) "$start_col"
    printf "\033[1m"
    printf "IPA:  "
    text_color "FFAA00"
    printf "[%s]" "$ipa"
    reset_color

    # Duration
    _vox_tui_goto $((start_row + 2)) "$start_col"
    printf "\033[1m"
    printf "Duration: "
    reset_color
    vox_duration_text
    printf "%sms" "$dur"
    reset_color

    # Phoneme list
    _vox_tui_goto $((start_row + 4)) "$start_col"
    printf "\033[1m\033[4m"
    printf "Phonemes:"
    reset_color

    local phonemes=$(echo "$token" | jq -c '.phonemes // []')

    local row=$((start_row + 5))
    local idx=0

    echo "$phonemes" | jq -c '.[]' | while IFS= read -r ph; do
        _vox_tui_goto "$row" "$start_col"

        local ph_ipa=$(echo "$ph" | jq -r '.ipa')
        local ph_dur=$(echo "$ph" | jq -r '.duration_ms')
        local ph_stress=$(echo "$ph" | jq -r '.stress // "none"')

        if [[ "$_VOX_TUI_MODE" == "phoneme" ]] && (( idx == _VOX_TUI_PHONEME_CURSOR )); then
            printf '\033[48;5;236m\033[37m'
            printf " ▸ "
        else
            printf "   "
        fi

        # IPA symbol
        text_color "AA00AA"
        printf "%-4s " "$ph_ipa"
        reset_color

        # Duration bar
        local bar_len=$((ph_dur / 20))
        (( bar_len > 20 )) && bar_len=20
        text_color "00AA00"
        printf "["
        printf '%*s' "$bar_len" '' | tr ' ' '█'
        printf '%*s' $((20 - bar_len)) '' | tr ' ' '░'
        printf "] %3dms" "$ph_dur"
        reset_color

        # Stress indicator
        case "$ph_stress" in
            primary)   text_color "FF0044"; printf " ˈ" ;;
            secondary) text_color "FFAA00"; printf " ˌ" ;;
        esac
        reset_color

        ((row++))
        ((idx++))
    done
}

#==============================================================================
# INPUT HANDLING
#==============================================================================

_vox_tui_read_key() {
    local key
    IFS= read -rsn1 key

    if [[ "$key" == $'\x1b' ]]; then
        read -rsn2 -t 0.1 key
        case "$key" in
            '[A') echo "up" ;;
            '[B') echo "down" ;;
            '[C') echo "right" ;;
            '[D') echo "left" ;;
            *)    echo "escape" ;;
        esac
    else
        echo "$key"
    fi
}

_vox_tui_handle_input() {
    local key="$1"

    case "$key" in
        up)
            if [[ "$_VOX_TUI_MODE" == "word" ]]; then
                (( _VOX_TUI_CURSOR > 0 )) && (( _VOX_TUI_CURSOR-- ))
                _VOX_TUI_PHONEME_CURSOR=0
            elif [[ "$_VOX_TUI_MODE" == "phoneme" ]]; then
                (( _VOX_TUI_PHONEME_CURSOR > 0 )) && (( _VOX_TUI_PHONEME_CURSOR-- ))
            fi
            ;;
        down)
            if [[ "$_VOX_TUI_MODE" == "word" ]]; then
                (( _VOX_TUI_CURSOR < ${#_VOX_TUI_TOKENS[@]} - 1 )) && (( _VOX_TUI_CURSOR++ ))
                _VOX_TUI_PHONEME_CURSOR=0
            elif [[ "$_VOX_TUI_MODE" == "phoneme" ]]; then
                local count=$(_vox_tui_phoneme_count)
                (( _VOX_TUI_PHONEME_CURSOR < count - 1 )) && (( _VOX_TUI_PHONEME_CURSOR++ ))
            fi
            ;;
        left)
            [[ "$_VOX_TUI_MODE" == "phoneme" ]] && _VOX_TUI_MODE="word"
            ;;
        right)
            if [[ "$_VOX_TUI_MODE" == "word" ]]; then
                _VOX_TUI_MODE="phoneme"
                _VOX_TUI_PHONEME_CURSOR=0
            fi
            ;;
        e|E)
            _vox_tui_edit_ipa
            ;;
        d|D)
            _vox_tui_edit_duration
            ;;
        +|=)
            _vox_tui_adjust_duration 10
            ;;
        -|_)
            _vox_tui_adjust_duration -10
            ;;
        p|P)
            _vox_tui_preview
            ;;
        s|S)
            _vox_tui_save
            ;;
        r|R)
            _vox_tui_regenerate_word
            ;;
        q|Q)
            return 1
            ;;
    esac

    return 0
}

#==============================================================================
# EDIT OPERATIONS
#==============================================================================

_vox_tui_edit_ipa() {
    local height=$(_vox_tui_height)
    local current_ipa=$(_vox_tui_current_ipa)

    _vox_tui_goto "$height" 1
    reset_color
    printf '\033[K'
    printf '\033[?25h'

    printf "New IPA [%s]: " "$current_ipa"
    stty echo icanon
    read -r new_ipa
    stty -echo -icanon

    printf '\033[?25l'

    if [[ -n "$new_ipa" && "$new_ipa" != "$current_ipa" ]]; then
        local token=$(_vox_tui_current_token)
        local updated
        updated=$(echo "$token" | jq --arg ipa "$new_ipa" '.ipa = $ipa')

        if declare -F _vox_g2p_parse_ipa &>/dev/null; then
            local new_phonemes
            new_phonemes=$(_vox_g2p_parse_ipa "$new_ipa")
            updated=$(echo "$updated" | jq --argjson ph "$new_phonemes" '
                .phonemes = $ph |
                .duration_ms = ($ph | map(.duration_ms) | add)
            ')
        fi

        _VOX_TUI_TOKENS[$_VOX_TUI_CURSOR]="$updated"
        _VOX_TUI_MODIFIED=1
        _VOX_TUI_MESSAGE="IPA updated"
    fi
}

_vox_tui_edit_duration() {
    if [[ "$_VOX_TUI_MODE" != "phoneme" ]]; then
        _VOX_TUI_MESSAGE="Select a phoneme first (→)"
        return
    fi

    local height=$(_vox_tui_height)
    local token=$(_vox_tui_current_token)
    local current_dur=$(echo "$token" | jq ".phonemes[$_VOX_TUI_PHONEME_CURSOR].duration_ms")

    _vox_tui_goto "$height" 1
    reset_color
    printf '\033[K'
    printf '\033[?25h'

    printf "New duration [%s ms]: " "$current_dur"
    stty echo icanon
    read -r new_dur
    stty -echo -icanon

    printf '\033[?25l'

    if [[ "$new_dur" =~ ^[0-9]+$ && "$new_dur" != "$current_dur" ]]; then
        local updated
        updated=$(echo "$token" | jq --argjson idx "$_VOX_TUI_PHONEME_CURSOR" --argjson dur "$new_dur" '
            .phonemes[$idx].duration_ms = $dur |
            .duration_ms = (.phonemes | map(.duration_ms) | add)
        ')

        _VOX_TUI_TOKENS[$_VOX_TUI_CURSOR]="$updated"
        _VOX_TUI_MODIFIED=1
        _VOX_TUI_MESSAGE="Duration updated"
    fi
}

_vox_tui_adjust_duration() {
    local delta="$1"

    if [[ "$_VOX_TUI_MODE" != "phoneme" ]]; then
        return
    fi

    local token=$(_vox_tui_current_token)
    local current_dur=$(echo "$token" | jq ".phonemes[$_VOX_TUI_PHONEME_CURSOR].duration_ms")
    local new_dur=$((current_dur + delta))

    (( new_dur < 10 )) && new_dur=10
    (( new_dur > 500 )) && new_dur=500

    local updated
    updated=$(echo "$token" | jq --argjson idx "$_VOX_TUI_PHONEME_CURSOR" --argjson dur "$new_dur" '
        .phonemes[$idx].duration_ms = $dur |
        .duration_ms = (.phonemes | map(.duration_ms) | add)
    ')

    _VOX_TUI_TOKENS[$_VOX_TUI_CURSOR]="$updated"
    _VOX_TUI_MODIFIED=1
}

_vox_tui_regenerate_word() {
    local word=$(_vox_tui_current_word)

    if ! declare -F vox_g2p_word_json &>/dev/null; then
        _VOX_TUI_MESSAGE="G2P not available"
        return
    fi

    local new_data
    new_data=$(vox_g2p_word_json "$word")

    local token=$(_vox_tui_current_token)
    local offset=$(echo "$token" | jq '.id')

    local updated
    updated=$(echo "$new_data" | jq --argjson id "$offset" '. + {id: $id}')

    _VOX_TUI_TOKENS[$_VOX_TUI_CURSOR]="$updated"
    _VOX_TUI_MODIFIED=1
    _VOX_TUI_MESSAGE="Regenerated: $word"
}

_vox_tui_preview() {
    local word=$(_vox_tui_current_word)

    local espeak_cmd
    for cmd in espeak-ng espeak; do
        if command -v "$cmd" &>/dev/null; then
            espeak_cmd="$cmd"
            break
        fi
    done

    if [[ -n "$espeak_cmd" ]]; then
        "$espeak_cmd" "$word" 2>/dev/null &
        _VOX_TUI_MESSAGE="Playing: $word"
    else
        _VOX_TUI_MESSAGE="No audio player available"
    fi
}

#==============================================================================
# MAIN TUI LOOP
#==============================================================================

_vox_tui_run() {
    local doc_id="$1"

    if ! _vox_tui_load "$doc_id"; then
        return 1
    fi

    trap _vox_tui_cleanup EXIT
    _vox_tui_setup

    while true; do
        _vox_tui_render

        local key
        key=$(_vox_tui_read_key)

        if ! _vox_tui_handle_input "$key"; then
            break
        fi
    done

    if (( _VOX_TUI_MODIFIED )); then
        _vox_tui_goto $(_vox_tui_height) 1
        printf '\033[K'
        printf '\033[?25h'
        printf "Save changes? [Y/n] "
        stty echo icanon
        read -r confirm
        stty -echo -icanon
        printf '\033[?25l'

        if [[ ! "$confirm" =~ ^[Nn] ]]; then
            _vox_tui_save
        fi
    fi
}

#==============================================================================
# NON-INTERACTIVE COMMANDS
#==============================================================================

vox_tui_list() {
    local doc_id="$1"

    if ! vox_annotate_exists "$doc_id"; then
        echo "Document not found: $doc_id" >&2
        return 1
    fi

    vox_annotate_read "$doc_id" "phonemes" | \
        jq -r '.tokens[] | "\(.word)\t[\(.ipa)]\t\(.duration_ms)ms"' | \
        column -t -s $'\t'
}

vox_tui_edit_word() {
    local doc_id="$1"
    local word="$2"
    local new_ipa="$3"

    local matches
    matches=$(vox_annotate_find_word "$doc_id" "$word")
    local count=$(echo "$matches" | jq 'length')

    if (( count == 0 )); then
        echo "Word not found: $word" >&2
        return 1
    fi

    if (( count > 1 )); then
        echo "Multiple matches found. Use vox_tui for interactive editing." >&2
        echo "$matches" | jq -r '.[] | "  offset \(.id): \(.word) [\(.ipa)]"'
        return 1
    fi

    local offset
    offset=$(echo "$matches" | jq -r '.[0].id')

    vox_annotate_update_ipa "$doc_id" "$offset" "$new_ipa"
    echo "Updated: $word → [$new_ipa]"
}

#==============================================================================
# CLI INTERFACE
#==============================================================================

vox_tui() {
    local cmd="${1:-help}"

    case "$cmd" in
        [0-9]*)
            _vox_tui_run "$cmd"
            ;;

        list|ls)
            shift
            vox_tui_list "$@"
            ;;

        edit-word|ew)
            shift
            vox_tui_edit_word "$@"
            ;;

        palette|colors)
            vox_show_palette
            ;;

        help|--help|-h|*)
            cat <<'EOF'
vox_tui - Interactive Phoneme Editor & Color System

Usage: vox_tui <doc_id>       Open interactive editor
       vox_tui list <doc_id>  List words non-interactively
       vox_tui edit-word <doc_id> <word> <new_ipa>
       vox_tui palette        Show color palette

Interactive Controls:
  ↑/↓         Navigate words
  ←/→         Switch between word/phoneme mode
  e           Edit IPA transcription
  d           Edit phoneme duration
  +/-         Adjust duration ±10ms
  r           Regenerate word from G2P
  p           Preview pronunciation
  s           Save changes
  q           Quit

Examples:
  vox_tui 1760229927
  vox_tui list 1760229927
  vox_tui edit-word 1760229927 hello həˈloʊ
  vox_tui palette
EOF
            ;;
    esac
}

#==============================================================================
# EXPORTS
#==============================================================================

export -f vox_tui vox_tui_list vox_tui_edit_word
export -f vox_show_palette vox_show_signature vox_show_progress vox_show_summary
export -f vox_state_symbol_colored vox_get_element_color vox_element_text
export -f vox_action_text vox_voice_text vox_qa_id_text vox_progress_text
export -f vox_cost_text vox_duration_text vox_show_cached
export -f _vox_tui_run _vox_tui_load _vox_tui_save
export -f _vox_tui_render _vox_tui_handle_input
export -f _vox_tui_setup _vox_tui_cleanup
