#!/usr/bin/env bash

# TUI Double Buffer Rendering Engine
# Phase 1: Core rendering system with frame buffering

# Frame buffer globals
declare -a FRAME_BUFFER=()
declare -a BACK_BUFFER=()
declare FRAME_DIRTY="true"
declare CURRENT_FRAME_HASH=""

# Performance optimization - cached calculations
declare -A HEX_TO_256_CACHE=()
declare -A COMPONENT_CACHE=()

# Component dirty tracking
declare -A COMPONENT_DIRTY=(
    [header]="true"
    [content]="true"
    [footer]="true"
    [repl]="true"
)

# Initialize double buffer system
init_double_buffer() {
    local term_height=${LINES:-24}
    local term_width=${COLUMNS:-80}

    # Initialize buffers with empty lines
    FRAME_BUFFER=()
    BACK_BUFFER=()

    for ((i=0; i<term_height; i++)); do
        FRAME_BUFFER[i]=""
        BACK_BUFFER[i]=""
    done

    FRAME_DIRTY="true"
    log_action "Rendering: Double buffer initialized (${term_width}x${term_height})"
}

# Mark specific component as dirty
mark_component_dirty() {
    local component="$1"
    COMPONENT_DIRTY[$component]="true"
    FRAME_DIRTY="true"
    log_action "Rendering: $component marked dirty"
}

# Mark all components dirty (full refresh)
mark_all_dirty() {
    for component in header content footer repl; do
        COMPONENT_DIRTY[$component]="true"
    done
    FRAME_DIRTY="true"
    log_action "Rendering: All components marked dirty"
}

# Build complete frame in back buffer
build_frame() {
    local term_width=${COLUMNS:-80}
    local term_height=${LINES:-24}

    # Only rebuild if frame is dirty
    if [[ "$FRAME_DIRTY" != "true" ]]; then
        return 0
    fi

    # Clear back buffer
    for ((i=0; i<term_height; i++)); do
        BACK_BUFFER[i]=""
    done

    get_terminal_regions

    # Build header component (lines 0-4)
    if [[ "${COMPONENT_DIRTY[header]}" == "true" ]]; then
        build_header_component
        COMPONENT_DIRTY[header]="false"
    fi

    # Build content component (dynamic region)
    if [[ "${COMPONENT_DIRTY[content]}" == "true" ]]; then
        build_content_component
        COMPONENT_DIRTY[content]="false"
    fi

    # Build footer component (last 4 lines)
    if [[ "${COMPONENT_DIRTY[footer]}" == "true" ]]; then
        build_footer_component
        COMPONENT_DIRTY[footer]="false"
    fi

    # Build REPL component if active and in REPL view
    if [[ "$CURRENT_INPUT_MODE" == "$INPUT_MODE_REPL" && "$CURRENT_VIEW_MODE" == "$VIEW_REPL" && "${COMPONENT_DIRTY[repl]}" == "true" ]]; then
        build_repl_component
        COMPONENT_DIRTY[repl]="false"
    fi

    FRAME_DIRTY="false"
    log_action "Rendering: Frame built in back buffer"
}

