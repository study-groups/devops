#!/usr/bin/env bash
# Simple gamepad input test
# Shows what gamepad buttons/axes are being pressed in real-time

source ~/tetra/tetra.sh
source "$TETRA_SRC/bash/game/core/input_detect.sh"

echo "=== Gamepad Input Test ==="
echo

# Detect gamepad
input_detect_all

if [[ "${GAMEPAD_DETECTED:-0}" != "1" ]]; then
    echo "No gamepad detected!"
    echo
    echo "Make sure your gamepad is:"
    echo "  1. Plugged in via USB"
    echo "  2. Turned on (if wireless)"
    echo "  3. Recognized by macOS"
    echo
    echo "Test with: system_profiler SPUSBDataType | grep -i game"
    exit 1
fi

echo "✓ Gamepad detected!"
echo "  Vendor: ${GAMEPAD_VENDOR_ID}"
  echo "  Product: ${GAMEPAD_PRODUCT_ID}"
echo

# Check for sdl2-jstest or jstest
if command -v sdl2-jstest >/dev/null 2>&1; then
    echo "Using sdl2-jstest..."
    echo "Press buttons and move sticks (Ctrl+C to exit)"
    echo
    sdl2-jstest --list
    echo
    read -p "Select device number (usually 0): " device_num
    sdl2-jstest --test "${device_num:-0}"
elif command -v jstest >/dev/null 2>&1; then
    echo "Using jstest..."
    echo "Press buttons and move sticks (Ctrl+C to exit)"
    echo
    # Try common device paths
    for device in /dev/input/js0 /dev/input/js1; do
        if [[ -e "$device" ]]; then
            jstest "$device"
            exit 0
        fi
    done
    echo "No /dev/input/js* devices found (normal on macOS)"
else
    echo "No gamepad testing tools found."
    echo
    echo "To install gamepad testing tools:"
    echo "  brew install sdl2"
    echo "  brew install jstest-gtk"
    echo
    echo "Alternative: Use built-in macOS tools:"
    echo "  1. System Settings → Game Controllers"
    echo "  2. Or: ioreg -c IOHIDDevice -r | grep -i game -A 10"
    echo
    echo "Checking ioreg..."
    if command -v ioreg >/dev/null 2>&1; then
        ioreg -c IOHIDDevice -r | grep -i -E "(game|controller|joystick)" -A 10 | head -30
    fi
fi
