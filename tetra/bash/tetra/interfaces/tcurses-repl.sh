#!/usr/bin/env bash
# tcurses-repl.sh - Terminal Control REPL with context + MIDI support
# Uses raw mode for responsive input, no full screen takeover
# Honors TETRA_CTX_* env vars set by `tetra ctx`
#
# Usage:
#   tcurses_repl          # Basic terminal REPL
#   tcurses_repl --midi   # With MIDI CC control

: "${TETRA_SRC:?TETRA_SRC must be set}"

# Source context manager
source "$TETRA_SRC/bash/tetra/ctx.sh"

# =============================================================================
# STATE
# =============================================================================

declare -g TCREPL_RUNNING=0
declare -g TCREPL_LAST_OUTPUT=""
declare -g TCREPL_SAVED_STTY=""

# MIDI state
declare -g TCREPL_MIDI_ENABLED=false
declare -g TCREPL_MIDI_CONNECTED=0
declare -g TCREPL_MIDI_PID=""
declare -g OSC_LISTEN="$TETRA_SRC/bash/midi/osc_listen"

# Selection arrays for MIDI CC mapping
declare -ga TCREPL_ORGS=()
declare -ga TCREPL_MODS=()
declare -ga TCREPL_TOPICS=("local" "dev" "staging" "prod")

# Tab completion (simple - no dropdown in this mode)
declare -ga TCREPL_COMPLETIONS=()

# =============================================================================
# TERMINAL CONTROL
# =============================================================================

_tcrepl_setup_term() {
    TCREPL_SAVED_STTY=$(stty -g)
    stty -echo -icanon min 0 time 1
    # Disable readline completion entirely so we get raw Tab
    bind 'set disable-completion on' 2>/dev/null
}

_tcrepl_restore_term() {
    if [[ -n "$TCREPL_SAVED_STTY" ]]; then
        stty "$TCREPL_SAVED_STTY" 2>/dev/null
    else
        stty sane 2>/dev/null
    fi
    # Re-enable readline completion
    bind 'set disable-completion off' 2>/dev/null
}

# =============================================================================
# MIDI (optional)
#
# MIDI integration uses osc_listen to receive OSC messages from a MIDI relay.
# Architecture:
#   [MIDI device] -> [midi_bridge/midi.js relay on port 1983]
#                 -> [osc_listen coproc] -> [this REPL polls for CC messages]
#
# We use bash coproc (coprocess) to run osc_listen in background:
#   - coproc creates bidirectional pipes to the subprocess
#   - TCREPL_OSC[0] = read from osc_listen stdout
#   - TCREPL_OSC_PID = PID for cleanup
#   - set +m/set -m = suppress "[1] PID" job control messages
# =============================================================================

_tcrepl_midi_connect() {
    [[ ! -x "$OSC_LISTEN" ]] && return 1

    # Start osc_listen as coprocess
    # - listens on multicast 239.1.1.1:1983 for OSC from midi relay
    # - outputs parsed events to stdout (which we read via coproc FD)
    set +m  # suppress job notifications
    coproc TCREPL_OSC { "$OSC_LISTEN" -p 1983 -m 239.1.1.1 2>/dev/null; }
    TCREPL_MIDI_PID=$TCREPL_OSC_PID
    set -m
    TCREPL_MIDI_CONNECTED=1
    return 0
}

_tcrepl_midi_cleanup() {
    [[ $TCREPL_MIDI_CONNECTED -eq 0 ]] && return 0

    # Kill osc_listen coproc and wait to reap zombie
    set +m  # suppress "Killed" message
    if [[ -n "$TCREPL_MIDI_PID" ]]; then
        kill -9 "$TCREPL_MIDI_PID" 2>/dev/null
        wait "$TCREPL_MIDI_PID" 2>/dev/null
    fi
    set -m

    TCREPL_MIDI_CONNECTED=0
    TCREPL_MIDI_PID=""
}

