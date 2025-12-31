#!/usr/bin/env bash
# tui.sh - Tetra TUI with context picker
# Left/Right: switch slots | Up/Down: cycle values | :: command mode | q: quit

: "${TETRA_SRC:?TETRA_SRC must be set}"

TUI_DIR="$TETRA_SRC/bash/tetra/interfaces/tui"
TUI_CORE="$TUI_DIR/tui-core"
OSC_LISTEN="$TETRA_SRC/bash/midi/osc_listen"

# Source tetra's classifier (steered by melvin)
source "$TETRA_SRC/bash/tetra/tetra_classify.sh"

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

# Context picker: slot 0=org, 1=topic(mod), 2=filter(type)
declare -g CTX_SLOT=1  # Start on topic (most common)
declare -g TUI_ORG_IDX=0
declare -g TUI_MOD_IDX=0
declare -g TUI_FILTER_IDX=0  # Default to ALL
declare -ga TUI_ORGS=()
declare -ga TUI_MODS=()
declare -ga TUI_FILTERS=("ALL" "LIBRARY" "MODULE" "APP" "APP+MODULE" "SCRIPTS")
declare -gA TUI_MOD_TYPES=()  # Cache: mod_name -> type

# Colors: org=magenta, topic=yellow, filter=blue
declare -g COLOR_ORG=35
declare -g COLOR_MOD=33
declare -g COLOR_FILTER=34

# MIDI state
declare -gA MIDI_CC_VAL=()

# CLI state
declare -g CLI_MODE="normal"  # normal | command | results
declare -g CLI_INPUT=""
declare -ga CLI_COMPLETIONS=()
declare -g CLI_COMP_IDX=0
declare -g DROPDOWN_OPEN=0
declare -g DROPDOWN_IDX=0
declare -g DROPDOWN_TYPE="cmd"  # cmd | help

# Output stack (most recent first)
declare -ga OUTPUT_STACK=()      # Array of output entries
declare -ga OUTPUT_COLLAPSED=()  # Collapsed state per entry
declare -g OUTPUT_MAX=20         # Max stack depth
declare -g RESULTS_IDX=0         # Current result when in results mode
declare -g TUI_CONTENT=""

# Command registry: name|description|category
declare -ga CMD_REGISTRY=(
    "help|Show all commands and navigation|nav"
    "files|List .sh files in module|explore"
    "grep|Search pattern in module|explore"
    "cat|Show file contents|explore"
    "tsm|Show service manifest|module"
    "stats|Show module statistics|module"
    "path|Show module path|module"
    "clear|Clear content area|util"
    "funcs|List module functions|explore"
    "deps|Show module dependencies|module"
)

