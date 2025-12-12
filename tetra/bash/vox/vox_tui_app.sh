#!/usr/bin/env bash

# vox_tui_app.sh - Interactive TUI for vox audio analysis and visualization
# Features:
# - ASCII waveform display with zoom
# - Phoneme timeline with onset markers
# - F0/formant overlay
# - Dual-mode input (CLI + key mode)

: "${VOX_SRC:=$TETRA_SRC/bash/vox}"
: "${TAU_SRC:=$HOME/src/tau}"

# Source color utilities
[[ -f "$VOX_SRC/vox_tui.sh" ]] && source "$VOX_SRC/vox_tui.sh"

# ═══════════════════════════════════════════════════════════════════════════════
# TERMINAL STATE
# ═══════════════════════════════════════════════════════════════════════════════

_VOX_APP_INITIALIZED=false
_VOX_APP_OLD_TTY=""
_VOX_APP_HEIGHT=24
_VOX_APP_WIDTH=80

# Layout constants
_VOX_APP_HEADER_HEIGHT=2
_VOX_APP_FOOTER_HEIGHT=5
_VOX_APP_CONTENT_HEIGHT=10

# State
_VOX_APP_AUDIO_FILE=""
_VOX_APP_ANALYSIS_JSON=""
_VOX_APP_MODE="cli"  # cli or key
_VOX_APP_VIEW="wave" # wave, timeline, formants, help
_VOX_APP_ZOOM=1      # 1=full, 2=2x, 4=4x, 8=8x
_VOX_APP_OFFSET=0    # Pan offset in samples
_VOX_APP_CURSOR=0    # Cursor position (0-100%)

# Cached analysis data
declare -a _VOX_APP_ONSETS=()
_VOX_APP_F0=0
_VOX_APP_DURATION=0

# Phoneme cursor navigation
_VOX_APP_PHONEME_IDX=0           # Current phoneme index (0-based)
_VOX_APP_PHONEME_COUNT=0         # Total phoneme count
declare -a _VOX_APP_PHONEME_STARTS=()  # Start times per phoneme
declare -a _VOX_APP_PHONEME_ENDS=()    # End times per phoneme

# ═══════════════════════════════════════════════════════════════════════════════
# TERMINAL SETUP/CLEANUP
# ═══════════════════════════════════════════════════════════════════════════════

vox_app_init() {
    [[ "$_VOX_APP_INITIALIZED" == "true" ]] && return 0

    # Save terminal state
    _VOX_APP_OLD_TTY=$(stty -g 2>/dev/null)

    # Get dimensions
    _VOX_APP_HEIGHT=$(tput lines 2>/dev/null || echo 24)
    _VOX_APP_WIDTH=$(tput cols 2>/dev/null || echo 80)
    _VOX_APP_CONTENT_HEIGHT=$((_VOX_APP_HEIGHT - _VOX_APP_HEADER_HEIGHT - _VOX_APP_FOOTER_HEIGHT))

    # Set scroll region: protect header and footer
    local content_end=$((_VOX_APP_HEIGHT - _VOX_APP_FOOTER_HEIGHT - 1))
    tput csr $_VOX_APP_HEADER_HEIGHT $content_end 2>/dev/null || true

    # Hide cursor initially
    tput civis 2>/dev/null || true

    # Clear screen
    clear

    _VOX_APP_INITIALIZED=true

    # Trap cleanup
    trap vox_app_cleanup EXIT INT TERM
}

vox_app_cleanup() {
    [[ "$_VOX_APP_INITIALIZED" != "true" ]] && return 0

    # Reset scroll region
    tput csr 0 $((_VOX_APP_HEIGHT - 1)) 2>/dev/null || true

    # Show cursor
    tput cnorm 2>/dev/null || true

    # Restore terminal
    [[ -n "$_VOX_APP_OLD_TTY" ]] && stty "$_VOX_APP_OLD_TTY" 2>/dev/null

    # Clear screen
    clear

    _VOX_APP_INITIALIZED=false
}

# ═══════════════════════════════════════════════════════════════════════════════
# DRAWING PRIMITIVES
# ═══════════════════════════════════════════════════════════════════════════════

# Colors (fallback if vox_tui.sh not loaded)
_VOX_C_RESET=$'\e[0m'
_VOX_C_BOLD=$'\e[1m'
_VOX_C_DIM=$'\e[2m'
_VOX_C_CYAN=$'\e[36m'
_VOX_C_GREEN=$'\e[32m'
_VOX_C_YELLOW=$'\e[33m'
_VOX_C_RED=$'\e[31m'
_VOX_C_MAGENTA=$'\e[35m'
_VOX_C_BLUE=$'\e[34m'

# Move cursor to position (0-based)
vox_app_move() {
    tput cup "$1" "$2" 2>/dev/null || printf '\e[%d;%dH' $(($1+1)) $(($2+1))
}

# Draw horizontal line
vox_app_hline() {
    local row=$1 col=$2 len=$3 char="${4:-━}"
    vox_app_move $row $col
    printf '%*s' "$len" '' | tr ' ' "$char"
}

# Clear line from position
vox_app_clear_line() {
    local row=$1
    vox_app_move $row 0
    tput el 2>/dev/null || printf '\e[K'
}

# ═══════════════════════════════════════════════════════════════════════════════
# HEADER/FOOTER RENDERING
# ═══════════════════════════════════════════════════════════════════════════════

