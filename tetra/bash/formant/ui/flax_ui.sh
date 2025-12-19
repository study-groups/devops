#!/usr/bin/env bash
# Formant UI - Flax Engine Based
# Single-file TUI using flax for rendering, supports interactive + command modes

FORMANT_FLAX_VERSION="1.0.0"

# =============================================================================
# DEPENDENCIES
# =============================================================================

# Locate ourselves
FORMANT_UI_SRC="${BASH_SOURCE[0]%/*}"

# Source flax engine
if [[ -z "$GAMES_SRC" ]]; then
    GAMES_SRC="$TETRA_SRC/bash/games"
fi

if [[ ! -f "$GAMES_SRC/engines/flax/flax.sh" ]]; then
    echo "Error: flax engine not found at $GAMES_SRC/engines/flax/flax.sh" >&2
    echo "Ensure TETRA_SRC or GAMES_SRC is set correctly" >&2
    return 1
fi

source "$GAMES_SRC/engines/flax/flax.sh"

# Source formant core (presets, expressions)
source "$FORMANT_UI_SRC/core/presets/phonemes.sh"
source "$FORMANT_UI_SRC/core/presets/expressions.sh"

# =============================================================================
# STATE (integer-scaled 0-100 to avoid bc issues)
# =============================================================================

# Articulator state (0-100 scale, display as 0.0-1.0)
declare -gi FUI_JAW=0
declare -gi FUI_ROUNDING=0
declare -gi FUI_CORNER=50
declare -gi FUI_COMPRESSION=0
declare -gi FUI_TONGUE_H=50
declare -gi FUI_TONGUE_F=50
declare -gi FUI_GROOVED=0
declare -gi FUI_VELUM=0

# Eye/brow state
declare -gi FUI_EYE_L=100
declare -gi FUI_EYE_R=100
declare -gi FUI_BROW_L=50
declare -gi FUI_BROW_R=50

# Animation targets (empty = no animation)
declare -gi FUI_JAW_TARGET=-1
declare -gi FUI_ROUNDING_TARGET=-1
declare -gi FUI_CORNER_TARGET=-1
declare -gi FUI_TONGUE_H_TARGET=-1
declare -gi FUI_TONGUE_F_TARGET=-1

# Animation rate (1-100, higher = faster)
declare -gi FUI_ANIM_RATE=30

# Mode: "interactive" or "command"
declare -g FUI_MODE="interactive"

# Command buffer for command mode
declare -g FUI_CMD_BUF=""

# Status message (shown briefly)
declare -g FUI_STATUS=""
declare -gi FUI_STATUS_TTL=0

# =============================================================================
# MATH HELPERS (pure bash, no bc)
# =============================================================================

fui_clamp() {
    local val=$1 min=${2:-0} max=${3:-100}
    ((val < min)) && val=$min
    ((val > max)) && val=$max
    echo $val
}

fui_lerp() {
    local current=$1 target=$2 rate=$3
    local diff=$((target - current))
    local step=$(( (diff * rate) / 100 ))
    # Ensure we move at least 1 if not at target
    if ((diff > 0 && step < 1)); then step=1; fi
    if ((diff < 0 && step > -1)); then step=-1; fi
    echo $((current + step))
}

fui_to_float() {
    local val=$1
    printf "%.2f" "$(awk "BEGIN {printf \"%.2f\", $val / 100}")"
}

# =============================================================================
# STATE MANAGEMENT
# =============================================================================

fui_reset() {
    FUI_JAW=0
    FUI_ROUNDING=0
    FUI_CORNER=50
    FUI_COMPRESSION=0
    FUI_TONGUE_H=50
    FUI_TONGUE_F=50
    FUI_GROOVED=0
    FUI_VELUM=0
    FUI_EYE_L=100
    FUI_EYE_R=100
    FUI_BROW_L=50
    FUI_BROW_R=50
    # Clear targets
    FUI_JAW_TARGET=-1
    FUI_ROUNDING_TARGET=-1
    FUI_CORNER_TARGET=-1
    FUI_TONGUE_H_TARGET=-1
    FUI_TONGUE_F_TARGET=-1
}

