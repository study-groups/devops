#!/usr/bin/env bash

# Quadrapole Mechanics Demo
# Demonstrates the new quadrapole control scheme with joystick mapping

quadrapole_mechanics_demo_run() {
    local fps="${1:-60}"

    # Check if Pulsar is available
    if [[ "$GAME_PULSAR_AVAILABLE" != "true" ]]; then
        tetra_log_error "game" "Pulsar not available. Please build the C engine first:"
        echo "  cd $TETRA_SRC/engine && make" >&2
        return 1
    fi

    echo "=== Quadrapole Mechanics Demo (DEV MODE + AUTO TEST) ==="
    echo "Two pulsars start together at center-left"
    echo ""
    echo "DEMO MODE:"
    echo "  Automatic test pattern will run:"
    echo "  - First second: Left stick moves right"
    echo "  - Second second: Right stick moves left (contrary motion!)"
    echo "  - Third second: Reset"
    echo "  - Watch the pulsars SPLIT when contrary motion reaches 1.5s"
    echo ""
    echo "UI:"
    echo "  q - Quit (then press ENTER to review logs)"
    echo "  p - Pause rendering (C engine pauses, logs stop)"
    echo "  h - Toggle help"
    echo "  1 - Toggle debug panel"
    echo "  2 - Toggle event log"
    echo ""
    echo "Dev Mode (ENABLED):"
    echo "  Mapping logs will show in stderr/terminal below"
    echo "  Watch for: [MAPPING] L[x,y]→V[vx,vy] R[x,y]→V[vx,vy]"
    echo "             [STATE] BONDED/SPLIT timer=X.XXs"
    echo ""
    echo "Starting in 3 seconds..."
    sleep 3

    # Initialize Pulsar game loop
    game_loop_pulsar_init "$fps" 80 24 || {
        tetra_log_error "game" "Failed to initialize Pulsar"
        return 1
    }

    # Load required modules
    source "${GAME_SRC}/core/gamepad_bridge.sh" || {
        tetra_log_error "game" "Failed to load gamepad_bridge.sh"
        return 1
    }
    source "${GAME_SRC}/core/dev_mode.sh" || {
        tetra_log_error "game" "Failed to load dev_mode.sh"
        return 1
    }
    source "${GAME_SRC}/core/quadrapole_mechanics.sh" || {
        tetra_log_error "game" "Failed to load quadrapole_mechanics.sh"
        return 1
    }

    # Initialize gamepad bridge and dev mode
    gamepad_bridge_init
    dev_mode_init

    # Demo state
    local pulsar_a_id=""
    local pulsar_b_id=""
    local initialized=0
    local simulation_paused=0

    # Init function
    quadrapole_mechanics_init() {
        tetra_log_info "game" "Creating quadrapole pair..."

        # Create Pulsar A: accent color, 8 arms
        pulsar_3d_create "$QUADRAPOLE_START_X" "$QUADRAPOLE_START_Y" "accent" 2000 pulsar_a_id
        if [[ -z "$pulsar_a_id" ]]; then
            tetra_log_error "game" "Failed to create pulsar A"
            return 1
        fi
        pulsar_3d_set_rotation "$pulsar_a_id" 0.5
        pulsar_3d_set_arm_count "$pulsar_a_id" 8

        # Create Pulsar B: danger color, 6 arms
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
        tetra_log_success "game" "Quadrapole mechanics demo ready!"
    }

    # Update function - called every frame
    quadrapole_mechanics_update() {
        local delta=$1

        if [[ "$initialized" != "1" ]]; then
            return
        fi

        # Check for pause key (p)
        # Note: This is a simple check - proper key handling would be in C engine
        # For now, we'll keep the simulation running but this is the hook point

        # If paused, don't update the simulation
        if [[ "$simulation_paused" == "1" ]]; then
            return
        fi

        # TEMPORARY: Simulate keyboard input until we have C engine integration
        # The C engine processes WASD/IJKL internally but doesn't send values back to Bash yet
        # So we simulate some test input to demonstrate the mapping logs

        # Simulate a test pattern: slowly move left stick right
        local frame_count="${frame_count:-0}"
        ((frame_count++))

        # Create a simple test pattern
        local test_cycle=$((frame_count % 180))  # 3 second cycle at 60fps
        local left_x=0.0 left_y=0.0 right_x=0.0 right_y=0.0

        if [[ $test_cycle -lt 60 ]]; then
            # First second: move left stick right
            left_x=$(echo "scale=2; $test_cycle / 60.0" | bc -l)
        elif [[ $test_cycle -lt 120 ]]; then
            # Second second: move right stick left (opposite)
            local t=$((test_cycle - 60))
            left_x=1.0
            right_x=$(echo "scale=2; -$t / 60.0" | bc -l)
        else
            # Third second: reset
            left_x=0.0
            right_x=0.0
        fi

        # Inject into gamepad bridge for consistency
        gamepad_bridge_set_axis 0 0 "$left_x"
        gamepad_bridge_set_axis 0 1 "$left_y"
        gamepad_bridge_set_axis 0 2 "$right_x"
        gamepad_bridge_set_axis 0 3 "$right_y"

        # Update quadrapole mechanics with current stick state
        quadrapole_update "$left_x" "$left_y" "$right_x" "$right_y" "$delta"
    }

    # Run the game loop (use manual mode since fg/job control not available)
    game_loop_pulsar_run_manual quadrapole_mechanics_init quadrapole_mechanics_update

    tetra_log_info "game" "Quadrapole mechanics demo ended"

    echo ""
    echo "=== Demo Complete ==="
    echo "Press ENTER to continue (so you can copy logs)..."
    read -r
}

# Export demo function
export -f quadrapole_mechanics_demo_run
