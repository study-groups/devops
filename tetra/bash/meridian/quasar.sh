#!/usr/bin/env bash

# quasar.sh - Quasar Audio Engine Module
#
# Multi-mode audio synthesizer for tetra games.
# Modes: TIA (Atari 2600), PWM (lo-fi), SIDPlus (C64+)
#
# Usage:
#   quasar start           # Start quasar server
#   quasar stop            # Stop quasar server
#   quasar status          # Show server status
#   quasar demo            # Start demo mode
#   quasar bridge traks    # Start traks bridge

QUASAR_SRC="${QUASAR_SRC:-$TETRA_SRC/bash/quasar}"
QUASAR_DIR="${QUASAR_DIR:-$TETRA_DIR/quasar}"
QUASAR_PORT="${QUASAR_PORT:-1985}"
QUASAR_OSC_PORT="${QUASAR_OSC_PORT:-1986}"
QUASAR_PID_FILE="$QUASAR_DIR/quasar.pid"

# Ensure runtime directory exists
[[ -d "$QUASAR_DIR" ]] || mkdir -p "$QUASAR_DIR"

# ============================================================================
# Server Management
# ============================================================================

quasar_start() {
    local verbose=""
    [[ "$1" == "-v" || "$1" == "--verbose" ]] && verbose="-v"

    if quasar_is_running; then
        echo "Quasar already running (PID: $(cat "$QUASAR_PID_FILE"))"
        return 1
    fi

    echo "Starting Quasar server on port $QUASAR_PORT..."

    # Check for node
    if ! command -v node &>/dev/null; then
        echo "Error: node not found. Install Node.js first."
        return 1
    fi

    # Check for dependencies
    if [[ ! -d "$QUASAR_SRC/node_modules/ws" ]]; then
        echo "Installing dependencies..."
        (cd "$QUASAR_SRC" && npm install ws osc 2>/dev/null)
    fi

    # Start server
    PORT="$QUASAR_PORT" OSC_IN="$QUASAR_OSC_PORT" \
        nohup node "$QUASAR_SRC/quasar_server.js" $verbose \
        > "$QUASAR_DIR/quasar.log" 2>&1 &

    local pid=$!
    echo "$pid" > "$QUASAR_PID_FILE"

    sleep 1
    if quasar_is_running; then
        echo "Quasar started (PID: $pid)"
        echo "  HTTP: http://localhost:$QUASAR_PORT"
        echo "  WS:   ws://localhost:$QUASAR_PORT/ws"
        echo "  OSC:  localhost:$QUASAR_OSC_PORT"
        return 0
    else
        echo "Failed to start Quasar"
        rm -f "$QUASAR_PID_FILE"
        return 1
    fi
}

quasar_stop() {
    if ! quasar_is_running; then
        echo "Quasar not running"
        return 0
    fi

    local pid
    pid=$(cat "$QUASAR_PID_FILE")
    echo "Stopping Quasar (PID: $pid)..."

    kill "$pid" 2>/dev/null
    sleep 1

    if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null
    fi

    rm -f "$QUASAR_PID_FILE"
    echo "Quasar stopped"
}

quasar_restart() {
    quasar_stop
    sleep 1
    quasar_start "$@"
}

quasar_status() {
    if quasar_is_running; then
        local pid
        pid=$(quasar_get_pid)
        echo "Quasar running (PID: $pid)"
        echo "  HTTP: http://localhost:$QUASAR_PORT"
        echo "  WS:   ws://localhost:$QUASAR_PORT/ws"
        echo "  OSC:  localhost:$QUASAR_OSC_PORT"

        # Try to get status from API
        if command -v curl &>/dev/null; then
            echo ""
            echo "Server status:"
            curl -s "http://localhost:$QUASAR_PORT/api/status" 2>/dev/null | \
                python3 -m json.tool 2>/dev/null || echo "  (unable to query)"
        fi
    else
        echo "Quasar not running"
    fi
}

# Get quasar PID from TSM, own PID file, or lsof
quasar_get_pid() {
    # Try TSM first
    if declare -f tsm_find_by_port &>/dev/null; then
        local name
        name=$(tsm_find_by_port "$QUASAR_PORT" 2>/dev/null)
        if [[ -n "$name" ]]; then
            jq -r '.pid' "$TSM_PROCESSES_DIR/$name/meta.json" 2>/dev/null && return 0
        fi
    fi
    # Try own PID file
    if [[ -f "$QUASAR_PID_FILE" ]]; then
        cat "$QUASAR_PID_FILE"
        return 0
    fi
    # Try lsof
    lsof -ti :"$QUASAR_PORT" 2>/dev/null | head -1
}

