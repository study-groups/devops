#!/usr/bin/env bash
# Tetra TUI v2 - Uses tui-core coprocessor for input handling
# tui-core handles: terminal setup, keyboard, MIDI via osc_listen
# This script handles: state management, rendering

: "${TETRA_SRC:?TETRA_SRC must be set}"

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

# State
declare -g TUI_WIDTH=80
declare -g TUI_HEIGHT=24
declare -g TUI_SPLIT=12

# Context: [org × mod × env]
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
declare -gA MIDI_CC_VAL=()  # Track last value per CC number

# CLI state
declare -g CLI_MODE="normal"  # normal, command
declare -g CLI_INPUT=""
declare -g CLI_CURSOR=0
declare -ga CLI_COMPLETIONS=()
declare -g CLI_COMP_IDX=0

# Dropdown state
declare -g DROPDOWN_OPEN=0
declare -g DROPDOWN_IDX=0
declare -g DROPDOWN_SCROLL=0

# Output history (scratch pad)
declare -ga TUI_OUTPUT_HISTORY=()   # Indexed outputs: $1, $2, ...
declare -g TUI_LAST_OUTPUT=""       # $_
declare -g TUI_LAST_CMD=""          # $!
declare -g TUI_LAST_EXIT=0          # $?
declare -g TUI_OUTPUT_COUNT=0       # Total commands run
declare -g TUI_CONTENT=""           # Current content to display

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

# =============================================================================
# TAB COMPLETION
# =============================================================================

