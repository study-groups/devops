#!/usr/bin/env bash
# tcurses-tui.sh - Full screen TUI with C coprocess + context support
# Uses tui-core for terminal setup, keyboard, MIDI via osc_listen
# Honors TETRA_CTX_* env vars set by `tetra ctx`

: "${TETRA_SRC:?TETRA_SRC must be set}"

# Source context manager
source "$TETRA_SRC/bash/tetra/ctx.sh"

# Source tetra.sh for module system (if not already loaded)
if ! declare -f tmod &>/dev/null; then
    source ~/tetra/tetra.sh 2>/dev/null || true
fi

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

# Selection arrays for MIDI CC mapping
declare -g TUI_ORG_IDX=0
declare -g TUI_MOD_IDX=0
declare -g TUI_ENV_IDX=0
declare -ga TUI_ORGS=()
declare -ga TUI_MODS=()
declare -ga TUI_ENVS=("local" "dev" "staging" "prod")

# MIDI state
declare -ga MIDI_LOG=()
declare -g MIDI_LOG_MAX=20
declare -g MIDI_LAST_CC=""
declare -g MIDI_LAST_VAL=""
declare -gA MIDI_CC_VAL=()

# CLI state
declare -g CLI_MODE="normal"
declare -g CLI_INPUT=""
declare -g CLI_CURSOR=0
declare -ga CLI_COMPLETIONS=()
declare -g CLI_COMP_IDX=0

# Dropdown state
declare -g DROPDOWN_OPEN=0
declare -g DROPDOWN_IDX=0
declare -g DROPDOWN_SCROLL=0

# Output history (scratch pad)
declare -ga TUI_OUTPUT_HISTORY=()
declare -g TUI_LAST_OUTPUT=""
declare -g TUI_LAST_CMD=""
declare -g TUI_LAST_EXIT=0
declare -g TUI_OUTPUT_COUNT=0
declare -g TUI_CONTENT=""

# Build org list from ~/tetra/orgs/
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

# Initialize context from arrays if not already set
: "${TETRA_CTX_ORG:=${TUI_ORGS[0]:-none}}"
: "${TETRA_CTX_PROJECT:=${TUI_MODS[0]:-tetra}}"
: "${TETRA_CTX_TOPIC:=${TUI_ENVS[0]:-local}}"
export TETRA_CTX_ORG TETRA_CTX_PROJECT TETRA_CTX_TOPIC

# =============================================================================
# TAB COMPLETION
# =============================================================================

