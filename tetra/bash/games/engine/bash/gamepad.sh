#!/usr/bin/env bash
# Gamepad management command
# Usage: gamepad [setup|start|stop|status|test]

GAME_SRC="${GAME_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
source "$GAME_SRC/core/input/gamepad_discovery.sh"

cmd="${1:-status}"

case "$cmd" in
    setup)
        gamepad_auto_setup
        ;;

    start)
        gamepad_start_reader
        ;;

    stop)
        gamepad_stop_reader
        gamepad_cleanup
        ;;

    status)
        gamepad_status
        ;;

    test)
        gamepad_test
        ;;

    discover)
        gamepad_discover
        ;;

    build)
        gamepad_build_tool
        ;;

    *)
        echo "Usage: gamepad [command]"
        echo
        echo "Commands:"
        echo "  setup      - Auto-detect and configure gamepads"
        echo "  start      - Start gamepad reader"
        echo "  stop       - Stop gamepad reader"
        echo "  status     - Show gamepad system status"
        echo "  test       - Monitor gamepad input (live)"
        echo "  discover   - Scan for connected gamepads"
        echo "  build      - Build gamepad tool"
        echo
        echo "Examples:"
        echo "  gamepad setup     # One-time setup"
        echo "  gamepad status    # Check if working"
        echo "  gamepad test      # See live input"
        ;;
esac
