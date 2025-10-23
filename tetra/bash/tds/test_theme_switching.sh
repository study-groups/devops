#!/usr/bin/env bash

# Test that demonstrates theme switching with visible color changes

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tds.sh" 2>/dev/null

clear
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                    TDS Theme Switching Demonstration                        ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo

# Function to show theme
show_theme() {
    local theme_name="$1"

    echo "┌────────────────────────────────────────────────────────────────────────────┐"
    echo "│ Theme: $theme_name"
    echo "└────────────────────────────────────────────────────────────────────────────┘"
    echo

    echo "  Status Indicators:"
    echo "    $(tds_status "success" "Build succeeded")  $(tds_status "error" "Connection failed")  $(tds_status "warning" "Disk low")  $(tds_status "info" "Update available")  $(tds_status "pending" "Processing...")"
    echo

    echo "  Environment Badges:"
    echo "    $(tds_env_badge "local")  $(tds_env_badge "dev")  $(tds_env_badge "staging")  $(tds_env_badge "prod")"
    echo

    echo "  Mode Badges:"
    echo "    $(tds_mode_badge "config")  $(tds_mode_badge "service")  $(tds_mode_badge "deploy")  $(tds_mode_badge "keys")"
    echo

    echo "  Semantic Colors:"
    echo "    Primary: $(tds_color "primary" "Sample text")  Secondary: $(tds_color "secondary" "Sample text")  Muted: $(tds_color "muted" "Sample text")"
    echo
    echo
}

# Test Tokyo Night
echo "Loading tokyo-night..."
tds_switch_theme "tokyo-night" >/dev/null 2>&1
show_theme "TOKYO NIGHT (vibrant blues, purples, greens)"
sleep 1

# Test Neon
echo "Loading neon..."
tds_switch_theme "neon" >/dev/null 2>&1
show_theme "NEON (electric colors, high contrast)"
sleep 1

# Test Default
echo "Loading default..."
tds_switch_theme "default" >/dev/null 2>&1
show_theme "DEFAULT (balanced professional colors)"
sleep 1

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                              Test Complete!                                  ║"
echo "║                                                                              ║"
echo "║  If you see DIFFERENT colors for each theme above, the fix is working!      ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