fui_set_target() {
    local param=$1 value=$2
    # Convert 0.0-1.0 float to 0-100 int
    local int_val=$(awk "BEGIN {printf \"%.0f\", $value * 100}")

    case "$param" in
        # Mouth/articulator - animated
        FORMANT_JAW_OPENNESS)      FUI_JAW_TARGET=$int_val ;;
        FORMANT_LIP_ROUNDING)      FUI_ROUNDING_TARGET=$int_val ;;
        FORMANT_LIP_CORNER_HEIGHT) FUI_CORNER_TARGET=$int_val ;;
        FORMANT_TONGUE_HEIGHT)     FUI_TONGUE_H_TARGET=$int_val ;;
        FORMANT_TONGUE_FRONTNESS)  FUI_TONGUE_F_TARGET=$int_val ;;

        # Eye/brow - direct set
        FORMANT_EYE_OPENNESS)      FUI_EYE_L=$int_val; FUI_EYE_R=$int_val ;;
        FORMANT_EYE_L_OPENNESS)    FUI_EYE_L=$int_val ;;
        FORMANT_EYE_R_OPENNESS)    FUI_EYE_R=$int_val ;;
        FORMANT_EYEBROW_L_HEIGHT)  FUI_BROW_L=$int_val ;;
        FORMANT_EYEBROW_R_HEIGHT)  FUI_BROW_R=$int_val ;;
        FORMANT_EYEBROW_L_ARCH)    ;; # Not visualized currently
        FORMANT_EYEBROW_R_ARCH)    ;; # Not visualized currently
        FORMANT_EYEBROW_L_ANGLE)   ;; # Not visualized currently
        FORMANT_EYEBROW_R_ANGLE)   ;; # Not visualized currently
        FORMANT_EYEBROW_SYMMETRY)  ;; # Not visualized currently
        FORMANT_GAZE_H)            ;; # Not visualized currently
        FORMANT_GAZE_V)            ;; # Not visualized currently

        # Other mouth params - direct set
        FORMANT_LIP_COMPRESSION)   FUI_COMPRESSION=$int_val ;;
        FORMANT_TONGUE_GROOVED)    FUI_GROOVED=$int_val ;;
        FORMANT_VELUM_LOWERED)     FUI_VELUM=$int_val ;;
        FORMANT_LIP_PROTRUSION)    ;; # Not visualized currently
    esac
}

fui_apply_preset() {
    local name=$1
    local preset_data=""

    # Try phoneme first, then expression
    preset_data=$(formant_get_phoneme_preset "$name" 2>/dev/null)
    [[ -z "$preset_data" ]] && preset_data=$(formant_get_expression_preset "$name" 2>/dev/null)

    if [[ -z "$preset_data" ]]; then
        FUI_STATUS="Unknown: $name"
        FUI_STATUS_TTL=60
        return 1
    fi

    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        IFS=':' read -r param value <<< "$line"
        fui_set_target "$param" "$value"
    done <<< "$preset_data"

    FUI_STATUS="→ $name"
    FUI_STATUS_TTL=30
}

fui_animate() {
    # Animate each parameter toward its target
    if ((FUI_JAW_TARGET >= 0)); then
        FUI_JAW=$(fui_lerp $FUI_JAW $FUI_JAW_TARGET $FUI_ANIM_RATE)
        ((FUI_JAW == FUI_JAW_TARGET)) && FUI_JAW_TARGET=-1
    fi
    if ((FUI_ROUNDING_TARGET >= 0)); then
        FUI_ROUNDING=$(fui_lerp $FUI_ROUNDING $FUI_ROUNDING_TARGET $FUI_ANIM_RATE)
        ((FUI_ROUNDING == FUI_ROUNDING_TARGET)) && FUI_ROUNDING_TARGET=-1
    fi
    if ((FUI_CORNER_TARGET >= 0)); then
        FUI_CORNER=$(fui_lerp $FUI_CORNER $FUI_CORNER_TARGET $FUI_ANIM_RATE)
        ((FUI_CORNER == FUI_CORNER_TARGET)) && FUI_CORNER_TARGET=-1
    fi
    if ((FUI_TONGUE_H_TARGET >= 0)); then
        FUI_TONGUE_H=$(fui_lerp $FUI_TONGUE_H $FUI_TONGUE_H_TARGET $FUI_ANIM_RATE)
        ((FUI_TONGUE_H == FUI_TONGUE_H_TARGET)) && FUI_TONGUE_H_TARGET=-1
    fi
    if ((FUI_TONGUE_F_TARGET >= 0)); then
        FUI_TONGUE_F=$(fui_lerp $FUI_TONGUE_F $FUI_TONGUE_F_TARGET $FUI_ANIM_RATE)
        ((FUI_TONGUE_F == FUI_TONGUE_F_TARGET)) && FUI_TONGUE_F_TARGET=-1
    fi

    # Decay status message
    ((FUI_STATUS_TTL > 0)) && ((FUI_STATUS_TTL--))
    ((FUI_STATUS_TTL == 0)) && FUI_STATUS=""
}

# =============================================================================
# FACE CHARACTERS
# =============================================================================