vox_app_render_header() {
    local file="${_VOX_APP_AUDIO_FILE:-<no file>}"
    local basename="${file##*/}"
    local mode_indicator

    if [[ "$_VOX_APP_MODE" == "key" ]]; then
        mode_indicator="${_VOX_C_GREEN}[KEY]${_VOX_C_RESET}"
    else
        mode_indicator="${_VOX_C_CYAN}[CLI]${_VOX_C_RESET}"
    fi

    # Line 0: Title bar
    vox_app_move 0 0
    printf "${_VOX_C_BOLD}${_VOX_C_CYAN}vox${_VOX_C_RESET} ${_VOX_C_DIM}│${_VOX_C_RESET} "
    printf "%s " "$basename"
    printf "${_VOX_C_DIM}│${_VOX_C_RESET} "
    printf "zoom:${_VOX_C_YELLOW}%dx${_VOX_C_RESET} " "$_VOX_APP_ZOOM"
    printf "view:${_VOX_C_MAGENTA}%s${_VOX_C_RESET} " "$_VOX_APP_VIEW"

    # Show phoneme cursor if we have phonemes
    if ((_VOX_APP_PHONEME_COUNT > 0)); then
        printf "${_VOX_C_DIM}│${_VOX_C_RESET} "
        printf "ph:${_VOX_C_GREEN}%d${_VOX_C_RESET}/${_VOX_C_DIM}%d${_VOX_C_RESET} " \
            "$((_VOX_APP_PHONEME_IDX + 1))" "$_VOX_APP_PHONEME_COUNT"
    fi

    printf "%s" "$mode_indicator"
    tput el 2>/dev/null || printf '\e[K'

    # Line 1: Separator
    vox_app_move 1 0
    printf "${_VOX_C_DIM}"
    vox_app_hline 1 0 $_VOX_APP_WIDTH "─"
    printf "${_VOX_C_RESET}"
}

vox_app_render_footer() {
    local footer_start=$((_VOX_APP_HEIGHT - _VOX_APP_FOOTER_HEIGHT))

    # Separator line
    vox_app_move $footer_start 0
    printf "${_VOX_C_DIM}"
    vox_app_hline $footer_start 0 $_VOX_APP_WIDTH "─"
    printf "${_VOX_C_RESET}"

    # Stats line
    vox_app_move $((footer_start + 1)) 0
    if [[ -n "$_VOX_APP_ANALYSIS_JSON" ]]; then
        printf "F0:${_VOX_C_GREEN}%.1fHz${_VOX_C_RESET} " "$_VOX_APP_F0"
        printf "dur:${_VOX_C_CYAN}%.2fs${_VOX_C_RESET} " "$_VOX_APP_DURATION"
        printf "onsets:${_VOX_C_YELLOW}%d${_VOX_C_RESET}" "${#_VOX_APP_ONSETS[@]}"
    else
        printf "${_VOX_C_DIM}No analysis loaded${_VOX_C_RESET}"
    fi
    tput el

    # Help line
    vox_app_move $((footer_start + 2)) 0
    if [[ "$_VOX_APP_MODE" == "key" ]]; then
        printf "${_VOX_C_DIM}←→${_VOX_C_RESET}pan "
        printf "${_VOX_C_DIM}+/-${_VOX_C_RESET}zoom "
        printf "${_VOX_C_DIM}w${_VOX_C_RESET}ave "
        printf "${_VOX_C_DIM}t${_VOX_C_RESET}ime "
        printf "${_VOX_C_DIM}f${_VOX_C_RESET}ormants "
        printf "${_VOX_C_DIM}p${_VOX_C_RESET}lay "
        printf "${_VOX_C_DIM}a${_VOX_C_RESET}nalyze "
        printf "${_VOX_C_DIM}ESC${_VOX_C_RESET}→cli"
    else
        printf "${_VOX_C_DIM}Commands: load <file> | analyze | play | zoom <n> | /key | quit${_VOX_C_RESET}"
    fi
    tput el

    # Prompt line (leave empty for input)
    vox_app_move $((footer_start + 3)) 0
    tput el
}

# ═══════════════════════════════════════════════════════════════════════════════
# WAVEFORM RENDERING
# ═══════════════════════════════════════════════════════════════════════════════