# Poll MIDI and update ctx - returns 0 if state changed
_tcrepl_midi_poll() {
    [[ $TCREPL_MIDI_CONNECTED -eq 0 ]] && return 1
    [[ -z "${TCREPL_OSC[0]:-}" ]] && return 1

    # Check if coproc still alive
    kill -0 "$TCREPL_MIDI_PID" 2>/dev/null || {
        TCREPL_MIDI_PID=""
        TCREPL_MIDI_CONNECTED=0
        return 1
    }

    local changed=1 line

    while read -t 0.001 -r line <&${TCREPL_OSC[0]} 2>/dev/null; do
        if [[ "$line" =~ raw[[:space:]]+CC[[:space:]]+([0-9]+)[[:space:]]+([0-9]+)[[:space:]]+([0-9]+) ]]; then
            local cc="${BASH_REMATCH[2]}"
            local val="${BASH_REMATCH[3]}"

            case "$cc" in
                30)  # Org selection -> TETRA_CTX_ORG
                    if ((${#TCREPL_ORGS[@]} > 0)); then
                        local idx=$(( val * (${#TCREPL_ORGS[@]} - 1) / 127 ))
                        export TETRA_CTX_ORG="${TCREPL_ORGS[$idx]}"
                        changed=0
                    fi
                    ;;
                31)  # Project selection -> TETRA_CTX_PROJECT
                    if ((${#TCREPL_MODS[@]} > 0)); then
                        local idx=$(( val * (${#TCREPL_MODS[@]} - 1) / 127 ))
                        export TETRA_CTX_PROJECT="${TCREPL_MODS[$idx]}"
                        changed=0
                    fi
                    ;;
                32)  # Topic selection -> TETRA_CTX_TOPIC
                    if ((${#TCREPL_TOPICS[@]} > 0)); then
                        local idx=$(( val * (${#TCREPL_TOPICS[@]} - 1) / 127 ))
                        export TETRA_CTX_TOPIC="${TCREPL_TOPICS[$idx]}"
                        changed=0
                    fi
                    ;;
            esac
        fi
    done

    return $changed
}

# =============================================================================
# BUILD SELECTION ARRAYS
# =============================================================================

_tcrepl_build_lists() {
    # Orgs from ~/tetra/orgs/
    TCREPL_ORGS=()
    for d in ~/tetra/orgs/*/; do
        [[ -d "$d" && ! -L "${d%/}" ]] || continue
        TCREPL_ORGS+=("$(basename "$d")")
    done
    IFS=$'\n' TCREPL_ORGS=($(sort <<<"${TCREPL_ORGS[*]}")); unset IFS
    [[ ${#TCREPL_ORGS[@]} -eq 0 ]] && TCREPL_ORGS=("none")

    # Modules from $TETRA_SRC/bash/*/
    TCREPL_MODS=()
    for d in "$TETRA_SRC/bash"/*/; do
        [[ -d "$d" ]] || continue
        local name=$(basename "$d")
        [[ "$name" == "tetra" || "$name" == "wip" ]] && continue
        [[ -f "$d/${name}.sh" || -f "$d/includes.sh" ]] && TCREPL_MODS+=("$name")
    done
    IFS=$'\n' TCREPL_MODS=($(sort <<<"${TCREPL_MODS[*]}")); unset IFS
}

# =============================================================================
# PROMPT
# =============================================================================

_tcrepl_prompt() {
    local ctx=$(tetra_ctx_prompt)
    local midi_icon
    if [[ $TCREPL_MIDI_ENABLED == true && $TCREPL_MIDI_CONNECTED -eq 1 ]]; then
        midi_icon="●"
    elif [[ $TCREPL_MIDI_ENABLED == true ]]; then
        midi_icon="◐"
    else
        midi_icon="○"
    fi
    printf '%s %s: ' "$midi_icon" "$ctx"
}

# =============================================================================
# TAB COMPLETION
# =============================================================================

# Get completions for current input
_tcrepl_get_completions() {
    local prefix="$1"
    local mod="${TETRA_CTX_PROJECT:-}"
    local -a completions=()

    # Builtin commands always available
    local builtins=(quit exit help ctx midi status clear)

    # If no module context, complete with builtins + module names
    if [[ -z "$mod" ]]; then
        for cmd in "${builtins[@]}"; do
            [[ -z "$prefix" || "$cmd" == "$prefix"* ]] && completions+=("$cmd")
        done
        for m in "${TCREPL_MODS[@]}"; do
            [[ -z "$prefix" || "$m" == "$prefix"* ]] && completions+=("$m")
        done
    else
        # Add builtins
        for cmd in "${builtins[@]}"; do
            [[ -z "$prefix" || "$cmd" == "$prefix"* ]] && completions+=("$cmd")
        done

        # Try MOD_COMMANDS array (e.g., TSM_COMMANDS)
        local var="${mod^^}_COMMANDS"
        if declare -p "$var" &>/dev/null 2>&1; then
            local -n cmd_array="$var"
            for cmd in "${cmd_array[@]}"; do
                [[ -z "$prefix" || "$cmd" == "$prefix"* ]] && completions+=("$cmd")
            done
        fi

        # Fallback: extract from module case statement
        if [[ ${#completions[@]} -le ${#builtins[@]} ]]; then
            local mod_file="$TETRA_SRC/bash/$mod/$mod.sh"
            if [[ -f "$mod_file" ]]; then
                while IFS= read -r cmd; do
                    cmd="${cmd%%)*}"
                    cmd="${cmd%%|*}"
                    cmd="${cmd// /}"
                    [[ -z "$cmd" || "$cmd" == *"*"* || "$cmd" == "-"* ]] && continue
                    [[ -z "$prefix" || "$cmd" == "$prefix"* ]] && completions+=("$cmd")
                done < <(grep -E '^\s+[a-z][a-z0-9_-]*(\|[a-z0-9_-]+)*\)' "$mod_file" 2>/dev/null | sed 's/^[[:space:]]*//')
            fi
        fi
    fi

    # Sort and dedupe
    IFS=$'\n' TCREPL_COMPLETIONS=($(printf '%s\n' "${completions[@]}" | sort -u)); unset IFS
}

# Show completions once (bash-style, no in-place update)
_tcrepl_show_completions() {
    local total=${#TCREPL_COMPLETIONS[@]}
    [[ $total -eq 0 ]] && return

    local cols=4
    local col_width=18

    printf '\n' >/dev/tty
    local col=0
    for item in "${TCREPL_COMPLETIONS[@]}"; do
        printf '%-*s' "$col_width" "${item:0:$((col_width-1))}" >/dev/tty
        ((col++))
        if [[ $col -ge $cols ]]; then
            printf '\n' >/dev/tty
            col=0
        fi
    done
    [[ $col -ne 0 ]] && printf '\n' >/dev/tty
}

# =============================================================================
# INPUT (raw mode)
# =============================================================================

_tcrepl_read() {
    local input="" char=""

    while true; do
        # Poll MIDI if enabled
        if [[ $TCREPL_MIDI_ENABLED == true ]] && _tcrepl_midi_poll; then
            # Redraw prompt on state change (to tty, not stdout)
            printf '\r\e[K%s%s' "$(_tcrepl_prompt)" "$input" >/dev/tty
        fi

        # Read single char with short timeout from /dev/tty directly
        if ! IFS= read -rsn1 -t 0.1 char </dev/tty; then
            continue
        fi

        case "$char" in
            $'\x1b')  # ESC or arrow key
                read -rsn1 -t 0.01 next </dev/tty || true
                if [[ "$next" == "[" ]]; then
                    read -rsn1 -t 0.01 arrow </dev/tty || true
                    # Ignore arrows in basic mode
                    continue
                fi
                # Plain ESC - cancel
                return 1
                ;;
            $'\t')  # Tab - simple completion (show list or complete single match)
                _tcrepl_get_completions "$input"
                local total=${#TCREPL_COMPLETIONS[@]}
                if [[ $total -eq 0 ]]; then
                    printf '\a' >/dev/tty  # beep
                elif [[ $total -eq 1 ]]; then
                    input="${TCREPL_COMPLETIONS[0]} "
                    printf '\r\e[K%s%s' "$(_tcrepl_prompt)" "$input" >/dev/tty
                else
                    # Show completions list
                    _tcrepl_show_completions
                    printf '%s%s' "$(_tcrepl_prompt)" "$input" >/dev/tty
                fi
                ;;
            "")  # Enter
                break
                ;;
            $'\x7f'|$'\x08')  # Backspace
                if [[ -n "$input" ]]; then
                    input="${input%?}"
                    printf '\r\e[K%s%s' "$(_tcrepl_prompt)" "$input" >/dev/tty
                fi
                ;;
            *)
                input+="$char"
                printf '%s' "$char" >/dev/tty
                ;;
        esac
    done

    printf '%s' "$input"
}

# =============================================================================
# DISPATCH
# =============================================================================

_tcrepl_dispatch() {
    local input="$1"

    [[ -z "$input" ]] && return 0

    # Builtins
    case "$input" in
        q|quit|exit)
            TCREPL_RUNNING=0
            return 0
            ;;
        help|h|\?)
            _tcrepl_help
            return 0
            ;;
        ctx)
            tetra_ctx_show
            return 0
            ;;
        ctx\ *)
            tetra_ctx ${input#ctx }
            return 0
            ;;
        midi|status)
            echo "MIDI state:"
            echo "  enabled:   $TCREPL_MIDI_ENABLED"
            echo "  connected: $TCREPL_MIDI_CONNECTED"
            echo "  PID:       ${TCREPL_MIDI_PID:-none}"
            if [[ -n "$TCREPL_MIDI_PID" ]]; then
                echo "  coproc FD: ${TCREPL_OSC[0]:-closed}"
                echo "  cleanup:   kill -9 $TCREPL_MIDI_PID && wait"
            fi
            return 0
            ;;
        clear)
            clear
            return 0
            ;;
    esac

    # Module dispatch based on ctx
    local proj="${TETRA_CTX_PROJECT:-}"
    if [[ -n "$proj" ]] && declare -F "$proj" &>/dev/null; then
        TCREPL_LAST_OUTPUT=$("$proj" $input 2>&1)
        echo "$TCREPL_LAST_OUTPUT"
    else
        # Try eval as shell
        eval "$input"
    fi
}

# =============================================================================
# HELP
# =============================================================================

_tcrepl_help() {
    cat <<'EOF'
tcurses-repl - Terminal Control REPL

CONTEXT
  ctx                 Show current context
  ctx <org:proj:top>  Set context
  ESC                 Cancel/back

COMMANDS
  Type any command    Dispatches to current project module
  q/quit              Exit

MIDI (with --midi)
  CC30                Select org
  CC31                Select project
  CC32                Select topic

ICONS
  ●  MIDI connected
  ◐  MIDI enabled, not connected
  ○  MIDI disabled
EOF
}

# =============================================================================
# MAIN
# =============================================================================

tcurses_repl() {
    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --midi|-m) TCREPL_MIDI_ENABLED=true ;;
            --help|-h) _tcrepl_help; return 0 ;;
        esac
        shift
    done

    TCREPL_RUNNING=1

    # Build selection lists
    _tcrepl_build_lists

    # Setup terminal
    _tcrepl_setup_term
    trap '_tcrepl_restore_term; _tcrepl_midi_cleanup' EXIT

    # Connect MIDI if enabled
    if [[ $TCREPL_MIDI_ENABLED == true ]]; then
        _tcrepl_midi_connect || echo "MIDI: failed to connect"
    fi

    # Welcome
    echo ""
    echo "tcurses-repl | ESC=cancel, q=quit, help=?, midi=status"
    if [[ $TCREPL_MIDI_CONNECTED -eq 1 ]]; then
        echo "MIDI: osc_listen coproc PID=$TCREPL_MIDI_PID (will kill -9 on exit)"
    elif [[ $TCREPL_MIDI_ENABLED == true ]]; then
        echo "MIDI: enabled but osc_listen not found"
    else
        echo "MIDI: off (use --midi)"
    fi
    tetra_ctx_show
    echo ""

    # Main loop
    while [[ $TCREPL_RUNNING -eq 1 ]]; do
        _tcrepl_midi_poll 2>/dev/null

        printf '%s' "$(_tcrepl_prompt)"

        local input
        if input=$(_tcrepl_read); then
            echo ""  # newline after input
            _tcrepl_dispatch "$input"
        else
            echo ""  # newline after ESC
            echo "(cancelled)"
        fi
    done

    # Cleanup
    trap - EXIT
    if [[ $TCREPL_MIDI_CONNECTED -eq 1 ]]; then
        echo "cleanup: killing osc_listen PID=$TCREPL_MIDI_PID"
    fi
    _tcrepl_midi_cleanup
    _tcrepl_restore_term
    stty sane 2>/dev/null

    echo "bye"
    return 0
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f tcurses_repl _tcrepl_help