# Get completions for current module
# Uses MOD_COMMANDS array or dispatcher case statements
get_module_completions() {
    local mod="${TUI_MODS[$TUI_MOD_IDX]:-}"
    local prefix="$1"
    local -a completions=()

    # If no module selected, complete with module names
    if [[ -z "$mod" ]]; then
        for m in "${TUI_MODS[@]}"; do
            [[ -z "$prefix" || "$m" == "$prefix"* ]] && completions+=("$m")
        done
        IFS=$'\n' CLI_COMPLETIONS=($(printf '%s\n' "${completions[@]}" | sort -u)); unset IFS
        return
    fi

    # Try MOD_COMMANDS array first (e.g., TSM_COMMANDS)
    local var="${mod^^}_COMMANDS"
    if declare -p "$var" &>/dev/null; then
        local -n cmd_array="$var"
        for cmd in "${cmd_array[@]}"; do
            [[ -z "$prefix" || "$cmd" == "$prefix"* ]] && completions+=("$cmd")
        done
    fi

    # If no commands from array, look for dispatcher case statement
    if [[ ${#completions[@]} -eq 0 ]]; then
        local mod_file="$TETRA_SRC/bash/$mod/$mod.sh"
        if [[ -f "$mod_file" ]]; then
            # Extract commands from case statement: cmd) or cmd|alias)
            while IFS= read -r cmd; do
                cmd="${cmd%%)*}"           # Remove ) and everything after
                cmd="${cmd%%|*}"           # Take first if has alternatives
                cmd="${cmd// /}"           # Trim whitespace
                [[ -z "$cmd" ]] && continue
                [[ "$cmd" == *"*"* ]] && continue  # Skip wildcards
                [[ "$cmd" == "-"* ]] && continue   # Skip flags
                [[ -z "$prefix" || "$cmd" == "$prefix"* ]] && completions+=("$cmd")
            done < <(grep -E '^\s+[a-z][a-z0-9_-]*(\|[a-z0-9_-]+)*\)' "$mod_file" 2>/dev/null | sed 's/^[[:space:]]*//')
        fi
    fi

    # Fallback: common commands
    if [[ ${#completions[@]} -eq 0 ]]; then
        completions=(help status list)
    fi

    # Sort and unique
    IFS=$'\n' CLI_COMPLETIONS=($(printf '%s\n' "${completions[@]}" | sort -u)); unset IFS
}

# Cycle through completions
complete_next() {
    [[ ${#CLI_COMPLETIONS[@]} -eq 0 ]] && return

    local comp="${CLI_COMPLETIONS[$CLI_COMP_IDX]}"

    # Replace input with completion
    CLI_INPUT="$comp"
    CLI_CURSOR=${#CLI_INPUT}

    # Cycle to next
    ((CLI_COMP_IDX = (CLI_COMP_IDX + 1) % ${#CLI_COMPLETIONS[@]}))
}

# =============================================================================
# EVENT HANDLERS
# =============================================================================

# Parse escaped key string back to bytes
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

# Auto-load current module if not already loaded
tui_load_module() {
    local mod="${TUI_MODS[$TUI_MOD_IDX]:-}"
    [[ -z "$mod" ]] && return 0

    # Already loaded?
    declare -f "$mod" &>/dev/null && return 0

    # Disable strict mode for module loading
    set +eu
    trap '' ERR  # Ignore errors during load

    # Try tmod first
    if declare -f tmod &>/dev/null; then
        tmod load "$mod" 2>/dev/null || true
    else
        local mod_file="$TETRA_SRC/bash/$mod/$mod.sh"
        [[ -f "$mod_file" ]] && source "$mod_file" 2>/dev/null || true
    fi

    # Re-enable error trap
    trap '_tui_error_handler $LINENO "$BASH_COMMAND"' ERR

    # Verify loaded
    declare -f "$mod" &>/dev/null && MIDI_LOG+=("✓ $mod") || MIDI_LOG+=("✗ $mod")
    return 0
}

# Handle CC value
handle_cc() {
    local cc="$1" val="$2"

    local old_mod_idx=$TUI_MOD_IDX
    case "$cc" in
        30) ((${#TUI_ORGS[@]} > 0)) && TUI_ORG_IDX=$(( val * (${#TUI_ORGS[@]} - 1) / 127 )) ;;
        31) ((${#TUI_MODS[@]} > 0)) && TUI_MOD_IDX=$(( val * (${#TUI_MODS[@]} - 1) / 127 )) ;;
        32) ((${#TUI_ENVS[@]} > 0)) && TUI_ENV_IDX=$(( val * (${#TUI_ENVS[@]} - 1) / 127 )) ;;
        40) local min=5 max=$((TUI_HEIGHT - 3)); TUI_SPLIT=$(( min + (val * (max - min) / 127) )) ;;
    esac
    # Auto-load module if changed
    if [[ $cc -eq 31 && $TUI_MOD_IDX -ne $old_mod_idx ]]; then
        tui_load_module || true
    fi
    return 0
}

# Handle keyboard event
handle_keyboard() {
    local escaped="$1"
    local key=$(_unescape_key "$escaped")

    # Command mode
    if [[ "$CLI_MODE" == "command" ]]; then
        case "$key" in
            $'\e')  # Escape - exit command mode
                CLI_MODE="normal"
                CLI_INPUT=""
                CLI_COMPLETIONS=()
                DROPDOWN_OPEN=0
                ;;
            $'\n'|$'\r')  # Enter - execute or select
                if [[ $DROPDOWN_OPEN -eq 1 && ${#CLI_COMPLETIONS[@]} -gt 0 ]]; then
                    # Select from dropdown
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
            $'\t')  # Tab - toggle/cycle dropdown
                get_module_completions "$CLI_INPUT"
                if [[ ${#CLI_COMPLETIONS[@]} -gt 0 ]]; then
                    if [[ $DROPDOWN_OPEN -eq 0 ]]; then
                        DROPDOWN_OPEN=1
                        DROPDOWN_IDX=0
                        DROPDOWN_SCROLL=0
                    else
                        # Cycle to next (scroll handled by render_dropdown)
                        ((DROPDOWN_IDX = (DROPDOWN_IDX + 1) % ${#CLI_COMPLETIONS[@]}))
                    fi
                fi
                ;;
            $'\e[A'|$'\eOA')  # Up arrow - move up in column
                if [[ $DROPDOWN_OPEN -eq 1 && ${#CLI_COMPLETIONS[@]} -gt 0 ]]; then
                    ((DROPDOWN_IDX = (DROPDOWN_IDX - 1 + ${#CLI_COMPLETIONS[@]}) % ${#CLI_COMPLETIONS[@]}))
                fi
                ;;
            $'\e[B'|$'\eOB')  # Down arrow - move down in column
                if [[ $DROPDOWN_OPEN -eq 1 && ${#CLI_COMPLETIONS[@]} -gt 0 ]]; then
                    ((DROPDOWN_IDX = (DROPDOWN_IDX + 1) % ${#CLI_COMPLETIONS[@]}))
                fi
                ;;
            $'\x7f'|$'\b')  # Backspace
                if [[ -n "$CLI_INPUT" ]]; then
                    CLI_INPUT="${CLI_INPUT%?}"
                    get_module_completions "$CLI_INPUT"
                    DROPDOWN_IDX=0
                    DROPDOWN_SCROLL=0
                fi
                ;;
            *)  # Regular character
                if [[ ${#key} -eq 1 && "$key" =~ [[:print:]] ]]; then
                    CLI_INPUT+="$key"
                    get_module_completions "$CLI_INPUT"
                    DROPDOWN_IDX=0
                    DROPDOWN_SCROLL=0
                    # Auto-open dropdown when typing
                    [[ ${#CLI_COMPLETIONS[@]} -gt 0 ]] && DROPDOWN_OPEN=1
                fi
                ;;
        esac
        return
    fi

    # Normal mode
    case "$key" in
        :)  # Enter command mode
            CLI_MODE="command"
            CLI_INPUT=""
            CLI_COMPLETIONS=()
            CLI_COMP_IDX=0
            get_module_completions ""
            ;;
        $'\e[C')  # Right arrow - next module
            ((TUI_MOD_IDX = (TUI_MOD_IDX + 1) % ${#TUI_MODS[@]}))
            tui_load_module
            ;;
        $'\e[D')  # Left arrow - prev module
            ((TUI_MOD_IDX = (TUI_MOD_IDX - 1 + ${#TUI_MODS[@]}) % ${#TUI_MODS[@]}))
            tui_load_module
            ;;
    esac
}

# Built-in TUI commands (not dispatched to module)
tui_builtin_command() {
    local cmd="$1"
    shift
    case "$cmd" in
        history|hist)
            # Show output history
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
        vars)
            # Show current variables
            TUI_CONTENT=$(cat <<EOF
Variables:
  \$_  = last output (${#TUI_LAST_OUTPUT} chars)
  \$!  = $TUI_LAST_CMD
  \$?  = $TUI_LAST_EXIT
  \$1-\$${#TUI_OUTPUT_HISTORY[@]} = history outputs
EOF
            )
            return 0
            ;;
        recall)
            # Recall output by number
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
            return 1  # Not a builtin
            ;;
    esac
}

# Expand variables in input
# $_ = last output, $1-$9 = history, $! = last cmd, $? = last exit
tui_expand_vars() {
    local input="$1"

    # $_ → last output (escape for sed)
    input="${input//\$_/$TUI_LAST_OUTPUT}"

    # $! → last command
    input="${input//\$!/$TUI_LAST_CMD}"

    # $? → last exit code
    input="${input//\$\?/$TUI_LAST_EXIT}"

    # $1-$9 → history by index
    for i in {1..9}; do
        local idx=$((i - 1))
        if [[ $idx -lt ${#TUI_OUTPUT_HISTORY[@]} ]]; then
            input="${input//\$$i/${TUI_OUTPUT_HISTORY[$idx]}}"
        fi
    done

    echo "$input"
}

# Execute CLI command with output capture
execute_cli_command() {
    local input="$1"
    local mod="${TUI_MODS[$TUI_MOD_IDX]:-}"

    # Parse: "cmd arg1 arg2" -> cmd and args
    local cmd="${input%% *}"
    local args="${input#* }"
    [[ "$args" == "$input" ]] && args=""

    # Check for builtin commands first
    if tui_builtin_command "$cmd" $args; then
        return 0
    fi

    # Expand variables
    input=$(tui_expand_vars "$input")
    cmd="${input%% *}"
    args="${input#* }"
    [[ "$args" == "$input" ]] && args=""

    # Store command
    TUI_LAST_CMD="$mod $cmd $args"
    ((TUI_OUTPUT_COUNT++))

    # Execute and capture output
    local output=""
    local exit_code=0

    if declare -f "$mod" &>/dev/null; then
        # Module dispatcher exists
        output=$("$mod" $cmd $args 2>&1)
        exit_code=$?
    elif declare -f "${mod}_${cmd}" &>/dev/null; then
        # Direct function call
        output=$("${mod}_${cmd}" $args 2>&1)
        exit_code=$?
    else
        output="Unknown: $mod $cmd"
        exit_code=1
    fi

    # Store in history
    TUI_LAST_OUTPUT="$output"
    TUI_LAST_EXIT=$exit_code
    TUI_OUTPUT_HISTORY+=("$output")

    # Keep history bounded (last 20)
    if [[ ${#TUI_OUTPUT_HISTORY[@]} -gt 20 ]]; then
        TUI_OUTPUT_HISTORY=("${TUI_OUTPUT_HISTORY[@]:1}")
    fi

    # Log execution
    local status_icon=$([[ $exit_code -eq 0 ]] && echo "✓" || echo "✗")
    MIDI_LOG+=("$status_icon [$TUI_OUTPUT_COUNT] $mod $cmd")

    # Store output for display in content area
    TUI_CONTENT="$output"
}

# Handle MIDI event - parse osc_listen format
handle_midi() {
    local line="$1"

    # Parse: __EVENT__ 1 545 545 raw CC 1 40 55
    if [[ "$line" =~ raw[[:space:]]+CC[[:space:]]+([0-9]+)[[:space:]]+([0-9]+)[[:space:]]+([0-9]+) ]]; then
        local cc="${BASH_REMATCH[2]}"
        local val="${BASH_REMATCH[3]}"

        # Update last CC state
        MIDI_LAST_CC="$cc"
        MIDI_LAST_VAL="$val"
        MIDI_CC_VAL[$cc]="$val"

        # Handle CC (update indices)
        handle_cc "$cc" "$val"
    fi
    return 0
}

# Handle screen resize
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
    local org="${TUI_ORGS[$TUI_ORG_IDX]:-none}"
    local mod="${TUI_MODS[$TUI_MOD_IDX]:-tetra}"
    local env="${TUI_ENVS[$TUI_ENV_IDX]:-local}"

    # Home and clear
    printf '\e[H\e[J'

    # Row 1: Title
    printf '\e[1;1H\e[1;36m⁘ Tetra Control Center\e[0m'

    # Row 2: Context [org × mod × env]
    printf '\e[2;1H\e[90m[\e[35m%s\e[90m × \e[1;33m%s\e[0;90m × \e[34m%s\e[90m]\e[0m' "$org" "$mod" "$env"

    # Row 3: MIDI status + current CC values
    local cc_display=""
    for cc in 30 31 32 40; do
        [[ -n "${MIDI_CC_VAL[$cc]:-}" ]] && cc_display+="\e[90mCC$cc=\e[32m${MIDI_CC_VAL[$cc]}\e[0m "
    done
    printf '\e[3;1H\e[K\e[1;34mMIDI:\e[0m \e[32m●\e[0m %b' "$cc_display"

    # Row 4: CC mappings
    printf '\e[4;1H\e[90mCC30:\e[35m%s\e[90m CC31:\e[33m%s\e[90m CC32:\e[34m%s\e[0m' "$org" "$mod" "$env"

    # Content area (rows 5 to TUI_SPLIT-1)
    local content_start=5
    local content_end=$((TUI_SPLIT - 1))
    local content_lines=$((content_end - content_start + 1))

    # Clear content area
    for ((row=content_start; row<=content_end; row++)); do
        printf '\e[%d;1H\e[K' "$row"
    done

    # Show command output if available
    if [[ -n "$TUI_CONTENT" ]]; then
        local line_num=0
        # Strip ANSI codes for clean positioning, then re-apply per line
        local clean_content
        clean_content=$(echo "$TUI_CONTENT" | sed 's/\x1b\[[0-9;]*m//g')
        while IFS= read -r line && [[ $line_num -lt $content_lines ]]; do
            printf '\e[%d;1H\e[K%s' "$((content_start + line_num))" "${line:0:$((TUI_WIDTH-1))}"
            ((line_num++))
        done <<< "$clean_content"

        # Show scroll hint if more content
        local total_lines=$(echo "$clean_content" | wc -l)
        if [[ $total_lines -gt $content_lines ]]; then
            printf '\e[%d;%dH\e[90m↓ +%d lines\e[0m' "$content_end" "$((TUI_WIDTH-12))" "$((total_lines - content_lines))"
        fi
    # Show MIDI log only when midi module selected
    elif [[ "$mod" == "midi" ]]; then
        local log_count=${#MIDI_LOG[@]}
        for ((row=content_start; row<=content_end; row++)); do
            local idx=$((log_count - (content_end - row) - 1))
            if ((idx >= 0 && idx < log_count)); then
                printf '\e[%d;1H\e[90m%s\e[0m' "$row" "${MIDI_LOG[$idx]}"
            fi
        done
    fi

    # Separator at TUI_SPLIT
    printf '\e[%d;1H' "$TUI_SPLIT"
    for ((i=0; i<TUI_WIDTH; i++)); do printf '\e[90m─\e[0m'; done

    # CLI area at TUI_SPLIT+1
    local cli_row=$((TUI_SPLIT+1))
    printf '\e[%d;1H\e[K' "$cli_row"

    if [[ "$CLI_MODE" == "command" ]]; then
        # Show context prompt with input
        printf '\e[%d;1H\e[90m[\e[35m%s\e[90m × \e[33m%s\e[90m × \e[34m%s\e[90m]:\e[0m%s\e[7m \e[0m' \
            "$cli_row" "$org" "$mod" "$env" "$CLI_INPUT"

        # Render dropdown box if open
        if [[ $DROPDOWN_OPEN -eq 1 && ${#CLI_COMPLETIONS[@]} -gt 0 ]]; then
            render_dropdown "$cli_row"
        fi
    else
        printf '\e[%d;1H\e[90m:\e[0m' "$cli_row"
    fi

    # Footer at bottom
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

# Render dropdown menu (tcurses-style: columns + descriptions)
render_dropdown() {
    local prompt_row="$1"
    local total=${#CLI_COMPLETIONS[@]}
    local cols=3
    local item_width=20
    local max_visible_rows=3

    # Calculate available space
    local available=$((TUI_HEIGHT - prompt_row - 4))
    [[ $available -lt 2 ]] && available=2
    [[ $available -lt $max_visible_rows ]] && max_visible_rows=$available

    local total_rows=$(( (total + cols - 1) / cols ))
    local visible_rows=$total_rows
    [[ $visible_rows -gt $max_visible_rows ]] && visible_rows=$max_visible_rows

    # Calculate scroll offset to keep selected visible
    local selected_row=$((DROPDOWN_IDX % total_rows))
    if [[ $selected_row -lt $DROPDOWN_SCROLL ]]; then
        DROPDOWN_SCROLL=$selected_row
    elif [[ $selected_row -ge $((DROPDOWN_SCROLL + max_visible_rows)) ]]; then
        DROPDOWN_SCROLL=$((selected_row - max_visible_rows + 1))
    fi

    # Draw items in columns
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
                    # Selected: ▶ and bold cyan
                    printf '  \e[1;36m▶\e[0m \e[1;33m%-*s\e[0m' "$((item_width-1))" "$display"
                else
                    # Normal: dim
                    printf '    \e[2m%-*s\e[0m' "$((item_width-1))" "$display"
                fi
            fi
        done
        ((row_num++))
    done

    # Scroll indicator
    if [[ $total_rows -gt $max_visible_rows ]]; then
        printf '\e[%d;1H\e[K' "$row_num"
        local indicator=""
        [[ $DROPDOWN_SCROLL -gt 0 ]] && indicator+="↑ "
        indicator+="$((DROPDOWN_IDX+1))/$total"
        [[ $((DROPDOWN_SCROLL + max_visible_rows)) -lt $total_rows ]] && indicator+=" ↓"
        printf '  \e[2m%s more\e[0m' "$indicator"
        ((row_num++))
    fi

    # Description line (blank for now - could add hints)
    printf '\e[%d;1H\e[K' "$row_num"
    printf '\e[%d;1H\e[K' "$((row_num+1))"
}

# =============================================================================
# MAIN
# =============================================================================

tetra_tui2() {
    [[ ! -x "$TUI_CORE" ]] && { echo "tui-core not found: $TUI_CORE"; return 1; }
    [[ ! -x "$OSC_LISTEN" ]] && { echo "osc_listen not found: $OSC_LISTEN"; return 1; }

    # Note: tui-core handles terminal setup (alternate screen, raw mode)
    # Start tui-core coprocess (redirect stderr to hide OSC messages)
    coproc TUI_COPROC { "$TUI_CORE" "$OSC_LISTEN" 2>/dev/null; }

    # Verify coproc started
    if [[ -z "${TUI_COPROC_PID:-}" ]]; then
        echo "Failed to start tui-core coprocess" >&2
        return 1
    fi

    # Use global for cleanup function access
    declare -g _TUI_CORE_PID=$TUI_COPROC_PID

    # Cleanup on exit (tui-core restores terminal on exit)
    cleanup_tui2() {
        [[ -n "${_TUI_CORE_PID:-}" ]] && {
            kill "$_TUI_CORE_PID" 2>/dev/null
            wait "$_TUI_CORE_PID" 2>/dev/null
        }
        unset _TUI_CORE_PID
    }
    trap cleanup_tui2 EXIT INT TERM

    # Disable strict mode for resilient event loop
    set +eu

    # Crash log file
    local crash_log="/tmp/tui2-crash.log"
    echo "=== TUI started $(date) ===" >> "$crash_log"

    # Error trap - log to file AND continue
    _tui_error_handler() {
        echo "ERR line $1: $2" >> "$crash_log"
    }
    trap '_tui_error_handler $LINENO "$BASH_COMMAND"' ERR

    # Exit trap - log why we're exiting
    _tui_exit_handler() {
        echo "EXIT at $(date) code=$?" >> "$crash_log"
    }
    trap '_tui_exit_handler' EXIT

    local last_state=""

    # Read events from tui-core
    while IFS= read -r line <&${TUI_COPROC[0]}; do
        # Log raw events
        echo "EVENT: $line" >> "$crash_log"

        local type="${line%%:*}"
        local data="${line#*:}"

        case "$type" in
            S)  # Screen size
                handle_resize "$data" || true
                render || true
                ;;
            K)  # Keyboard
                handle_keyboard "$data" || true
                ;;
            M)  # MIDI
                handle_midi "$data" || true
                echo "MIDI handled OK" >> "$crash_log"
                ;;
            Q)  # Quit
                break
                ;;
        esac

        # Render on meaningful state change only
        local cur_state="$TUI_ORG_IDX:$TUI_MOD_IDX:$TUI_ENV_IDX:$TUI_SPLIT:$CLI_MODE:$CLI_INPUT:$DROPDOWN_OPEN:$DROPDOWN_IDX"
        if [[ "$cur_state" != "$last_state" ]]; then
            last_state="$cur_state"
            render || true
        fi
    done

    # Log why loop ended
    echo "LOOP ENDED - checking coproc status" >> "$crash_log"
    if kill -0 "$_TUI_CORE_PID" 2>/dev/null; then
        echo "tui-core still running (pid $_TUI_CORE_PID)" >> "$crash_log"
    else
        wait "$_TUI_CORE_PID" 2>/dev/null
        echo "tui-core DIED with exit code $?" >> "$crash_log"
    fi

    # Cleanup
    cleanup_tui2
    trap - EXIT INT TERM ERR
}

# Run if executed directly
[[ "${BASH_SOURCE[0]}" == "$0" ]] && tetra_tui2 "$@" || true
