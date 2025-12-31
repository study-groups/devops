⏺ Summary

  Problem: tetra tui was hanging

  Root Cause: Coprocs don't inherit the controlling terminal properly, so tui-core couldn't access /dev/tty

  Fixes Applied:

  1. Made MIDI opt-in (--midi flag) - prevents hang when MIDI service isn't running
  2. Added TTY fd inheritance - tui-core accepts TUI_TTY_FD env var for terminal access in coproc
  3. Run scripts as executables, not sourced - sourcing inherits shell state that breaks coprocs

  Final Commands:
  - tetra tui → tui2.sh (simple, reliable)
  - tetra tcui --midi → tcurses-tui.sh (with ctx integration)
  - tsm start midi → starts MIDI service

  Files Changed:
  - tetra.sh - run tui scripts as executables
  - tcurses-tui.sh - MIDI opt-in, TTY fd passing
  - tui-core.c - accept inherited TTY fd, optional MIDI
  - tui2.sh - restored from git

