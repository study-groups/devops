#!/usr/bin/env bash

# Quadrapole Game Demo
# Two pulsars with 8 arms pulsating in synchronized patterns

# Demo state
QUADRAPOLE_PULSAR1_ID=""
QUADRAPOLE_PULSAR2_ID=""

# Colors for pulsars (use TDS/color if available, fallback to ANSI)
if command -v color_get >/dev/null 2>&1; then
    QUADRAPOLE_COLOR1="$(color_get cyan)"
    QUADRAPOLE_COLOR2="$(color_get magenta)"
else
    QUADRAPOLE_COLOR1="\033[96m"  # Bright cyan fallback
    QUADRAPOLE_COLOR2="\033[95m"  # Bright magenta fallback
fi

# Initialize quadrapole demo
quadrapole_init() {
    echo "Initializing Quadrapole demo..." >&2

    # Create two pulsars at specified positions
    # Pulsar 1 at (20, 12) - Clockwise rotation, 6 arms
    pulsar_create 20 12 "$QUADRAPOLE_COLOR1" 2000 QUADRAPOLE_PULSAR1_ID
    pulsar_set_rotation "$QUADRAPOLE_PULSAR1_ID" 1  # Clockwise
    game_entity_set "$QUADRAPOLE_PULSAR1_ID" "arm_count" "6"  # 6 arms to break symmetry

    # Pulsar 2 at (60, 12) - Counter-clockwise rotation, 4 arms
    pulsar_create 60 12 "$QUADRAPOLE_COLOR2" 2000 QUADRAPOLE_PULSAR2_ID
    pulsar_set_rotation "$QUADRAPOLE_PULSAR2_ID" -1  # Counter-clockwise
    game_entity_set "$QUADRAPOLE_PULSAR2_ID" "arm_count" "4"  # 4 arms for contrast

    echo "Created pulsars: $QUADRAPOLE_PULSAR1_ID, $QUADRAPOLE_PULSAR2_ID" >&2
}

# Draw statistics HUD when paused
quadrapole_draw_hud() {
    local hud_width=50
    local hud_height=20
    local hud_x=$(( (${GAME_SCREEN_WIDTH:-80} - hud_width) / 2 ))
    local hud_y=$(( (${GAME_SCREEN_HEIGHT:-24} - hud_height) / 2 ))

    # Draw box border
    game_draw_rect "$hud_x" "$hud_y" "$hud_width" "$hud_height" "\033[96m"

    # Title
    game_draw_text $(( hud_x + 8 )) $(( hud_y + 1 )) "═══ PULSAR STATISTICS ═══" "\033[1;33m"

    # Get runtime and jitter stats
    local runtime=$(game_loop_get_runtime)
    local actual_fps=$(game_jitter_actual_fps)
    local jitter_avg=$(game_jitter_avg)
    local jitter_std=$(game_jitter_std)

    # Get pulsar angles
    local p1_angle=$(game_entity_get "$QUADRAPOLE_PULSAR1_ID" "rotation_angle" 2>/dev/null || echo "0")
    local p2_angle=$(game_entity_get "$QUADRAPOLE_PULSAR2_ID" "rotation_angle" 2>/dev/null || echo "0")
    p1_angle=$(awk "BEGIN {printf \"%.0f\", $p1_angle}" 2>/dev/null || echo "0")
    p2_angle=$(awk "BEGIN {printf \"%.0f\", $p2_angle}" 2>/dev/null || echo "0")

    # Draw stats
    local line=$(( hud_y + 3 ))
    game_draw_text $(( hud_x + 2 )) $((line++)) "Status:          PAUSED" "\033[37m"
    game_draw_text $(( hud_x + 2 )) $((line++)) "Runtime:         ${runtime}s" "\033[37m"
    game_draw_text $(( hud_x + 2 )) $((line++)) "Total Frames:    $GAME_LOOP_TOTAL_FRAMES" "\033[37m"

    line=$((line + 1))
    game_draw_text $(( hud_x + 2 )) $((line++)) "Performance:" "\033[33m"
    game_draw_text $(( hud_x + 2 )) $((line++)) "  Target FPS:    ${GAME_LOOP_TARGET_FPS}" "\033[37m"
    game_draw_text $(( hud_x + 2 )) $((line++)) "  Actual FPS:    ${actual_fps}" "\033[37m"
    game_draw_text $(( hud_x + 2 )) $((line++)) "  Jitter avg:    ${jitter_avg}ms" "\033[37m"
    game_draw_text $(( hud_x + 2 )) $((line++)) "  Jitter std:    ${jitter_std}ms" "\033[37m"

    line=$((line + 1))
    game_draw_text $(( hud_x + 2 )) $((line++)) "Pulsar 1 (Cyan):" "\033[96m"
    game_draw_text $(( hud_x + 2 )) $((line++)) "  Rotation:      ↻ Clockwise" "\033[96m"
    game_draw_text $(( hud_x + 2 )) $((line++)) "  Angle:         ${p1_angle}°" "\033[96m"

    line=$((line + 1))
    game_draw_text $(( hud_x + 2 )) $((line++)) "Pulsar 2 (Magenta):" "\033[95m"
    game_draw_text $(( hud_x + 2 )) $((line++)) "  Rotation:      ↺ Counter-CW" "\033[95m"
    game_draw_text $(( hud_x + 2 )) $((line++)) "  Angle:         ${p2_angle}°" "\033[95m"

    # Controls hint
    game_draw_text $(( hud_x + 2 )) $(( hud_y + hud_height - 2 )) "Press 'p' to resume" "\033[2;37m"
}

# Update quadrapole demo
# Args: delta_ms
quadrapole_update() {
    local delta="$1"

    # Update all entities (pulsars will update themselves)
    game_entity_update_all "$delta"
}

# Render quadrapole demo
quadrapole_render() {
    # Draw title
    game_draw_text_centered 2 "QUADRAPOLE - Dual Pulsar Demo" "\033[1;37m"

    # Render all entities (pulsars will render themselves)
    game_entity_render_all

    # Show HUD if paused
    if [[ ${GAME_LOOP_PAUSED:-0} -eq 1 ]]; then
        quadrapole_draw_hud
    fi

    # Draw status line
    local status_y=$((${GAME_SCREEN_HEIGHT:-24} - 2))
    if [[ ${GAME_LOOP_PAUSED:-0} -eq 1 ]]; then
        game_draw_text_centered "$status_y" "⏸  PAUSED  [p]resume [+/-]FPS [q]quit" "\033[1;31m"
    else
        game_draw_text_centered "$status_y" "▶  RUNNING  [p]pause [+/-]FPS [q]quit" "\033[1;32m"
    fi
}

# Main entry point for quadrapole demo
quadrapole_run() {
    echo "Starting Quadrapole demo..." >&2

    # Enable debug mode to show FPS
    game_loop_set_debug 1

    # Set target FPS
    game_loop_set_fps 30

    # Initialize and run game loop
    game_loop_init 30
    game_loop_run "quadrapole_init" "quadrapole_update" "quadrapole_render"

    echo "Quadrapole demo ended." >&2
}

# Export quadrapole functions
export -f quadrapole_init
export -f quadrapole_update
export -f quadrapole_render
export -f quadrapole_draw_hud
export -f quadrapole_run
