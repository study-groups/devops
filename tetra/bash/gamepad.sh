#!/bin/bash

# List all connected gamepads with detailed information
function tetra_gamepad_list {
    local gamepads=($(ls /dev/input/js* 2>/dev/null))
    local num_gamepads=${#gamepads[@]}
    
    if [ $num_gamepads -eq 0 ]; then
        echo "No gamepads found."
    else
        echo "Number of connected gamepads: $num_gamepads"
        echo "-----------------------------------"
        for ((i=0; i<$num_gamepads; i++)); do
            echo "Gamepad $i:"
            echo -n "  Device Name: ";
			cat "/sys/class/input/js$i/device/name" 2>/dev/null \
				|| echo "Unknown"
            echo -n "  Device ID: ";
			cat "/sys/class/input/js$i/device/id/vendor" 2>/dev/null \
				|| echo "Unknown"
            echo -n "  Driver: ";
			cat "/sys/class/input/js$i/device/driver" 2>/dev/null \
				|| echo "Unknown"
            echo "-----------------------------------"
        done
    fi
}

# Get detailed information about a specific gamepad by index
function tetra_gamepad_get_info {
    local index=$1
    local gamepad="/dev/input/js$index"

    if [ ! -e "$gamepad" ]; then
        echo "Gamepad $index not found."
    else
        echo "Information for Gamepad $index:"
        echo "-----------------------------------"
        echo -n "Device Name: ";
		cat "/sys/class/input/js$index/device/name" 2>/dev/null \
			|| echo "Unknown"
        echo -n "Device ID: ";
		cat "/sys/class/input/js$index/device/id/vendor" 2>/dev/null \
			|| echo "Unknown"
        echo -n "Driver: ";
		cat "/sys/class/input/js$index/device/driver" 2>/dev/null \
			|| echo "Unknown"
        echo "-----------------------------------"
    fi
}

# Example usage:
# tetra_gamepad_list
# tetra_gamepad_get_info 0
