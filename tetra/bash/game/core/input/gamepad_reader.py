#!/usr/bin/env python3
"""
Simple gamepad input reader for macOS
Outputs stick positions and button presses in real-time
Can be piped to bash for game control
"""

import sys
import time

try:
    import pygame
    pygame.init()
    pygame.joystick.init()
except ImportError:
    print("ERROR: pygame not installed", file=sys.stderr)
    print("Install with: pip3 install pygame", file=sys.stderr)
    sys.exit(1)

def main():
    # Check for gamepads
    joystick_count = pygame.joystick.get_count()

    if joystick_count == 0:
        print("ERROR: No gamepads detected", file=sys.stderr)
        sys.exit(1)

    # Use first gamepad
    joystick = pygame.joystick.Joystick(0)
    joystick.init()

    print(f"# Gamepad: {joystick.get_name()}", file=sys.stderr)
    print(f"# Axes: {joystick.get_numaxes()}", file=sys.stderr)
    print(f"# Buttons: {joystick.get_numbuttons()}", file=sys.stderr)
    print(f"# Hats: {joystick.get_numhats()}", file=sys.stderr)
    print("#", file=sys.stderr)
    print("# Output format: AXIS <index> <value> | BUTTON <index> <0|1>", file=sys.stderr)
    print("#", file=sys.stderr)

    # State tracking
    prev_axes = [0.0] * joystick.get_numaxes()
    prev_buttons = [0] * joystick.get_numbuttons()

    try:
        while True:
            pygame.event.pump()

            # Check axes (sticks, triggers)
            for i in range(joystick.get_numaxes()):
                value = joystick.get_axis(i)
                # Apply deadzone
                if abs(value) < 0.1:
                    value = 0.0

                # Only output if changed
                if abs(value - prev_axes[i]) > 0.01:
                    print(f"AXIS {i} {value:.3f}")
                    sys.stdout.flush()
                    prev_axes[i] = value

            # Check buttons
            for i in range(joystick.get_numbuttons()):
                value = joystick.get_button(i)

                # Only output on change
                if value != prev_buttons[i]:
                    print(f"BUTTON {i} {value}")
                    sys.stdout.flush()
                    prev_buttons[i] = value

            # Check D-pad (hat)
            for i in range(joystick.get_numhats()):
                hat = joystick.get_hat(i)
                if hat != (0, 0):
                    print(f"HAT {i} {hat[0]} {hat[1]}")
                    sys.stdout.flush()

            time.sleep(0.016)  # ~60 FPS

    except KeyboardInterrupt:
        print("# Gamepad reader stopped", file=sys.stderr)
        pygame.quit()

if __name__ == "__main__":
    main()
