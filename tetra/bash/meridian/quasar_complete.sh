#!/usr/bin/env bash
# quasar_complete.sh - Tab completion for quasar command
#
# Provides descriptive completions with hints about what each command does.
# Double-tab shows full command list with descriptions.

# =============================================================================
# COMMAND DEFINITIONS WITH DESCRIPTIONS
# =============================================================================

declare -gA _QUASAR_CMD_DESC=(
    # Server management
    [start]="Start quasar server"
    [stop]="Stop quasar server"
    [restart]="Restart quasar server"
    [status]="Show server status"
    [logs]="Show log output"
    [tail]="Follow log output"
    # Game bridges
    [bridge]="Start game bridge"
    [demo]="Start server + demo bridge"
    # Sound control
    [osc]="Send OSC message"
    [test]="Test sound output"
    [mute]="Silence all voices"
    # Client
    [open]="Open browser client"
    [diagram]="Show architecture diagram"
    [help]="Show help"
)

# Command aliases (short -> long) - none by default
declare -gA _QUASAR_CMD_ALIAS=()

# OSC subcommand descriptions
declare -gA _QUASAR_OSC_DESC=(
    [voice]="Set voice parameters"
    [gate]="Set voice gate (on/off)"
    [mode]="Set synth mode"
    [trigger]="Trigger preset sound"
)

# Voice parameter descriptions
declare -gA _QUASAR_VOICE_DESC=(
    [0]="Voice 0 (P1 engine)"
    [1]="Voice 1 (P2 engine)"
    [2]="Voice 2 (P1 effects)"
    [3]="Voice 3 (P2 effects)"
)

# OSC address patterns
declare -gA _QUASAR_OSC_ADDR=(
    [set]="/quasar/{voice}/set - Set gate freq wave vol"
    [gate]="/quasar/{voice}/gate - Set gate (0|1)"
    [mode]="/quasar/mode - Set synth mode"
    [trigger]="/quasar/trigger/{name} - Trigger preset"
)

# Trigger presets
declare -ga _QUASAR_TRIGGERS=(
    pew boom clank pickup hit score engine_idle engine_rev
)

# Synth modes
declare -ga _QUASAR_MODES=(
    tia pwm sidplus
)

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

