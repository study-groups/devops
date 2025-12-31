#!/usr/bin/env bash
# Pulsar Development Console - Two Terminal Setup
#
# TERMINAL 1 (visuals):  ./dev.sh engine
# TERMINAL 2 (commands): source dev.sh
#
# Then in Terminal 2:
#   p "SPAWN_PLAYER 80 48 1 2"
#   pstart
#   pboth
#   pq

PULSAR_DEV_FIFO="/tmp/pulsar_dev.fifo"
PULSAR_SRC="${PULSAR_SRC:-$TETRA_SRC/bash/pulsar}"

# =============================================================================
# TERMINAL 1: ENGINE MODE
# =============================================================================

pulsar_engine() {
    local bin="$PULSAR_SRC/engine/bin/pulsar"

    if [[ ! -x "$bin" ]]; then
        echo "Error: Pulsar not found. Run: cd $PULSAR_SRC/engine && make" >&2
        return 1
    fi

    # Cleanup old FIFO
    rm -f "$PULSAR_DEV_FIFO"
    mkfifo "$PULSAR_DEV_FIFO"

    echo "Pulsar engine waiting for commands on $PULSAR_DEV_FIFO"
    echo "Run 'source dev.sh' in another terminal to send commands"
    echo ""

    # Keep FIFO open and run engine
    tail -f /dev/null > "$PULSAR_DEV_FIFO" &
    local tail_pid=$!

    # Run engine (blocks, shows visuals)
    "$bin" < "$PULSAR_DEV_FIFO"

    # Cleanup
    kill $tail_pid 2>/dev/null
    rm -f "$PULSAR_DEV_FIFO"
}

# =============================================================================
# TERMINAL 2: COMMAND MODE
# =============================================================================

pulsar_connect() {
    if [[ ! -p "$PULSAR_DEV_FIFO" ]]; then
        echo "Error: Engine not running. In another terminal run:"
        echo "  cd $PULSAR_SRC && ./dev.sh engine"
        return 1
    fi

    exec 3>"$PULSAR_DEV_FIFO"

    echo "Connected to pulsar engine"
    echo ""
    echo "Commands:"
    echo "  p 'CMD'   - send single command"
    echo "  pp        - multi-line block"
    echo "  pstart    - spawn players + RUN"
    echo "  p1 / p2   - fire from player 1/2"
    echo "  pboth     - fire both (collision!)"
    echo "  pq        - quit engine"
    echo ""

    # Auto-init
    p "INIT 80 24"
}

# Send single command
p() {
    echo "$*" >&3
}

# Multi-line block
pp() {
    echo "Enter commands (empty line to send):"
    {
        while IFS= read -r line; do
            [[ -z "$line" ]] && break
            echo "$line"
        done
    } >&3
    echo "Sent."
}

# Spawn players and run
# Screen: 80 cols = 160 microgrid X, 24 rows = 96 microgrid Y
pstart() {
    {
        echo "SPAWN_PLAYER 20 48 1 2"
        echo "SPAWN_PLAYER 140 48 1 4"
        echo "RUN 30"
    } >&3
}

# Fire from player 1 (left side)
p1() {
    echo "SPAWN_PROJECTILE 30 48 1 ${1:-50} 0 0 1 10 2" >&3
}

# Fire from player 2 (right side)
p2() {
    echo "SPAWN_PROJECTILE 130 48 1 -${1:-50} 0 0 2 10 4" >&3
}

# Fire both
pboth() {
    {
        echo "SPAWN_PROJECTILE 30 48 1 ${1:-50} 0 0 1 12 2"
        echo "SPAWN_PROJECTILE 130 48 1 -${1:-50} 0 0 2 12 4"
    } >&3
}

# Quit
pq() {
    p "QUIT"
    exec 3>&-
    echo "Disconnected"
}

# =============================================================================
# ENTRY POINT
# =============================================================================

export -f p pp pstart p1 p2 pboth pq pulsar_connect
export PULSAR_DEV_FIFO PULSAR_SRC

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Executed directly
    case "${1:-}" in
        engine|e)
            pulsar_engine
            ;;
        *)
            echo "Pulsar Dev Console"
            echo ""
            echo "  Terminal 1:  ./dev.sh engine"
            echo "  Terminal 2:  source dev.sh"
            ;;
    esac
else
    # Sourced - connect to engine
    pulsar_connect
fi