quasar_is_running() {
    # Check if server responds (most reliable)
    curl -s --max-time 1 "http://localhost:$QUASAR_PORT/api/status" &>/dev/null && return 0

    # Fallback: check PID file and verify process is alive
    if [[ -f "$QUASAR_PID_FILE" ]]; then
        local pid
        pid=$(cat "$QUASAR_PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        else
            # Stale PID file - clean it up
            rm -f "$QUASAR_PID_FILE"
        fi
    fi

    return 1
}

quasar_logs() {
    local lines="${1:-50}"
    if [[ -f "$QUASAR_DIR/quasar.log" ]]; then
        tail -n "$lines" "$QUASAR_DIR/quasar.log"
    else
        echo "No log file found"
    fi
}

quasar_tail() {
    if [[ -f "$QUASAR_DIR/quasar.log" ]]; then
        tail -f "$QUASAR_DIR/quasar.log"
    else
        echo "No log file found"
    fi
}

# ============================================================================
# Bridge Management
# ============================================================================

quasar_bridge() {
    local game="${1:-traks}"
    local bridge_path="$QUASAR_SRC/bridges/${game}_bridge.js"

    if [[ ! -f "$bridge_path" ]]; then
        echo "Unknown game bridge: $game"
        echo "Available bridges:"
        ls "$QUASAR_SRC/bridges/"*_bridge.js 2>/dev/null | \
            xargs -I{} basename {} _bridge.js | sed 's/^/  /'
        return 1
    fi

    echo "Starting $game bridge..."
    node "$bridge_path" --server "ws://localhost:$QUASAR_PORT/ws?role=game"
}

# ============================================================================
# Demo Mode
# ============================================================================

quasar_demo() {
    echo "Starting Quasar in demo mode..."

    # Start server if not running
    if ! quasar_is_running; then
        quasar_start
        sleep 2
    fi

    # Start traks bridge (has built-in demo mode if traks not found)
    quasar_bridge traks
}

# ============================================================================
# OSC Send Helper
# ============================================================================

quasar_osc() {
    # Send OSC message to quasar
    # Usage: quasar_osc /quasar/0/set 1 18 7 12

    local address="$1"
    shift
    local args=("$@")

    if command -v oscsend &>/dev/null; then
        oscsend localhost "$QUASAR_OSC_PORT" "$address" "${args[@]}"
    else
        echo "oscsend not found. Install liblo-tools."
        echo "Would send: $address ${args[*]}"
    fi
}

# ============================================================================
# Sound Test
# ============================================================================

quasar_test() {
    echo "Testing Quasar sound..."

    if ! quasar_is_running; then
        echo "Quasar not running. Starting..."
        quasar_start
        sleep 2
    fi

    echo "Sending test sounds via OSC..."

    # Test voice 0
    quasar_osc /quasar/0/set i i i i 1 18 7 12
    sleep 0.5

    # Trigger pew
    quasar_osc /quasar/trigger/pew

    sleep 1

    # Stop voice
    quasar_osc /quasar/0/gate i 0

    echo "Test complete. Check browser at http://localhost:$QUASAR_PORT"
}

# ============================================================================
# Mute / Stop All
# ============================================================================

quasar_mute() {
    # Silence all voices
    for v in 0 1 2 3; do
        quasar_osc /quasar/$v/gate i 0
    done
    echo "All voices muted"
}

# ============================================================================
# Architecture Diagram
# ============================================================================

quasar_diagram() {
    cat <<'EOF'
QUASAR ARCHITECTURE
===================

LOCAL SYSTEM                                      BROWSER
─────────────────────────────────────────────────────────────────────────────

  ┌─────────────────┐
  │   BASH GAME     │  (traks.sh, pulsar.sh, etc.)
  │                 │
  │  • Game logic   │
  │  • State mgmt   │
  │  • Render ASCII │
  └────────┬────────┘
           │ stdout (ASCII frames)
           │ stdin  (keypresses)
           ▼
  ┌─────────────────┐
  │  GAME BRIDGE    │  (bridges/*_bridge.js)
  │                 │
  │  • PTY spawn    │
  │  • Parse frames │
  │  • Calc sound   │───────────────────────────────────────┐
  │    from state   │                                       │
  └────────┬────────┘                                       │
           │                                                │
           │ WebSocket (role=game)                          │
           │ ws://localhost:1985/ws?role=game               │
           ▼                                                │
  ┌─────────────────────────────────────┐                   │
  │         QUASAR SERVER               │                   │
  │         (quasar_server.js)          │                   │
  │                                     │                   │
  │  ┌───────────┐  ┌───────────────┐   │                   │
  │  │   HTTP    │  │   WebSocket   │   │                   │
  │  │  :1985    │  │    Server     │   │                   │
  │  │           │  │               │   │                   │
  │  │ • Serve   │  │ • Broadcast   │◄──┼───────────────────┘
  │  │   client  │  │   frames      │   │
  │  │ • /api/   │  │ • Relay input │   │
  │  │   status  │  │ • State sync  │   │
  │  └───────────┘  └───────┬───────┘   │
  │                         │           │
  │  ┌───────────┐          │           │
  │  │    OSC    │          │           │
  │  │   :1986   │          │           │
  │  │           │          │           │
  │  │ • Sound   │──────────┤           │
  │  │   cmds    │          │           │
  │  └───────────┘          │           │
  └─────────────────────────┼───────────┘
                            │
                            │ WebSocket
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
  │    BROWSER    │ │    BROWSER    │ │    BROWSER    │
  │    CLIENT     │ │    CLIENT     │ │    CLIENT     │
  │               │ │               │ │               │
  │ ┌───────────┐ │ │               │ │               │
  │ │ terminal  │ │ │     ...       │ │     ...       │
  │ │   .js     │ │ │               │ │               │
  │ │           │ │ │               │ │               │
  │ │ • Canvas  │ │ │               │ │               │
  │ │ • 60x24   │ │ │               │ │               │
  │ │ • CGA     │ │ │               │ │               │
  │ └───────────┘ │ │               │ │               │
  │               │ │               │ │               │
  │ ┌───────────┐ │ │               │ │               │
  │ │ quasar.js │ │ │               │ │               │
  │ │           │ │ │               │ │               │
  │ │ • Web     │ │ │               │ │               │
  │ │   Audio   │ │ │               │ │               │
  │ │ • 4 voice │ │ │               │ │               │
  │ └─────┬─────┘ │ │               │ │               │
  │       │       │ │               │ │               │
  │       ▼       │ │               │ │               │
  │ ┌───────────┐ │ │               │ │               │
  │ │tia-worklet│ │ │               │ │               │
  │ │   .js     │ │ │               │ │               │
  │ │           │ │ │               │ │               │
  │ │ • LFSR    │ │ │               │ │               │
  │ │ • Poly    │ │ │               │ │               │
  │ └─────┬─────┘ │ │               │ │               │
  └───────┼───────┘ └───────────────┘ └───────────────┘
          │
          ▼
      🔊 SPEAKERS


STATE PROPAGATION
=================

1. GAME STATE (bash process)
   ┌──────────────────────────────────────────────────┐
   │  • Position, velocity, collisions               │
   │  • Game loop ~15-30 FPS                         │
   │  • Renders ASCII to stdout                      │
   └──────────────────────────────────────────────────┘
                          │
                          ▼
2. BRIDGE STATE (node process)
   ┌──────────────────────────────────────────────────┐
   │  • Parses stdout for frame boundaries           │
   │  • Extracts game state from output              │
   │  • Calculates sound params:                     │
   │      velocity → freq (0=fast/high, 31=slow/low) │
   │      velocity → vol  (faster = louder)          │
   │      collision → trigger preset                 │
   └──────────────────────────────────────────────────┘
                          │
                          ▼
3. SERVER STATE (singleton)
   ┌──────────────────────────────────────────────────┐
   │  soundState = {                                 │
   │    mode: 'tia',                                 │
   │    v: [                                         │
   │      { g:0, f:0, w:0, v:0 },  // voice 0        │
   │      { g:0, f:0, w:0, v:0 },  // voice 1        │
   │      { g:0, f:0, w:0, v:0 },  // voice 2        │
   │      { g:0, f:0, w:0, v:0 }   // voice 3        │
   │    ]                                            │
   │  }                                              │
   │  • New clients get sync message                 │
   │  • Updates broadcast to all                     │
   └──────────────────────────────────────────────────┘
                          │
                          ▼
4. BROWSER STATE (per client)
   ┌──────────────────────────────────────────────────┐
   │  • Display buffer: 60x24 char array             │
   │  • Audio: 4 oscillators + worklet state         │
   │  • Presets: timer-based sequences               │
   │  • Input: keydown → WS → bridge → game stdin    │
   └──────────────────────────────────────────────────┘


SOUND PIPELINE
==============

  OSC Command                WebSocket Frame
  ───────────               ─────────────────
  /quasar/0/set             { t:'frame', snd: {
    1 18 7 12                 v: [{ g:1, f:18,
                                   w:7, v:12 }]
                              }}
        │                           │
        └───────────┬───────────────┘
                    │
                    ▼
            quasar_server.js
            (merge into soundState)
                    │
                    │ broadcast
                    ▼
            ┌───────────────────────────────┐
            │     Browser: quasar.js        │
            │                               │
            │  onmessage(snd) {             │
            │    for each voice:            │
            │      worklet.port.postMessage │
            │  }                            │
            └───────────────┬───────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │   AudioWorklet: tia-worklet   │
            │                               │
            │  process(inputs, outputs) {   │
            │    for each sample:           │
            │      clock TIA @ ~30kHz       │
            │      generate poly counters   │
            │      output = sum(voices)     │
            │  }                            │
            └───────────────┬───────────────┘
                            │
                            ▼
                        🔊 Audio


TIA WAVEFORMS
=============

  Wave 0:  Silent         ────────────────────
  Wave 1:  4-bit poly     ▄▀▄▀▀▄▀▄▄▀▀▄▀▀▄▀▄▄▀  (period 15)
  Wave 3:  5→4 poly       ▀▄▀▀▄▀▀▄▄▀▄▀▀▄▀▄▄▀▀  (engine rumble)
  Wave 4:  Square         ████    ████    ████  (pure tone)
  Wave 8:  9-bit poly     ▀▄▀▄▀▀▄▄▀▄▀▄▀▄▄▀▀▄▄  (white noise)


PORTS & PROTOCOLS
=================

  Port  Protocol  Direction    Purpose
  ────  ────────  ──────────   ────────────────────────────
  1985  HTTP      server→      Serve browser client files
  1985  WS        bidirect     Frames, input, sound state
  1986  OSC/UDP   in only      Sound commands from CLI/games

EOF
}

# ============================================================================
# Open Browser
# ============================================================================

quasar_open() {
    local url="http://localhost:$QUASAR_PORT"

    if ! quasar_is_running; then
        echo "Quasar not running. Start with: quasar start"
        return 1
    fi

    echo "Opening $url"

    if command -v open &>/dev/null; then
        open "$url"
    elif command -v xdg-open &>/dev/null; then
        xdg-open "$url"
    else
        echo "Please open $url in your browser"
    fi
}

# ============================================================================
# Main Dispatcher
# ============================================================================

quasar() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        start)   quasar_start "$@" ;;
        stop)    quasar_stop ;;
        restart) quasar_restart "$@" ;;
        status)  quasar_status ;;
        logs)    quasar_logs "$@" ;;
        tail)    quasar_tail ;;
        bridge)  quasar_bridge "$@" ;;
        demo)    quasar_demo ;;
        osc)     quasar_osc "$@" ;;
        test)    quasar_test ;;
        mute)    quasar_mute ;;
        open)    quasar_open ;;
        diagram) quasar_diagram ;;
        help|--help|-h)
            cat <<'EOF'
Quasar Audio Engine - Multi-mode synthesizer for tetra games

Usage: quasar <command> [options]

Commands:
  start [-v]      Start quasar server (verbose with -v)
  stop            Stop quasar server
  restart [-v]    Restart quasar server
  status          Show server status
  logs [n]        Show last n lines of log (default: 50)
  tail            Follow log output
  bridge <game>   Start game bridge (traks, pulsar, etc.)
  demo            Start demo mode
  osc <addr> ...  Send OSC message
  test            Test sound output
  mute            Silence all voices
  open            Open browser client
  diagram         Show architecture diagram

Environment:
  QUASAR_PORT      HTTP/WS port (default: 1985)
  QUASAR_OSC_PORT  OSC input port (default: 1986)

OSC Protocol:
  /quasar/{voice}/set {gate} {freq} {wave} {vol}
  /quasar/{voice}/gate {0|1}
  /quasar/mode {tia|pwm|sidplus}
  /quasar/trigger/{name}

Examples:
  quasar start           # Start server
  quasar demo            # Start with demo
  quasar bridge traks    # Connect traks game
  quasar open            # Open browser
EOF
            ;;
        *)
            echo "Unknown command: $cmd"
            echo "Run 'quasar help' for usage"
            return 1
            ;;
    esac
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    quasar "$@"
fi
