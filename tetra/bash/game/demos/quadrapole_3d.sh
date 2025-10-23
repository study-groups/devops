#!/usr/bin/env bash

# Quadrapole Demo - Pulsar C Engine Backend
# Two rotating pulsars with bonded/split mechanics

quadrapole_3d_run() {
    local fps="${1:-60}"

    # Check if Pulsar is available
    if [[ "$GAME_PULSAR_AVAILABLE" != "true" ]]; then
        tetra_log_error "game" "Pulsar not available. Please build the C engine first:"
        echo "  cd $TETRA_SRC/engine && make" >&2
        return 1
    fi

    echo "=== Quadrapole Demo (Pulsar + Mechanics) ==="
    echo "Two pulsars with bonded/split control"
    echo ""
    echo "DEMO MODE: Automatic test pattern"
    echo "  - Pulsars start bonded at center-left"
    echo "  - Simulation moves them with contrary motion"
    echo "  - Watch them SPLIT when timer reaches 1.5s!"
    echo ""
    echo "Controls:"
    echo "  q - Quit (then ENTER to review logs)"
    echo "  h - Toggle help"
    echo "  1 - Debug panel"
    echo "  2 - Event log"
    echo ""
    echo "Dev Logs:"
    echo "  Logs will be written to: /tmp/quadrapole_dev.log"
    echo "  In another terminal, run: tail -f /tmp/quadrapole_dev.log"
    echo "  Watch for [MAPPING] and [STATE] logs"
    echo ""
    echo "Starting in 3 seconds..."
    sleep 3

    # Create dev log file immediately
    export DEV_LOG_FILE="/tmp/quadrapole_dev.log"
    echo "=== Quadrapole Dev Logs - $(date) ===" > "$DEV_LOG_FILE"
    echo "Watch for [MAPPING] and [STATE] logs below..." >> "$DEV_LOG_FILE"
    echo "" >> "$DEV_LOG_FILE"

    # Confirm file creation
    if [[ -f "$DEV_LOG_FILE" ]]; then
        echo "✓ Dev logs writing to: $DEV_LOG_FILE"
    else
        echo "✗ Warning: Could not create log file"
    fi

    # Initialize Pulsar game loop (auto-detect terminal size)
    game_loop_pulsar_init "$fps" || {
        tetra_log_error "game" "Failed to initialize Pulsar"
        return 1
    }

    # Load mechanics modules
    source "${GAME_SRC}/core/gamepad_bridge.sh"
    source "${GAME_SRC}/core/dev_mode.sh"
    source "${GAME_SRC}/core/quadrapole_mechanics.sh"

    # Initialize systems
    gamepad_bridge_init
    dev_mode_init

    # Demo state
    local pulsar_a_id=""
    local pulsar_b_id=""
    local initialized=0

    # Init function
    quadrapole_3d_init() {
        tetra_log_info "game" "Creating quadrapole pair..."

        # Pulsar A: accent color, 8 arms, starts at QUADRAPOLE_START position
        pulsar_3d_create "$QUADRAPOLE_START_X" "$QUADRAPOLE_START_Y" "accent" 2000 pulsar_a_id
        if [[ -z "$pulsar_a_id" ]]; then
            tetra_log_error "game" "Failed to create pulsar A"
            return 1
        fi
        pulsar_3d_set_rotation "$pulsar_a_id" 0.5
        pulsar_3d_set_arm_count "$pulsar_a_id" 8

        # Pulsar B: danger color, 6 arms, starts on top of A
        pulsar_3d_create "$QUADRAPOLE_START_X" "$QUADRAPOLE_START_Y" "danger" 2000 pulsar_b_id
        if [[ -z "$pulsar_b_id" ]]; then
            tetra_log_error "game" "Failed to create pulsar B"
            return 1
        fi
        pulsar_3d_set_rotation "$pulsar_b_id" -0.7
        pulsar_3d_set_arm_count "$pulsar_b_id" 6

        # Initialize quadrapole mechanics
        quadrapole_init "$pulsar_a_id" "$pulsar_b_id"

        initialized=1
        tetra_log_success "game" "Quadrapole mechanics active!"
    }

    # Update function - runs mechanics simulation
    quadrapole_3d_update() {
        local delta=$1

        if [[ "$initialized" != "1" ]]; then
            return
        fi

        # Read gamepad input from C engine (player 0)
        local left_x=$(pulsar_query_gamepad_axis 0 0)
        local left_y=$(pulsar_query_gamepad_axis 0 1)
        local right_x=$(pulsar_query_gamepad_axis 0 2)
        local right_y=$(pulsar_query_gamepad_axis 0 3)

        # Update mechanics with real gamepad input
        quadrapole_update "$left_x" "$left_y" "$right_x" "$right_y" "$delta"
    }

    # Run the game loop (C engine handles everything now)
    game_loop_pulsar_run quadrapole_3d_init quadrapole_3d_update

    tetra_log_info "game" "Quadrapole demo ended"

    echo ""
    echo "=== Demo Complete ==="
    echo "Press ENTER to continue (review logs above)..."
    read -r
}

# Export demo function
export -f quadrapole_3d_run