# Build org list
for d in ~/tetra/orgs/*/; do
    [[ -d "$d" && ! -L "${d%/}" ]] || continue
    TUI_ORGS+=("$(basename "$d")")
done
IFS=$'\n' TUI_ORGS=($(sort <<<"${TUI_ORGS[*]}")); unset IFS
[[ ${#TUI_ORGS[@]} -eq 0 ]] && TUI_ORGS=("none")

# Get module path for current org
get_org_path() {
    local org="${1:-${TUI_ORGS[$TUI_ORG_IDX]:-tetra}}"
    if [[ "$org" == "tetra" ]]; then
        echo "$TETRA_SRC/bash"
    else
        echo "$TETRA_DIR/orgs/$org"
    fi
}

# Classify all modules in current org (uses tetra_classify.sh)
classify_org_mods() {
    local org_path=$(get_org_path)
    tetra_classify_all "$org_path"
    # Copy to TUI arrays for compatibility
    TUI_MOD_TYPES=()
    for mod in "${TETRA_MOD_LIST[@]}"; do
        TUI_MOD_TYPES["$mod"]="${TETRA_MOD_TYPE[$mod]}"
    done
}

# Filter cached modules by type (fast, run on filter change)
rebuild_mods() {
    local filter="${TUI_FILTERS[$TUI_FILTER_IDX]}"
    TUI_MODS=()
    TUI_MOD_IDX=0

    for mod in "${TETRA_MOD_LIST[@]}"; do
        local type="${TETRA_MOD_TYPE[$mod]:-SCRIPTS}"
        if [[ "$filter" == "ALL" ]] || [[ "$type" == "$filter" ]]; then
            TUI_MODS+=("$mod")
        fi
    done
}

# Get stats for current module
get_mod_stats() {
    local org_path=$(get_org_path)
    local mod="${TUI_MODS[$TUI_MOD_IDX]:-}"
    local mod_path="$org_path/$mod"

    [[ -z "$mod" || ! -d "$mod_path" ]] && { echo "No module selected"; return; }

    local mod_type="${TUI_MOD_TYPES[$mod]:-UNKNOWN}"
    local file_count=$(find "$mod_path" -type f -name "*.sh" 2>/dev/null | wc -l | tr -d ' ')
    local line_count=$(find "$mod_path" -type f -name "*.sh" -exec cat {} + 2>/dev/null | wc -l | tr -d ' ')
    local last_mod=$(find "$mod_path" -type f -name "*.sh" -exec stat -f "%m %N" {} \; 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
    local has_tsm=$([[ -f "$mod_path/$mod.tsm" ]] && echo "yes" || echo "no")
    local has_tests=$([[ -d "$mod_path/tests" ]] && echo "yes" || echo "no")

    printf "Type: %s\n" "$mod_type"
    printf "Path: %s\n" "$mod_path"
    printf "Files: %s  Lines: %s\n" "$file_count" "$line_count"
    printf "TSM: %s  Tests: %s\n" "$has_tsm" "$has_tests"
    [[ -n "$last_mod" ]] && printf "Recent: %s\n" "$(basename "$last_mod")"
}

# Initial module build
classify_org_mods
rebuild_mods

# =============================================================================
# HELPERS
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

ctx_slot_up() {
    case $CTX_SLOT in
        0)  # Org - reclassify on change
            ((TUI_ORG_IDX = (TUI_ORG_IDX - 1 + ${#TUI_ORGS[@]}) % ${#TUI_ORGS[@]}))
            classify_org_mods
            rebuild_mods
            TUI_CONTENT=$(get_mod_stats)
            ;;
        1)  # Topic (mod)
            [[ ${#TUI_MODS[@]} -gt 0 ]] && {
                ((TUI_MOD_IDX = (TUI_MOD_IDX - 1 + ${#TUI_MODS[@]}) % ${#TUI_MODS[@]}))
                tui_load_module
                TUI_CONTENT=$(get_mod_stats)
            }
            ;;
        2)  # Filter - just re-filter cached mods (fast)
            ((TUI_FILTER_IDX = (TUI_FILTER_IDX - 1 + ${#TUI_FILTERS[@]}) % ${#TUI_FILTERS[@]}))
            rebuild_mods
            ;;
    esac
}

ctx_slot_down() {
    case $CTX_SLOT in
        0)  # Org - reclassify on change
            ((TUI_ORG_IDX = (TUI_ORG_IDX + 1) % ${#TUI_ORGS[@]}))
            classify_org_mods
            rebuild_mods
            TUI_CONTENT=$(get_mod_stats)
            ;;
        1)  # Topic (mod)
            [[ ${#TUI_MODS[@]} -gt 0 ]] && {
                ((TUI_MOD_IDX = (TUI_MOD_IDX + 1) % ${#TUI_MODS[@]}))
                tui_load_module
                TUI_CONTENT=$(get_mod_stats)
            }
            ;;
        2)  # Filter - just re-filter cached mods (fast)
            ((TUI_FILTER_IDX = (TUI_FILTER_IDX + 1) % ${#TUI_FILTERS[@]}))
            rebuild_mods
            ;;
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

# Get help entries for dropdown (from CMD_REGISTRY)
get_help_completions() {
    CLI_COMPLETIONS=()
    for entry in "${CMD_REGISTRY[@]}"; do
        CLI_COMPLETIONS+=("$entry")
    done
    DROPDOWN_TYPE="help"
}

# Get command completions (existing behavior)
get_completions() {
    local mod="${TUI_MODS[$TUI_MOD_IDX]:-}"
    local prefix="$1"
    local -a completions=()
    DROPDOWN_TYPE="cmd"

    # Built-in commands first
    for entry in "${CMD_REGISTRY[@]}"; do
        local cmd="${entry%%|*}"
        [[ -z "$prefix" || "$cmd" == "$prefix"* ]] && completions+=("$cmd")
    done

    # Module-specific commands
    if [[ -n "$mod" && "$mod" != "(empty)" ]]; then
        local var="${mod^^}_COMMANDS"
        if declare -p "$var" &>/dev/null 2>&1; then
            local -n cmd_array="$var"
            for cmd in "${cmd_array[@]}"; do
                [[ -z "$prefix" || "$cmd" == "$prefix"* ]] && completions+=("$cmd")
            done
        fi
        if [[ ${#completions[@]} -lt 5 ]]; then
            local org_path=$(get_org_path)
            local mod_file="$org_path/$mod/$mod.sh"
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
# OUTPUT STACK
# =============================================================================

# Push result onto stack: header|command|content|timestamp
push_output() {
    local header="$1"
    local cmd="$2"
    local content="$3"
    local ts=$(date +%H:%M:%S)

    # Encode newlines in content for storage
    local encoded="${content//$'\n'/\\n}"

    # Insert at beginning (most recent first)
    OUTPUT_STACK=("${header}|${cmd}|${encoded}|${ts}" "${OUTPUT_STACK[@]}")
    OUTPUT_COLLAPSED=(0 "${OUTPUT_COLLAPSED[@]}")

    # Trim to max size
    while [[ ${#OUTPUT_STACK[@]} -gt $OUTPUT_MAX ]]; do
        unset 'OUTPUT_STACK[-1]'
        unset 'OUTPUT_COLLAPSED[-1]'
    done
}

# Toggle collapsed state
toggle_result_collapsed() {
    local idx="${1:-$RESULTS_IDX}"
    [[ $idx -lt ${#OUTPUT_COLLAPSED[@]} ]] && {
        OUTPUT_COLLAPSED[$idx]=$(( 1 - OUTPUT_COLLAPSED[$idx] ))
    }
}

# =============================================================================
# COMMANDS
# =============================================================================

execute_command() {
    local input="$1"
    local org="${TUI_ORGS[$TUI_ORG_IDX]:-tetra}"
    local mod="${TUI_MODS[$TUI_MOD_IDX]:-}"
    local filter="${TUI_FILTERS[$TUI_FILTER_IDX]:-ALL}"
    local mod_type="${TUI_MOD_TYPES[$mod]:-}"
    local org_path=$(get_org_path)
    local mod_path="$org_path/$mod"
    local cmd="${input%% *}"
    local args="${input#* }"; [[ "$args" == "$input" ]] && args=""

    local output=""
    local header="${org}/${mod}[${mod_type:-?}]"

    # Built-in investigation commands
    case "$cmd" in
        clear|cls)
            OUTPUT_STACK=()
            OUTPUT_COLLAPSED=()
            TUI_CONTENT=""
            return ;;
        help|h|\?)
            output="Navigation: ←→ slot | ↑↓ value | : cmd | Tab results | q quit"
            for entry in "${CMD_REGISTRY[@]}"; do
                local c="${entry%%|*}"
                local rest="${entry#*|}"
                local desc="${rest%%|*}"
                output+=$'\n'"  ${c}  ${desc}"
            done
            ;;
        files|ls)
            [[ ! -d "$mod_path" ]] && { output="No module path"; push_output "$header" ":$input" "$output"; return; }
            output=$(find "$mod_path" -maxdepth 2 -name "*.sh" -type f 2>/dev/null | sed "s|$mod_path/||" | sort)
            ;;
        grep|search)
            [[ -z "$args" ]] && { output="Usage: grep <pattern>"; push_output "$header" ":$input" "$output"; return; }
            [[ ! -d "$mod_path" ]] && { output="No module path"; push_output "$header" ":$input" "$output"; return; }
            output=$(grep -rn --include="*.sh" "$args" "$mod_path" 2>/dev/null | sed "s|$mod_path/||" | head -20)
            [[ -z "$output" ]] && output="No matches"
            ;;
        cat|show)
            [[ -z "$args" ]] && { output="Usage: cat <file>"; push_output "$header" ":$input" "$output"; return; }
            local file="$mod_path/$args"
            [[ -f "$file" ]] && output=$(head -50 "$file") || output="File not found: $args"
            ;;
        tsm)
            if [[ -f "$mod_path/$mod.tsm" ]]; then
                output=$(cat "$mod_path/$mod.tsm")
            else
                output="No .tsm file for $mod"
            fi
            ;;
        stats)
            output=$(get_mod_stats)
            ;;
        path)
            output="$mod_path"
            ;;
        funcs)
            [[ ! -d "$mod_path" ]] && { output="No module path"; push_output "$header" ":$input" "$output"; return; }
            output=$(grep -h '^[a-z_][a-z0-9_]*()' "$mod_path"/*.sh 2>/dev/null | sed 's/().*//' | sort -u | head -30)
            [[ -z "$output" ]] && output="No functions found"
            ;;
        deps)
            [[ ! -d "$mod_path" ]] && { output="No module path"; push_output "$header" ":$input" "$output"; return; }
            output=$(grep -h 'source\|^\.\s' "$mod_path"/*.sh 2>/dev/null | grep -v '^#' | sort -u | head -20)
            [[ -z "$output" ]] && output="No dependencies found"
            ;;
        *)
            # Try module dispatch
            if declare -f "$mod" &>/dev/null; then
                output=$("$mod" $cmd $args 2>&1)
            else
                output="Unknown: $cmd (try :help)"
            fi
            ;;
    esac

    # Push to output stack
    push_output "$header" ":$input" "$output"
    TUI_CONTENT="$output"
}

# =============================================================================
# KEYBOARD
# =============================================================================

handle_keyboard() {
    local key=$(_unescape_key "$1")

    # Results mode - navigate the output stack
    if [[ "$CLI_MODE" == "results" ]]; then
        case "$key" in
            $'\e'|q)
                CLI_MODE="normal"
                ;;
            $'\e[A'|$'\eOA'|k)  # Up - newer result
                [[ ${#OUTPUT_STACK[@]} -gt 0 ]] && ((RESULTS_IDX = (RESULTS_IDX - 1 + ${#OUTPUT_STACK[@]}) % ${#OUTPUT_STACK[@]}))
                ;;
            $'\e[B'|$'\eOB'|j)  # Down - older result
                [[ ${#OUTPUT_STACK[@]} -gt 0 ]] && ((RESULTS_IDX = (RESULTS_IDX + 1) % ${#OUTPUT_STACK[@]}))
                ;;
            $'\t'|' ')  # Toggle collapse
                toggle_result_collapsed
                ;;
            $'\n'|$'\r')  # Expand and show full output
                [[ ${#OUTPUT_STACK[@]} -gt 0 ]] && {
                    local entry="${OUTPUT_STACK[$RESULTS_IDX]}"
                    local content="${entry#*|}"
                    content="${content#*|}"
                    content="${content%|*}"
                    # Decode newlines
                    TUI_CONTENT="${content//\\n/$'\n'}"
                }
                ;;
        esac
        return
    fi

    # Command mode
    if [[ "$CLI_MODE" == "command" ]]; then
        case "$key" in
            $'\e')
                CLI_MODE="normal"
                CLI_INPUT=""
                DROPDOWN_OPEN=0
                ;;
            $'\n'|$'\r')
                if [[ $DROPDOWN_OPEN -eq 1 && ${#CLI_COMPLETIONS[@]} -gt 0 ]]; then
                    if [[ "$DROPDOWN_TYPE" == "help" ]]; then
                        # Extract just the command name
                        CLI_INPUT="${CLI_COMPLETIONS[$DROPDOWN_IDX]%%|*}"
                    else
                        CLI_INPUT="${CLI_COMPLETIONS[$DROPDOWN_IDX]}"
                    fi
                fi
                [[ -n "$CLI_INPUT" ]] && execute_command "$CLI_INPUT"
                CLI_MODE="normal"
                CLI_INPUT=""
                DROPDOWN_OPEN=0
                ;;
            $'\t')
                if [[ -z "$CLI_INPUT" ]]; then
                    # Empty input: show help dropdown
                    get_help_completions
                    DROPDOWN_OPEN=1
                    DROPDOWN_IDX=0
                else
                    # Has input: show command completions
                    get_completions "$CLI_INPUT"
                    [[ ${#CLI_COMPLETIONS[@]} -gt 0 ]] && {
                        DROPDOWN_OPEN=1
                        ((DROPDOWN_IDX = (DROPDOWN_IDX + 1) % ${#CLI_COMPLETIONS[@]}))
                    }
                fi
                ;;
            $'\e[A'|$'\eOA')
                [[ $DROPDOWN_OPEN -eq 1 ]] && ((DROPDOWN_IDX = (DROPDOWN_IDX - 1 + ${#CLI_COMPLETIONS[@]}) % ${#CLI_COMPLETIONS[@]}))
                ;;
            $'\e[B'|$'\eOB')
                [[ $DROPDOWN_OPEN -eq 1 ]] && ((DROPDOWN_IDX = (DROPDOWN_IDX + 1) % ${#CLI_COMPLETIONS[@]}))
                ;;
            $'\x7f'|$'\b')
                [[ -n "$CLI_INPUT" ]] && {
                    CLI_INPUT="${CLI_INPUT%?}"
                    get_completions "$CLI_INPUT"
                    DROPDOWN_IDX=0
                }
                ;;
            *)
                [[ ${#key} -eq 1 && "$key" =~ [[:print:]] ]] && {
                    CLI_INPUT+="$key"
                    get_completions "$CLI_INPUT"
                    DROPDOWN_IDX=0
                    DROPDOWN_OPEN=1
                }
                ;;
        esac
        return
    fi

    # Normal mode - ctx picker navigation
    case "$key" in
        $'\e[C')  # Right
            ((CTX_SLOT = (CTX_SLOT + 1) % 3))
            [[ $CTX_SLOT -eq 1 ]] && TUI_CONTENT=$(get_mod_stats)
            ;;
        $'\e[D')  # Left
            ((CTX_SLOT = (CTX_SLOT + 2) % 3))
            [[ $CTX_SLOT -eq 1 ]] && TUI_CONTENT=$(get_mod_stats)
            ;;
        $'\e[A')  # Up
            ctx_slot_up
            ;;
        $'\e[B')  # Down
            ctx_slot_down
            ;;
        :)
            CLI_MODE="command"
            CLI_INPUT=""
            get_completions ""
            ;;
        $'\t')  # Tab to enter results mode
            [[ ${#OUTPUT_STACK[@]} -gt 0 ]] && {
                CLI_MODE="results"
                RESULTS_IDX=0
            }
            ;;
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
        30) ((${#TUI_ORGS[@]} > 0)) && { TUI_ORG_IDX=$(( val * (${#TUI_ORGS[@]} - 1) / 127 )); classify_org_mods; rebuild_mods; } ;;
        31) ((${#TUI_MODS[@]} > 0)) && { TUI_MOD_IDX=$(( val * (${#TUI_MODS[@]} - 1) / 127 )); tui_load_module; } ;;
        32) ((${#TUI_FILTERS[@]} > 0)) && { TUI_FILTER_IDX=$(( val * (${#TUI_FILTERS[@]} - 1) / 127 )); rebuild_mods; } ;;
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
    local mod="${TUI_MODS[$TUI_MOD_IDX]:-}"
    local filter="${TUI_FILTERS[$TUI_FILTER_IDX]:-ALL}"
    local mod_count=${#TUI_MODS[@]}

    printf '\e[H\e[J'

    # Row 1: Title
    printf '\e[1;1H\e[1;36m⁘ Tetra\e[0m'

    # Row 2: Context picker with current slot bold
    printf '\e[2;1H'
    # Org
    [[ $CTX_SLOT -eq 0 ]] && printf '\e[1;%dm▶%s◀\e[0m' "$COLOR_ORG" "$org" || printf '\e[%dm %s \e[0m' "$COLOR_ORG" "$org"
    printf '\e[90m:\e[0m'
    # Topic (mod) - show count if empty
    if [[ -n "$mod" ]]; then
        [[ $CTX_SLOT -eq 1 ]] && printf '\e[1;%dm▶%s◀\e[0m' "$COLOR_MOD" "$mod" || printf '\e[%dm %s \e[0m' "$COLOR_MOD" "$mod"
    else
        printf '\e[90m(0)\e[0m'
    fi
    printf '\e[90m:\e[0m'
    # Filter - show count
    [[ $CTX_SLOT -eq 2 ]] && printf '\e[1;%dm▶%s◀\e[0m' "$COLOR_FILTER" "$filter" || printf '\e[%dm %s \e[0m' "$COLOR_FILTER" "$filter"
    printf '\e[90m(%d)\e[0m' "$mod_count"

    # Row 3: MIDI CCs if any
    local cc_str=""
    for cc in 30 31 32 40; do
        [[ -n "${MIDI_CC_VAL[$cc]:-}" ]] && cc_str+="\e[90mCC$cc:\e[32m${MIDI_CC_VAL[$cc]} \e[0m"
    done
    [[ -n "$cc_str" ]] && printf '\e[3;1H%b' "$cc_str"

    # Content area (upper pane)
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

    # CLI row
    local cli_row=$((TUI_SPLIT + 1))

    if [[ "$CLI_MODE" == "results" ]]; then
        # Results mode - show navigation hint
        printf '\e[%d;1H\e[7m RESULTS \e[0m \e[90m↑↓:nav Tab:collapse Enter:expand Esc:back\e[0m' "$cli_row"
    elif [[ "$CLI_MODE" == "command" ]]; then
        printf '\e[%d;1H\e[K\e[90m%s:\e[0m%s\e[7m \e[0m' "$cli_row" "$mod" "$CLI_INPUT"

        # Dropdown for help or completions
        if [[ $DROPDOWN_OPEN -eq 1 && ${#CLI_COMPLETIONS[@]} -gt 0 ]]; then
            local dr=$((cli_row + 1)) max=8
            for ((i=0; i<${#CLI_COMPLETIONS[@]} && i<max; i++)); do
                local entry="${CLI_COMPLETIONS[$i]}"
                local display_text

                if [[ "$DROPDOWN_TYPE" == "help" ]]; then
                    # Parse: name|description|category
                    local cmd="${entry%%|*}"
                    local rest="${entry#*|}"
                    local desc="${rest%%|*}"
                    local cat="${rest#*|}"
                    # Format: command + description with category color
                    local cat_color=90
                    case "$cat" in
                        nav) cat_color=36 ;;
                        explore) cat_color=33 ;;
                        module) cat_color=35 ;;
                        util) cat_color=32 ;;
                    esac
                    display_text=$(printf '%-8s \e[%dm%s\e[0m' "$cmd" "$cat_color" "$desc")
                else
                    display_text="$entry"
                fi

                if [[ $i -eq $DROPDOWN_IDX ]]; then
                    printf '\e[%d;1H\e[K\e[1;33m▶ %b\e[0m' "$dr" "$display_text"
                else
                    printf '\e[%d;1H\e[K  \e[90m%b\e[0m' "$dr" "$display_text"
                fi
                ((dr++))
            done
        fi
    else
        # Normal mode hint
        printf '\e[%d;1H\e[90m←→:slot ↑↓:value ::cmd Tab:results q:quit\e[0m' "$cli_row"
    fi

    # Output stack below CLI (the "downstairs")
    local stack_start=$((cli_row + 2))
    [[ "$CLI_MODE" == "command" && $DROPDOWN_OPEN -eq 1 ]] && stack_start=$((cli_row + 10))

    local stack_row=$stack_start
    local max_stack_rows=$((TUI_HEIGHT - stack_start))

    for ((i=0; i<${#OUTPUT_STACK[@]} && stack_row < TUI_HEIGHT; i++)); do
        local entry="${OUTPUT_STACK[$i]}"
        local collapsed="${OUTPUT_COLLAPSED[$i]:-0}"

        # Parse entry: header|command|content|timestamp
        local header="${entry%%|*}"
        local rest="${entry#*|}"
        local cmd="${rest%%|*}"
        rest="${rest#*|}"
        local content="${rest%|*}"
        local ts="${rest##*|}"

        # Decode newlines in content
        content="${content//\\n/$'\n'}"
        local first_line="${content%%$'\n'*}"
        local line_count=$(echo "$content" | wc -l | tr -d ' ')

        # Clear line
        printf '\e[%d;1H\e[K' "$stack_row"

        # Highlight if in results mode and selected
        local sel_prefix=""
        local sel_suffix=""
        if [[ "$CLI_MODE" == "results" && $i -eq $RESULTS_IDX ]]; then
            sel_prefix="\e[7m"
            sel_suffix="\e[0m"
        fi

        # Render header line (bold context + command)
        if [[ $collapsed -eq 1 ]]; then
            printf '\e[%d;1H%b\e[1;90m▸\e[0m \e[1m%s\e[0m \e[36m%s\e[0m \e[90m[%d lines] %s%b' \
                "$stack_row" "$sel_prefix" "$header" "$cmd" "$line_count" "$ts" "$sel_suffix"
        else
            printf '\e[%d;1H%b\e[1;90m▾\e[0m \e[1m%s\e[0m \e[36m%s\e[0m \e[90m%s%b' \
                "$stack_row" "$sel_prefix" "$header" "$cmd" "$ts" "$sel_suffix"
        fi
        ((stack_row++))

        # Show content if not collapsed
        if [[ $collapsed -eq 0 && $stack_row -lt $TUI_HEIGHT ]]; then
            # Show first few lines of content
            local content_max=$((max_stack_rows - (stack_row - stack_start) - 2))
            [[ $content_max -gt 5 ]] && content_max=5
            local lnum=0
            while IFS= read -r cline && ((lnum < content_max)) && ((stack_row < TUI_HEIGHT)); do
                printf '\e[%d;1H\e[K  \e[90m%s\e[0m' "$stack_row" "${cline:0:$((TUI_WIDTH-4))}"
                ((stack_row++))
                ((lnum++))
            done <<< "$content"
            [[ $line_count -gt $content_max ]] && {
                printf '\e[%d;1H\e[K  \e[90m... +%d more\e[0m' "$stack_row" "$((line_count - content_max))"
                ((stack_row++))
            }
        fi

        # Separator between stack entries
        [[ $stack_row -lt $TUI_HEIGHT ]] && {
            printf '\e[%d;1H\e[K\e[90m┄\e[0m' "$stack_row"
            ((stack_row++))
        }
    done
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

    # Disable errexit for event loop
    set +e

    local last_state=""
    while IFS= read -r line <&${TUI_COPROC[0]}; do
        local type="${line%%:*}" data="${line#*:}"
        case "$type" in
            S) handle_resize "$data" || true; render || true ;;
            K) handle_keyboard "$data" || true ;;
            M) handle_midi "$data" || true ;;
            Q) break ;;
        esac
        local cur_state="$CTX_SLOT:$TUI_ORG_IDX:$TUI_MOD_IDX:$TUI_FILTER_IDX:$CLI_MODE:$CLI_INPUT:${DROPDOWN_IDX:-0}:${RESULTS_IDX:-0}:${#OUTPUT_STACK[@]}"
        [[ "$cur_state" != "$last_state" ]] && { last_state="$cur_state"; render || true; }
    done

    trap - EXIT
}

[[ "${BASH_SOURCE[0]}" == "$0" ]] && tetra_tui "$@"
