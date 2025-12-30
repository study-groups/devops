#!/usr/bin/env bash
# Tetra TUI - Rendering System
# Split-based layout: Content | Separator | CLI | Footer

# =============================================================================
# CONTENT AREA (rows 0 to TUI_SPLIT_ROW-1)
# =============================================================================

# Render content area with header info and module details
render_content_area() {
    local org="${CONTENT_MODEL[org]:-none}"
    local env="${CONTENT_MODEL[env]:-local}"
    local module="${CONTENT_MODEL[module]:-tetra}"
    local action="${CONTENT_MODEL[action]:-}"
    local state="${CONTENT_MODEL[action_state]:-idle}"
    local mod_idx="${CONTENT_MODEL[module_index]:-0}"
    local mod_count="${#TUI_MODULES[@]}"
    [[ $mod_count -eq 0 ]] && mod_count=1

    # Clear content area
    tui_clear_content

    local line_num=0
    local max_lines=$((TUI_REGION_CONTENT_END - TUI_REGION_CONTENT_START + 1))
    [[ $max_lines -lt 3 ]] && max_lines=3

    # Line 1: Title
    tui_write_content $line_num "$(_c_title)⁘ Tetra Control Center$(_c_reset)"
    ((line_num++))

    # Line 2: Context bar [org × env × module]
    local ctx=""
    ctx+="$(_c_dim)[$(_c_reset)"
    ctx+="$(_c_accent)$org$(_c_reset)"
    ctx+=" $(_c_dim)×$(_c_reset) "
    ctx+="$(_c_info)$env$(_c_reset)"
    ctx+=" $(_c_dim)×$(_c_reset) "
    ctx+="$(_c_highlight)$module$(_c_reset)"
    ctx+="$(_c_dim)]$(_c_reset)"
    ctx+=" $(_c_dim)($((mod_idx + 1))/$mod_count)$(_c_reset)"
    tui_write_content $line_num "$ctx"
    ((line_num++))

    # Line 3: MIDI status
    local midi_line=""
    if [[ "${TUI_MIDI_ENABLED:-false}" == "true" ]]; then
        if [[ "${TUI_MIDI_STATE[connected]:-}" == "true" ]]; then
            if [[ -n "${TUI_MIDI_STATE[last_cc]:-}" ]]; then
                midi_line+="$(_c_label)MIDI:$(_c_reset) $(_c_success)●$(_c_reset) "
                midi_line+="CC${TUI_MIDI_STATE[last_cc]}=${TUI_MIDI_STATE[last_val]:-0}"
            else
                midi_line+="$(_c_label)MIDI:$(_c_reset) $(_c_info)◉$(_c_reset) connected"
            fi
        elif [[ -n "${TUI_MIDI_STATE[error]:-}" ]]; then
            midi_line+="$(_c_label)MIDI:$(_c_reset) $(_c_error)✗$(_c_reset) ${TUI_MIDI_STATE[error]}"
        else
            midi_line+="$(_c_label)MIDI:$(_c_reset) $(_c_dim)○$(_c_reset) disabled"
        fi
    else
        midi_line+="$(_c_label)MIDI:$(_c_reset) $(_c_dim)disabled$(_c_reset)"
    fi
    tui_write_content $line_num "$midi_line"
    ((line_num++))

    # Line 4: Module status
    if [[ $line_num -lt $max_lines ]]; then
        local mod_line=""
        mod_line+="$(_c_label)Module:$(_c_reset) $(_c_value)$module$(_c_reset)"
        if declare -f "$module" >/dev/null 2>&1; then
            mod_line+=" $(_c_success)●$(_c_reset)"
        else
            mod_line+=" $(_c_dim)○$(_c_reset)"
        fi
        tui_write_content $line_num "$mod_line"
        ((line_num++))
    fi

    # Line 5: State
    if [[ $line_num -lt $max_lines ]]; then
        local state_line=""
        case "$state" in
            idle)      state_line="$(_c_dim)· idle$(_c_reset)" ;;
            executing) state_line="$(_c_success)⋯ executing$(_c_reset)" ;;
            error)     state_line="$(_c_error)✗ error$(_c_reset)" ;;
            success)   state_line="$(_c_success)✓ success$(_c_reset)" ;;
            *)         state_line="$(_c_dim)$state$(_c_reset)" ;;
        esac
        tui_write_content $line_num "$(_c_label)State:$(_c_reset) $state_line"
        ((line_num++))
    fi

    # Action line (if set)
    if [[ -n "$action" && $line_num -lt $max_lines ]]; then
        tui_write_content $line_num "$(_c_label)Action:$(_c_reset) $(_c_accent)$action$(_c_reset)"
        ((line_num++))
    fi
}

# Legacy alias for compatibility
render_header() {
    render_content_area
}

# Render animated separator with gradient effect
render_separator() {
    local sep_char="─"
    local width="$TUI_WIDTH"
    local position="${CONTENT_MODEL[separator_position]}"

    local output=""

    # Animated marker with color trail
    for ((i=0; i<width; i++)); do
        if [[ "${CONTENT_MODEL[animation_enabled]}" == "true" ]]; then
            local pos=$((position % width))
            local dist=$(( (i - pos + width) % width ))

            if [[ $dist -eq 0 ]]; then
                output+="\033[1;36m⋯\033[0m"  # bright cyan marker
            elif [[ $dist -lt 3 ]]; then
                output+="\033[36m─\033[0m"    # cyan trail
            elif [[ $dist -lt 6 ]]; then
                output+="\033[34m─\033[0m"    # blue fade
            else
                output+="\033[90m─\033[0m"    # dim default
            fi
        else
            output+="\033[90m$sep_char\033[0m"
        fi
    done

    tui_write_separator "$output"
}