vox_app_render_waveform() {
    local start_row=$((_VOX_APP_HEADER_HEIGHT))
    local height=$((_VOX_APP_CONTENT_HEIGHT))
    local width=$((_VOX_APP_WIDTH - 2))

    # Clear content area
    for ((i=0; i<height; i++)); do
        vox_app_clear_line $((start_row + i))
    done

    if [[ -z "$_VOX_APP_AUDIO_FILE" ]]; then
        vox_app_move $((start_row + height/2)) 2
        printf "${_VOX_C_DIM}Load an audio file: load <path>${_VOX_C_RESET}"
        return
    fi

    # Get energy data from filterbank
    local fb_bin="$TAU_SRC/tau_lib/algorithms/filterbank/filterbank"
    if [[ ! -x "$fb_bin" ]]; then
        vox_app_move $((start_row + height/2)) 2
        printf "${_VOX_C_RED}filterbank not built${_VOX_C_RESET}"
        return
    fi

    # Generate filterbank data
    local tmp_tsv=$(mktemp)
    "$fb_bin" -i "$_VOX_APP_AUDIO_FILE" -o "$tmp_tsv" 2>/dev/null

    if [[ ! -s "$tmp_tsv" ]]; then
        rm -f "$tmp_tsv"
        vox_app_move $((start_row + height/2)) 2
        printf "${_VOX_C_RED}Failed to analyze audio${_VOX_C_RESET}"
        return
    fi

    # Read and downsample energy values
    local -a energies=()
    local max_energy=0.0001
    local total_lines=$(tail -n +2 "$tmp_tsv" | wc -l)
    local step=$((total_lines / width))
    [[ $step -lt 1 ]] && step=1

    # Apply zoom
    local zoom_step=$((step / _VOX_APP_ZOOM))
    [[ $zoom_step -lt 1 ]] && zoom_step=1

    local line_num=0
    local sample_idx=0
    while IFS=$'\t' read -r t b80 b120 b180 b270 f1 f2 f3 total; do
        [[ "$t" == "t" ]] && continue

        ((line_num++))
        if (( line_num % zoom_step == 0 )); then
            energies+=("$total")
            if (( $(echo "$total > $max_energy" | bc -l 2>/dev/null || echo 0) )); then
                max_energy="$total"
            fi
            ((sample_idx++))
            [[ $sample_idx -ge $width ]] && break
        fi
    done < "$tmp_tsv"
    rm -f "$tmp_tsv"

    # Normalize and draw
    local bar_max=$((height - 2))

    for ((x=0; x<${#energies[@]} && x<width; x++)); do
        local e="${energies[$x]}"
        local bar_height=$(echo "scale=0; $e / $max_energy * $bar_max" | bc -l 2>/dev/null || echo 0)
        [[ $bar_height -lt 0 ]] && bar_height=0
        [[ $bar_height -gt $bar_max ]] && bar_height=$bar_max

        # Draw column bottom-up
        for ((y=0; y<bar_max; y++)); do
            local row=$((start_row + bar_max - y))
            vox_app_move $row $((x + 1))
            if (( y < bar_height )); then
                if (( y > bar_max * 3 / 4 )); then
                    printf "${_VOX_C_RED}█${_VOX_C_RESET}"
                elif (( y > bar_max / 2 )); then
                    printf "${_VOX_C_YELLOW}█${_VOX_C_RESET}"
                else
                    printf "${_VOX_C_GREEN}█${_VOX_C_RESET}"
                fi
            fi
        done
    done

    # Draw onset markers and highlight current phoneme
    if [[ ${#_VOX_APP_ONSETS[@]} -gt 0 && "$_VOX_APP_DURATION" != "0" ]]; then
        local cur_start_x=-1
        local cur_end_x=-1

        # Calculate current phoneme region
        if ((_VOX_APP_PHONEME_COUNT > 0)); then
            local cur_start="${_VOX_APP_PHONEME_STARTS[$_VOX_APP_PHONEME_IDX]}"
            local cur_end="${_VOX_APP_PHONEME_ENDS[$_VOX_APP_PHONEME_IDX]}"
            cur_start_x=$(echo "scale=0; $cur_start / $_VOX_APP_DURATION * $width" | bc -l 2>/dev/null || echo 0)
            cur_end_x=$(echo "scale=0; $cur_end / $_VOX_APP_DURATION * $width" | bc -l 2>/dev/null || echo 0)
        fi

        # Draw all onset markers
        for ((i=0; i<${#_VOX_APP_ONSETS[@]}; i++)); do
            local onset="${_VOX_APP_ONSETS[$i]}"
            local x_pos=$(echo "scale=0; $onset / $_VOX_APP_DURATION * $width" | bc -l 2>/dev/null || echo 0)
            [[ $x_pos -lt 0 ]] && x_pos=0
            [[ $x_pos -ge $width ]] && x_pos=$((width-1))
            vox_app_move $((start_row + bar_max)) $((x_pos + 1))

            # Highlight current phoneme's onset marker
            if ((i == _VOX_APP_PHONEME_IDX)); then
                printf "${_VOX_C_BOLD}${_VOX_C_GREEN}▼${_VOX_C_RESET}"
            else
                printf "${_VOX_C_MAGENTA}▼${_VOX_C_RESET}"
            fi
        done

        # Draw current phoneme bracket/region indicator on bottom row
        if ((cur_start_x >= 0 && cur_end_x >= 0)); then
            vox_app_move $((start_row + bar_max + 1)) $((cur_start_x + 1))
            printf "${_VOX_C_GREEN}["
            local bracket_width=$((cur_end_x - cur_start_x - 1))
            ((bracket_width < 0)) && bracket_width=0
            for ((b=0; b<bracket_width && b<20; b++)); do
                printf "─"
            done
            vox_app_move $((start_row + bar_max + 1)) $((cur_end_x + 1))
            printf "]${_VOX_C_RESET}"
        fi
    fi

    # Time axis with current phoneme time
    vox_app_move $((start_row + height - 1)) 1
    printf "${_VOX_C_DIM}0s"

    # Show current phoneme time in middle
    if ((_VOX_APP_PHONEME_COUNT > 0)); then
        local ph_start="${_VOX_APP_PHONEME_STARTS[$_VOX_APP_PHONEME_IDX]}"
        local ph_dur=$(echo "scale=0; (${_VOX_APP_PHONEME_ENDS[$_VOX_APP_PHONEME_IDX]} - $ph_start) * 1000" | bc -l 2>/dev/null || echo 0)
        vox_app_move $((start_row + height - 1)) $((width / 2 - 8))
        printf "${_VOX_C_GREEN}[%.2fs %dms]${_VOX_C_RESET}" "$ph_start" "$ph_dur"
    fi

    vox_app_move $((start_row + height - 1)) $((width - 4))
    printf "${_VOX_C_DIM}%.1fs${_VOX_C_RESET}" "$_VOX_APP_DURATION"
}

# ═══════════════════════════════════════════════════════════════════════════════
# TIMELINE VIEW
# ═══════════════════════════════════════════════════════════════════════════════

vox_app_render_timeline() {
    local start_row=$((_VOX_APP_HEADER_HEIGHT))
    local height=$((_VOX_APP_CONTENT_HEIGHT))
    local width=$((_VOX_APP_WIDTH - 2))

    for ((i=0; i<height; i++)); do
        vox_app_clear_line $((start_row + i))
    done

    if [[ ${#_VOX_APP_ONSETS[@]} -eq 0 ]]; then
        vox_app_move $((start_row + height/2)) 2
        printf "${_VOX_C_DIM}No onsets detected. Run analyze first.${_VOX_C_RESET}"
        return
    fi

    # Timeline ruler
    vox_app_move $start_row 1
    printf "${_VOX_C_DIM}"
    for ((i=0; i<width; i++)); do
        if (( i % 10 == 0 )); then printf "│"; else printf "─"; fi
    done
    printf "${_VOX_C_RESET}"

    # Onset markers with intervals
    local prev_onset=0
    local idx=0

    for onset in "${_VOX_APP_ONSETS[@]}"; do
        local x_pos=$(echo "scale=0; $onset / $_VOX_APP_DURATION * $width" | bc -l 2>/dev/null || echo 0)
        [[ $x_pos -lt 0 ]] && x_pos=0
        [[ $x_pos -ge $width ]] && x_pos=$((width-1))

        vox_app_move $((start_row + 1)) $((x_pos + 1))
        printf "${_VOX_C_CYAN}▲${_VOX_C_RESET}"

        local interval=$(echo "scale=3; $onset - $prev_onset" | bc -l 2>/dev/null || echo 0)
        local label_row=$(( (idx % 2 == 0) ? start_row + 3 : start_row + 4 ))
        vox_app_move $label_row $((x_pos + 1))
        printf "${_VOX_C_DIM}%.0fms${_VOX_C_RESET}" "$(echo "$interval * 1000" | bc -l 2>/dev/null || echo 0)"

        prev_onset=$onset
        ((idx++))
        [[ $idx -gt 20 ]] && break
    done

    vox_app_move $((start_row + height - 1)) 1
    printf "${_VOX_C_GREEN}%d${_VOX_C_RESET} phoneme boundaries" "${#_VOX_APP_ONSETS[@]}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# FORMANTS VIEW
# ═══════════════════════════════════════════════════════════════════════════════

vox_app_render_formants() {
    local start_row=$((_VOX_APP_HEADER_HEIGHT))
    local height=$((_VOX_APP_CONTENT_HEIGHT))

    for ((i=0; i<height; i++)); do
        vox_app_clear_line $((start_row + i))
    done

    if [[ -z "$_VOX_APP_ANALYSIS_JSON" ]]; then
        vox_app_move $((start_row + height/2)) 2
        printf "${_VOX_C_DIM}No analysis loaded. Run analyze first.${_VOX_C_RESET}"
        return
    fi

    local f1=$(echo "$_VOX_APP_ANALYSIS_JSON" | jq -r '.analysis.formants.f1_energy // 0')
    local f2=$(echo "$_VOX_APP_ANALYSIS_JSON" | jq -r '.analysis.formants.f2_energy // 0')
    local f3=$(echo "$_VOX_APP_ANALYSIS_JSON" | jq -r '.analysis.formants.f3_energy // 0')
    local b80=$(echo "$_VOX_APP_ANALYSIS_JSON" | jq -r '.analysis.fundamental_bands.b80 // 0')
    local b120=$(echo "$_VOX_APP_ANALYSIS_JSON" | jq -r '.analysis.fundamental_bands.b120 // 0')
    local b180=$(echo "$_VOX_APP_ANALYSIS_JSON" | jq -r '.analysis.fundamental_bands.b180 // 0')
    local b270=$(echo "$_VOX_APP_ANALYSIS_JSON" | jq -r '.analysis.fundamental_bands.b270 // 0')
    local tilt=$(echo "$_VOX_APP_ANALYSIS_JSON" | jq -r '.analysis.spectral_tilt // 0')

    vox_app_move $start_row 2
    printf "${_VOX_C_BOLD}Spectral Analysis${_VOX_C_RESET}"

    vox_app_move $((start_row + 2)) 2
    printf "F0 Estimate: ${_VOX_C_GREEN}%.1f Hz${_VOX_C_RESET}" "$_VOX_APP_F0"

    vox_app_move $((start_row + 4)) 2
    printf "Fundamental: "
    local max_b=$(echo "$b80 $b120 $b180 $b270" | tr ' ' '\n' | sort -rn | head -1)
    [[ -z "$max_b" || "$max_b" == "0" ]] && max_b="0.0001"

    for band in "80:$b80" "120:$b120" "180:$b180" "270:$b270"; do
        local freq="${band%%:*}"
        local val="${band##*:}"
        local bar_len=$(echo "scale=0; $val / $max_b * 10" | bc -l 2>/dev/null || echo 1)
        [[ $bar_len -lt 1 ]] && bar_len=1
        printf "${_VOX_C_DIM}%3s${_VOX_C_RESET}${_VOX_C_CYAN}" "$freq"
        printf '%*s' "$bar_len" '' | tr ' ' '█'
        printf "${_VOX_C_RESET} "
    done

    vox_app_move $((start_row + 6)) 2
    printf "Formants:    "
    local max_f=$(echo "$f1 $f2 $f3" | tr ' ' '\n' | sort -rn | head -1)
    [[ -z "$max_f" || "$max_f" == "0" ]] && max_f="0.0001"

    for formant in "F1:$f1" "F2:$f2" "F3:$f3"; do
        local name="${formant%%:*}"
        local val="${formant##*:}"
        local bar_len=$(echo "scale=0; $val / $max_f * 10" | bc -l 2>/dev/null || echo 1)
        [[ $bar_len -lt 1 ]] && bar_len=1
        printf "${_VOX_C_DIM}%s${_VOX_C_RESET}${_VOX_C_YELLOW}" "$name"
        printf '%*s' "$bar_len" '' | tr ' ' '█'
        printf "${_VOX_C_RESET}  "
    done

    vox_app_move $((start_row + 8)) 2
    printf "Spectral Tilt: ${_VOX_C_MAGENTA}%.2f${_VOX_C_RESET}" "$tilt"
}

# ═══════════════════════════════════════════════════════════════════════════════
# PHONEME DETAIL VIEW
# ═══════════════════════════════════════════════════════════════════════════════

vox_app_render_phoneme() {
    local start_row=$((_VOX_APP_HEADER_HEIGHT))
    local height=$((_VOX_APP_CONTENT_HEIGHT))

    # Clear content area
    for ((i=0; i<height; i++)); do
        vox_app_clear_line $((start_row + i))
    done

    if ((_VOX_APP_PHONEME_COUNT == 0)); then
        vox_app_move $((start_row + height/2)) 2
        printf "${_VOX_C_DIM}No phonemes. Run analyze first.${_VOX_C_RESET}"
        return
    fi

    local idx=$_VOX_APP_PHONEME_IDX
    local ph_start="${_VOX_APP_PHONEME_STARTS[$idx]}"
    local ph_end="${_VOX_APP_PHONEME_ENDS[$idx]}"
    local ph_dur=$(echo "scale=3; $ph_end - $ph_start" | bc -l 2>/dev/null || echo "0")
    local ph_dur_ms=$(echo "scale=0; $ph_dur * 1000" | bc -l 2>/dev/null || echo "0")

    # Title
    vox_app_move $start_row 2
    printf "${_VOX_C_BOLD}Phoneme ${_VOX_C_GREEN}%d${_VOX_C_RESET}${_VOX_C_BOLD}/${_VOX_C_DIM}%d${_VOX_C_RESET}" \
        "$((idx + 1))" "$_VOX_APP_PHONEME_COUNT"

    # Time info
    vox_app_move $((start_row + 2)) 2
    printf "${_VOX_C_CYAN}Time:${_VOX_C_RESET}"
    vox_app_move $((start_row + 2)) 12
    printf "%.3fs → %.3fs" "$ph_start" "$ph_end"

    vox_app_move $((start_row + 3)) 2
    printf "${_VOX_C_CYAN}Duration:${_VOX_C_RESET}"
    vox_app_move $((start_row + 3)) 12
    printf "${_VOX_C_GREEN}%d${_VOX_C_RESET} ms (%.3fs)" "$ph_dur_ms" "$ph_dur"

    # Navigation context
    vox_app_move $((start_row + 5)) 2
    printf "${_VOX_C_CYAN}Context:${_VOX_C_RESET}"

    # Previous phoneme
    vox_app_move $((start_row + 6)) 4
    if ((idx > 0)); then
        local prev_dur=$(echo "scale=0; (${_VOX_APP_PHONEME_ENDS[$((idx-1))]} - ${_VOX_APP_PHONEME_STARTS[$((idx-1))]}) * 1000" | bc -l 2>/dev/null || echo "0")
        printf "${_VOX_C_DIM}← prev: %dms${_VOX_C_RESET}" "$prev_dur"
    else
        printf "${_VOX_C_DIM}← (start)${_VOX_C_RESET}"
    fi

    # Next phoneme
    vox_app_move $((start_row + 7)) 4
    if ((idx < _VOX_APP_PHONEME_COUNT - 1)); then
        local next_dur=$(echo "scale=0; (${_VOX_APP_PHONEME_ENDS[$((idx+1))]} - ${_VOX_APP_PHONEME_STARTS[$((idx+1))]}) * 1000" | bc -l 2>/dev/null || echo "0")
        printf "${_VOX_C_DIM}→ next: %dms${_VOX_C_RESET}" "$next_dur"
    else
        printf "${_VOX_C_DIM}→ (end)${_VOX_C_RESET}"
    fi

    # Visual duration bar
    vox_app_move $((start_row + 9)) 2
    printf "${_VOX_C_CYAN}Visual:${_VOX_C_RESET} "
    local bar_width=$(echo "scale=0; $ph_dur * 100" | bc -l 2>/dev/null || echo 5)
    ((bar_width < 1)) && bar_width=1
    ((bar_width > 40)) && bar_width=40
    printf "${_VOX_C_GREEN}"
    for ((b=0; b<bar_width; b++)); do printf "█"; done
    printf "${_VOX_C_RESET}"

    # Controls hint
    vox_app_move $((start_row + height - 2)) 2
    printf "${_VOX_C_DIM}h/l: prev/next │ space: play │ 0/\$: first/last${_VOX_C_RESET}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# HELP VIEW
# ═══════════════════════════════════════════════════════════════════════════════

vox_app_render_help() {
    local start_row=$((_VOX_APP_HEADER_HEIGHT))

    # Clear content area first
    local height=$((_VOX_APP_CONTENT_HEIGHT))
    for ((i=0; i<height; i++)); do
        vox_app_clear_line $((start_row + i))
    done

    vox_app_move $start_row 2
    printf "${_VOX_C_BOLD}VOX TUI Help${_VOX_C_RESET}"

    vox_app_move $((start_row + 2)) 2
    printf "${_VOX_C_CYAN}CLI Commands:${_VOX_C_RESET}"
    vox_app_move $((start_row + 3)) 4
    printf "load <file>  - Load audio file"
    vox_app_move $((start_row + 4)) 4
    printf "analyze      - Run analysis"
    vox_app_move $((start_row + 5)) 4
    printf "play         - Play audio"
    vox_app_move $((start_row + 6)) 4
    printf "goto <n>     - Jump to phoneme n"
    vox_app_move $((start_row + 7)) 4
    printf "/key         - Enter key mode"

    vox_app_move $((start_row + 9)) 2
    printf "${_VOX_C_CYAN}Key Mode - Navigation:${_VOX_C_RESET}"
    vox_app_move $((start_row + 10)) 4
    printf "h/l     - Prev/next phoneme"
    vox_app_move $((start_row + 11)) 4
    printf "H/L     - Jump 5 phonemes"
    vox_app_move $((start_row + 12)) 4
    printf "0/\$     - First/last phoneme"
    vox_app_move $((start_row + 13)) 4
    printf "g       - Goto phoneme number"

    vox_app_move $((start_row + 9)) 40
    printf "${_VOX_C_CYAN}Views & Actions:${_VOX_C_RESET}"
    vox_app_move $((start_row + 10)) 42
    printf "w/t/f/d - Wave/Time/Formants/Detail"
    vox_app_move $((start_row + 11)) 42
    printf "+/-     - Zoom in/out"
    vox_app_move $((start_row + 12)) 42
    printf "space   - Play current phoneme"
    vox_app_move $((start_row + 13)) 42
    printf "p/a/q   - Play all/Analyze/Quit"
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN RENDER
# ═══════════════════════════════════════════════════════════════════════════════

vox_app_render() {
    vox_app_render_header

    case "$_VOX_APP_VIEW" in
        wave)     vox_app_render_waveform ;;
        timeline) vox_app_render_timeline ;;
        formants) vox_app_render_formants ;;
        phoneme)  vox_app_render_phoneme ;;
        help)     vox_app_render_help ;;
    esac

    vox_app_render_footer
}

# ═══════════════════════════════════════════════════════════════════════════════
# COMMANDS
# ═══════════════════════════════════════════════════════════════════════════════

vox_app_load() {
    local file="$1"
    [[ ! -f "$file" ]] && { echo "File not found: $file"; return 1; }

    _VOX_APP_AUDIO_FILE="$file"
    _VOX_APP_ANALYSIS_JSON=""
    _VOX_APP_ONSETS=()
    _VOX_APP_F0=0
    _VOX_APP_DURATION=0

    echo "Loaded: $file"
    vox_app_render
}

vox_app_analyze() {
    [[ -z "$_VOX_APP_AUDIO_FILE" ]] && { echo "No audio file loaded"; return 1; }

    echo "Analyzing..."
    _VOX_APP_ANALYSIS_JSON=$(vox_analyze "$_VOX_APP_AUDIO_FILE" 2>/dev/null)
    [[ -z "$_VOX_APP_ANALYSIS_JSON" ]] && { echo "Analysis failed"; return 1; }

    _VOX_APP_F0=$(echo "$_VOX_APP_ANALYSIS_JSON" | jq -r '.analysis.f0_estimate_hz // 0')
    _VOX_APP_DURATION=$(echo "$_VOX_APP_ANALYSIS_JSON" | jq -r '.duration_sec // 0')

    # Parse onset times
    _VOX_APP_ONSETS=()
    while read -r onset; do
        [[ -n "$onset" ]] && _VOX_APP_ONSETS+=("$onset")
    done < <(echo "$_VOX_APP_ANALYSIS_JSON" | jq -r '.analysis.onsets.times[]? // empty')

    # Build phoneme segments from onsets
    _VOX_APP_PHONEME_STARTS=()
    _VOX_APP_PHONEME_ENDS=()
    _VOX_APP_PHONEME_COUNT=${#_VOX_APP_ONSETS[@]}
    _VOX_APP_PHONEME_IDX=0

    for ((i=0; i<${#_VOX_APP_ONSETS[@]}; i++)); do
        _VOX_APP_PHONEME_STARTS+=("${_VOX_APP_ONSETS[$i]}")
        if ((i + 1 < ${#_VOX_APP_ONSETS[@]})); then
            _VOX_APP_PHONEME_ENDS+=("${_VOX_APP_ONSETS[$((i+1))]}")
        else
            _VOX_APP_PHONEME_ENDS+=("$_VOX_APP_DURATION")
        fi
    done

    echo "Done: F0=${_VOX_APP_F0}Hz, ${_VOX_APP_PHONEME_COUNT} phonemes"
    vox_app_render
}

vox_app_play() {
    [[ -z "$_VOX_APP_AUDIO_FILE" ]] && { echo "No audio file"; return 1; }
    vox_play_audio "$_VOX_APP_AUDIO_FILE"
}

# ═══════════════════════════════════════════════════════════════════════════════
# PHONEME NAVIGATION
# ═══════════════════════════════════════════════════════════════════════════════

# Move to previous phoneme
vox_app_phoneme_prev() {
    ((_VOX_APP_PHONEME_IDX > 0)) && ((_VOX_APP_PHONEME_IDX--))
}

# Move to next phoneme
vox_app_phoneme_next() {
    ((_VOX_APP_PHONEME_IDX < _VOX_APP_PHONEME_COUNT - 1)) && ((_VOX_APP_PHONEME_IDX++))
}

# Jump by N phonemes (positive=forward, negative=backward)
vox_app_phoneme_jump() {
    local delta="$1"
    local new_idx=$((_VOX_APP_PHONEME_IDX + delta))

    # Clamp to valid range
    (( new_idx < 0 )) && new_idx=0
    (( new_idx >= _VOX_APP_PHONEME_COUNT )) && new_idx=$((_VOX_APP_PHONEME_COUNT - 1))
    (( _VOX_APP_PHONEME_COUNT == 0 )) && new_idx=0

    _VOX_APP_PHONEME_IDX=$new_idx
}

# Go to specific phoneme by index
vox_app_phoneme_goto() {
    local idx="$1"
    [[ ! "$idx" =~ ^[0-9]+$ ]] && return 1

    (( idx >= _VOX_APP_PHONEME_COUNT )) && idx=$((_VOX_APP_PHONEME_COUNT - 1))
    (( idx < 0 )) && idx=0

    _VOX_APP_PHONEME_IDX=$idx
}

# Prompt user for phoneme number (in key mode)
vox_app_prompt_goto() {
    local footer_start=$((_VOX_APP_HEIGHT - _VOX_APP_FOOTER_HEIGHT))
    local prompt_row=$((footer_start + 3))

    vox_app_move $prompt_row 0
    printf "${_VOX_C_YELLOW}goto phoneme:${_VOX_C_RESET} "
    tput el
    tput cnorm  # Show cursor

    local num
    read -r num </dev/tty
    tput civis  # Hide cursor

    if [[ "$num" =~ ^[0-9]+$ ]]; then
        vox_app_phoneme_goto "$num"
    fi
    vox_app_render
}

# Play current phoneme segment only
vox_app_play_phoneme() {
    [[ -z "$_VOX_APP_AUDIO_FILE" ]] && { echo "No audio file"; return 1; }
    ((_VOX_APP_PHONEME_COUNT == 0)) && { echo "No phonemes"; return 1; }

    local start="${_VOX_APP_PHONEME_STARTS[$_VOX_APP_PHONEME_IDX]}"
    local end="${_VOX_APP_PHONEME_ENDS[$_VOX_APP_PHONEME_IDX]}"
    local duration=$(echo "$end - $start" | bc -l 2>/dev/null || echo "0.1")

    # Use afplay with -t (time) option on macOS
    if command -v afplay &>/dev/null; then
        afplay -t "$duration" --leadin "$start" "$_VOX_APP_AUDIO_FILE" 2>/dev/null &
    elif command -v ffplay &>/dev/null; then
        ffplay -nodisp -autoexit -ss "$start" -t "$duration" "$_VOX_APP_AUDIO_FILE" 2>/dev/null &
    fi
}

# Get current phoneme info as string
vox_app_phoneme_info() {
    ((_VOX_APP_PHONEME_COUNT == 0)) && { echo "no phonemes"; return; }

    local start="${_VOX_APP_PHONEME_STARTS[$_VOX_APP_PHONEME_IDX]}"
    local end="${_VOX_APP_PHONEME_ENDS[$_VOX_APP_PHONEME_IDX]}"
    local dur=$(echo "scale=0; ($end - $start) * 1000" | bc -l 2>/dev/null || echo "0")

    printf "%d/%d [%.3f-%.3f] %dms" \
        "$((_VOX_APP_PHONEME_IDX + 1))" \
        "$_VOX_APP_PHONEME_COUNT" \
        "$start" "$end" "$dur"
}

# ═══════════════════════════════════════════════════════════════════════════════
# INPUT HANDLING
# ═══════════════════════════════════════════════════════════════════════════════

# Read a single key, handling escape sequences
vox_app_read_key() {
    local key
    IFS= read -rsn1 key </dev/tty

    # Check for escape sequence
    if [[ "$key" == $'\e' ]]; then
        # Read potential escape sequence (non-blocking)
        local seq
        read -rsn1 -t 0.01 seq </dev/tty 2>/dev/null || true
        if [[ "$seq" == "[" ]]; then
            read -rsn1 seq </dev/tty 2>/dev/null || true
            case "$seq" in
                A) echo "UP" ;;
                B) echo "DOWN" ;;
                C) echo "RIGHT" ;;
                D) echo "LEFT" ;;
                *) echo "ESC" ;;
            esac
            return
        fi
        echo "ESC"
        return
    fi

    echo "$key"
}

vox_app_handle_key() {
    local key="$1"
    case "$key" in
        ESC)    _VOX_APP_MODE="cli"; vox_app_render ;;
        # Pan with arrows
        LEFT)   ((_VOX_APP_OFFSET > 0)) && ((_VOX_APP_OFFSET -= 10)); vox_app_render ;;
        RIGHT)  ((_VOX_APP_OFFSET += 10)); vox_app_render ;;
        # Zoom with up/down or +/-
        UP)     ((_VOX_APP_ZOOM < 8)) && ((_VOX_APP_ZOOM *= 2)); vox_app_render ;;
        DOWN)   ((_VOX_APP_ZOOM > 1)) && ((_VOX_APP_ZOOM /= 2)); vox_app_render ;;
        +|=)    ((_VOX_APP_ZOOM < 8)) && ((_VOX_APP_ZOOM *= 2)); vox_app_render ;;
        -|_)    ((_VOX_APP_ZOOM > 1)) && ((_VOX_APP_ZOOM /= 2)); vox_app_render ;;
        # Phoneme navigation (vim-style: h/l horizontal, j/k also work)
        h|k)    vox_app_phoneme_prev; vox_app_render ;;
        l|j)    vox_app_phoneme_next; vox_app_render ;;
        H|K)    vox_app_phoneme_jump -5; vox_app_render ;;  # Jump 5 back
        L|J)    vox_app_phoneme_jump 5; vox_app_render ;;   # Jump 5 forward
        0)      _VOX_APP_PHONEME_IDX=0; vox_app_render ;;   # First phoneme
        '$')    ((_VOX_APP_PHONEME_COUNT > 0)) && _VOX_APP_PHONEME_IDX=$((_VOX_APP_PHONEME_COUNT - 1)); vox_app_render ;;  # Last
        g)      vox_app_prompt_goto ;;  # Prompt for phoneme number
        # Views
        w|W)    _VOX_APP_VIEW="wave"; vox_app_render ;;
        t|T)    _VOX_APP_VIEW="timeline"; vox_app_render ;;
        f|F)    _VOX_APP_VIEW="formants"; vox_app_render ;;
        d|D)    _VOX_APP_VIEW="phoneme"; vox_app_render ;;  # Detail view
        '?')    _VOX_APP_VIEW="help"; vox_app_render ;;
        # Actions
        p|P)    vox_app_play ;;
        ' ')    vox_app_play_phoneme ;;  # Space plays current phoneme
        a|A)    vox_app_analyze ;;
        q|Q)    return 1 ;;
        r|R)    vox_app_render ;;  # Refresh
    esac
    return 0
}

