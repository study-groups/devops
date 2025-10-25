#!/usr/bin/env bash
# Org REPL TUI - Full screen control with in-place prompt updates

source "$TETRA_SRC/bash/org/org_constants.sh"
source "$TETRA_SRC/bash/tcurses/tcurses.sh"
source "$TETRA_SRC/bash/color/repl_colors.sh"

# Load TDS for syntax highlighting support
if [[ -z "${TDS_LOADED:-}" ]] && [[ -f "$TETRA_SRC/bash/tds/tds.sh" ]]; then
    source "$TETRA_SRC/bash/tds/tds.sh" 2>/dev/null || true
fi

source "$TETRA_SRC/bash/org/actions.sh"

# State initialization function
_org_repl_init_state() {
    # Ensure constants are loaded
    if [[ ${#ORG_ENVIRONMENTS[@]} -eq 0 ]] || [[ ${#ORG_MODES[@]} -eq 0 ]]; then
        echo "ERROR: org_constants.sh not loaded properly" >&2
        echo "ORG_ENVIRONMENTS count: ${#ORG_ENVIRONMENTS[@]}" >&2
        echo "ORG_MODES count: ${#ORG_MODES[@]}" >&2
        return 1
    fi

    ORG_REPL_ENV_INDEX=0
    ORG_REPL_MODE_INDEX=0
    ORG_REPL_ACTION_INDEX=0
    ORG_REPL_ENVIRONMENTS=("${ORG_ENVIRONMENTS[@]}")
    ORG_REPL_MODES=("${ORG_MODES[@]}")
    ORG_REPL_INPUT=""
    ORG_REPL_CURSOR_POS=0
    ORG_REPL_OUTPUT_LINES=()
    ORG_REPL_RAW_CONTENT=()  # Raw unrendered content (for raw mode)
    ORG_REPL_OUTPUT_SCROLL_OFFSET=0  # Scroll position in output
    ORG_REPL_VIEW_MODE=false  # View mode: arrows scroll content
    ORG_REPL_VIEW_CHROMA=true  # View mode: chroma (colorized) vs raw
    ORG_REPL_VIEW_FILE=""  # File being viewed (if any)
    ORG_REPL_RUNNING=true
    ORG_REPL_SHOW_ACTION_MENU=false
    ORG_REPL_ACTION_MENU_INDEX=0
    ORG_REPL_COMMAND_HISTORY=()
    ORG_REPL_HISTORY_INDEX=-1
    ORG_REPL_LOG_LINES=()
    ORG_REPL_FOCUS=0  # 0=Env, 1=Mode, 2=Action
    ORG_REPL_CACHED_ACTIONS=()  # Cache for performance
    ORG_REPL_SAFETY_ON=true  # Safety mode (browsing) vs edit mode
}

# State cleanup function
_org_repl_cleanup() {
    unset ORG_REPL_ENV_INDEX ORG_REPL_MODE_INDEX ORG_REPL_ACTION_INDEX
    unset ORG_REPL_ENVIRONMENTS ORG_REPL_MODES
    unset ORG_REPL_INPUT ORG_REPL_CURSOR_POS ORG_REPL_FOCUS
    unset ORG_REPL_COMMAND_HISTORY ORG_REPL_HISTORY_INDEX
    unset ORG_REPL_OUTPUT_LINES ORG_REPL_RAW_CONTENT ORG_REPL_OUTPUT_SCROLL_OFFSET ORG_REPL_VIEW_MODE ORG_REPL_VIEW_CHROMA ORG_REPL_VIEW_FILE ORG_REPL_LOG_LINES
    unset ORG_REPL_RUNNING ORG_REPL_SHOW_ACTION_MENU ORG_REPL_ACTION_MENU_INDEX
    unset ORG_REPL_CACHED_ACTIONS ORG_REPL_SAFETY_ON
}

# Helpers
_org_active() { org_active 2>/dev/null || echo "none"; }

# Get actions with caching for performance
_org_actions() {
    # Return cached actions if available
    if [[ ${#ORG_REPL_CACHED_ACTIONS[@]} -gt 0 ]]; then
        echo "${ORG_REPL_CACHED_ACTIONS[@]}"
        return
    fi

    # Cache miss - fetch and cache
    local actions
    actions=$(org_get_actions "${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}" \
                              "${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}")
    ORG_REPL_CACHED_ACTIONS=($actions)
    echo "$actions"
}

# Invalidate action cache (call when env/mode changes)
_org_invalidate_cache() {
    ORG_REPL_CACHED_ACTIONS=()
}

# Build prompt string with focus indicators (with defensive checks)
_org_build_prompt_text() {
    local org=$(_org_active)

    # Safely get environment with bounds checking
    local env="UNKNOWN"
    if [[ ${#ORG_REPL_ENVIRONMENTS[@]} -gt 0 ]] && [[ $ORG_REPL_ENV_INDEX -lt ${#ORG_REPL_ENVIRONMENTS[@]} ]]; then
        env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
    fi

    # Safely get mode with bounds checking
    local mode="UNKNOWN"
    if [[ ${#ORG_REPL_MODES[@]} -gt 0 ]] && [[ $ORG_REPL_MODE_INDEX -lt ${#ORG_REPL_MODES[@]} ]]; then
        mode="${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
    fi

    # Safely get action with bounds checking
    local actions=($(_org_actions))
    local action="none"
    if [[ ${#actions[@]} -gt 0 ]] && [[ $ORG_REPL_ACTION_INDEX -lt ${#actions[@]} ]]; then
        action="${actions[$ORG_REPL_ACTION_INDEX]}"
    fi

    # Build colored prompt string (90% strength - normal colors)
    local prompt=""
    prompt+="$(text_color "$REPL_BRACKET")[$(reset_color)"

    if [[ -z "$org" || "$org" == "none" ]]; then
        prompt+="$(text_color "$REPL_ORG_INACTIVE")none$(reset_color)"
    else
        prompt+="$(text_color "$REPL_ORG_ACTIVE")${org}$(reset_color)"
    fi

    prompt+="$(text_color "$REPL_SEPARATOR") x $(reset_color)"

    # Environment
    prompt+="$(text_color "$(repl_env_color "$ORG_REPL_ENV_INDEX")")${env}$(reset_color)"

    prompt+="$(text_color "$REPL_SEPARATOR") x $(reset_color)"

    # Mode
    prompt+="$(text_color "$(repl_mode_color "$ORG_REPL_MODE_INDEX")")${mode}$(reset_color)"

    prompt+="$(text_color "$REPL_BRACKET")] $(reset_color)"

    # Action
    if [[ -z "$action" || "$action" == "none" ]]; then
        prompt+="$(text_color "$REPL_ACTION_NONE")none$(reset_color)"
    else
        prompt+="$(text_color "$REPL_ACTION_ACTIVE")${action}$(reset_color)"
    fi

    # Prompt indicator: dim when browsing, bold when action loaded
    if $ORG_REPL_SAFETY_ON; then
        # Browsing mode - dim prompt
        prompt+="\033[2m$(text_color "$REPL_ARROW")> $(reset_color)"
    else
        # Action loaded - bold prompt (ready to execute)
        prompt+="\033[1m$(text_color "$REPL_ARROW")> $(reset_color)"
    fi

    printf "%b" "$prompt"
}

# Render the screen
# Two modes:
# VIEW MODE (when ORG_REPL_VIEW_MODE=true):
#   Line 0: Dim info (file, position)
#   Line 1: [raw] [chroma*] toggle
#   Lines 2+: Content fills screen (no logs)
#
# NORMAL MODE:
#   Line 0: Header "org | tetra"
#   Line 1: Navigation keys
#   Line 2: Prompt/Input
#   Line 3: Status
#   Line 4: Blank separator
#   Lines 5 to height-6: Results
#   Last 4 lines: Log footer
_org_render() {
    local term_height=$(tput lines)
    local term_width=$(tput cols)

    tcurses_buffer_clear

    # VIEW MODE: Minimal UI for content viewing
    if $ORG_REPL_VIEW_MODE; then
        # Determine which content to show: raw or chroma
        local content_lines
        if $ORG_REPL_VIEW_CHROMA && [[ ${#ORG_REPL_OUTPUT_LINES[@]} -gt 0 ]]; then
            content_lines=("${ORG_REPL_OUTPUT_LINES[@]}")
        elif [[ ${#ORG_REPL_RAW_CONTENT[@]} -gt 0 ]]; then
            content_lines=("${ORG_REPL_RAW_CONTENT[@]}")
        else
            content_lines=("${ORG_REPL_OUTPUT_LINES[@]}")
        fi

        local total_lines=${#content_lines[@]}
        local visible_lines=$((term_height - 2))
        local end_idx=$((ORG_REPL_OUTPUT_SCROLL_OFFSET + visible_lines))
        [[ $end_idx -gt $total_lines ]] && end_idx=$total_lines
        local percent=$((total_lines > 0 ? (ORG_REPL_OUTPUT_SCROLL_OFFSET * 100 / total_lines) : 0))

        # Line 0: Dim info line
        local info_line="\033[2m"  # Dim
        if [[ -n "$ORG_REPL_VIEW_FILE" ]]; then
            local filetype=$(_org_detect_filetype "$ORG_REPL_VIEW_FILE")
            info_line+="$ORG_REPL_VIEW_FILE [$filetype] | "
        else
            info_line+="Output | "
        fi
        info_line+="Lines ${ORG_REPL_OUTPUT_SCROLL_OFFSET}-${end_idx}/${total_lines} | ${percent}%\033[0m"
        tcurses_buffer_write_line 0 "$info_line"

        # Line 1: raw/chroma toggle (medium bright)
        local toggle_line="$(text_color "$REPL_SEPARATOR")  "  # Indent
        if $ORG_REPL_VIEW_CHROMA; then
            toggle_line+="$(text_color "$REPL_SEPARATOR")[raw]$(reset_color) "
            toggle_line+="\033[1m$(text_color "$REPL_ACTION_ACTIVE")[chroma]$(reset_color)"
        else
            toggle_line+="\033[1m$(text_color "$REPL_ACTION_ACTIVE")[raw]$(reset_color) "
            toggle_line+="$(text_color "$REPL_SEPARATOR")[chroma]$(reset_color)"
        fi
        toggle_line+="$(text_color "$REPL_SEPARATOR")  (c to toggle, ESC to exit)$(reset_color)"
        tcurses_buffer_write_line 1 "$toggle_line"

        # Lines 2+: Content fills rest of screen
        local content_start=2
        local line_num=$content_start
        local start_idx=$ORG_REPL_OUTPUT_SCROLL_OFFSET

        for ((i = start_idx; i < total_lines && line_num < term_height; i++)); do
            local content_line="${content_lines[$i]}"
            tcurses_buffer_write_line $line_num "$content_line"
            ((line_num++))
        done

        tcurses_buffer_render_diff
        return
    fi

    # NORMAL MODE: Full UI with navigation, logs, etc.

    # Header (line 0) - org | tetra right-aligned with semantic colors
    local header_bare="org | tetra"  # 11 chars
    local header_text="$(text_color "$REPL_ORG_ACTIVE")\033[1morg$(reset_color) $(text_color "$REPL_SEPARATOR")|$(reset_color) $(text_color "$REPL_ACTION_ACTIVE")\033[1mtetra$(reset_color)"
    local header_padding=$((term_width - 11))
    [[ $header_padding -lt 0 ]] && header_padding=0
    tcurses_buffer_write_line 0 "$(printf '%*s' $header_padding '')${header_text}"

    # Navigation keys (line 1) - dimmed keys (50% brightness), dimmed help
    local help_text="\033[2m$(text_color "$REPL_ORG_ACTIVE")1-org$(reset_color) "
    help_text+="\033[2m$(text_color "$(repl_env_color 0)")2-env$(reset_color) "
    help_text+="\033[2m$(text_color "$(repl_mode_color 0)")3-mode$(reset_color) "
    help_text+="\033[2m$(text_color "$REPL_ACTION_ACTIVE")4-action$(reset_color) "
    help_text+="\033[2m| 'help' for more$(reset_color)"
    tcurses_buffer_write_line 1 "$help_text"

    # Prompt and input line (line 2) - more prominent
    local prompt_text="\033[1m$(_org_build_prompt_text)\033[0m"
    # Get theme-appropriate text color
    local input_text_color="$(get_theme_color text 2>/dev/null || echo 'FFFFFF')"

    # Build input line with cursor at correct position
    local input_display
    if ! $ORG_REPL_SAFETY_ON && [[ -z "$ORG_REPL_INPUT" ]]; then
        # Action selected but not edited - show it with ready indicator
        local actions=($(_org_actions))
        if [[ ${#actions[@]} -gt 0 ]] && [[ $ORG_REPL_ACTION_INDEX -lt ${#actions[@]} ]]; then
            local action="${actions[$ORG_REPL_ACTION_INDEX]}"
            input_display="${prompt_text}\033[1m${action}\033[0m"
        else
            input_display="${prompt_text}$(text_color "$input_text_color")█$(reset_color)"
        fi
    else
        # Normal input display with cursor - color the typed text
        local before_cursor="${ORG_REPL_INPUT:0:$ORG_REPL_CURSOR_POS}"
        local after_cursor="${ORG_REPL_INPUT:$ORG_REPL_CURSOR_POS}"
        input_display="${prompt_text}$(text_color "$input_text_color")${before_cursor}█${after_cursor}$(reset_color)"
    fi

    tcurses_buffer_write_line 2 "$input_display"

    # Status line (line 3) - dimmed, indented 5 spaces, under prompt, blue semantic
    local status_text=""
    local theme_name="${CURRENT_THEME:-dark}"

    # View mode indicator
    if $ORG_REPL_VIEW_MODE; then
        status_text="     \033[1m$(text_color "$REPL_ACTION_ACTIVE")[VIEW MODE]$(reset_color) \033[2m$(text_color "$REPL_MODE_INSPECT")↑↓ to scroll, ESC to exit$(reset_color)"
    elif $ORG_REPL_SAFETY_ON; then
        # Browsing mode - show action count and theme
        local actions=($(_org_actions))
        local env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
        local mode="${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
        status_text="     \033[2m$(text_color "$REPL_MODE_INSPECT")${#actions[@]} actions in $env × $mode | theme: $theme_name$(reset_color)"
    else
        # Action selected - show ready state and theme
        local actions=($(_org_actions))
        local action="${actions[$ORG_REPL_ACTION_INDEX]}"
        status_text="     \033[2m$(text_color "$REPL_MODE_INSPECT")Ready to execute: $action | theme: $theme_name$(reset_color)"
    fi
    tcurses_buffer_write_line 3 "$status_text"

    # Results area (from line 5 to term_height-6)
    local results_start=5
    local log_height=5  # 1 separator + 4 log lines
    local results_end=$((term_height - log_height - 1))
    local max_results_lines=$((results_end - results_start))
    local line_num=results_start

    tcurses_buffer_write_line 4 ""  # Blank line separator
    tcurses_buffer_write_line $line_num ""
    ((line_num++))

    # Show action menu if active
    if $ORG_REPL_SHOW_ACTION_MENU; then
        tcurses_buffer_write_line $line_num "Available actions (↑/↓ to navigate, Enter to select, Tab to close):"
        ((line_num++))
        tcurses_buffer_write_line $line_num ""
        ((line_num++))

        local actions=($(_org_actions))
        for ((i = 0; i < ${#actions[@]} && line_num <= results_end; i++)); do
            local action="${actions[$i]}"
            if [[ $i -eq $ORG_REPL_ACTION_MENU_INDEX ]]; then
                tcurses_buffer_write_line $line_num "  → $(text_color "$REPL_ACTION_ACTIVE")${action}$(reset_color)"
            else
                tcurses_buffer_write_line $line_num "    ${action}"
            fi
            ((line_num++))
        done
    else
        # Show regular output with scrolling support
        local total_output_lines=${#ORG_REPL_OUTPUT_LINES[@]}
        local start_idx=$ORG_REPL_OUTPUT_SCROLL_OFFSET
        local end_idx=$((start_idx + max_results_lines))

        for ((i = start_idx; i < total_output_lines && i < end_idx && line_num <= results_end; i++)); do
            tcurses_buffer_write_line $line_num "${ORG_REPL_OUTPUT_LINES[$i]}"
            ((line_num++))
        done

        # Show scroll indicator if there's more content
        if [[ $total_output_lines -gt $max_results_lines ]]; then
            local scroll_info="[${start_idx}-$((end_idx < total_output_lines ? end_idx : total_output_lines))/$total_output_lines]"
            if [[ $start_idx -gt 0 ]]; then
                scroll_info="↑ $scroll_info"
            fi
            if [[ $end_idx -lt $total_output_lines ]]; then
                scroll_info="$scroll_info ↓"
            fi
            # Add view mode hint if not in view mode
            if ! $ORG_REPL_VIEW_MODE; then
                scroll_info="$scroll_info $(text_color "$REPL_ACTION_ACTIVE")v$(reset_color)$(text_color "$REPL_SEPARATOR")-view"
            fi
            # Show at bottom right of results area
            tcurses_buffer_write_line $((results_end - 1)) "$(printf '%*s' $(($(tput cols) - 30)) '')$(text_color "$REPL_SEPARATOR")$scroll_info$(reset_color)"
        fi
    fi

    # Log footer (last 4 lines, bottom-up)
    local log_start=$((term_height - 4))
    tcurses_buffer_write_line $((log_start - 1)) "───────────────────────────────────────────────────────────"

    # Show last 4 log lines (bottom-up: most recent at bottom)
    local log_count=${#ORG_REPL_LOG_LINES[@]}
    local log_display_start=$((log_count > 4 ? log_count - 4 : 0))

    local log_line_num=$log_start
    for ((i = log_display_start; i < log_count && log_line_num < term_height; i++)); do
        tcurses_buffer_write_line $log_line_num "${ORG_REPL_LOG_LINES[$i]}"
        ((log_line_num++))
    done

    tcurses_buffer_render_diff
}

# Add output line
_org_add_output() {
    ORG_REPL_OUTPUT_LINES+=("$1")
}

# Clear output area
_org_clear_output() {
    ORG_REPL_OUTPUT_LINES=()
    ORG_REPL_RAW_CONTENT=()
    ORG_REPL_OUTPUT_SCROLL_OFFSET=0
    ORG_REPL_VIEW_FILE=""
}

# Detect file type by extension
_org_detect_filetype() {
    local filepath="$1"
    local ext="${filepath##*.}"
    case "${ext,,}" in
        toml) echo "toml" ;;
        md|markdown) echo "markdown" ;;
        *) echo "text" ;;
    esac
}

# Load file content with optional TDS rendering
# Args: filepath [render:true|false]
_org_load_file_content() {
    local filepath="$1"
    local render="${2:-true}"

    # Validate file exists
    if [[ ! -f "$filepath" ]]; then
        _org_add_output "Error: File not found: $filepath"
        return 1
    fi

    # Store file path
    ORG_REPL_VIEW_FILE="$filepath"

    # Clear existing content
    ORG_REPL_RAW_CONTENT=()
    ORG_REPL_OUTPUT_LINES=()

    # Load raw content
    mapfile -t ORG_REPL_RAW_CONTENT < "$filepath"

    # Apply rendering if requested
    if [[ "$render" == "true" ]]; then
        local filetype=$(_org_detect_filetype "$filepath")

        # Ensure TDS is loaded
        if [[ -z "${TDS_LOADED:-}" ]]; then
            if [[ -f "$TETRA_SRC/bash/tds/tds.sh" ]]; then
                source "$TETRA_SRC/bash/tds/tds.sh" 2>/dev/null || true
            fi
        fi

        case "$filetype" in
            toml)
                # Apply TOML syntax highlighting
                if command -v tds_toml &>/dev/null; then
                    local temp_output
                    temp_output=$(tds_toml "$filepath" 2>&1)
                    mapfile -t ORG_REPL_OUTPUT_LINES <<< "$temp_output"
                else
                    ORG_REPL_OUTPUT_LINES=("${ORG_REPL_RAW_CONTENT[@]}")
                fi
                ;;
            markdown)
                # Apply Markdown rendering
                if command -v tds_markdown &>/dev/null; then
                    local temp_output
                    temp_output=$(tds_markdown "$filepath" 2>&1)
                    mapfile -t ORG_REPL_OUTPUT_LINES <<< "$temp_output"
                else
                    ORG_REPL_OUTPUT_LINES=("${ORG_REPL_RAW_CONTENT[@]}")
                fi
                ;;
            *)
                # No renderer - use raw
                ORG_REPL_OUTPUT_LINES=("${ORG_REPL_RAW_CONTENT[@]}")
                ;;
        esac
    else
        # No rendering - copy raw to output
        ORG_REPL_OUTPUT_LINES=("${ORG_REPL_RAW_CONTENT[@]}")
    fi

    # Reset scroll
    ORG_REPL_OUTPUT_SCROLL_OFFSET=0

    return 0
}

# Scroll output up (towards beginning)
_org_scroll_up() {
    if [[ $ORG_REPL_OUTPUT_SCROLL_OFFSET -gt 0 ]]; then
        ((ORG_REPL_OUTPUT_SCROLL_OFFSET -= 5))
        [[ $ORG_REPL_OUTPUT_SCROLL_OFFSET -lt 0 ]] && ORG_REPL_OUTPUT_SCROLL_OFFSET=0
    fi
}

# Scroll output down (towards end)
_org_scroll_down() {
    local term_height=$(tput lines)
    local log_height=5
    local results_start=5
    local results_end=$((term_height - log_height - 1))
    local max_results_lines=$((results_end - results_start))
    local total_output_lines=${#ORG_REPL_OUTPUT_LINES[@]}
    local max_scroll=$((total_output_lines - max_results_lines))

    if [[ $max_scroll -gt 0 ]] && [[ $ORG_REPL_OUTPUT_SCROLL_OFFSET -lt $max_scroll ]]; then
        ((ORG_REPL_OUTPUT_SCROLL_OFFSET += 5))
        [[ $ORG_REPL_OUTPUT_SCROLL_OFFSET -gt $max_scroll ]] && ORG_REPL_OUTPUT_SCROLL_OFFSET=$max_scroll
    fi
}

# Add log line (keeps last 20, shows last 4)
_org_add_log() {
    local timestamp=$(date '+%H:%M:%S')
    ORG_REPL_LOG_LINES+=("$(text_color "$REPL_SEPARATOR")[$timestamp]$(reset_color) $1")

    # Keep only last 20 log entries
    if [[ ${#ORG_REPL_LOG_LINES[@]} -gt 20 ]]; then
        ORG_REPL_LOG_LINES=("${ORG_REPL_LOG_LINES[@]:(-20)}")
    fi
}

# Show comprehensive action details
_org_show_action_details() {
    local actions=($(_org_actions))
    if [[ ${#actions[@]} -eq 0 ]] || [[ $ORG_REPL_ACTION_INDEX -ge ${#actions[@]} ]]; then
        return
    fi

    local action="${actions[$ORG_REPL_ACTION_INDEX]}"
    local env="${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
    local mode="${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"

    # Parse verb:noun
    local verb="${action%%:*}"
    local noun="${action##*:}"
    local func_name="org_action_${verb}_${noun}"

    # Clear and build comprehensive output
    _org_clear_output

    _org_add_output "$(text_color "$REPL_ACTION_ACTIVE")ACTION: $action$(reset_color)"
    _org_add_output "═══════════════════════════════════════════════════════════"
    _org_add_output ""
    _org_add_output "$(text_color "$REPL_ORG_ACTIVE")Module Provenance:$(reset_color)"
    _org_add_output "  Source: \$TETRA_SRC/bash/org/actions.sh"
    _org_add_output "  Module: org (Organization Management)"
    _org_add_output "  Function: $func_name"

    # Try to find function line number
    if [[ -f "$TETRA_SRC/bash/org/actions.sh" ]]; then
        local line_num=$(grep -n "^${func_name}()" "$TETRA_SRC/bash/org/actions.sh" 2>/dev/null | cut -d: -f1)
        if [[ -n "$line_num" ]]; then
            _org_add_output "  Location: actions.sh:$line_num"
        fi
    fi

    _org_add_output ""
    _org_add_output "$(text_color "$(repl_env_color $ORG_REPL_ENV_INDEX)")Context:$(reset_color)"
    _org_add_output "  Environment: $env"
    _org_add_output "  Mode: $mode"
    _org_add_output "  E×M Matrix: $env:$mode"
    _org_add_output ""
    _org_add_output "$(text_color "$REPL_SEPARATOR")Metadata:$(reset_color)"
    _org_add_output "  Verb: $verb (operation type)"
    _org_add_output "  Noun: $noun (resource target)"
    _org_add_output "  Result Type: @stdout (display output)"
    _org_add_output ""

    # Show function implementation preview if function exists
    if declare -f "$func_name" &>/dev/null; then
        _org_add_output "$(text_color "$REPL_ACTION_ACTIVE")Implementation Preview:$(reset_color)"
        local func_body=$(declare -f "$func_name" | head -15 | tail -n +2)
        while IFS= read -r line; do
            _org_add_output "  $(text_color "$REPL_SEPARATOR")$line$(reset_color)"
        done <<< "$func_body"
    else
        _org_add_output "$(text_color "$REPL_SEPARATOR")Status: Function not yet implemented$(reset_color)"
    fi

    _org_add_log "Action details: $action"
}

# Toggle action menu
_org_toggle_action_menu() {
    if $ORG_REPL_SHOW_ACTION_MENU; then
        ORG_REPL_SHOW_ACTION_MENU=false
    else
        ORG_REPL_SHOW_ACTION_MENU=true
        ORG_REPL_ACTION_MENU_INDEX=0
    fi
}

# Navigate action menu
_org_action_menu_up() {
    local actions=($(_org_actions))
    if [[ ${#actions[@]} -gt 0 ]]; then
        ORG_REPL_ACTION_MENU_INDEX=$(( (ORG_REPL_ACTION_MENU_INDEX - 1 + ${#actions[@]}) % ${#actions[@]} ))
        # Sync main action index with menu selection
        ORG_REPL_ACTION_INDEX=$ORG_REPL_ACTION_MENU_INDEX
    fi
}

_org_action_menu_down() {
    local actions=($(_org_actions))
    if [[ ${#actions[@]} -gt 0 ]]; then
        ORG_REPL_ACTION_MENU_INDEX=$(( (ORG_REPL_ACTION_MENU_INDEX + 1) % ${#actions[@]} ))
        # Sync main action index with menu selection
        ORG_REPL_ACTION_INDEX=$ORG_REPL_ACTION_MENU_INDEX
    fi
}

# Select action from menu
_org_select_action_from_menu() {
    local actions=($(_org_actions))
    local action="${actions[$ORG_REPL_ACTION_MENU_INDEX]}"
    if [[ -n "$action" && "$action" != "none" ]]; then
        ORG_REPL_INPUT="$action"
        ORG_REPL_CURSOR_POS=${#ORG_REPL_INPUT}
        ORG_REPL_SHOW_ACTION_MENU=false
    fi
}

# Handle input character
_org_handle_char() {
    local char="$1"

    # Check input length limit
    local max_len=${ORG_REPL_INPUT_MAX:-1000}
    if [[ ${#ORG_REPL_INPUT} -ge $max_len ]]; then
        _org_add_log "Input limit reached ($max_len chars)"
        return 1
    fi

    # Validate character is printable (already filtered by case, but double-check)
    if [[ ! "$char" =~ [[:print:]] ]]; then
        return 1
    fi

    ORG_REPL_INPUT="${ORG_REPL_INPUT:0:$ORG_REPL_CURSOR_POS}${char}${ORG_REPL_INPUT:$ORG_REPL_CURSOR_POS}"
    ((ORG_REPL_CURSOR_POS++))
}

# Handle backspace
_org_handle_backspace() {
    if [[ $ORG_REPL_CURSOR_POS -gt 0 ]]; then
        ORG_REPL_INPUT="${ORG_REPL_INPUT:0:$((ORG_REPL_CURSOR_POS-1))}${ORG_REPL_INPUT:$ORG_REPL_CURSOR_POS}"
        ((ORG_REPL_CURSOR_POS--))
    fi
}

# Handle enter
_org_handle_enter() {
    local input="$ORG_REPL_INPUT"

    # First Enter: prepare action for execution (if browsing and input empty)
    if $ORG_REPL_SAFETY_ON && [[ -z "$input" ]]; then
        local actions=($(_org_actions))
        if [[ ${#actions[@]} -gt 0 ]] && [[ $ORG_REPL_ACTION_INDEX -lt ${#actions[@]} ]]; then
            local action="${actions[$ORG_REPL_ACTION_INDEX]}"
            if [[ -n "$action" && "$action" != "none" ]]; then
                # Mark action as ready to execute (don't show it in input yet)
                ORG_REPL_SAFETY_ON=false
                return
            fi
        fi
        return
    fi

    # Second Enter: execute the selected action (or typed command)
    if [[ -z "$input" ]]; then
        # Get the current action to execute
        local actions=($(_org_actions))
        if [[ ${#actions[@]} -gt 0 ]] && [[ $ORG_REPL_ACTION_INDEX -lt ${#actions[@]} ]]; then
            input="${actions[$ORG_REPL_ACTION_INDEX]}"
        fi
    fi

    ORG_REPL_INPUT=""
    ORG_REPL_CURSOR_POS=0
    ORG_REPL_SAFETY_ON=true  # Return to browsing mode after execution

    if [[ -z "$input" ]]; then
        return
    fi

    # Add to command history (skip duplicates of last command)
    if [[ ${#ORG_REPL_COMMAND_HISTORY[@]} -eq 0 ]] || [[ "${ORG_REPL_COMMAND_HISTORY[-1]}" != "$input" ]]; then
        ORG_REPL_COMMAND_HISTORY+=("$input")
        # Keep only last 100 commands
        if [[ ${#ORG_REPL_COMMAND_HISTORY[@]} -gt 100 ]]; then
            ORG_REPL_COMMAND_HISTORY=("${ORG_REPL_COMMAND_HISTORY[@]: -100}")
        fi
    fi
    # Reset history index
    ORG_REPL_HISTORY_INDEX=-1

    # Clear previous output
    _org_clear_output

    # Add to log
    _org_add_log "$(text_color "$REPL_ARROW")>$(reset_color) $input"

    # Process command
    case "$input" in
        exit|quit|q)
            _org_add_log "Exiting..."
            ORG_REPL_RUNNING=false
            ;;
        clear)
            _org_clear_output
            ORG_REPL_LOG_LINES=()
            _org_add_log "Screen cleared"
            ;;
        help|h|\?)
            _org_add_output "Navigation:"
            _org_add_output "  1/!            Cycle org (backward/forward)"
            _org_add_output "  2/\@           Cycle environment (backward/forward)"
            _org_add_output "  3/#            Cycle mode (backward/forward)"
            _org_add_output "  4/\$           Cycle action (forward/backward)"
            _org_add_output "  Tab            Show action dropdown menu"
            _org_add_output "  Enter (1st)    Select action (> becomes bold)"
            _org_add_output "  Enter (2nd)    Execute action"
            _org_add_output ""
            _org_add_output "Typing Commands:"
            _org_add_output "  Type           Start typing to enter command (automatically)"
            _org_add_output "  Enter          Execute typed command"
            _org_add_output "  ESC            Clear input and return to browsing"
            _org_add_output ""
            _org_add_output "Content Viewing:"
            _org_add_output "  v              Enter view mode (collapses UI, shows content)"
            _org_add_output "  ↑↓             Scroll content (in view mode)"
            _org_add_output "  c              Toggle raw/chroma (strip colors vs colorized)"
            _org_add_output "  ESC            Exit view mode"
            _org_add_output "  Ctrl+U/Ctrl+D  Scroll up/down (5 lines, works in any mode)"
            _org_add_output "  Page Up/Down   Also works if available"
            _org_add_output ""
            _org_add_output "Editing (when typing):"
            _org_add_output "  Home/End       Move to start/end of line"
            _org_add_output "  Delete         Delete character at cursor"
            _org_add_output "  Ctrl+A         Move to start of line (or cycle action if empty)"
            _org_add_output "  Ctrl+K         Kill from cursor to end"
            _org_add_output "  Ctrl+U         Kill from start to cursor (scrolls if input empty)"
            _org_add_output "  Ctrl+W         Kill word backwards"
            _org_add_output ""
            _org_add_output "Legacy Shortcuts:"
            _org_add_output "  Ctrl+E         Cycle environment (Local/Dev/Staging/Production)"
            _org_add_output "  Ctrl+R         Cycle mode (Inspect/Transfer/Execute)"
            _org_add_output "  Ctrl+T         Cycle theme (dark/solarized)"
            _org_add_output "  Ctrl+X         Execute current action"
            _org_add_output ""
            _org_add_output "Commands:"
            _org_add_output "  verb:noun      Execute action directly (e.g., view:toml)"
            _org_add_output "  view <file>    Load file with syntax highlighting (then press 'v')"
            _org_add_output "  list           List organizations"
            _org_add_output "  clear          Clear output"
            _org_add_output "  help           Show this help"
            _org_add_output "  exit           Exit REPL"
            _org_add_output ""
            _org_add_log "Showed help"
            ;;
        list|ls)
            local output=$(org_list 2>&1)
            while IFS= read -r line; do
                _org_add_output "  $line"
            done <<< "$output"
            _org_add_output ""
            _org_add_log "Listed organizations"
            ;;
        view\ *)
            # View file: view <filepath>
            local filepath="${input#view }"
            if [[ -z "$filepath" ]]; then
                _org_add_output "  Usage: view <filepath>"
                _org_add_log "Error: No file specified"
            elif _org_load_file_content "$filepath" true; then
                _org_add_log "Loaded file: $filepath (press 'v' to enter view mode)"
            else
                _org_add_log "Error loading file: $filepath"
            fi
            ;;
        '')
            # Empty command - execute current action from prompt
            local actions=($(_org_actions))
            if [[ ${#actions[@]} -eq 0 ]] || [[ $ORG_REPL_ACTION_INDEX -ge ${#actions[@]} ]]; then
                _org_add_output "  No action available"
                return
            fi
            local action="${actions[$ORG_REPL_ACTION_INDEX]:-}"
            if [[ -n "$action" && "$action" != "none" ]]; then
                _org_add_log "Executing: $action"
                local output=$(org_execute_action "$action" "${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}" 2>&1)
                while IFS= read -r line; do
                    _org_add_output "  $line"
                done <<< "$output"
                _org_add_output ""
            fi
            ;;
        *)
            if [[ "$input" == *:* ]]; then
                _org_add_log "Executing: $input"
                local output=$(org_execute_action "$input" "${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}" 2>&1)
                while IFS= read -r line; do
                    _org_add_output "  $line"
                done <<< "$output"
                _org_add_output ""
            else
                _org_add_output "  Unknown: $input (try 'help')"
                _org_add_output ""
                _org_add_log "Unknown command: $input"
            fi
            ;;
    esac
}

# Cycle environment (with defensive checks)
_org_cycle_env() {
    local env_count=${#ORG_REPL_ENVIRONMENTS[@]}
    if [[ $env_count -eq 0 ]]; then
        echo "ERROR: No environments available" >&2
        return 1
    fi
    ORG_REPL_ENV_INDEX=$(( (ORG_REPL_ENV_INDEX + 1) % env_count ))
    ORG_REPL_ACTION_INDEX=0
    _org_invalidate_cache  # Clear action cache
}

# Cycle mode (with defensive checks)
_org_cycle_mode() {
    local mode_count=${#ORG_REPL_MODES[@]}
    if [[ $mode_count -eq 0 ]]; then
        echo "ERROR: No modes available" >&2
        return 1
    fi
    ORG_REPL_MODE_INDEX=$(( (ORG_REPL_MODE_INDEX + 1) % mode_count ))
    ORG_REPL_ACTION_INDEX=0
    _org_invalidate_cache  # Clear action cache
}

# Cycle action
_org_cycle_action() {
    local actions=($(_org_actions))
    if [[ ${#actions[@]} -gt 0 ]]; then
        ORG_REPL_ACTION_INDEX=$(( (ORG_REPL_ACTION_INDEX + 1) % ${#actions[@]} ))
        ORG_REPL_ACTION_MENU_INDEX=$ORG_REPL_ACTION_INDEX  # Sync menu index
    fi
}

# TAB: Cycle focus between sections
_org_cycle_focus() {
    ORG_REPL_FOCUS=$(( (ORG_REPL_FOCUS + 1) % 3 ))
    # Reset history index when leaving action focus
    if [[ $ORG_REPL_FOCUS -ne 2 ]]; then
        ORG_REPL_HISTORY_INDEX=-1
    fi
}

# Arrow Up: Context-dependent navigation (with defensive checks)
_org_navigate_up() {
    # When action is selected (safety OFF), arrows don't navigate sections
    if ! $ORG_REPL_SAFETY_ON; then
        return
    fi

    case $ORG_REPL_FOCUS in
        0)  # Env focus - cycle backwards through environments
            local env_count=${#ORG_REPL_ENVIRONMENTS[@]}
            if [[ $env_count -eq 0 ]]; then
                echo "ERROR: No environments available" >&2
                return 1
            fi
            ORG_REPL_ENV_INDEX=$(( (ORG_REPL_ENV_INDEX - 1 + env_count) % env_count ))
            ORG_REPL_ACTION_INDEX=0
            _org_invalidate_cache
            ;;
        1)  # Mode focus - cycle backwards through modes
            local mode_count=${#ORG_REPL_MODES[@]}
            if [[ $mode_count -eq 0 ]]; then
                echo "ERROR: No modes available" >&2
                return 1
            fi
            ORG_REPL_MODE_INDEX=$(( (ORG_REPL_MODE_INDEX - 1 + mode_count) % mode_count ))
            ORG_REPL_ACTION_INDEX=0
            _org_invalidate_cache
            ;;
        2)  # Action focus - navigate command history
            if [[ ${#ORG_REPL_COMMAND_HISTORY[@]} -gt 0 ]]; then
                if [[ $ORG_REPL_HISTORY_INDEX -eq -1 ]]; then
                    # First time - start from end
                    ORG_REPL_HISTORY_INDEX=$(( ${#ORG_REPL_COMMAND_HISTORY[@]} - 1 ))
                else
                    # Move back in history
                    [[ $ORG_REPL_HISTORY_INDEX -gt 0 ]] && ((ORG_REPL_HISTORY_INDEX--))
                fi
                ORG_REPL_INPUT="${ORG_REPL_COMMAND_HISTORY[$ORG_REPL_HISTORY_INDEX]}"
                ORG_REPL_CURSOR_POS=${#ORG_REPL_INPUT}
            fi
            ;;
    esac
}

# Arrow Down: Context-dependent navigation (with defensive checks)
_org_navigate_down() {
    # When action is selected (safety OFF), arrows don't navigate sections
    if ! $ORG_REPL_SAFETY_ON; then
        return
    fi

    case $ORG_REPL_FOCUS in
        0)  # Env focus - cycle forward through environments
            local env_count=${#ORG_REPL_ENVIRONMENTS[@]}
            if [[ $env_count -eq 0 ]]; then
                echo "ERROR: No environments available" >&2
                return 1
            fi
            ORG_REPL_ENV_INDEX=$(( (ORG_REPL_ENV_INDEX + 1) % env_count ))
            ORG_REPL_ACTION_INDEX=0
            _org_invalidate_cache
            ;;
        1)  # Mode focus - cycle forward through modes
            local mode_count=${#ORG_REPL_MODES[@]}
            if [[ $mode_count -eq 0 ]]; then
                echo "ERROR: No modes available" >&2
                return 1
            fi
            ORG_REPL_MODE_INDEX=$(( (ORG_REPL_MODE_INDEX + 1) % mode_count ))
            ORG_REPL_ACTION_INDEX=0
            _org_invalidate_cache
            ;;
        2)  # Action focus - navigate command history
            if [[ ${#ORG_REPL_COMMAND_HISTORY[@]} -gt 0 ]]; then
                if [[ $ORG_REPL_HISTORY_INDEX -eq -1 ]]; then
                    # Do nothing - already at current
                    :
                elif [[ $ORG_REPL_HISTORY_INDEX -lt $(( ${#ORG_REPL_COMMAND_HISTORY[@]} - 1 )) ]]; then
                    # Move forward in history
                    ((ORG_REPL_HISTORY_INDEX++))
                    ORG_REPL_INPUT="${ORG_REPL_COMMAND_HISTORY[$ORG_REPL_HISTORY_INDEX]}"
                    ORG_REPL_CURSOR_POS=${#ORG_REPL_INPUT}
                else
                    # At newest - clear input
                    ORG_REPL_HISTORY_INDEX=-1
                    ORG_REPL_INPUT=""
                    ORG_REPL_CURSOR_POS=0
                fi
            fi
            ;;
    esac
}

# Main TUI loop
org_repl_tui() {
    # Initialize state
    if ! _org_repl_init_state; then
        echo "FATAL: Failed to initialize org REPL state" >&2
        echo "Please restart your shell and re-source tetra:" >&2
        echo "  exec bash" >&2
        echo "  source ~/tetra/tetra.sh" >&2
        return 1
    fi

    # Initialize tcurses
    tcurses_init
    tcurses_buffer_init

    # Setup cleanup trap to handle Ctrl+C properly
    tcurses_setup_cleanup_trap

    # Clear screen
    tput clear
    tput civis  # Hide cursor

    # Initial render
    _org_render

    # Main loop
    while $ORG_REPL_RUNNING; do
        # Read single character
        IFS= read -rsn1 char

        case "$char" in
            $'\x1b')  # Escape sequence
                read -rsn2 -t 0.1 seq
                case "$seq" in
                    '[D')  # Left arrow
                        if $ORG_REPL_SHOW_ACTION_MENU; then
                            # Legacy action menu behavior
                            :
                        elif [[ $ORG_REPL_FOCUS -eq 2 ]]; then
                            # On action focus, allow cursor movement
                            [[ $ORG_REPL_CURSOR_POS -gt 0 ]] && ((ORG_REPL_CURSOR_POS--))
                        fi
                        ;;
                    '[C')  # Right arrow
                        if $ORG_REPL_SHOW_ACTION_MENU; then
                            # Legacy action menu behavior
                            :
                        elif [[ $ORG_REPL_FOCUS -eq 2 ]]; then
                            # On action focus, allow cursor movement
                            [[ $ORG_REPL_CURSOR_POS -lt ${#ORG_REPL_INPUT} ]] && ((ORG_REPL_CURSOR_POS++))
                        fi
                        ;;
                    '[A')  # Up arrow - context-dependent
                        if $ORG_REPL_VIEW_MODE; then
                            # View mode - scroll up
                            _org_scroll_up
                        elif $ORG_REPL_SHOW_ACTION_MENU; then
                            _org_action_menu_up
                        else
                            _org_navigate_up
                        fi
                        ;;
                    '[B')  # Down arrow - context-dependent
                        if $ORG_REPL_VIEW_MODE; then
                            # View mode - scroll down
                            _org_scroll_down
                        elif $ORG_REPL_SHOW_ACTION_MENU; then
                            _org_action_menu_down
                        else
                            _org_navigate_down
                        fi
                        ;;
                    '[H'|'[1~')  # Home key
                        [[ $ORG_REPL_FOCUS -eq 2 ]] && ORG_REPL_CURSOR_POS=0
                        ;;
                    '[F'|'[4~')  # End key
                        [[ $ORG_REPL_FOCUS -eq 2 ]] && ORG_REPL_CURSOR_POS=${#ORG_REPL_INPUT}
                        ;;
                    '[3~')  # Delete key
                        if [[ $ORG_REPL_FOCUS -eq 2 ]] && [[ $ORG_REPL_CURSOR_POS -lt ${#ORG_REPL_INPUT} ]]; then
                            ORG_REPL_INPUT="${ORG_REPL_INPUT:0:$ORG_REPL_CURSOR_POS}${ORG_REPL_INPUT:$((ORG_REPL_CURSOR_POS + 1))}"
                        fi
                        ;;
                    '[5~')  # Page Up - scroll output up
                        _org_scroll_up
                        ;;
                    '[6~')  # Page Down - scroll output down
                        _org_scroll_down
                        ;;
                    '')  # Plain ESC key (no sequence following)
                        # Exit view mode if active, otherwise clear input
                        if $ORG_REPL_VIEW_MODE; then
                            ORG_REPL_VIEW_MODE=false
                            _org_add_log "Exited view mode"
                        else
                            # Clear input and return to clean browsing state
                            ORG_REPL_SAFETY_ON=true
                            ORG_REPL_INPUT=""
                            ORG_REPL_CURSOR_POS=0
                            ORG_REPL_SHOW_ACTION_MENU=false
                            _org_clear_output
                            _org_add_log "Reset to clean state (Env/Mode preserved)"
                        fi
                        ;;
                esac
                ;;
            $'\x09')  # Tab - show action dropdown menu
                _org_toggle_action_menu
                ;;
            '1')  # 1 - cycle org (if input empty) or type '1' (if typing)
                if [[ -z "$ORG_REPL_INPUT" ]]; then
                    # Input empty - cycle through available orgs
                    local orgs=($(org_list 2>/dev/null | grep -v "^No organizations" || echo ""))
                    if [[ ${#orgs[@]} -gt 0 ]]; then
                        local current_org=$(_org_active)
                        local current_idx=-1
                        for i in "${!orgs[@]}"; do
                            if [[ "${orgs[$i]}" == "$current_org" ]]; then
                                current_idx=$i
                                break
                            fi
                        done
                        local next_idx=$(( (current_idx - 1 + ${#orgs[@]}) % ${#orgs[@]} ))
                        org_activate "${orgs[$next_idx]}" 2>/dev/null
                    fi
                else
                    # Input not empty - type the character
                    _org_handle_char '1'
                fi
                ;;
            '!')  # ! (shift-1) - cycle org right (if input empty) or type
                if [[ -z "$ORG_REPL_INPUT" ]]; then
                    local orgs=($(org_list 2>/dev/null | grep -v "^No organizations" || echo ""))
                    if [[ ${#orgs[@]} -gt 0 ]]; then
                        local current_org=$(_org_active)
                        local current_idx=-1
                        for i in "${!orgs[@]}"; do
                            if [[ "${orgs[$i]}" == "$current_org" ]]; then
                                current_idx=$i
                                break
                            fi
                        done
                        local next_idx=$(( (current_idx + 1) % ${#orgs[@]} ))
                        org_activate "${orgs[$next_idx]}" 2>/dev/null
                    fi
                else
                    _org_handle_char '!'
                fi
                ;;
            '2')  # 2 - cycle environment (if input empty) or type '2'
                if [[ -z "$ORG_REPL_INPUT" ]]; then
                    ORG_REPL_ENV_INDEX=$(( (ORG_REPL_ENV_INDEX - 1 + ${#ORG_REPL_ENVIRONMENTS[@]}) % ${#ORG_REPL_ENVIRONMENTS[@]} ))
                    ORG_REPL_ACTION_INDEX=0
                    _org_invalidate_cache
                else
                    _org_handle_char '2'
                fi
                ;;
            '@')  # @ (shift-2) - cycle environment right (if input empty) or type
                if [[ -z "$ORG_REPL_INPUT" ]]; then
                    ORG_REPL_ENV_INDEX=$(( (ORG_REPL_ENV_INDEX + 1) % ${#ORG_REPL_ENVIRONMENTS[@]} ))
                    ORG_REPL_ACTION_INDEX=0
                    _org_invalidate_cache
                else
                    _org_handle_char '@'
                fi
                ;;
            '3')  # 3 - cycle mode (if input empty) or type '3'
                if [[ -z "$ORG_REPL_INPUT" ]]; then
                    ORG_REPL_MODE_INDEX=$(( (ORG_REPL_MODE_INDEX - 1 + ${#ORG_REPL_MODES[@]}) % ${#ORG_REPL_MODES[@]} ))
                    ORG_REPL_ACTION_INDEX=0
                    _org_invalidate_cache
                else
                    _org_handle_char '3'
                fi
                ;;
            '#')  # # (shift-3) - cycle mode right (if input empty) or type
                if [[ -z "$ORG_REPL_INPUT" ]]; then
                    ORG_REPL_MODE_INDEX=$(( (ORG_REPL_MODE_INDEX + 1) % ${#ORG_REPL_MODES[@]} ))
                    ORG_REPL_ACTION_INDEX=0
                    _org_invalidate_cache
                else
                    _org_handle_char '#'
                fi
                ;;
            '4')  # 4 - cycle action forward (if input empty) or type '4'
                if [[ -z "$ORG_REPL_INPUT" ]]; then
                    local actions=($(_org_actions))
                    if [[ ${#actions[@]} -gt 0 ]]; then
                        ORG_REPL_ACTION_INDEX=$(( (ORG_REPL_ACTION_INDEX + 1) % ${#actions[@]} ))
                        ORG_REPL_ACTION_MENU_INDEX=$ORG_REPL_ACTION_INDEX  # Sync menu index
                        _org_show_action_details
                    fi
                else
                    _org_handle_char '4'
                fi
                ;;
            '$')  # $ (shift-4) - cycle action backward (if input empty) or type
                if [[ -z "$ORG_REPL_INPUT" ]]; then
                    local actions=($(_org_actions))
                    if [[ ${#actions[@]} -gt 0 ]]; then
                        ORG_REPL_ACTION_INDEX=$(( (ORG_REPL_ACTION_INDEX - 1 + ${#actions[@]}) % ${#actions[@]} ))
                        ORG_REPL_ACTION_MENU_INDEX=$ORG_REPL_ACTION_INDEX  # Sync menu index
                        _org_show_action_details
                    fi
                else
                    _org_handle_char '$'
                fi
                ;;
            $'\x7f'|$'\x08')  # Backspace
                _org_handle_backspace
                ;;
            $'\x0a'|$'\x0d'|'')  # Enter (0x0a = LF, 0x0d = CR, '' = edge case)
                if $ORG_REPL_SHOW_ACTION_MENU; then
                    _org_select_action_from_menu
                else
                    _org_handle_enter
                fi
                ;;
            $'\x05')  # Ctrl+E - cycle environment
                _org_cycle_env
                _org_add_log "Environment: ${ORG_REPL_ENVIRONMENTS[$ORG_REPL_ENV_INDEX]}"
                ;;
            $'\x12')  # Ctrl+R - cycle mode
                _org_cycle_mode
                _org_add_log "Mode: ${ORG_REPL_MODES[$ORG_REPL_MODE_INDEX]}"
                ;;
            $'\x18')  # Ctrl+X - execute current action
                _org_handle_enter
                ;;
            $'\x01')  # Ctrl+A - cycle action (legacy) OR move to start when on action focus
                if [[ $ORG_REPL_FOCUS -eq 2 ]] && [[ -n "$ORG_REPL_INPUT" ]]; then
                    # On action focus with input: move to start of line
                    ORG_REPL_CURSOR_POS=0
                else
                    # Otherwise: legacy behavior (cycle action)
                    _org_cycle_action
                    local actions=($(_org_actions))
                    _org_add_log "Action: ${actions[$ORG_REPL_ACTION_INDEX]:-none}"
                fi
                ;;
            $'\x0b')  # Ctrl+K - kill from cursor to end of line
                if [[ $ORG_REPL_FOCUS -eq 2 ]]; then
                    ORG_REPL_INPUT="${ORG_REPL_INPUT:0:$ORG_REPL_CURSOR_POS}"
                fi
                ;;
            $'\x15')  # Ctrl+U - scroll up (if input empty) OR kill from start to cursor
                if [[ -z "$ORG_REPL_INPUT" ]]; then
                    # No input - scroll output up
                    _org_scroll_up
                elif [[ $ORG_REPL_FOCUS -eq 2 ]]; then
                    # Editing - kill from start to cursor
                    ORG_REPL_INPUT="${ORG_REPL_INPUT:$ORG_REPL_CURSOR_POS}"
                    ORG_REPL_CURSOR_POS=0
                fi
                ;;
            $'\x04')  # Ctrl+D - scroll down (if input empty)
                if [[ -z "$ORG_REPL_INPUT" ]]; then
                    # No input - scroll output down
                    _org_scroll_down
                fi
                ;;
            $'\x14')  # Ctrl+T - cycle theme
                if $ORG_REPL_SAFETY_ON; then
                    # Cycle through themes: dark -> solarized -> dark
                    case "${CURRENT_THEME:-dark}" in
                        dark) set_theme solarized ;;
                        solarized) set_theme dark ;;
                        *) set_theme dark ;;
                    esac
                    _org_add_log "Theme: ${CURRENT_THEME}"
                else
                    _org_handle_char $'\x14'
                fi
                ;;
            $'\x17')  # Ctrl+W - kill word backwards
                if [[ $ORG_REPL_FOCUS -eq 2 ]] && [[ $ORG_REPL_CURSOR_POS -gt 0 ]]; then
                    local before="${ORG_REPL_INPUT:0:$ORG_REPL_CURSOR_POS}"
                    local after="${ORG_REPL_INPUT:$ORG_REPL_CURSOR_POS}"
                    # Remove trailing spaces then remove last word
                    before="${before%"${before##*[![:space:]]}"}"  # Trim trailing space
                    before="${before%"${before##*[[:space:]]}"}"   # Remove last word
                    ORG_REPL_INPUT="${before}${after}"
                    ORG_REPL_CURSOR_POS=${#before}
                fi
                ;;
            $'\x03')  # Ctrl+C - exit
                ORG_REPL_RUNNING=false
                ;;
            'v')  # 'v' - toggle view mode (if input empty and content available)
                if [[ -z "$ORG_REPL_INPUT" ]] && [[ ${#ORG_REPL_OUTPUT_LINES[@]} -gt 0 ]]; then
                    # Toggle view mode
                    if $ORG_REPL_VIEW_MODE; then
                        ORG_REPL_VIEW_MODE=false
                        _org_add_log "View mode: OFF"
                    else
                        ORG_REPL_VIEW_MODE=true
                        _org_add_log "View mode: ON (↑↓ to scroll)"
                    fi
                else
                    # Input not empty - type the 'v' character
                    _org_handle_char 'v'
                fi
                ;;
            'c')  # 'c' - toggle raw/chroma in view mode, or type 'c' when editing
                if $ORG_REPL_VIEW_MODE; then
                    # In view mode - toggle chroma
                    if $ORG_REPL_VIEW_CHROMA; then
                        ORG_REPL_VIEW_CHROMA=false
                        _org_add_log "View: RAW (no colors)"
                    else
                        # Switching TO chroma mode
                        # If we don't have raw content yet, capture current output as raw
                        if [[ ${#ORG_REPL_OUTPUT_LINES[@]} -gt 0 ]] && [[ ${#ORG_REPL_RAW_CONTENT[@]} -eq 0 ]]; then
                            # Strip ANSI codes from output before storing as raw
                            ORG_REPL_RAW_CONTENT=()
                            for line in "${ORG_REPL_OUTPUT_LINES[@]}"; do
                                # Remove ANSI escape sequences
                                local clean_line=$(echo -e "$line" | sed $'s/\033\[[0-9;]*m//g')
                                ORG_REPL_RAW_CONTENT+=("$clean_line")
                            done

                            # Auto-detect content type and apply renderer
                            # Check for TOML (look for [section] markers, allow leading whitespace)
                            local has_toml_section=false
                            for line in "${ORG_REPL_RAW_CONTENT[@]}"; do
                                # Trim leading whitespace for detection
                                local trimmed_line="${line#"${line%%[![:space:]]*}"}"
                                if [[ "$trimmed_line" =~ ^\[.*\]$ ]]; then
                                    has_toml_section=true
                                    _org_add_log "Detected TOML section: $trimmed_line"
                                    break
                                fi
                            done

                            if $has_toml_section; then
                                # Ensure TDS is loaded
                                if [[ -z "${TDS_LOADED:-}" ]] && [[ -f "$TETRA_SRC/bash/tds/tds.sh" ]]; then
                                    source "$TETRA_SRC/bash/tds/tds.sh" 2>/dev/null || true
                                fi

                                if command -v tds_toml &>/dev/null; then
                                    # Write to temp file and render
                                    local temp_file="/tmp/org_repl_toml_$$.toml"
                                    printf "%s\n" "${ORG_REPL_RAW_CONTENT[@]}" > "$temp_file"

                                    # Capture rendered output
                                    local rendered_output
                                    rendered_output=$(tds_toml "$temp_file" 2>&1)
                                    local render_exit=$?

                                    if [[ $render_exit -eq 0 ]] && [[ -n "$rendered_output" ]]; then
                                        # Successfully rendered - update output lines
                                        ORG_REPL_OUTPUT_LINES=()
                                        while IFS= read -r line; do
                                            ORG_REPL_OUTPUT_LINES+=("$line")
                                        done <<< "$rendered_output"
                                        _org_add_log "Applied TOML highlighting (${#ORG_REPL_OUTPUT_LINES[@]} lines)"
                                    else
                                        _org_add_log "TOML render failed (exit=$render_exit)"
                                    fi

                                    rm -f "$temp_file"
                                else
                                    _org_add_log "tds_toml not available"
                                fi
                            else
                                _org_add_log "No TOML detected in output"
                            fi
                        fi

                        ORG_REPL_VIEW_CHROMA=true
                        _org_add_log "View: CHROMA mode"
                    fi
                else
                    # Not in view mode - type the character
                    _org_handle_char 'c'
                fi
                ;;
            [[:print:]])  # Printable character - just add to input
                _org_handle_char "$char"
                ;;
        esac

        # Re-render after each input
        _org_render
    done

    # Cleanup
    tput cnorm  # Show cursor
    tput clear
    tcurses_cleanup
    _org_repl_cleanup
}

export -f org_repl_tui
export -f _org_repl_init_state
export -f _org_repl_cleanup
export -f _org_active
export -f _org_actions
export -f _org_build_prompt_text
export -f _org_render
export -f _org_add_output
export -f _org_clear_output
export -f _org_detect_filetype
export -f _org_load_file_content
export -f _org_scroll_up
export -f _org_scroll_down
export -f _org_add_log
export -f _org_show_action_details
export -f _org_cycle_env
export -f _org_cycle_mode
export -f _org_cycle_action
export -f _org_cycle_focus
export -f _org_navigate_up
export -f _org_navigate_down
export -f _org_handle_char
export -f _org_handle_backspace
export -f _org_handle_enter
export -f _org_invalidate_cache
