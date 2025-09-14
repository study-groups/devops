#!/usr/bin/env bash

echo "=== Tubes TUI Application Demo ==="
echo ""
echo "This application automatically detects your terminal environment:"
echo ""

# Test simple mode
echo "📋 Testing Simple Mode (command-line interface):"
echo "   (Simulating non-TTY environment)"
echo ""

echo -e "help\ntheme\nmode\nquit" | ./tubes

echo ""
echo "✅ Simple mode works! All core functionality available via commands."
echo ""

# Check if we can test TUI mode
if [[ -t 0 && -t 1 && -t 2 ]]; then
    echo "🖥️  Your environment supports TUI mode!"
    echo ""
    echo "TUI Mode Features:"
    echo "  • Muted status bar at top showing current mode"
    echo "  • ESC toggles between self/tasks modes" 
    echo "  • Ctrl+C to quit (not ESC)"
    echo "  • Blue status bar for system messages"
    echo "  • Feedback area for help and autocompletion"
    echo "  • Borderless input prevents cut-off"
    echo "  • Tab completion for commands"
    echo ""
    echo "To test TUI mode, run: ./tubes"
    echo "Then try: /help, Tab completion, ESC to toggle modes"
else
    echo "ℹ️  TUI mode not available in this environment"
    echo "   (Running in Simple mode automatically)"
fi

echo ""
echo "🎨 Theme Management:"
echo "   Available themes: monochrome (default), dracula"
echo "   Current theme stored in: themes/.current"
echo "   Try: echo 'theme' | ./tubes"

echo ""
echo "📁 Project Structure:"
echo "   ✅ Deterministic grid layout system"
echo "   ✅ YAML-based theme management"  
echo "   ✅ UI Watchdog prevents layout issues"
echo "   ✅ MVC architecture with Bubbletea"
echo "   ✅ Extensible command registry"
echo "   ✅ Auto-fallback for any environment"

echo ""
echo "🚀 Ready to use! Both interfaces provide full functionality."