vox_app_handle_cli() {
    local input="$1"

    # Strip escape sequences and control chars
    input=$(echo "$input" | sed 's/\x1b\[[0-9;]*[A-Za-z]//g; s/\^[\[\[A-Z]//g')
    input="${input//[[:cntrl:]]/}"

    [[ -z "$input" ]] && { vox_app_render; return 0; }

    local cmd="${input%% *}"
    local args="${input#* }"
    [[ "$args" == "$input" ]] && args=""

    case "$cmd" in
        load|l)     vox_app_load "$args" ;;
        analyze|an) vox_app_analyze ;;
        play|p)     vox_app_play ;;
        zoom|z)
            [[ "$args" =~ ^[1248]$ ]] && { _VOX_APP_ZOOM=$args; vox_app_render; } || echo "Zoom: 1,2,4,8"
            ;;
        goto|g)
            if [[ "$args" =~ ^[0-9]+$ ]]; then
                vox_app_phoneme_goto "$args"
                vox_app_render
            else
                echo "Usage: goto <phoneme_number>"
            fi
            ;;
        next|n)     vox_app_phoneme_next; vox_app_render ;;
        prev)       vox_app_phoneme_prev; vox_app_render ;;
        view|v)
            case "$args" in
                wave|w)     _VOX_APP_VIEW="wave" ;;
                timeline|t) _VOX_APP_VIEW="timeline" ;;
                formants|f) _VOX_APP_VIEW="formants" ;;
                phoneme|d)  _VOX_APP_VIEW="phoneme" ;;
                help|h)     _VOX_APP_VIEW="help" ;;
            esac
            vox_app_render
            ;;
        /key|key)   _VOX_APP_MODE="key"; vox_app_render ;;
        quit|q|exit) return 1 ;;
        help|h|'?') _VOX_APP_VIEW="help"; vox_app_render ;;
        "")         vox_app_render ;;
        *)          echo "Unknown: $cmd" ;;
    esac
    return 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

vox_app_main() {
    local initial_file="$1"

    vox_app_init

    if [[ -n "$initial_file" ]]; then
        vox_app_load "$initial_file"
        vox_app_analyze
    fi

    vox_app_render

    while true; do
        local footer_start=$((_VOX_APP_HEIGHT - _VOX_APP_FOOTER_HEIGHT))
        local prompt_row=$((footer_start + 3))

        if [[ "$_VOX_APP_MODE" == "key" ]]; then
            vox_app_move $prompt_row 0
            printf "${_VOX_C_GREEN}▶${_VOX_C_RESET} key mode (ESC=cli, q=quit)"
            tput el

            local key
            key=$(vox_app_read_key)
            vox_app_handle_key "$key" || break
        else
            vox_app_move $prompt_row 0
            printf "${_VOX_C_CYAN}vox>${_VOX_C_RESET} "
            tput el
            tput cnorm

            local input
            IFS= read -re input </dev/tty  # -e enables readline editing
            tput civis

            vox_app_handle_cli "$input" || break
        fi
    done

    vox_app_cleanup
}

# Entry point
[[ "${BASH_SOURCE[0]}" == "${0}" ]] && vox_app_main "$@"

export -f vox_app_main
