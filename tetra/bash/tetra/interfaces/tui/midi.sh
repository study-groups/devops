#!/usr/bin/env bash
# Tetra TUI - MIDI Integration via midi-mp
# Connects to midi-mp router via Unix socket
# Hooks system for CC → action mapping

# Load user config if exists
[[ -f "$TETRA_DIR/tetra/interfaces/tui.conf" ]] && source "$TETRA_DIR/tetra/interfaces/tui.conf"

# MIDI Configuration
TUI_MIDI_ENABLED="${TUI_MIDI_ENABLED:-true}"
TUI_MIDI_SOCKET="${TUI_MIDI_SOCKET:-/tmp/tetra/midi-mp.sock}"
TUI_CC_CHANNEL="${TUI_CC_CHANNEL:-1}"

# CC Hooks - map CC number to function name
# Format: TUI_CC_HOOKS[cc_number]="function_name"
declare -gA TUI_CC_HOOKS=(
    [40]="set_split_from_cc"      # CC 40 → split row position
    [41]="_tui_set_module_from_cc" # CC 41 → module selection
    [42]="_tui_set_env_from_cc"    # CC 42 → env selection
    [43]="_tui_set_scroll_from_cc" # CC 43 → scroll position
)

# MIDI state tracking
declare -gA TUI_MIDI_STATE=(
    [connected]="false"
    [last_addr]=""
    [last_cc]=""
    [last_val]=""
    [packet_count]="0"
    [last_update]=""
    [last_update_sec]="0"
    [error]=""
    [channel]=""
)

# FIFO for async reading
TUI_MIDI_FIFO="/tmp/tetra-tui-midi-$$.fifo"

# Signal-based push notification
declare -g TUI_MIDI_EVENT_PENDING=false

_tui_midi_signal_handler() {
    TUI_MIDI_EVENT_PENDING=true
    needs_redraw=true
}

# Register a CC hook
# Usage: tui_midi_hook 40 my_function
tui_midi_hook() {
    local cc="$1"
    local func="$2"
    TUI_CC_HOOKS[$cc]="$func"
}

