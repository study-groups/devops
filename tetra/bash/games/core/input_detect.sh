#!/usr/bin/env bash

# input_detect.sh - Input device detection for Pulsar game engine
# Detects gamepads, keyboards, and other input devices
# macOS-specific implementation using system_profiler and ioreg

# ============================================================================
# GAMEPAD DETECTION
# ============================================================================

# Detect connected gamepads via USB HID
# Returns: 0 if gamepad found, 1 otherwise
# Sets: GAMEPAD_* environment variables for detected devices
input_detect_gamepad() {
    # Check for USB HID game controllers
    if command -v system_profiler >/dev/null 2>&1; then
        local usb_data
        usb_data=$(system_profiler SPUSBDataType 2>/dev/null)

        # Look for common gamepad keywords
        if echo "$usb_data" | grep -qiE "(game|controller|joystick|xbox|playstation|nintendo)"; then
            # Found a potential gamepad
            export GAMEPAD_DETECTED=1

            # Try to extract device info
            local device_info
            device_info=$(echo "$usb_data" | grep -iA 10 -E "(game|controller|joystick)" | head -20)

            # Extract product ID and vendor ID if available
            local product_id
            local vendor_id
            product_id=$(echo "$device_info" | grep "Product ID:" | head -1 | awk '{print $NF}')
            vendor_id=$(echo "$device_info" | grep "Vendor ID:" | head -1 | awk '{print $NF}')

            export GAMEPAD_PRODUCT_ID="${product_id:-unknown}"
            export GAMEPAD_VENDOR_ID="${vendor_id:-unknown}"

            return 0
        fi
    fi

    # Check IOKit registry for HID devices
    if command -v ioreg >/dev/null 2>&1; then
        local hid_devices
        hid_devices=$(ioreg -c IOHIDDevice -r 2>/dev/null)

        if echo "$hid_devices" | grep -qiE "(game|controller|joystick)"; then
            export GAMEPAD_DETECTED=1
            export GAMEPAD_PRODUCT_ID="ioreg"
            export GAMEPAD_VENDOR_ID="ioreg"
            return 0
        fi
    fi

    # No gamepad found
    export GAMEPAD_DETECTED=0
    unset GAMEPAD_PRODUCT_ID
    unset GAMEPAD_VENDOR_ID
    return 1
}

# Get detailed gamepad information
# Returns: Human-readable gamepad info string
input_detect_gamepad_info() {
    if [[ "${GAMEPAD_DETECTED:-0}" != "1" ]]; then
        echo "No gamepad detected"
        return 1
    fi

    cat << EOF
Gamepad Detected:
  Vendor ID:  ${GAMEPAD_VENDOR_ID:-unknown}
  Product ID: ${GAMEPAD_PRODUCT_ID:-unknown}
  Status:     Connected
EOF
}

# Get macOS HID device path for gamepad (if available)
# This is more complex on macOS than Linux - devices aren't simple /dev/input/js0
# Returns: Path to device or empty string
input_detect_gamepad_device_path() {
    # macOS doesn't have /dev/input/js* like Linux
    # Instead, we need to use IOKit or Game Controller framework
    # For now, return empty - the C engine will use IOKit directly
    echo ""
}

# ============================================================================
# TERMINAL DETECTION
# ============================================================================

# Detect terminal capabilities
# Sets: TERMINAL_* environment variables
input_detect_terminal() {
    # Get terminal size
    if command -v tput >/dev/null 2>&1; then
        export TERMINAL_COLS=$(tput cols 2>/dev/null || echo 80)
        export TERMINAL_ROWS=$(tput lines 2>/dev/null || echo 24)
    else
        export TERMINAL_COLS=80
        export TERMINAL_ROWS=24
    fi

    # Check color support
    local colors
    colors=$(tput colors 2>/dev/null || echo 0)
    export TERMINAL_COLORS="$colors"

    # Check UTF-8 support
    if locale | grep -qi "utf-8"; then
        export TERMINAL_UTF8=1
    else
        export TERMINAL_UTF8=0
    fi

    # Terminal type
    export TERMINAL_TYPE="${TERM:-unknown}"
}

# Get terminal info
input_detect_terminal_info() {
    cat << EOF
Terminal Capabilities:
  Size:       ${TERMINAL_COLS:-?}x${TERMINAL_ROWS:-?}
  Colors:     ${TERMINAL_COLORS:-?}
  UTF-8:      ${TERMINAL_UTF8:-?}
  Type:       ${TERMINAL_TYPE:-unknown}
EOF
}

# ============================================================================
# KEYBOARD DETECTION
# ============================================================================

# Detect keyboard capabilities
input_detect_keyboard() {
    # For now, assume keyboard is always available
    export KEYBOARD_DETECTED=1

    # Check if terminal supports non-blocking input
    if stty -a 2>/dev/null | grep -q "icanon"; then
        export KEYBOARD_RAW_MODE=1
    else
        export KEYBOARD_RAW_MODE=0
    fi
}

# ============================================================================
# COMBINED DETECTION
# ============================================================================

# Run all input detection
# Returns: 0 on success
input_detect_all() {
    input_detect_gamepad
    input_detect_terminal
    input_detect_keyboard
    return 0
}

# Show all detected input devices
input_detect_show_all() {
    echo "=== Input Device Detection ==="
    echo ""
    input_detect_terminal_info
    echo ""
    input_detect_gamepad_info
    echo ""
    echo "Keyboard: ${KEYBOARD_DETECTED:-0}"
}

# ============================================================================
# EXPORTS
# ============================================================================

export -f input_detect_gamepad
export -f input_detect_gamepad_info
export -f input_detect_gamepad_device_path
export -f input_detect_terminal
export -f input_detect_terminal_info
export -f input_detect_keyboard
export -f input_detect_all
export -f input_detect_show_all