get_module_completions() {
    local mod="${TETRA_CTX_PROJECT:-}"
    local prefix="$1"
    local -a completions=()

    if [[ -z "$mod" ]]; then
        for m in "${TUI_MODS[@]}"; do
            [[ -z "$prefix" || "$m" == "$prefix"* ]] && completions+=("$m")
        done
        IFS=$'\n' CLI_COMPLETIONS=($(printf '%s\n' "${completions[@]}" | sort -u)); unset IFS
        return
    fi

    local var="${mod^^}_COMMANDS"
    if declare -p "$var" &>/dev/null; then
        local -n cmd_array="$var"
        for cmd in "${cmd_array[@]}"; do
            [[ -z "$prefix" || "$cmd" == "$prefix"* ]] && completions+=("$cmd")
        done
    fi

    if [[ ${#completions[@]} -eq 0 ]]; then
        local mod_file="$TETRA_SRC/bash/$mod/$mod.sh"
        if [[ -f "$mod_file" ]]; then
            while IFS= read -r cmd; do
                cmd="${cmd%%)*}"
                cmd="${cmd%%|*}"
                cmd="${cmd// /}"
                [[ -z "$cmd" ]] && continue
                [[ "$cmd" == *"*"* ]] && continue
                [[ "$cmd" == "-"* ]] && continue
                [[ -z "$prefix" || "$cmd" == "$prefix"* ]] && completions+=("$cmd")
            done < <(grep -E '^\s+[a-z][a-z0-9_-]*(\|[a-z0-9_-]+)*\)' "$mod_file" 2>/dev/null | sed 's/^[[:space:]]*//')
        fi
    fi

    if [[ ${#completions[@]} -eq 0 ]]; then
        completions=(help status list)
    fi

    IFS=$'\n' CLI_COMPLETIONS=($(printf '%s\n' "${completions[@]}" | sort -u)); unset IFS
}

complete_next() {
    [[ ${#CLI_COMPLETIONS[@]} -eq 0 ]] && return
    local comp="${CLI_COMPLETIONS[$CLI_COMP_IDX]}"
    CLI_INPUT="$comp"
    CLI_CURSOR=${#CLI_INPUT}
    ((CLI_COMP_IDX = (CLI_COMP_IDX + 1) % ${#CLI_COMPLETIONS[@]}))
}

# =============================================================================
# EVENT HANDLERS
# =============================================================================

_unescape_key() {
    local s="$1"
    local result=""
    local i=0
    local len=${#s}

    while ((i < len)); do
        local c="${s:i:1}"
        if [[ "$c" == "\\" && $((i+1)) -lt $len ]]; then
            local next="${s:i+1:1}"
            case "$next" in
                n) result+=$'\n'; ((i+=2)) ;;
                r) result+=$'\r'; ((i+=2)) ;;
                "\\") result+="\\"; ((i+=2)) ;;
                x)
                    if ((i+3 < len)); then
                        local hex="${s:i+2:2}"
                        result+=$(printf "\\x$hex")
                        ((i+=4))
                    else
                        result+="$c"; ((i++))
                    fi
                    ;;
                *) result+="$c"; ((i++)) ;;
            esac
        else
            result+="$c"
            ((i++))
        fi
    done
    printf '%s' "$result"
}

tui_load_module() {
    local mod="${TETRA_CTX_PROJECT:-}"
    [[ -z "$mod" ]] && return 0

    declare -f "$mod" &>/dev/null && return 0

    set +eu
    trap '' ERR

    if declare -f tmod &>/dev/null; then
        tmod load "$mod" 2>/dev/null || true
    else
        local mod_file="$TETRA_SRC/bash/$mod/$mod.sh"
        [[ -f "$mod_file" ]] && source "$mod_file" 2>/dev/null || true
    fi

    trap '_tui_error_handler $LINENO "$BASH_COMMAND"' ERR

    declare -f "$mod" &>/dev/null && MIDI_LOG+=("✓ $mod") || MIDI_LOG+=("✗ $mod")
    return 0
}

# Handle CC - updates TETRA_CTX_* vars
handle_cc() {
    local cc="$1" val="$2"

    local old_project="$TETRA_CTX_PROJECT"

    case "$cc" in
        30)  # Org selection -> TETRA_CTX_ORG
            if ((${#TUI_ORGS[@]} > 0)); then
                TUI_ORG_IDX=$(( val * (${#TUI_ORGS[@]} - 1) / 127 ))
                export TETRA_CTX_ORG="${TUI_ORGS[$TUI_ORG_IDX]}"
            fi
            ;;
        31)  # Module selection -> TETRA_CTX_PROJECT
            if ((${#TUI_MODS[@]} > 0)); then
                TUI_MOD_IDX=$(( val * (${#TUI_MODS[@]} - 1) / 127 ))
                export TETRA_CTX_PROJECT="${TUI_MODS[$TUI_MOD_IDX]}"
            fi
            ;;
        32)  # Env selection -> TETRA_CTX_TOPIC
            if ((${#TUI_ENVS[@]} > 0)); then
                TUI_ENV_IDX=$(( val * (${#TUI_ENVS[@]} - 1) / 127 ))
                export TETRA_CTX_TOPIC="${TUI_ENVS[$TUI_ENV_IDX]}"
            fi
            ;;
        40)  # Split row
            local min=5 max=$((TUI_HEIGHT - 3))
            TUI_SPLIT=$(( min + (val * (max - min) / 127) ))
            ;;
    esac

    # Auto-load module if changed
    if [[ $cc -eq 31 && "$TETRA_CTX_PROJECT" != "$old_project" ]]; then
        tui_load_module || true
    fi
    return 0
}

handle_keyboard() {
    local escaped="$1"
    local key=$(_unescape_key "$escaped")

    if [[ "$CLI_MODE" == "command" ]]; then
        case "$key" in
            $'\e')
                CLI_MODE="normal"
                CLI_INPUT=""
                CLI_COMPLETIONS=()
                DROPDOWN_OPEN=0
                ;;
            $'\n'|$'\r')
                if [[ $DROPDOWN_OPEN -eq 1 && ${#CLI_COMPLETIONS[@]} -gt 0 ]]; then
                    CLI_INPUT="${CLI_COMPLETIONS[$DROPDOWN_IDX]}"
                    DROPDOWN_OPEN=0
                fi
                if [[ -n "$CLI_INPUT" ]]; then
                    execute_cli_command "$CLI_INPUT"
                fi
                CLI_MODE="normal"
                CLI_INPUT=""
                CLI_COMPLETIONS=()
                DROPDOWN_OPEN=0
                ;;
            $'\t')
                get_module_completions "$CLI_INPUT"
                if [[ ${#CLI_COMPLETIONS[@]} -gt 0 ]]; then
                    if [[ $DROPDOWN_OPEN -eq 0 ]]; then
                        DROPDOWN_OPEN=1
                        DROPDOWN_IDX=0
                        DROPDOWN_SCROLL=0
                    else
                        ((DROPDOWN_IDX = (DROPDOWN_IDX + 1) % ${#CLI_COMPLETIONS[@]}))
                    fi
                fi
                ;;
            $'\e[A'|$'\eOA')
                if [[ $DROPDOWN_OPEN -eq 1 && ${#CLI_COMPLETIONS[@]} -gt 0 ]]; then
                    ((DROPDOWN_IDX = (DROPDOWN_IDX - 1 + ${#CLI_COMPLETIONS[@]}) % ${#CLI_COMPLETIONS[@]}))
                fi
                ;;
            $'\e[B'|$'\eOB')
                if [[ $DROPDOWN_OPEN -eq 1 && ${#CLI_COMPLETIONS[@]} -gt 0 ]]; then
                    ((DROPDOWN_IDX = (DROPDOWN_IDX + 1) % ${#CLI_COMPLETIONS[@]}))
                fi
                ;;
            $'\x7f'|$'\b')
                if [[ -n "$CLI_INPUT" ]]; then
                    CLI_INPUT="${CLI_INPUT%?}"
                    get_module_completions "$CLI_INPUT"
                    DROPDOWN_IDX=0
                    DROPDOWN_SCROLL=0
                fi
                ;;
            *)
                if [[ ${#key} -eq 1 && "$key" =~ [[:print:]] ]]; then
                    CLI_INPUT+="$key"
                    get_module_completions "$CLI_INPUT"
                    DROPDOWN_IDX=0
                    DROPDOWN_SCROLL=0
                    [[ ${#CLI_COMPLETIONS[@]} -gt 0 ]] && DROPDOWN_OPEN=1
                fi
                ;;
        esac
        return
    fi

    # Normal mode
    case "$key" in
        :)
            CLI_MODE="command"
            CLI_INPUT=""
            CLI_COMPLETIONS=()
            CLI_COMP_IDX=0
            get_module_completions ""
            ;;
        $'\e[C')
            ((TUI_MOD_IDX = (TUI_MOD_IDX + 1) % ${#TUI_MODS[@]}))
            export TETRA_CTX_PROJECT="${TUI_MODS[$TUI_MOD_IDX]}"
            tui_load_module
            ;;
        $'\e[D')
            ((TUI_MOD_IDX = (TUI_MOD_IDX - 1 + ${#TUI_MODS[@]}) % ${#TUI_MODS[@]}))
            export TETRA_CTX_PROJECT="${TUI_MODS[$TUI_MOD_IDX]}"
            tui_load_module
            ;;
    esac
}

# =============================================================================
# COMMAND EXECUTION
# =============================================================================

tui_builtin_command() {
    local cmd="$1"
    shift
    case "$cmd" in
        history|hist)
            local out="Output History:\n"
            for i in "${!TUI_OUTPUT_HISTORY[@]}"; do
                local preview="${TUI_OUTPUT_HISTORY[$i]:0:60}"
                preview="${preview//$'\n'/ }"
                out+="\$$(($i+1)): $preview...\n"
            done
            TUI_CONTENT=$(echo -e "$out")
            return 0
            ;;
        clear|cls)
            TUI_CONTENT=""
            TUI_OUTPUT_HISTORY=()
            TUI_OUTPUT_COUNT=0
            return 0
            ;;
        ctx)
            TUI_CONTENT=$(tetra_ctx_show)
            return 0
            ;;
        vars)
            TUI_CONTENT=$(cat <<EOF
Variables:
  \$_  = last output (${#TUI_LAST_OUTPUT} chars)
  \$!  = $TUI_LAST_CMD
  \$?  = $TUI_LAST_EXIT
  \$1-\$${#TUI_OUTPUT_HISTORY[@]} = history outputs
Context:
  $(tetra_ctx_prompt)
EOF
            )
            return 0
            ;;
        recall)
            local num="${1:-1}"
            local idx=$((num - 1))
            if [[ $idx -ge 0 && $idx -lt ${#TUI_OUTPUT_HISTORY[@]} ]]; then
                TUI_CONTENT="${TUI_OUTPUT_HISTORY[$idx]}"
            else
                TUI_CONTENT="No output at index $num"
            fi
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

tui_expand_vars() {
    local input="$1"
    input="${input//\$_/$TUI_LAST_OUTPUT}"
    input="${input//\$!/$TUI_LAST_CMD}"
    input="${input//\$\?/$TUI_LAST_EXIT}"
    for i in {1..9}; do
        local idx=$((i - 1))
        if [[ $idx -lt ${#TUI_OUTPUT_HISTORY[@]} ]]; then
            input="${input//\$$i/${TUI_OUTPUT_HISTORY[$idx]}}"
        fi
    done
    echo "$input"
}

execute_cli_command() {
    local input="$1"
    local mod="${TETRA_CTX_PROJECT:-}"

    local cmd="${input%% *}"
    local args="${input#* }"
    [[ "$args" == "$input" ]] && args=""

    if tui_builtin_command "$cmd" $args; then
        return 0
    fi

    input=$(tui_expand_vars "$input")
    cmd="${input%% *}"
    args="${input#* }"
    [[ "$args" == "$input" ]] && args=""

    TUI_LAST_CMD="$mod $cmd $args"
    ((TUI_OUTPUT_COUNT++))

    local output=""
    local exit_code=0

    if declare -f "$mod" &>/dev/null; then
        output=$("$mod" $cmd $args 2>&1)
        exit_code=$?
    elif declare -f "${mod}_${cmd}" &>/dev/null; then
        output=$("${mod}_${cmd}" $args 2>&1)
        exit_code=$?
    else
        output="Unknown: $mod $cmd"
        exit_code=1
    fi

    TUI_LAST_OUTPUT="$output"
    TUI_LAST_EXIT=$exit_code
    TUI_OUTPUT_HISTORY+=("$output")

    if [[ ${#TUI_OUTPUT_HISTORY[@]} -gt 20 ]]; then
        TUI_OUTPUT_HISTORY=("${TUI_OUTPUT_HISTORY[@]:1}")
    fi

    local status_icon=$([[ $exit_code -eq 0 ]] && echo "✓" || echo "✗")
    MIDI_LOG+=("$status_icon [$TUI_OUTPUT_COUNT] $mod $cmd")

    TUI_CONTENT="$output"
}

handle_midi() {
    local line="$1"

    if [[ "$line" =~ raw[[:space:]]+CC[[:space:]]+([0-9]+)[[:space:]]+([0-9]+)[[:space:]]+([0-9]+) ]]; then
        local cc="${BASH_REMATCH[2]}"
        local val="${BASH_REMATCH[3]}"

        MIDI_LAST_CC="$cc"
        MIDI_LAST_VAL="$val"
        MIDI_CC_VAL[$cc]="$val"

        handle_cc "$cc" "$val"
    fi
    return 0
}

handle_resize() {
    local size="$1"
    if [[ "$size" =~ ^([0-9]+)x([0-9]+)$ ]]; then
        TUI_WIDTH="${BASH_REMATCH[1]}"
        TUI_HEIGHT="${BASH_REMATCH[2]}"
        TUI_SPLIT=$((TUI_HEIGHT / 2))
    fi
}

# =============================================================================
# RENDERING
# =============================================================================

render() {
    local org="${TETRA_CTX_ORG:-none}"
    local mod="${TETRA_CTX_PROJECT:-tetra}"
    local env="${TETRA_CTX_TOPIC:-local}"

    printf '\e[H\e[J'

    # Row 1: Title
    printf '\e[1;1H\e[1;36m⁘ Tetra Control Center\e[0m'

    # Row 2: Context using tetra_ctx_prompt
    printf '\e[2;1H%s' "$(tetra_ctx_prompt)"

    # Row 3: MIDI status
    local cc_display=""
    for cc in 30 31 32 40; do
        [[ -n "${MIDI_CC_VAL[$cc]:-}" ]] && cc_display+="\e[90mCC$cc=\e[32m${MIDI_CC_VAL[$cc]}\e[0m "
    done
    printf '\e[3;1H\e[K\e[1;34mMIDI:\e[0m \e[32m●\e[0m %b' "$cc_display"

    # Row 4: CC mappings
    printf '\e[4;1H\e[90mCC30:\e[35m%s\e[90m CC31:\e[33m%s\e[90m CC32:\e[34m%s\e[0m' "$org" "$mod" "$env"

    # Content area
    local content_start=5
    local content_end=$((TUI_SPLIT - 1))
    local content_lines=$((content_end - content_start + 1))

    for ((row=content_start; row<=content_end; row++)); do
        printf '\e[%d;1H\e[K' "$row"
    done

    if [[ -n "$TUI_CONTENT" ]]; then
        local line_num=0
        local clean_content
        clean_content=$(echo "$TUI_CONTENT" | sed 's/\x1b\[[0-9;]*m//g')
        while IFS= read -r line && [[ $line_num -lt $content_lines ]]; do
            printf '\e[%d;1H\e[K%s' "$((content_start + line_num))" "${line:0:$((TUI_WIDTH-1))}"
            ((line_num++))
        done <<< "$clean_content"

        local total_lines=$(echo "$clean_content" | wc -l)
        if [[ $total_lines -gt $content_lines ]]; then
            printf '\e[%d;%dH\e[90m↓ +%d lines\e[0m' "$content_end" "$((TUI_WIDTH-12))" "$((total_lines - content_lines))"
        fi
    elif [[ "$mod" == "midi" ]]; then
        local log_count=${#MIDI_LOG[@]}
        for ((row=content_start; row<=content_end; row++)); do
            local idx=$((log_count - (content_end - row) - 1))
            if ((idx >= 0 && idx < log_count)); then
                printf '\e[%d;1H\e[90m%s\e[0m' "$row" "${MIDI_LOG[$idx]}"
            fi
        done
    fi

    # Separator
    printf '\e[%d;1H' "$TUI_SPLIT"
    for ((i=0; i<TUI_WIDTH; i++)); do printf '\e[90m─\e[0m'; done

    # CLI area
    local cli_row=$((TUI_SPLIT+1))
    printf '\e[%d;1H\e[K' "$cli_row"

    if [[ "$CLI_MODE" == "command" ]]; then
        printf '\e[%d;1H%s:\e[0m%s\e[7m \e[0m' "$cli_row" "$(tetra_ctx_prompt)" "$CLI_INPUT"

        if [[ $DROPDOWN_OPEN -eq 1 && ${#CLI_COMPLETIONS[@]} -gt 0 ]]; then
            render_dropdown "$cli_row"
        fi
    else
        printf '\e[%d;1H\e[90m:\e[0m' "$cli_row"
    fi

    # Footer
    if [[ "$CLI_MODE" == "command" ]]; then
        if [[ $DROPDOWN_OPEN -eq 1 ]]; then
            printf '\e[%d;1H\e[90m↑↓:navigate Tab:cycle Enter:select Esc:cancel\e[0m' "$TUI_HEIGHT"
        else
            printf '\e[%d;1H\e[90mTab:complete Enter:exec Esc:cancel\e[0m' "$TUI_HEIGHT"
        fi
    else
        printf '\e[%d;1H\e[36m:\e[90m=cmd \e[36m←→\e[90m:mod \e[90mCC30/31/32/40:org/mod/env/row \e[31mq\e[90m=quit\e[0m' "$TUI_HEIGHT"
    fi
}

render_dropdown() {
    local prompt_row="$1"
    local total=${#CLI_COMPLETIONS[@]}
    local cols=3
    local item_width=20
    local max_visible_rows=3

    local available=$((TUI_HEIGHT - prompt_row - 4))
    [[ $available -lt 2 ]] && available=2
    [[ $available -lt $max_visible_rows ]] && max_visible_rows=$available

    local total_rows=$(( (total + cols - 1) / cols ))
    local visible_rows=$total_rows
    [[ $visible_rows -gt $max_visible_rows ]] && visible_rows=$max_visible_rows

    local selected_row=$((DROPDOWN_IDX % total_rows))
    if [[ $selected_row -lt $DROPDOWN_SCROLL ]]; then
        DROPDOWN_SCROLL=$selected_row
    elif [[ $selected_row -ge $((DROPDOWN_SCROLL + max_visible_rows)) ]]; then
        DROPDOWN_SCROLL=$((selected_row - max_visible_rows + 1))
    fi

    local row_num=$((prompt_row + 1))
    for ((row=0; row<visible_rows; row++)); do
        printf '\e[%d;1H\e[K' "$row_num"
        local actual_row=$((row + DROPDOWN_SCROLL))

        for ((col=0; col<cols; col++)); do
            local idx=$((actual_row + col * total_rows))
            if [[ $idx -lt $total ]]; then
                local item="${CLI_COMPLETIONS[$idx]}"
                local display="${item:0:$((item_width-2))}"

                if [[ $idx -eq $DROPDOWN_IDX ]]; then
                    printf '  \e[1;36m▶\e[0m \e[1;33m%-*s\e[0m' "$((item_width-1))" "$display"
                else
                    printf '    \e[2m%-*s\e[0m' "$((item_width-1))" "$display"
                fi
            fi
        done
        ((row_num++))
    done

    if [[ $total_rows -gt $max_visible_rows ]]; then
        printf '\e[%d;1H\e[K' "$row_num"
        local indicator=""
        [[ $DROPDOWN_SCROLL -gt 0 ]] && indicator+="↑ "
        indicator+="$((DROPDOWN_IDX+1))/$total"
        [[ $((DROPDOWN_SCROLL + max_visible_rows)) -lt $total_rows ]] && indicator+=" ↓"
        printf '  \e[2m%s more\e[0m' "$indicator"
        ((row_num++))
    fi

    printf '\e[%d;1H\e[K' "$row_num"
    printf '\e[%d;1H\e[K' "$((row_num+1))"
}

# =============================================================================
# MAIN
# =============================================================================

tcurses_tui() {
    local use_midi=false

    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --midi|-m) use_midi=true; shift ;;
            *) shift ;;
        esac
    done

    [[ ! -x "$TUI_CORE" ]] && { echo "tui-core not found: $TUI_CORE"; return 1; }

    # MIDI is opt-in with --midi flag
    local midi_arg=""
    if [[ $use_midi == true ]]; then
        if [[ -x "$OSC_LISTEN" ]]; then
            midi_arg="$OSC_LISTEN"
            echo "MIDI enabled" >&2
        else
            echo "Warning: MIDI requested but osc_listen not found" >&2
        fi
    fi

    # Open /dev/tty on fd 9 and pass to tui-core via env var
    exec 9<>/dev/tty
    coproc TUI_COPROC { TUI_TTY_FD=9 "$TUI_CORE" $midi_arg 2>/dev/null; }

    if [[ -z "${TUI_COPROC_PID:-}" ]]; then
        echo "Failed to start tui-core coprocess" >&2
        return 1
    fi

    declare -g _TUI_CORE_PID=$TUI_COPROC_PID

    cleanup_tui() {
        [[ -n "${_TUI_CORE_PID:-}" ]] && {
            kill "$_TUI_CORE_PID" 2>/dev/null
            wait "$_TUI_CORE_PID" 2>/dev/null
        }
        unset _TUI_CORE_PID
    }
    trap cleanup_tui EXIT INT TERM

    set +eu

    local crash_log="/tmp/tcurses-tui-crash.log"
    echo "=== TUI started $(date) ===" >> "$crash_log"

    _tui_error_handler() {
        echo "ERR line $1: $2" >> "$crash_log"
    }
    trap '_tui_error_handler $LINENO "$BASH_COMMAND"' ERR

    _tui_exit_handler() {
        echo "EXIT at $(date) code=$?" >> "$crash_log"
    }
    trap '_tui_exit_handler' EXIT

    local last_state=""

    while IFS= read -r line <&${TUI_COPROC[0]}; do
        echo "EVENT: $line" >> "$crash_log"

        local type="${line%%:*}"
        local data="${line#*:}"

        case "$type" in
            S)  handle_resize "$data" || true; render || true ;;
            K)  handle_keyboard "$data" || true ;;
            M)  handle_midi "$data" || true ;;
            Q)  break ;;
        esac

        local cur_state="$TETRA_CTX_ORG:$TETRA_CTX_PROJECT:$TETRA_CTX_TOPIC:$TUI_SPLIT:$CLI_MODE:$CLI_INPUT:$DROPDOWN_OPEN:$DROPDOWN_IDX"
        if [[ "$cur_state" != "$last_state" ]]; then
            last_state="$cur_state"
            render || true
        fi
    done

    echo "LOOP ENDED" >> "$crash_log"
    cleanup_tui
    trap - EXIT INT TERM ERR
}

# Alias for backward compat
tetra_tui2() { tcurses_tui "$@"; }

[[ "${BASH_SOURCE[0]}" == "$0" ]] && tcurses_tui "$@" || true
