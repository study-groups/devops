#!/usr/bin/env bash
# Spawn TGP viewer in a new terminal window
# Works on macOS and Linux

SESSION="${1:-pulsar}"
VIEWER_SCRIPT="$TETRA_SRC/bash/game/engine/tgp_viewer.sh"

if [[ ! -f "$VIEWER_SCRIPT" ]]; then
    echo "ERROR: Viewer script not found: $VIEWER_SCRIPT"
    exit 1
fi

# Detect OS and spawn appropriate terminal
case "$(uname -s)" in
    Darwin)
        # macOS - use osascript to open new Terminal window
        osascript <<EOF
tell application "Terminal"
    activate
    do script "bash '$VIEWER_SCRIPT' '$SESSION'"
end tell
EOF
        echo "✓ Viewer launched in new Terminal window"
        ;;

    Linux)
        # Linux - try common terminal emulators
        if command -v gnome-terminal &>/dev/null; then
            gnome-terminal -- bash "$VIEWER_SCRIPT" "$SESSION" &
            echo "✓ Viewer launched in gnome-terminal"
        elif command -v xterm &>/dev/null; then
            xterm -e bash "$VIEWER_SCRIPT" "$SESSION" &
            echo "✓ Viewer launched in xterm"
        elif command -v konsole &>/dev/null; then
            konsole -e bash "$VIEWER_SCRIPT" "$SESSION" &
            echo "✓ Viewer launched in konsole"
        elif command -v x-terminal-emulator &>/dev/null; then
            x-terminal-emulator -e bash "$VIEWER_SCRIPT" "$SESSION" &
            echo "✓ Viewer launched in default terminal"
        else
            echo "ERROR: No terminal emulator found"
            echo "Please run manually: bash $VIEWER_SCRIPT $SESSION"
            exit 1
        fi
        ;;

    *)
        echo "ERROR: Unsupported OS: $(uname -s)"
        echo "Please run manually: bash $VIEWER_SCRIPT $SESSION"
        exit 1
        ;;
esac