fui_get_mouth() {
    local jaw=$FUI_JAW rnd=$FUI_ROUNDING corner=$FUI_CORNER comp=$FUI_COMPRESSION

    if ((jaw < 15)); then
        if ((comp > 60)); then echo "═"
        elif ((corner > 70)); then echo "‿"
        elif ((corner < 30)); then echo "⌢"
        elif ((rnd > 60)); then echo "o"
        else echo "─"
        fi
    elif ((jaw < 40)); then
        if ((rnd > 60)); then echo "o"
        else echo "○"
        fi
    elif ((jaw < 70)); then
        if ((rnd > 60)); then echo "O"
        else echo "◯"
        fi
    else
        echo "⭘"
    fi
}

fui_get_eye() {
    local openness=$1
    if ((openness > 80)); then echo "●"
    elif ((openness > 50)); then echo "○"
    else echo "─"
    fi
}

fui_get_brow() {
    local arch=$1 is_left=$2
    if ((arch > 70)); then
        ((is_left)) && echo "/" || echo "\\"
    elif ((arch < 30)); then
        echo "─"
    else
        ((is_left)) && echo "/" || echo "\\"
    fi
}

# =============================================================================
# RENDERING (flax-based)
# =============================================================================

fui_render() {
    local cols lines
    read -r lines cols < <(stty size 2>/dev/null || echo "24 80")

    local cx=$((cols / 2))
    local cy=$((lines / 2 - 2))

    # Get face characters
    local mouth=$(fui_get_mouth)
    local eye_l=$(fui_get_eye $FUI_EYE_L)
    local eye_r=$(fui_get_eye $FUI_EYE_R)
    local brow_l=$(fui_get_brow $FUI_BROW_L 1)
    local brow_r=$(fui_get_brow $FUI_BROW_R 0)

    # Draw eyebrows
    flax_draw_text $((cy - 3)) $((cx - 12)) "${brow_l}${brow_l}${brow_l}${brow_l}" 250
    flax_draw_text $((cy - 3)) $((cx + 9)) "${brow_r}${brow_r}${brow_r}${brow_r}" 250

    # Draw eyes
    flax_draw_text $cy $((cx - 10)) "$eye_l" 255
    flax_draw_text $cy $((cx + 10)) "$eye_r" 255

    # Draw mouth (width based on jaw openness)
    local mw=$(( (FUI_JAW * 5 / 100) + 1 ))
    local mouth_str=""
    for ((i=0; i<mw; i++)); do mouth_str+="$mouth"; done
    flax_draw_text $((cy + 4)) $((cx - mw/2)) "$mouth_str" 203

    # Build dynamic width borders
    local inner_w=$((cols - 2))
    local title="─ Articulator State "
    local title_len=${#title}
    local fill_len=$((inner_w - title_len))
    local fill=""
    for ((i=0; i<fill_len; i++)); do fill+="─"; done

    # Status panel
    local panel_y=$((lines - 7))

    # Top border
    flax_goto $panel_y 1
    flax_color 240
    flax_add "╭${title}${fill}╮"

    # Build content strings
    local jaw_f=$(fui_to_float $FUI_JAW)
    local rnd_f=$(fui_to_float $FUI_ROUNDING)
    local crn_f=$(fui_to_float $FUI_CORNER)
    local cmp_f=$(fui_to_float $FUI_COMPRESSION)
    local th_f=$(fui_to_float $FUI_TONGUE_H)
    local tf_f=$(fui_to_float $FUI_TONGUE_F)
    local grv_f=$(fui_to_float $FUI_GROOVED)
    local vel_f=$(fui_to_float $FUI_VELUM)

    local line1="JAW:$jaw_f RND:$rnd_f CRN:$crn_f CMP:$cmp_f"
    local line2="TNG_H:$th_f TNG_F:$tf_f GRV:$grv_f VEL:$vel_f"

    # Row 1
    flax_goto $((panel_y + 1)) 1
    flax_color 240
    flax_add "│ "
    flax_color 248
    flax_add "$line1"
    flax_goto $((panel_y + 1)) $cols
    flax_color 240
    flax_add "│"

    # Row 2
    flax_goto $((panel_y + 2)) 1
    flax_color 240
    flax_add "│ "
    flax_color 248
    flax_add "$line2"
    flax_goto $((panel_y + 2)) $cols
    flax_color 240
    flax_add "│"

    # Bottom border
    local bottom_fill=""
    for ((i=0; i<inner_w; i++)); do bottom_fill+="─"; done
    flax_goto $((panel_y + 3)) 1
    flax_color 240
    flax_add "╰${bottom_fill}╯"
    flax_reset

    # Mode bar
    local mode_y=$((lines - 3))
    flax_goto $mode_y 1
    if [[ "$FUI_MODE" == "command" ]]; then
        flax_color 226
        flax_add "COMMAND: "
        flax_color 255
        flax_add "$FUI_CMD_BUF"
        flax_color 240
        flax_add "█"
    else
        flax_color 46
        flax_add "INTERACTIVE"
        flax_color 240
        flax_add " WS:Jaw IK:Tng JL:FB QE:Lips 1-5:Vowels R:Reset ::Cmd Q:Quit"
    fi
    flax_reset

    # Status message
    if [[ -n "$FUI_STATUS" ]]; then
        flax_draw_text $((lines - 1)) 1 "$FUI_STATUS" 220
    fi
}

# =============================================================================
# INPUT HANDLING
# =============================================================================

fui_handle_interactive() {
    local key=$1
    local step=10

    case "$key" in
        # Jaw control
        w|W) FUI_JAW=$(fui_clamp $((FUI_JAW - step))) ;;
        s|S) FUI_JAW=$(fui_clamp $((FUI_JAW + step))) ;;

        # Tongue height
        i|I) FUI_TONGUE_H=$(fui_clamp $((FUI_TONGUE_H + step))) ;;
        k|K) FUI_TONGUE_H=$(fui_clamp $((FUI_TONGUE_H - step))) ;;

        # Tongue frontness
        j|J) FUI_TONGUE_F=$(fui_clamp $((FUI_TONGUE_F - step))) ;;
        l|L) FUI_TONGUE_F=$(fui_clamp $((FUI_TONGUE_F + step))) ;;

        # Lip rounding
        q) FUI_ROUNDING=$(fui_clamp $((FUI_ROUNDING + step))) ;;

        # Lip corner (smile)
        e|E) FUI_CORNER=$(fui_clamp $((FUI_CORNER + step))) ;;

        # Quick vowels
        1) fui_apply_preset "i" ;;
        2) fui_apply_preset "e" ;;
        3) fui_apply_preset "a" ;;
        4) fui_apply_preset "o" ;;
        5) fui_apply_preset "u" ;;

        # Reset
        r|R) fui_reset; FUI_STATUS="Reset"; FUI_STATUS_TTL=30 ;;

        # Enter command mode
        :) FUI_MODE="command"; FUI_CMD_BUF="" ;;

        # Quit (handled by flax loop, but we can override Q to not quit in interactive)
        # Let Q go through to flax_loop which handles it
    esac
}

