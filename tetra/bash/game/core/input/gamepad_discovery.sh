#!/usr/bin/env bash
# Gamepad Discovery System
# Automatically detects, configures, and launches gamepad reader

[[ -n "${_GAMEPAD_DISCOVERY_LOADED}" ]] && return 0
_GAMEPAD_DISCOVERY_LOADED=1

# Configuration
GAMEPAD_TOOL="${GAME_SRC:-$(dirname "${BASH_SOURCE[0]}")/../..}/tools/sender"
GAMEPAD_DB="${GAME_SRC:-$(dirname "${BASH_SOURCE[0]}")/../..}/tools/gamecontrollerdb.txt"
SOCKET_PATH="${GAME_INPUT_SOCKET:-/tmp/gamepad.sock}"

# Check if SDL2 is installed
gamepad_check_sdl2() {
    if command -v sdl2-config >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Check if gamepad tool is built
gamepad_check_tool() {
    [[ -x "$GAMEPAD_TOOL" ]]
}

# Build gamepad tool if needed
gamepad_build_tool() {
    local tool_dir="$(dirname "$GAMEPAD_TOOL")"

    if ! gamepad_check_sdl2; then
        echo "ERROR: SDL2 not installed" >&2
        echo "Install with: brew install sdl2" >&2
        return 1
    fi

    echo "Building gamepad tool..." >&2
    (cd "$tool_dir" && make) >&2

    if gamepad_check_tool; then
        echo "✓ Gamepad tool built" >&2
        return 0
    else
        echo "ERROR: Failed to build gamepad tool" >&2
        return 1
    fi
}

# Discover connected gamepads
gamepad_discover() {
    if ! gamepad_check_sdl2; then
        return 1
    fi

    # Use system_profiler on macOS
    if command -v system_profiler >/dev/null 2>&1; then
        system_profiler SPUSBDataType 2>/dev/null | \
            grep -iE "(game|controller|joystick|xbox|playstation|nintendo)" | \
            head -5
        return $?
    fi

    # Use lsusb on Linux
    if command -v lsusb >/dev/null 2>&1; then
        lsusb | grep -iE "(game|controller|xbox|playstation|nintendo)"
        return $?
    fi

    return 1
}

# Cleanup socket if needed
gamepad_setup_socket() {
    local socket_path="${1:-$SOCKET_PATH}"

    # Remove existing socket if present
    if [[ -e "$socket_path" ]]; then
        rm -f "$socket_path"
    fi

    echo "✓ Ready for socket: $socket_path" >&2
    return 0
}

# Start gamepad sender in background
gamepad_start_reader() {
    local socket_path="${1:-$SOCKET_PATH}"
    local player_id="${2:-0}"

    # Ensure tool is built
    if ! gamepad_check_tool; then
        gamepad_build_tool || return 1
    fi

    # Cleanup socket if needed
    gamepad_setup_socket "$socket_path" || return 1

    # Start sender
    "$GAMEPAD_TOOL" "$socket_path" "$player_id" 2>&1 | sed 's/^/[GAMEPAD] /' &
    local pid=$!

    # Store PID for cleanup
    echo "$pid" > "${socket_path}.pid"

    echo "✓ Gamepad sender started (PID: $pid)" >&2
    echo "$pid"
}

# Stop gamepad sender
gamepad_stop_reader() {
    local socket_path="${1:-$SOCKET_PATH}"
    local pid_file="${socket_path}.pid"

    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            echo "✓ Stopped gamepad sender (PID: $pid)" >&2
        fi
        rm -f "$pid_file"
    fi
}

# Auto-setup: discover, build, and start
gamepad_auto_setup() {
    local socket_path="${1:-$SOCKET_PATH}"
    local player_id="${2:-0}"

    echo "=== Gamepad Auto-Discovery ===" >&2
    echo >&2

    # Check SDL2
    if ! gamepad_check_sdl2; then
        echo "✗ SDL2 not installed" >&2
        echo "  Install with: brew install sdl2" >&2
        return 1
    fi
    echo "✓ SDL2 installed: $(sdl2-config --version)" >&2

    # Discover gamepads
    echo >&2
    echo "Scanning for gamepads..." >&2
    if gamepad_discover >/dev/null 2>&1; then
        echo "✓ Gamepad(s) detected:" >&2
        gamepad_discover | sed 's/^/  /' >&2
    else
        echo "⚠ No gamepads detected (will enable hot-plug)" >&2
    fi

    # Build tool if needed
    echo >&2
    if gamepad_check_tool; then
        echo "✓ Gamepad tool ready" >&2
    else
        echo "Building gamepad tool..." >&2
        gamepad_build_tool || return 1
    fi

    # Start sender
    echo >&2
    local pid=$(gamepad_start_reader "$socket_path" "$player_id")

    if [[ -n "$pid" ]]; then
        echo >&2
        echo "✓ Gamepad system ready!" >&2
        echo "  Socket: $socket_path" >&2
        echo "  Player ID: $player_id" >&2
        echo "  Sender PID: $pid" >&2
        return 0
    else
        echo "✗ Failed to start gamepad sender" >&2
        return 1
    fi
}

# Cleanup on exit
gamepad_cleanup() {
    local socket_path="${1:-$SOCKET_PATH}"

    gamepad_stop_reader "$socket_path"

    if [[ -S "$socket_path" ]]; then
        rm -f "$socket_path"
        echo "✓ Removed socket: $socket_path" >&2
    fi
}

# Show status
gamepad_status() {
    local socket_path="${1:-$SOCKET_PATH}"

    echo "=== Gamepad Status ==="

    # SDL2
    if gamepad_check_sdl2; then
        echo "SDL2: ✓ $(sdl2-config --version)"
    else
        echo "SDL2: ✗ Not installed"
    fi

    # Tool
    if gamepad_check_tool; then
        echo "Tool: ✓ $GAMEPAD_TOOL"
    else
        echo "Tool: ✗ Not built"
    fi

    # Socket
    if [[ -S "$socket_path" ]]; then
        echo "Socket: ✓ $socket_path"
    else
        echo "Socket: ✗ Not created"
    fi

    # Sender
    local pid_file="${socket_path}.pid"
    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo "Sender: ✓ Running (PID: $pid)"
        else
            echo "Sender: ✗ PID file exists but process dead"
        fi
    else
        echo "Sender: ✗ Not running"
    fi

    # Gamepads
    echo
    echo "Connected Gamepads:"
    if gamepad_discover; then
        : # Output already printed
    else
        echo "  None detected"
    fi
}

# Interactive test
gamepad_test() {
    local socket_path="${1:-$SOCKET_PATH}"

    echo "=== Gamepad Input Test ==="
    echo
    echo "This will monitor the sender process output."
    echo "Move sticks and press buttons to see activity."
    echo "Press Ctrl+C to stop"
    echo

    # Check if sender is running
    local pid_file="${socket_path}.pid"
    if [[ ! -f "$pid_file" ]]; then
        echo "ERROR: Sender not running. Start with: gamepad setup"
        return 1
    fi

    local pid=$(cat "$pid_file")
    if ! kill -0 "$pid" 2>/dev/null; then
        echo "ERROR: Sender process (PID: $pid) is dead"
        return 1
    fi

    echo "Sender running (PID: $pid)"
    echo "Monitoring socket activity at: $socket_path"
    echo

    # Show info message
    echo "Note: With datagram sockets, you'll need to run the engine"
    echo "to receive and display gamepad input."
}
