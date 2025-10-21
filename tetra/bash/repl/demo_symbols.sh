#!/usr/bin/env bash
# Symbol-Driven REPL Demo
# Shows runtime mode switching and symbol detection

cd "$(dirname "$0")/../.."

cat << 'EOF'
Symbol-Driven REPL Demo
========================

This demo shows:
1. Runtime mode switching (augment <-> takeover)
2. Symbol detection and handling (@, ::, #)
3. Dynamic command routing

Available Modes:
  augment  - Shell commands by default, /cmd for module
  takeover - Module commands by default, !cmd for shell

Symbol Handlers:
  @file    - File selector (stores in TEST_SELECTED_FILE)
  ::range  - Range parser (e.g., 10,20 or 1:100)
  #tag     - Tag metadata

Example Commands (in augment mode):
  ls                    # Shell command
  /start                # Module command
  echo @test.sh         # Symbol detection
  /mode takeover        # Switch mode

Example Commands (in takeover mode):
  status                # Module command (no / needed)
  !ls                   # Shell escape
  echo @file.sh::10,20  # Multiple symbols

Try these commands in the REPL:
  /status               # Show current state
  echo @myfile.sh       # See @symbol detection
  /mode takeover        # Switch to takeover mode
  !pwd                  # Shell escape in takeover mode
  /mode augment         # Switch back
  /theme list           # See available themes
  /exit                 # Exit

Starting REPL...
EOF

exec ./bash/repl/test_repl.sh