# Initialize MIDI connection via midi-mp socket
_tui_midi_init() {
    [[ "$TUI_MIDI_ENABLED" != "true" ]] && return 0

    # Check socket exists (midi-mp running?)
    if [[ ! -S "$TUI_MIDI_SOCKET" ]]; then
        TUI_MIDI_STATE[error]="midi-mp not running"
        TUI_MIDI_STATE[connected]="false"
        return 1
    fi

    # Create FIFO for async reading
    rm -f "$TUI_MIDI_FIFO"
    mkfifo "$TUI_MIDI_FIFO" 2>/dev/null || {
        TUI_MIDI_STATE[error]="fifo failed"
        TUI_MIDI_STATE[connected]="false"
        return 1
    }

    # Open bidirectional connection to midi-mp socket
    exec 9<>"$TUI_MIDI_SOCKET" 2>/dev/null || {
        TUI_MIDI_STATE[error]="socket connect failed"
        TUI_MIDI_STATE[connected]="false"
        rm -f "$TUI_MIDI_FIFO"
        return 1
    }

    # Subscribe to ALL CCs on our channel
    local subscribe='["/midi/raw/cc/'$TUI_CC_CHANNEL'/*"]'

    # Send registration
    local reg='{"type":"register","name":"tetra-tui-'$$'","transport":"unix","subscribe":'"$subscribe"'}'
    echo "$reg" >&9

    # Read response (with timeout)
    local response
    if read -t 2 -r response <&9; then
        if [[ "$response" == *'"ok":true'* ]]; then
            if [[ "$response" =~ \"channel\":\"([^\"]+)\" ]]; then
                TUI_MIDI_STATE[channel]="${BASH_REMATCH[1]}"
            fi
            TUI_MIDI_STATE[connected]="true"
            TUI_MIDI_STATE[error]=""
        else
            TUI_MIDI_STATE[error]="registration rejected"
            TUI_MIDI_STATE[connected]="false"
            exec 9<&-
            rm -f "$TUI_MIDI_FIFO"
            return 1
        fi
    else
        TUI_MIDI_STATE[error]="no response"
        TUI_MIDI_STATE[connected]="false"
        exec 9<&-
        rm -f "$TUI_MIDI_FIFO"
        return 1
    fi

    # Set up signal handler for push notifications
    trap '_tui_midi_signal_handler' USR1

    # Start background reader that signals parent on data
    local parent_pid=$$
    {
        while IFS= read -r line <&9 2>/dev/null; do
            echo "$line"
            kill -USR1 "$parent_pid" 2>/dev/null || break
        done
    } > "$TUI_MIDI_FIFO" &
    TUI_MIDI_READER_PID=$!

    # Open FIFO for non-blocking reads
    exec 8<>"$TUI_MIDI_FIFO"

    return 0
}

# Cleanup MIDI resources
_tui_midi_cleanup() {
    [[ "$TUI_MIDI_ENABLED" != "true" ]] && return 0

    if [[ "${TUI_MIDI_STATE[connected]}" == "true" ]]; then
        echo '{"type":"unregister","name":"tetra-tui-'$$'"}' >&9 2>/dev/null || true
    fi

    [[ -n "${TUI_MIDI_READER_PID:-}" ]] && {
        kill "$TUI_MIDI_READER_PID" 2>/dev/null || true
        wait "$TUI_MIDI_READER_PID" 2>/dev/null || true
    }

    exec 9<&- 2>/dev/null || true
    exec 8<&- 2>/dev/null || true
    rm -f "$TUI_MIDI_FIFO"

    TUI_MIDI_STATE[connected]="false"
}

# Poll for messages (only processes when signal received)
_tui_midi_poll() {
    [[ "$TUI_MIDI_ENABLED" != "true" ]] && return 0
    [[ "${TUI_MIDI_STATE[connected]}" != "true" ]] && return 0

    # Check reader alive
    if [[ -n "${TUI_MIDI_READER_PID:-}" ]] && ! kill -0 "$TUI_MIDI_READER_PID" 2>/dev/null; then
        TUI_MIDI_STATE[connected]="false"
        TUI_MIDI_STATE[error]="disconnected"
        return 1
    fi

    # Only process if we got a push notification (SIGUSR1)
    [[ "$TUI_MIDI_EVENT_PENDING" != "true" ]] && return 0
    TUI_MIDI_EVENT_PENDING=false

    # Process all pending messages
    local line
    while IFS= read -t 0.001 -r line <&8 2>/dev/null; do
        [[ -z "$line" ]] && continue
        _tui_midi_handle "$line"
    done

    return 0
}

# Handle incoming message - dispatch to hooks
_tui_midi_handle() {
    local msg="$1"
    local address value

    # Parse OSC format: "/address value"
    if [[ "$msg" =~ ^(/[^[:space:]]+)[[:space:]]+(.+)$ ]]; then
        address="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"
    else
        return
    fi

    # Extract CC number from /midi/raw/cc/{channel}/{cc}
    local cc_num
    if [[ "$address" =~ /midi/raw/cc/[0-9]+/([0-9]+)$ ]]; then
        cc_num="${BASH_REMATCH[1]}"
    else
        return
    fi

    # Update state
    TUI_MIDI_STATE[last_addr]="$address"
    TUI_MIDI_STATE[last_cc]="$cc_num"
    TUI_MIDI_STATE[last_val]="$value"
    TUI_MIDI_STATE[packet_count]=$(( ${TUI_MIDI_STATE[packet_count]} + 1 ))

    # Timestamp
    if (( SECONDS != ${TUI_MIDI_STATE[last_update_sec]:-0} )); then
        TUI_MIDI_STATE[last_update_sec]=$SECONDS
        printf -v 'TUI_MIDI_STATE[last_update]' '%(%H:%M:%S)T' -1
    fi

    # Dispatch to hook if registered
    local hook="${TUI_CC_HOOKS[$cc_num]:-}"
    if [[ -n "$hook" ]] && declare -f "$hook" >/dev/null 2>&1; then
        "$hook" "$value"
        needs_redraw=true
    fi
}

# Built-in hooks

# Module selection (CC → module index)
_tui_set_module_from_cc() {
    local cc_val="$1"
    local count=${#TUI_MODULES[@]}
    [[ $count -eq 0 ]] && return

    local idx=$(( cc_val * count / 128 ))
    [[ $idx -ge $count ]] && idx=$((count - 1))
    [[ $idx -lt 0 ]] && idx=0

    if [[ "${CONTENT_MODEL[module_index]}" != "$idx" ]]; then
        CONTENT_MODEL[module_index]="$idx"
        CONTENT_MODEL[module]="${TUI_MODULES[$idx]}"
        TUI_BUFFERS["@tui[content]"]=""
    fi
}

# Env selection (CC → env index)
_tui_set_env_from_cc() {
    local cc_val="$1"
    local count=${#TUI_ENVS[@]}
    [[ $count -eq 0 ]] && return

    local idx=$(( cc_val * count / 128 ))
    [[ $idx -ge $count ]] && idx=$((count - 1))
    [[ $idx -lt 0 ]] && idx=0

    if [[ "${CONTENT_MODEL[env_index]}" != "$idx" ]]; then
        CONTENT_MODEL[env_index]="$idx"
        CONTENT_MODEL[env]="${TUI_ENVS[$idx]}"
    fi
}

# Scroll position
_tui_set_scroll_from_cc() {
    local cc_val="$1"
    if [[ "${CONTENT_MODEL[view_mode]}" == "true" ]]; then
        CONTENT_MODEL[scroll_offset]="$cc_val"
        TUI_PAGER_OFFSET="$cc_val"
    fi
}

# Compatibility aliases for render.sh (uses TUI_TDP_* names)
TUI_TDP_ENABLED="$TUI_MIDI_ENABLED"
declare -gA TUI_TDP_STATE
_tui_tdp_state_sync() {
    TUI_TDP_STATE[connected]="${TUI_MIDI_STATE[connected]}"
    TUI_TDP_STATE[last_cc]="${TUI_MIDI_STATE[last_cc]}"
    TUI_TDP_STATE[last_val]="${TUI_MIDI_STATE[last_val]}"
    TUI_TDP_STATE[packet_count]="${TUI_MIDI_STATE[packet_count]}"
    TUI_TDP_STATE[last_update]="${TUI_MIDI_STATE[last_update]}"
    TUI_TDP_STATE[error]="${TUI_MIDI_STATE[error]}"
}

_tui_tdp_init() { _tui_midi_init; _tui_tdp_state_sync; }
_tui_tdp_cleanup() { _tui_midi_cleanup; }
_tui_tdp_poll() { _tui_midi_poll; _tui_tdp_state_sync; }