# Build header component with optimized rendering
build_header_component() {
    local term_width=${COLUMNS:-80}

    # Line 0: Header
    local header_content=$(render_header | head -c $term_width)
    BACK_BUFFER[0]="$(printf '\033[1;1H%s\033[K' "$header_content")"

    # Line 1: Environment
    local env_line=$(render_environment_line | head -c $term_width)
    BACK_BUFFER[1]="$(printf '\033[2;1H%s\033[K' "$env_line")"

    # Line 2: Mode
    local mode_line=$(render_mode_line | head -c $term_width)
    BACK_BUFFER[2]="$(printf '\033[3;1H%s\033[K' "$mode_line")"

    # Line 3: Action
    local action_line=$(render_action_line | head -c $term_width)
    BACK_BUFFER[3]="$(printf '\033[4;1H%s\033[K' "$action_line")"

    # Line 4: Separator with counter
    local actions=($(get_actions))
    local separator_with_counter="$(generate_action_separator "$(($ACTION_INDEX + 1))/${#actions[@]}")"
    BACK_BUFFER[4]="$(printf '\033[5;1H%s\033[K' "$separator_with_counter")"
}

# Build content component with scroll optimization
build_content_component() {
    local term_width=${COLUMNS:-80}

    # Generate content buffer from cached or fresh content
    local content_lines=()
    if [[ -n "$CONTENT" ]]; then
        mapfile -t content_lines <<< "$CONTENT"
    else
        content_lines=("Demo v009 - CLI REPL Integration" "" "E×M+A=R: Environment × Mode + Action = Result")
    fi

    # Fill content region lines
    local line_idx=$REGION_CONTENT_START
    for content_line in "${content_lines[@]}"; do
        if [[ $line_idx -le $REGION_CONTENT_END ]]; then
            local truncated_line=$(printf '%b' "$content_line" | head -c $term_width)
            BACK_BUFFER[$((line_idx-1))]="$(printf '\033[%d;1H%s\033[K' $line_idx "$truncated_line")"
            ((line_idx++))
        else
            break
        fi
    done

    # Clear remaining content lines
    while [[ $line_idx -le $REGION_CONTENT_END ]]; do
        BACK_BUFFER[$((line_idx-1))]="$(printf '\033[%d;1H\033[K' $line_idx)"
        ((line_idx++))
    done
}

# Build footer component with format caching
build_footer_component() {
    local term_width=${COLUMNS:-80}

    if [[ -n "$FOOTER_CONTENT" ]]; then
        local footer_lines=()
        mapfile -t footer_lines <<< "$FOOTER_CONTENT"

        # Calculate vertical centering
        local available_lines=$UI_FOOTER_LINES
        local content_lines=${#footer_lines[@]}
        local vertical_offset=$(( (available_lines - content_lines) / 2 ))
        [[ $vertical_offset -lt 0 ]] && vertical_offset=0

        # Clear all footer lines first
        for ((i=REGION_FOOTER_START; i<=REGION_FOOTER_END; i++)); do
            BACK_BUFFER[$((i-1))]="$(printf '\033[%d;1H\033[K' $i)"
        done

        # Render centered footer content
        for ((i=0; i<content_lines && i<available_lines; i++)); do
            local target_line=$((REGION_FOOTER_START + vertical_offset + i))
            if [[ $target_line -le $REGION_FOOTER_END ]]; then
                local footer_line=$(printf '%b' "${footer_lines[i]}" | head -c $term_width)
                BACK_BUFFER[$((target_line-1))]="$(printf '\033[%d;1H%s\033[K' $target_line "$footer_line")"
            fi
        done
    else
        # Default footer
        local footer_text=$(render_footer | head -c $term_width)
        BACK_BUFFER[$((REGION_FOOTER_START-1))]="$(printf '\033[%d;1H%s\033[K' $REGION_FOOTER_START "$footer_text")"

        # Clear remaining footer lines
        for ((i=$((REGION_FOOTER_START+1)); i<=REGION_FOOTER_END; i++)); do
            BACK_BUFFER[$((i-1))]="$(printf '\033[%d;1H\033[K' $i)"
        done
    fi
}

# Build REPL component (when active)
build_repl_component() {
    if [[ "$CURRENT_INPUT_MODE" == "$INPUT_MODE_REPL" && "$CURRENT_VIEW_MODE" == "$VIEW_REPL" ]]; then
        local prompt=$(get_repl_prompt)
        local input_line="${prompt}${REPL_INPUT}"
        local term_width=${COLUMNS:-80}

        # Truncate if too long
        if [[ ${#input_line} -gt $term_width ]]; then
            input_line="${input_line:0:$((term_width-3))}..."
        fi

        BACK_BUFFER[$((REGION_REPL_LINE-1))]="$(printf '\033[%d;1H%s\033[K' $REGION_REPL_LINE "$input_line")"

        # Position cursor at end of input
        BACK_BUFFER[$((REGION_REPL_LINE-1))]+="$(printf '\033[%d;%dH' $REGION_REPL_LINE $((${#input_line}+1)))"
    else
        # Clear REPL line when not in REPL mode
        if [[ -n "$REGION_REPL_LINE" && $REGION_REPL_LINE -gt 0 ]]; then
            BACK_BUFFER[$((REGION_REPL_LINE-1))]="$(printf '\033[%d;1H\033[K' $REGION_REPL_LINE)"
        fi
    fi
}

# Present frame - single atomic screen update
present_frame() {
    # Only present if frame was rebuilt
    if [[ "$FRAME_DIRTY" == "true" ]]; then
        build_frame
    fi

    # Generate frame hash for change detection
    local new_hash=$(printf '%s\n' "${BACK_BUFFER[@]}" | sha1sum | cut -d' ' -f1 2>/dev/null)

    # Only update screen if frame actually changed
    if [[ "$CURRENT_FRAME_HASH" != "$new_hash" ]]; then
        # Apply current theme first
        if command -v apply_current_theme >/dev/null 2>&1; then
            apply_current_theme
        fi

        # Single cursor home and clear, then output buffer
        printf '\033[H\033[2J'
        printf '%s' "${BACK_BUFFER[@]}"

        # Copy back buffer to frame buffer
        FRAME_BUFFER=("${BACK_BUFFER[@]}")
        CURRENT_FRAME_HASH="$new_hash"

        log_action "Rendering: Frame presented (hash: ${new_hash:0:8})"
    fi
}

# Optimized color refresh with caching
refresh_color_state_cached() {
    local verb="$1"
    local noun="$2"

    # Use cached colors if available
    local cache_key="${verb}:${noun}"
    if [[ -n "${COMPONENT_CACHE[$cache_key]}" ]]; then
        return 0
    fi

    # Only calculate if not cached
    refresh_color_state "$verb" "$noun"
    COMPONENT_CACHE[$cache_key]="true"
}

# Efficient screen clear (only when needed)
clear_screen_optimized() {
    # Use single escape sequence for full clear
    printf '\033[H\033[2J'
    mark_all_dirty
    log_action "Rendering: Screen cleared and marked dirty"
}

# Terminal resize handler
handle_terminal_resize() {
    init_double_buffer
    mark_all_dirty
    log_action "Rendering: Terminal resized, buffers reinitialized"
}

# Debug: Show rendering statistics
show_render_stats() {
    local dirty_components=()
    for component in header content footer repl; do
        if [[ "${COMPONENT_DIRTY[$component]}" == "true" ]]; then
            dirty_components+=("$component")
        fi
    done

    echo "Frame dirty: $FRAME_DIRTY"
    echo "Dirty components: ${dirty_components[*]:-none}"
    echo "Cache entries: ${#COMPONENT_CACHE[@]}"
    echo "Buffer size: ${#FRAME_BUFFER[@]} lines"
    echo "Current hash: ${CURRENT_FRAME_HASH:0:8}"
}