fui_handle_command() {
    local key=$1

    case "$key" in
        # Escape - cancel and return to interactive
        $'\x1b')
            FUI_MODE="interactive"
            FUI_CMD_BUF=""
            ;;

        # Enter - execute command
        "")
            fui_execute_command "$FUI_CMD_BUF"
            FUI_CMD_BUF=""
            FUI_MODE="interactive"
            ;;

        # Backspace
        $'\x7f'|$'\x08')
            [[ -n "$FUI_CMD_BUF" ]] && FUI_CMD_BUF="${FUI_CMD_BUF%?}"
            ;;

        # Printable characters
        *)
            if [[ "$key" =~ ^[[:print:]]$ ]]; then
                FUI_CMD_BUF+="$key"
            fi
            ;;
    esac
}

fui_execute_command() {
    local cmd=$1
    local -a args
    read -ra args <<< "$cmd"

    case "${args[0]}" in
        ph|phoneme)
            [[ -n "${args[1]}" ]] && fui_apply_preset "${args[1]}"
            ;;
        expr|expression)
            [[ -n "${args[1]}" ]] && fui_apply_preset "${args[1]}"
            ;;
        reset|r)
            fui_reset
            FUI_STATUS="Reset"
            FUI_STATUS_TTL=30
            ;;
        ipa|chart)
            FUI_STATUS="IPA: i e a o u (1-5)"
            FUI_STATUS_TTL=90
            ;;
        help|h|\?)
            FUI_STATUS="ph <ipa> | expr <name> | reset | quit"
            FUI_STATUS_TTL=120
            ;;
        quit|exit|q)
            flax_stop
            ;;
        "")
            ;; # Empty command, ignore
        *)
            # Try as preset name directly
            if ! fui_apply_preset "$cmd"; then
                FUI_STATUS="Unknown: $cmd"
                FUI_STATUS_TTL=60
            fi
            ;;
    esac
}

# =============================================================================
# FLAX CALLBACKS
# =============================================================================

formant_flax_render() {
    fui_render
}

formant_flax_update() {
    local key="$FLAX_KEY"

    # Animate toward targets
    fui_animate

    # Handle input based on mode
    if [[ -n "$key" ]]; then
        if [[ "$FUI_MODE" == "command" ]]; then
            fui_handle_command "$key"
        else
            fui_handle_interactive "$key"
        fi
    fi
}

# =============================================================================
# ENTRY POINT
# =============================================================================

formant_flax_start() {
    fui_reset
    FUI_MODE="interactive"

    echo "Formant UI v$FORMANT_FLAX_VERSION (flax-based)" >&2
    echo "Press any key to start..." >&2
    read -rsn1

    flax_set_fps 30
    flax_loop formant_flax_update formant_flax_render
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    formant_flax_start
fi
