#!/usr/bin/env bash

echo "Testing Tubes TUI improvements..."
echo ""
echo "Features implemented:"
echo "✅ Muted status bar at top (shows mode)"
echo "✅ ESC toggles between modes (not quit)"  
echo "✅ Blue status bar at bottom for system messages"
echo "✅ Feedback area below input for help/coaching"
echo "✅ Removed textarea flashing/blinking"
echo "✅ Fixed background color consistency"
echo "✅ Borderless input prevents cut-off"
echo "✅ UI Watchdog prevents layout issues"
echo ""
echo "Testing commands to try:"
echo "  /help       - Shows commands in feedback area"
echo "  /theme list - Lists available themes"
echo "  /theme use dracula - Switches to dracula theme"
echo "  Tab         - Command completion (shows in feedback)"
echo "  ESC         - Toggle between self/tasks mode"
echo "  Ctrl+C      - Quit application"
echo ""
echo "Building and starting Tubes..."

# Build the application
go build -o tubes ./cmd/tubes

if [ $? -eq 0 ]; then
    echo "Build successful! Starting Tubes..."
    echo "Note: ESC now toggles modes, Ctrl+C to quit"
    echo ""
    ./tubes
else
    echo "Build failed!"
    exit 1
fi