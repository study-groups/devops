#!/usr/bin/env bash
# tui.sh - Tetra TUI with context picker
# Left/Right: switch slots | Up/Down: cycle values | :: command mode | q: quit

: "${TETRA_SRC:?TETRA_SRC must be set}"

TUI_DIR="$TETRA_SRC/bash/tetra/interfaces/tui"
TUI_CORE="$TUI_DIR/tui-core"
OSC_LISTEN="$TETRA_SRC/bash/midi/osc_listen"

# Build C core if missing
[[ ! -x "$TUI_CORE" ]] && {
    echo "Building tui-core..."
    cc -O2 -o "$TUI_CORE" "$TUI_DIR/tui-core.c" || {
        echo "Failed to build tui-core" >&2
        exit 1
    }
}

# =============================================================================
# STATE
# =============================================================================

declare -g TUI_WIDTH=80
declare -g TUI_HEIGHT=24
declare -g TUI_SPLIT=12

# Context picker: slot 0=org, 1=mod, 2=env
declare -g CTX_SLOT=1  # Start on mod (most common)
declare -g TUI_ORG_IDX=0
declare -g TUI_MOD_IDX=0
declare -g TUI_ENV_IDX=0
declare -ga TUI_ORGS=()
declare -ga TUI_MODS=()
declare -ga TUI_ENVS=("local" "dev" "staging" "prod")

# Colors: org=magenta, mod=yellow, env=blue
declare -g COLOR_ORG=35
declare -g COLOR_MOD=33
declare -g COLOR_ENV=34

# MIDI state
declare -gA MIDI_CC_VAL=()

# CLI state
declare -g CLI_MODE="normal"
declare -g CLI_INPUT=""
declare -ga CLI_COMPLETIONS=()
declare -g CLI_COMP_IDX=0
declare -g DROPDOWN_OPEN=0
declare -g DROPDOWN_IDX=0

# Output
declare -g TUI_CONTENT=""
declare -g TUI_LAST_OUTPUT=""
declare -g TUI_LAST_CMD=""

# Build org list
for d in ~/tetra/orgs/*/; do
    [[ -d "$d" && ! -L "${d%/}" ]] || continue
    TUI_ORGS+=("$(basename "$d")")
done
IFS=$'\n' TUI_ORGS=($(sort <<<"${TUI_ORGS[*]}")); unset IFS
[[ ${#TUI_ORGS[@]} -eq 0 ]] && TUI_ORGS=("none")

# Build module list
for d in "$TETRA_SRC/bash"/*/; do
    [[ -d "$d" ]] || continue
    name=$(basename "$d")
    [[ "$name" == "tetra" || "$name" == "wip" ]] && continue
    [[ -f "$d/${name}.sh" || -f "$d/includes.sh" ]] && TUI_MODS+=("$name")
done
IFS=$'\n' TUI_MODS=($(sort <<<"${TUI_MODS[*]}")); unset IFS

# =============================================================================
# HELPERS
# =============================================================================

_unescape_key() {
    local s="$1" result="" i=0 len=${#s}
    while ((i < len)); do
        local c="${s:i:1}"
        if [[ "$c" == "\\" && $((i+1)) -lt $len ]]; then
            local next="${s:i+1:1}"
            case "$next" in
                n) result+=$'\n'; ((i+=2)) ;;
                r) result+=$'\r'; ((i+=2)) ;;
                "\\") result+="\\"; ((i+=2)) ;;
                x) [[ $((i+3)) -lt $len ]] && { result+=$(printf "\\x${s:i+2:2}"); ((i+=4)); } || { result+="$c"; ((i++)); } ;;
                *) result+="$c"; ((i++)) ;;
            esac
        else
            result+="$c"; ((i++))
        fi
    done
    printf '%s' "$result"
}