# =============================================================================
# CLI AREA (rows TUI_SPLIT_ROW+1 to TUI_HEIGHT-2)
# =============================================================================

# Render CLI area with command prompt at top
render_cli_area() {
    # Clear CLI area
    tui_clear_cli

    local cli_height=$((TUI_REGION_CLI_END - TUI_REGION_CLI_START + 1))
    [[ $cli_height -lt 1 ]] && return

    # Line 0: Command prompt (right below separator)
    local prompt=""
    if [[ "${CONTENT_MODEL[command_mode]}" == "true" ]]; then
        prompt+="$(_c_accent):$(_c_reset)"
        prompt+="$(_c_value)${CONTENT_MODEL[command_input]}$(_c_reset)"
        prompt+="$(_c_title)█$(_c_reset)"
    else
        prompt+="$(_c_dim):$(_c_reset)"
    fi
    tui_write_cli 0 "$prompt"

    # Lines 1+: Command output/history
    local cli_content="${TUI_BUFFERS["@tui[cli]"]:-}"
    if [[ -n "$cli_content" ]]; then
        local line_num=1
        while IFS= read -r line && [[ $line_num -lt $cli_height ]]; do
            tui_write_cli $line_num "$line"
            ((line_num++))
        done <<< "$cli_content"
    fi
}

# Legacy alias
render_command_line() {
    render_cli_area
}

# Render custom content (for pager/view mode)
render_content() {
    local content="${TUI_BUFFERS["@tui[content]"]}"

    # Only render if we have custom content (pager mode)
    if [[ -z "$content" ]]; then
        return
    fi

    # Use pager system for robust scrolling
    if [[ "${CONTENT_MODEL[view_mode]}" == "true" ]]; then
        # Pager mode - use robust pager system
        if [[ "$TUI_PAGER_MODE" != "pager" ]]; then
            tui_pager_set "$content"
        fi
        tui_pager_render
    else
        # Direct mode - fast display with truncation indicator
        local line_count=$(echo -e "$content" | wc -l)
        if [[ $line_count -gt $CONTENT_VIEWPORT_HEIGHT ]]; then
            content=$(echo -e "$content" | head -n $((CONTENT_VIEWPORT_HEIGHT - 1)))
            content+=$'\n'"$(_c_dim)── press 'v' to scroll ($line_count lines) ──$(_c_reset)"
        fi
        tui_direct_write "$content"
    fi
}

# =============================================================================
# FOOTER (row TUI_HEIGHT-1)
# =============================================================================

# Render footer with colorful key hints
render_footer() {
    local output=""

    if [[ "${CONTENT_MODEL[command_mode]}" == "true" ]]; then
        output+="$(_c_accent)Command mode$(_c_reset)"
        output+=" $(_c_dim)│$(_c_reset) "
        output+="$(_c_warn)ESC$(_c_reset)$(_c_dim)=exit$(_c_reset) "
        output+="$(_c_success)Enter$(_c_reset)$(_c_dim)=execute$(_c_reset)"
    elif [[ "${CONTENT_MODEL[view_mode]}" == "true" ]]; then
        output+="$(_c_info)Pager$(_c_reset)"
        output+=" $(_c_dim)│$(_c_reset) "
        output+="$(_c_title)↑↓/jk$(_c_reset)$(_c_dim)=line$(_c_reset) "
        output+="$(_c_accent)b/SPC$(_c_reset)$(_c_dim)=page$(_c_reset) "
        output+="$(_c_success)g/G$(_c_reset)$(_c_dim)=top/end$(_c_reset) "
        output+="$(_c_warn)q$(_c_reset)$(_c_dim)=back$(_c_reset)"
    else
        # Navigation keys
        output+="$(_c_title)←→$(_c_reset)$(_c_dim):mod$(_c_reset) "
        output+="$(_c_title)↑↓$(_c_reset)$(_c_dim):split$(_c_reset) "
        output+="$(_c_info)e$(_c_reset)$(_c_dim)=env$(_c_reset) "
        output+="$(_c_highlight)⏎$(_c_reset)$(_c_dim)=run$(_c_reset)"
        output+=" $(_c_dim)│$(_c_reset) "
        # Split info
        output+="$(_c_dim)row:$(_c_reset)$(_c_value)$TUI_SPLIT_ROW$(_c_reset) "
        output+="$(_c_error)q$(_c_reset)$(_c_dim)=quit$(_c_reset)"
    fi

    # Write directly to footer row
    tui_write_line "$TUI_REGION_FOOTER" "$output"
}

# =============================================================================
# MAIN RENDER FUNCTION
# =============================================================================

# Main render function - split-based layout
render_screen() {
    local first_render="${1:-false}"

    # Update region boundaries
    tui_region_update

    # Clear buffer and rebuild
    tui_buffer_clear

    # Populate buffer using split-based regions:
    # 1. Content area (rows 0 to TUI_SPLIT_ROW-1)
    render_content_area

    # Check if we have custom content to overlay
    if [[ -n "${TUI_BUFFERS["@tui[content]"]}" ]]; then
        render_content
    fi

    # 2. Separator (row TUI_SPLIT_ROW)
    render_separator

    # 3. CLI area (rows TUI_SPLIT_ROW+1 to TUI_HEIGHT-2)
    render_cli_area

    # 4. Footer (row TUI_HEIGHT-1)
    render_footer

    # Render: full screen on first call, differential updates after
    if [[ "$first_render" == "true" ]]; then
        tui_buffer_render_full
    else
        tui_buffer_render_diff
    fi
}
