#!/usr/bin/env bash
# gamepad_bridge.sh - Bridge between C engine gamepad state and bash game logic
# Provides a clean interface to read gamepad axes and buttons

[[ -n "${_GAME_GAMEPAD_BRIDGE_LOADED}" ]] && return 0
_GAME_GAMEPAD_BRIDGE_LOADED=1

# Gamepad state cache (updated periodically)
declare -g -A GAMEPAD_AXES        # [player_id.axis_id] = value
declare -g -A GAMEPAD_BUTTONS     # [player_id] = button_bitfield
declare -g GAMEPAD_BRIDGE_ENABLED=1

# Initialize gamepad bridge
gamepad_bridge_init() {
    GAMEPAD_BRIDGE_ENABLED=1
    tetra_log_debug "game" "Gamepad bridge initialized"
}

# Get axis value for a player
# Usage: value=$(gamepad_bridge_get_axis <player_id> <axis_id>)
# Returns: Float value in range [-1.0, 1.0]
gamepad_bridge_get_axis() {
    local player_id="$1"
    local axis_id="$2"
    local key="${player_id}.${axis_id}"

    # Return cached value or 0.0 if not set
    echo "${GAMEPAD_AXES[$key]:-0.0}"
}

# Get left stick for a player
# Usage: read left_x left_y < <(gamepad_bridge_get_left_stick <player_id>)
gamepad_bridge_get_left_stick() {
    local player_id="$1"
    local x=$(gamepad_bridge_get_axis "$player_id" 0)
    local y=$(gamepad_bridge_get_axis "$player_id" 1)
    echo "$x $y"
}

# Get right stick for a player
# Usage: read right_x right_y < <(gamepad_bridge_get_right_stick <player_id>)
gamepad_bridge_get_right_stick() {
    local player_id="$1"
    local x=$(gamepad_bridge_get_axis "$player_id" 2)
    local y=$(gamepad_bridge_get_axis "$player_id" 3)
    echo "$x $y"
}

# Get button state for a player
# Usage: buttons=$(gamepad_bridge_get_buttons <player_id>)
# Returns: 32-bit button bitfield
gamepad_bridge_get_buttons() {
    local player_id="$1"
    echo "${GAMEPAD_BUTTONS[$player_id]:-0}"
}

# Check if specific button is pressed
# Usage: if gamepad_bridge_button_pressed <player_id> <button_id>; then ...
gamepad_bridge_button_pressed() {
    local player_id="$1"
    local button_id="$2"
    local buttons=$(gamepad_bridge_get_buttons "$player_id")

    # Check if bit is set
    local mask=$((1 << button_id))
    local result=$((buttons & mask))

    [[ $result -ne 0 ]]
}

# Update gamepad state from engine
# This is called periodically by the game loop
# For now, this is a SIMULATION - in production, this would query the C engine
# Usage: gamepad_bridge_update
gamepad_bridge_update() {
    if [[ "$GAMEPAD_BRIDGE_ENABLED" != "1" ]]; then
        return
    fi

    # TODO: In production, query the C engine for gamepad state
    # The C engine maintains gamepad state in gamepads[MAX_PLAYERS]
    # We would send a command like "GET_GAMEPAD_STATE 0" and parse response
    #
    # For now, we simulate by checking keyboard state which the C engine
    # already converts to gamepad axes via update_keyboard_gamepad_simulation()

    # The C engine handles keyboard->gamepad mapping internally
    # WASD -> left stick, IJKL -> right stick
    # So we just need to poll that state

    # For testing purposes, we'll set some default values
    # In a real implementation, this would come from the C engine via a protocol command
}

# Set axis value directly (for testing/simulation)
# Usage: gamepad_bridge_set_axis <player_id> <axis_id> <value>
gamepad_bridge_set_axis() {
    local player_id="$1"
    local axis_id="$2"
    local value="$3"
    local key="${player_id}.${axis_id}"

    GAMEPAD_AXES[$key]="$value"
}

# Set button state directly (for testing/simulation)
# Usage: gamepad_bridge_set_buttons <player_id> <buttons>
gamepad_bridge_set_buttons() {
    local player_id="$1"
    local buttons="$2"

    GAMEPAD_BUTTONS[$player_id]="$buttons"
}

# Debug: Print gamepad state
# Usage: gamepad_bridge_debug <player_id>
gamepad_bridge_debug() {
    local player_id="${1:-0}"

    echo "Gamepad State (Player $player_id):"
    echo "  Left Stick:  ($(gamepad_bridge_get_axis "$player_id" 0), $(gamepad_bridge_get_axis "$player_id" 1))"
    echo "  Right Stick: ($(gamepad_bridge_get_axis "$player_id" 2), $(gamepad_bridge_get_axis "$player_id" 3))"
    echo "  Triggers:    L=$(gamepad_bridge_get_axis "$player_id" 4) R=$(gamepad_bridge_get_axis "$player_id" 5)"
    echo "  Buttons:     0x$(printf "%08x" "$(gamepad_bridge_get_buttons "$player_id")")"
}

# Export functions
export -f gamepad_bridge_init
export -f gamepad_bridge_get_axis
export -f gamepad_bridge_get_left_stick
export -f gamepad_bridge_get_right_stick
export -f gamepad_bridge_get_buttons
export -f gamepad_bridge_button_pressed
export -f gamepad_bridge_update
export -f gamepad_bridge_set_axis
export -f gamepad_bridge_set_buttons
export -f gamepad_bridge_debug