_quasar_complete_bridges() {
    local bridges_dir="${QUASAR_SRC:-$TETRA_SRC/bash/quasar}/bridges"
    [[ -d "$bridges_dir" ]] || return

    for bridge in "$bridges_dir"/*_bridge.js; do
        [[ -f "$bridge" ]] || continue
        basename "$bridge" _bridge.js
    done
}

_quasar_complete_osc_addresses() {
    local voice="${1:-0}"
    echo "/quasar/$voice/set"
    echo "/quasar/$voice/gate"
    echo "/quasar/mode"
    for trig in "${_QUASAR_TRIGGERS[@]}"; do
        echo "/quasar/trigger/$trig"
    done
}

# Show context: server status (checks actual server, not just PID file)
_quasar_complete_context() {
    local port="${QUASAR_PORT:-1985}"

    # Check if server actually responds
    if curl -s --max-time 1 "http://localhost:$port/api/status" &>/dev/null; then
        echo "running:$port"
    elif lsof -ti :"$port" &>/dev/null; then
        echo "running:$port"
    else
        echo "stopped"
    fi
}

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_quasar_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local cmd="${COMP_WORDS[1]:-}"
    local arg2="${COMP_WORDS[2]:-}"
    local arg3="${COMP_WORDS[3]:-}"
    local arg4="${COMP_WORDS[4]:-}"

    COMPREPLY=()

    # First arg - commands (with aliases)
    if [[ $COMP_CWORD -eq 1 ]]; then
        local all_cmds="${!_QUASAR_CMD_DESC[*]} ${!_QUASAR_CMD_ALIAS[*]}"
        COMPREPLY=($(compgen -W "$all_cmds" -- "$cur"))
        return
    fi

    # Resolve alias to canonical command
    [[ -n "${_QUASAR_CMD_ALIAS[$cmd]}" ]] && cmd="${_QUASAR_CMD_ALIAS[$cmd]}"

    # Second arg - based on command
    if [[ $COMP_CWORD -eq 2 ]]; then
        case "$cmd" in
            start|restart)
                COMPREPLY=($(compgen -W "-v --verbose" -- "$cur"))
                ;;
            bridge)
                COMPREPLY=($(compgen -W "$(_quasar_complete_bridges)" -- "$cur"))
                ;;
            logs)
                COMPREPLY=($(compgen -W "10 25 50 100 200 500" -- "$cur"))
                ;;
            osc)
                # OSC address completion with nested path support
                _quasar_complete_osc_path "$cur"
                ;;
        esac
        return
    fi

    # Third+ arg - OSC arguments after address
    if [[ $COMP_CWORD -ge 3 && "$cmd" == "osc" ]]; then
        _quasar_complete_osc_args "$arg2" $((COMP_CWORD - 2)) "$cur"
        return
    fi
}

# Complete OSC address paths with nested / exploration
_quasar_complete_osc_path() {
    local cur="$1"

    # Build completions based on current path depth
    if [[ -z "$cur" || "$cur" == "/" ]]; then
        # Root level
        COMPREPLY=($(compgen -W "/quasar" -- "$cur"))
        compopt -o nospace
        return
    fi

    if [[ "$cur" == /quasar || "$cur" == /quasar/ ]]; then
        # Second level: voices, mode, trigger
        local opts="/quasar/0 /quasar/1 /quasar/2 /quasar/3 /quasar/mode /quasar/trigger"
        COMPREPLY=($(compgen -W "$opts" -- "$cur"))
        compopt -o nospace
        return
    fi

    if [[ "$cur" == /quasar/[0-3] ]]; then
        # Voice level - add subcommands
        COMPREPLY=("${cur}/set" "${cur}/gate")
        compopt -o nospace
        return
    fi

    if [[ "$cur" == /quasar/[0-3]/ ]]; then
        # Voice level with trailing slash
        local voice="${cur%/}"
        COMPREPLY=("${voice}/set" "${voice}/gate")
        return
    fi

    if [[ "$cur" == /quasar/trigger || "$cur" == /quasar/trigger/ ]]; then
        # Trigger level - add preset names
        local triggers=""
        for t in "${_QUASAR_TRIGGERS[@]}"; do
            triggers+="/quasar/trigger/$t "
        done
        COMPREPLY=($(compgen -W "$triggers" -- "$cur"))
        return
    fi

    if [[ "$cur" == /quasar/mode ]]; then
        # Mode is complete, no more path segments
        return
    fi

    # Partial matching
    case "$cur" in
        /quasar/[0-3]/s*)
            local voice="${cur%%/s*}"
            COMPREPLY=($(compgen -W "${voice}/set" -- "$cur"))
            ;;
        /quasar/[0-3]/g*)
            local voice="${cur%%/g*}"
            COMPREPLY=($(compgen -W "${voice}/gate" -- "$cur"))
            ;;
        /quasar/t*)
            COMPREPLY=($(compgen -W "/quasar/trigger" -- "$cur"))
            compopt -o nospace
            ;;
        /quasar/m*)
            COMPREPLY=($(compgen -W "/quasar/mode" -- "$cur"))
            ;;
        /quasar/trigger/*)
            local triggers=""
            for t in "${_QUASAR_TRIGGERS[@]}"; do
                triggers+="/quasar/trigger/$t "
            done
            COMPREPLY=($(compgen -W "$triggers" -- "$cur"))
            ;;
        /q*)
            COMPREPLY=($(compgen -W "/quasar" -- "$cur"))
            compopt -o nospace
            ;;
    esac
}

# Complete OSC arguments after the address
_quasar_complete_osc_args() {
    local addr="$1"
    local arg_pos="$2"
    local cur="$3"

    case "$addr" in
        /quasar/[0-3]/set)
            # 4 args: gate freq wave vol
            case $arg_pos in
                1)
                    COMPREPLY=($(compgen -W "0 1" -- "$cur"))
                    [[ ${#COMPREPLY[@]} -eq 0 ]] && COMPREPLY=("# gate: 0=off 1=on")
                    ;;
                2)
                    COMPREPLY=($(compgen -W "0 4 8 12 16 20 24 28 31" -- "$cur"))
                    [[ ${#COMPREPLY[@]} -eq 0 ]] && COMPREPLY=("# freq: 0-31 (0=high 31=low)")
                    ;;
                3)
                    COMPREPLY=($(compgen -W "0 1 3 4 7 8 12" -- "$cur"))
                    [[ ${#COMPREPLY[@]} -eq 0 ]] && COMPREPLY=("# wave: 0=silent 4=square 8=noise")
                    ;;
                4)
                    COMPREPLY=($(compgen -W "0 4 8 12 15" -- "$cur"))
                    [[ ${#COMPREPLY[@]} -eq 0 ]] && COMPREPLY=("# vol: 0-15")
                    ;;
            esac
            ;;
        /quasar/[0-3]/gate)
            COMPREPLY=($(compgen -W "0 1" -- "$cur"))
            ;;
        /quasar/mode)
            COMPREPLY=($(compgen -W "${_QUASAR_MODES[*]}" -- "$cur"))
            ;;
        /quasar/trigger/*)
            # Trigger complete, optional voice override
            if [[ $arg_pos -eq 1 ]]; then
                COMPREPLY=($(compgen -W "0 1 2 3" -- "$cur"))
            fi
            ;;
    esac
}

# =============================================================================
# DESCRIPTIVE HELP FUNCTIONS
# =============================================================================

# Print all commands with descriptions
quasar_commands() {
    local ctx=$(_quasar_complete_context)
    echo "quasar - TIA/PWM/SID Audio Engine [$ctx]"
    echo ""
    echo "SERVER"
    printf "  %-12s %s\n" "start" "${_QUASAR_CMD_DESC[start]}"
    printf "  %-12s %s\n" "stop" "${_QUASAR_CMD_DESC[stop]}"
    printf "  %-12s %s\n" "restart" "${_QUASAR_CMD_DESC[restart]}"
    printf "  %-12s %s\n" "status" "${_QUASAR_CMD_DESC[status]}"
    printf "  %-12s %s\n" "logs" "${_QUASAR_CMD_DESC[logs]}"
    printf "  %-12s %s\n" "tail" "${_QUASAR_CMD_DESC[tail]}"
    echo ""
    echo "GAMES"
    printf "  %-12s %s\n" "bridge" "${_QUASAR_CMD_DESC[bridge]}"
    printf "  %-12s %s\n" "demo" "${_QUASAR_CMD_DESC[demo]}"
    echo ""
    echo "SOUND"
    printf "  %-12s %s\n" "osc" "${_QUASAR_CMD_DESC[osc]}"
    printf "  %-12s %s\n" "test" "${_QUASAR_CMD_DESC[test]}"
    printf "  %-12s %s\n" "mute" "${_QUASAR_CMD_DESC[mute]}"
    echo ""
    echo "CLIENT"
    printf "  %-12s %s\n" "open" "${_QUASAR_CMD_DESC[open]}"
    printf "  %-12s %s\n" "diagram" "${_QUASAR_CMD_DESC[diagram]}"
    printf "  %-12s %s\n" "help" "${_QUASAR_CMD_DESC[help]}"
    echo ""
    echo "Run 'quasar help' for full documentation"
}

# Print OSC subcommands
quasar_osc_commands() {
    echo "quasar osc - Send OSC messages to audio engine"
    echo ""
    echo "VOICE CONTROL (4 voices: 0-3)"
    printf "  %-30s %s\n" "/quasar/{0-3}/set g f w v" "Set gate freq wave vol"
    printf "  %-30s %s\n" "/quasar/{0-3}/gate {0|1}" "Gate on/off"
    echo ""
    echo "MODE"
    printf "  %-30s %s\n" "/quasar/mode {mode}" "tia, pwm, sidplus"
    echo ""
    echo "TRIGGERS"
    for trig in "${_QUASAR_TRIGGERS[@]}"; do
        printf "  %-30s\n" "/quasar/trigger/$trig"
    done
    echo ""
    echo "TIA PARAMETERS"
    echo "  freq (AUDF): 0-31 (0=highest, 31=lowest)"
    echo "  wave (AUDC): 0-15 (waveform type)"
    echo "  vol  (AUDV): 0-15 (volume)"
    echo ""
    echo "COMMON WAVEFORMS"
    echo "  0=silent 1=4bit-poly 3=engine 4=square"
    echo "  7=rev 8=noise 12=pure-tone"
}

# Print bridge subcommands
quasar_bridge_commands() {
    echo "quasar bridge - Connect games to audio engine"
    echo ""
    echo "AVAILABLE BRIDGES"
    for bridge in $(_quasar_complete_bridges); do
        printf "  %-12s Connect %s game\n" "$bridge" "$bridge"
    done
    echo ""
    echo "USAGE"
    echo "  quasar bridge traks    # Start traks with audio"
    echo "  quasar demo            # Start server + traks demo"
}

# =============================================================================
# REGISTRATION
# =============================================================================

complete -F _quasar_complete quasar

# Export functions for subshells
export -f _quasar_complete _quasar_complete_bridges _quasar_complete_osc_addresses
export -f _quasar_complete_osc_path _quasar_complete_osc_args
export -f _quasar_complete_context quasar_commands quasar_osc_commands quasar_bridge_commands