ctx_slot_up() {
    case $CTX_SLOT in
        0) ((TUI_ORG_IDX = (TUI_ORG_IDX - 1 + ${#TUI_ORGS[@]}) % ${#TUI_ORGS[@]})) ;;
        1) ((TUI_MOD_IDX = (TUI_MOD_IDX - 1 + ${#TUI_MODS[@]}) % ${#TUI_MODS[@]})); tui_load_module ;;
        2) ((TUI_ENV_IDX = (TUI_ENV_IDX - 1 + ${#TUI_ENVS[@]}) % ${#TUI_ENVS[@]})) ;;
    esac
}

ctx_slot_down() {
    case $CTX_SLOT in
        0) ((TUI_ORG_IDX = (TUI_ORG_IDX + 1) % ${#TUI_ORGS[@]})) ;;
        1) ((TUI_MOD_IDX = (TUI_MOD_IDX + 1) % ${#TUI_MODS[@]})); tui_load_module ;;
        2) ((TUI_ENV_IDX = (TUI_ENV_IDX + 1) % ${#TUI_ENVS[@]})) ;;
    esac
}

tui_load_module() {
    local mod="${TUI_MODS[$TUI_MOD_IDX]:-}"
    [[ -z "$mod" ]] && return 0
    declare -f "$mod" &>/dev/null && return 0
    if declare -f tmod &>/dev/null; then
        tmod load "$mod" 2>/dev/null || true
    else
        local mod_file="$TETRA_SRC/bash/$mod/$mod.sh"
        [[ -f "$mod_file" ]] && source "$mod_file" 2>/dev/null || true
    fi
}

# =============================================================================
# COMPLETIONS
# =============================================================================

get_completions() {
    local mod="${TUI_MODS[$TUI_MOD_IDX]:-}"
    local prefix="$1"
    local -a completions=()

    if [[ -z "$mod" ]]; then
        for m in "${TUI_MODS[@]}"; do
            [[ -z "$prefix" || "$m" == "$prefix"* ]] && completions+=("$m")
        done
    else
        local var="${mod^^}_COMMANDS"
        if declare -p "$var" &>/dev/null 2>&1; then
            local -n cmd_array="$var"
            for cmd in "${cmd_array[@]}"; do
                [[ -z "$prefix" || "$cmd" == "$prefix"* ]] && completions+=("$cmd")
            done
        fi
        if [[ ${#completions[@]} -eq 0 ]]; then
            local mod_file="$TETRA_SRC/bash/$mod/$mod.sh"
            [[ -f "$mod_file" ]] && while IFS= read -r cmd; do
                cmd="${cmd%%)*}"; cmd="${cmd%%|*}"; cmd="${cmd// /}"
                [[ -z "$cmd" || "$cmd" == *"*"* || "$cmd" == "-"* ]] && continue
                [[ -z "$prefix" || "$cmd" == "$prefix"* ]] && completions+=("$cmd")
            done < <(grep -E '^\s+[a-z][a-z0-9_-]*(\|[a-z0-9_-]+)*\)' "$mod_file" 2>/dev/null | sed 's/^[[:space:]]*//')
        fi
    fi
    IFS=$'\n' CLI_COMPLETIONS=($(printf '%s\n' "${completions[@]}" | sort -u)); unset IFS
}

# =============================================================================
# COMMANDS
# =============================================================================

execute_command() {
    local input="$1"
    local mod="${TUI_MODS[$TUI_MOD_IDX]:-}"
    local cmd="${input%% *}"
    local args="${input#* }"; [[ "$args" == "$input" ]] && args=""

    case "$cmd" in
        clear|cls) TUI_CONTENT=""; return ;;
        help|h|\?) TUI_CONTENT="Arrows: navigate ctx | :: command | q: quit"; return ;;
    esac

    TUI_LAST_CMD="$mod $input"
    if declare -f "$mod" &>/dev/null; then
        TUI_CONTENT=$("$mod" $cmd $args 2>&1)
    else
        TUI_CONTENT="Module '$mod' not loaded"
    fi
    TUI_LAST_OUTPUT="$TUI_CONTENT"
}

# =============================================================================
# KEYBOARD
# =============================================================================

handle_keyboard() {
    local key=$(_unescape_key "$1")

    if [[ "$CLI_MODE" == "command" ]]; then
        case "$key" in
            $'\e') CLI_MODE="normal"; CLI_INPUT=""; DROPDOWN_OPEN=0 ;;
            $'\n'|$'\r')
                [[ $DROPDOWN_OPEN -eq 1 && ${#CLI_COMPLETIONS[@]} -gt 0 ]] && CLI_INPUT="${CLI_COMPLETIONS[$DROPDOWN_IDX]}"
                [[ -n "$CLI_INPUT" ]] && execute_command "$CLI_INPUT"
                CLI_MODE="normal"; CLI_INPUT=""; DROPDOWN_OPEN=0
                ;;
            $'\t')
                get_completions "$CLI_INPUT"
                [[ ${#CLI_COMPLETIONS[@]} -gt 0 ]] && { DROPDOWN_OPEN=1; ((DROPDOWN_IDX = (DROPDOWN_IDX + 1) % ${#CLI_COMPLETIONS[@]})); }
                ;;
            $'\e[A'|$'\eOA') [[ $DROPDOWN_OPEN -eq 1 ]] && ((DROPDOWN_IDX = (DROPDOWN_IDX - 1 + ${#CLI_COMPLETIONS[@]}) % ${#CLI_COMPLETIONS[@]})) ;;
            $'\e[B'|$'\eOB') [[ $DROPDOWN_OPEN -eq 1 ]] && ((DROPDOWN_IDX = (DROPDOWN_IDX + 1) % ${#CLI_COMPLETIONS[@]})) ;;
            $'\x7f'|$'\b') [[ -n "$CLI_INPUT" ]] && { CLI_INPUT="${CLI_INPUT%?}"; get_completions "$CLI_INPUT"; DROPDOWN_IDX=0; } ;;
            *) [[ ${#key} -eq 1 && "$key" =~ [[:print:]] ]] && { CLI_INPUT+="$key"; get_completions "$CLI_INPUT"; DROPDOWN_IDX=0; DROPDOWN_OPEN=1; } ;;
        esac
        return
    fi

    # Normal mode - ctx picker navigation
    case "$key" in
        $'\e[C'|$'\eOC') ((CTX_SLOT = (CTX_SLOT + 1) % 3)) ;;      # Right
        $'\e[D'|$'\eOD') ((CTX_SLOT = (CTX_SLOT + 2) % 3)) ;;      # Left
        $'\e[A'|$'\eOA') ctx_slot_up ;;                             # Up
        $'\e[B'|$'\eOB') ctx_slot_down ;;                           # Down
        :) CLI_MODE="command"; CLI_INPUT=""; get_completions "" ;; # Command mode
    esac
}

# =============================================================================
# MIDI
# =============================================================================

handle_midi() {
    local line="$1"
    [[ "$line" =~ raw[[:space:]]+CC[[:space:]]+([0-9]+)[[:space:]]+([0-9]+)[[:space:]]+([0-9]+) ]] || return
    local cc="${BASH_REMATCH[2]}" val="${BASH_REMATCH[3]}"
    MIDI_CC_VAL[$cc]="$val"
    case "$cc" in
        30) ((${#TUI_ORGS[@]} > 0)) && TUI_ORG_IDX=$(( val * (${#TUI_ORGS[@]} - 1) / 127 )) ;;
        31) ((${#TUI_MODS[@]} > 0)) && { TUI_MOD_IDX=$(( val * (${#TUI_MODS[@]} - 1) / 127 )); tui_load_module; } ;;
        32) ((${#TUI_ENVS[@]} > 0)) && TUI_ENV_IDX=$(( val * (${#TUI_ENVS[@]} - 1) / 127 )) ;;
        40) TUI_SPLIT=$(( 5 + (val * (TUI_HEIGHT - 8) / 127) )) ;;
    esac
}

handle_resize() {
    [[ "$1" =~ ^([0-9]+)x([0-9]+)$ ]] && { TUI_WIDTH="${BASH_REMATCH[1]}"; TUI_HEIGHT="${BASH_REMATCH[2]}"; TUI_SPLIT=$((TUI_HEIGHT / 2)); }
}

# =============================================================================
# RENDER
# =============================================================================

render() {
    local org="${TUI_ORGS[$TUI_ORG_IDX]:-none}"
    local mod="${TUI_MODS[$TUI_MOD_IDX]:-tetra}"
    local env="${TUI_ENVS[$TUI_ENV_IDX]:-local}"

    printf '\e[H\e[J'

    # Row 1: Title
    printf '\e[1;1H\e[1;36m⁘ Tetra\e[0m'

    # Row 2: Context picker with current slot bold
    printf '\e[2;1H'
    # Org
    [[ $CTX_SLOT -eq 0 ]] && printf '\e[1;%dm▶%s◀\e[0m' "$COLOR_ORG" "$org" || printf '\e[%dm %s \e[0m' "$COLOR_ORG" "$org"
    printf '\e[90m:\e[0m'
    # Mod
    [[ $CTX_SLOT -eq 1 ]] && printf '\e[1;%dm▶%s◀\e[0m' "$COLOR_MOD" "$mod" || printf '\e[%dm %s \e[0m' "$COLOR_MOD" "$mod"
    printf '\e[90m:\e[0m'
    # Env
    [[ $CTX_SLOT -eq 2 ]] && printf '\e[1;%dm▶%s◀\e[0m' "$COLOR_ENV" "$env" || printf '\e[%dm %s \e[0m' "$COLOR_ENV" "$env"

    # Row 3: MIDI CCs if any
    local cc_str=""
    for cc in 30 31 32 40; do
        [[ -n "${MIDI_CC_VAL[$cc]:-}" ]] && cc_str+="\e[90mCC$cc:\e[32m${MIDI_CC_VAL[$cc]} \e[0m"
    done
    [[ -n "$cc_str" ]] && printf '\e[3;1H%b' "$cc_str"

    # Content area
    local content_start=4
    local content_end=$((TUI_SPLIT - 1))
    for ((row=content_start; row<=content_end; row++)); do printf '\e[%d;1H\e[K' "$row"; done

    if [[ -n "$TUI_CONTENT" ]]; then
        local line_num=0 content_lines=$((content_end - content_start + 1))
        while IFS= read -r line && ((line_num < content_lines)); do
            printf '\e[%d;1H%s' "$((content_start + line_num))" "${line:0:$((TUI_WIDTH-1))}"
            ((line_num++))
        done <<< "$TUI_CONTENT"
    fi

    # Separator
    printf '\e[%d;1H\e[90m' "$TUI_SPLIT"
    printf '─%.0s' $(seq 1 $TUI_WIDTH)
    printf '\e[0m'

    # CLI
    local cli_row=$((TUI_SPLIT + 1))
    if [[ "$CLI_MODE" == "command" ]]; then
        printf '\e[%d;1H\e[K\e[90m%s:\e[0m%s\e[7m \e[0m' "$cli_row" "$mod" "$CLI_INPUT"
        # Dropdown
        if [[ $DROPDOWN_OPEN -eq 1 && ${#CLI_COMPLETIONS[@]} -gt 0 ]]; then
            local dr=$((cli_row + 1)) max=5
            for ((i=0; i<${#CLI_COMPLETIONS[@]} && i<max; i++)); do
                [[ $i -eq $DROPDOWN_IDX ]] && printf '\e[%d;1H\e[1;33m▶ %s\e[0m' "$dr" "${CLI_COMPLETIONS[$i]}" \
                                           || printf '\e[%d;1H  \e[90m%s\e[0m' "$dr" "${CLI_COMPLETIONS[$i]}"
                ((dr++))
            done
        fi
    else
        printf '\e[%d;1H\e[90m←→:slot ↑↓:value ::cmd q:quit\e[0m' "$cli_row"
    fi
}

# =============================================================================
# MAIN
# =============================================================================

tetra_tui() {
    local use_midi=false
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --midi|-m) use_midi=true ;;
        esac
        shift
    done

    [[ ! -x "$TUI_CORE" ]] && { echo "tui-core not found"; return 1; }

    local midi_arg=""
    $use_midi && [[ -x "$OSC_LISTEN" ]] && midi_arg="$OSC_LISTEN"

    exec 9<>/dev/tty
    coproc TUI_COPROC { TUI_TTY_FD=9 "$TUI_CORE" $midi_arg 2>/dev/null; }

    [[ -z "${TUI_COPROC_PID:-}" ]] && { echo "Failed to start tui-core" >&2; return 1; }

    trap 'kill $TUI_COPROC_PID 2>/dev/null; wait $TUI_COPROC_PID 2>/dev/null' EXIT

    local last_state=""
    while IFS= read -r line <&${TUI_COPROC[0]}; do
        local type="${line%%:*}" data="${line#*:}"
        case "$type" in
            S) handle_resize "$data"; render ;;
            K) handle_keyboard "$data" ;;
            M) handle_midi "$data" ;;
            Q) break ;;
        esac
        local cur_state="$CTX_SLOT:$TUI_ORG_IDX:$TUI_MOD_IDX:$TUI_ENV_IDX:$CLI_MODE:$CLI_INPUT:$DROPDOWN_IDX"
        [[ "$cur_state" != "$last_state" ]] && { last_state="$cur_state"; render; }
    done

    trap - EXIT
}

[[ "${BASH_SOURCE[0]}" == "$0" ]] && tetra_tui "$@"
