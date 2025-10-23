#!/usr/bin/env bash
# pulsar.sh - C engine integration layer for tetra game module
# Manages Pulsar process lifecycle and protocol communication

# ============================================================================
# GLOBALS
# ============================================================================

declare -g _PULSAR_PID=""
declare -g PULSAR_FD_IN=""
declare -g PULSAR_FD_OUT=""
declare -g PULSAR_BIN="${GAME_SRC}/engine/bin/pulsar"
declare -g PULSAR_COLS=80
declare -g PULSAR_ROWS=24

# ID mapping: entity_id -> pulsar_id
declare -g -A PULSAR_ENTITY_MAP

# ============================================================================
# PROCESS MANAGEMENT
# ============================================================================

pulsar_start() {
    local cols="${1:-80}"
    local rows="${2:-24}"

    # Build engine if needed
    if [[ ! -x "$PULSAR_BIN" ]]; then
        tetra_log_info "game" "Building Pulsar engine..."
        make -C "${GAME_SRC}/engine" >&2 || {
            tetra_log_error "game" "Failed to build Pulsar"
            return 1
        }
    fi

    # Enable job control so we can foreground the process later
    set -m 2>/dev/null

    # Start engine process with bidirectional pipe
    coproc PULSAR { "$PULSAR_BIN"; }
    _PULSAR_PID=$PULSAR_PID  # Save bash's auto-set coproc PID to our variable
    PULSAR_FD_IN="${PULSAR[1]}"
    PULSAR_FD_OUT="${PULSAR[0]}"

    # Wait for READY response
    local response
    read -r -u "$PULSAR_FD_OUT" response
    if [[ "$response" != "OK READY" ]]; then
        tetra_log_error "game" "Pulsar failed to initialize: $response"
        return 1
    fi

    # Initialize terminal dimensions
    pulsar_cmd "INIT $cols $rows"

    # Read INIT response
    read -r -u "$PULSAR_FD_OUT" response
    if [[ "$response" != "OK INIT" ]]; then
        tetra_log_error "game" "Pulsar INIT failed: $response"
        return 1
    fi

    PULSAR_COLS=$cols
    PULSAR_ROWS=$rows

    # Auto-spawn gamepad sender and connect socket
    # Engine will spawn sender as child process automatically
    local socket_path="${GAME_INPUT_SOCKET:-/tmp/gamepad.sock}"

    # Export GAME_SRC so engine can find the sender binary
    export GAME_SRC

    tetra_log_info "game" "Connecting gamepad via $socket_path"
    pulsar_cmd "OPEN_SOCKET $socket_path"
    read -r -u "$PULSAR_FD_OUT" response
    if [[ "$response" == OK* ]]; then
        # Extract sender PID from response (macOS compatible)
        local sender_pid=$(echo "$response" | sed -n 's/.*sender_pid=\([0-9]*\).*/\1/p')
        [[ -z "$sender_pid" ]] && sender_pid="auto"
        tetra_log_success "game" "Gamepad connected: $socket_path (sender PID: $sender_pid)"
    else
        tetra_log_warn "game" "Gamepad socket failed: $response"
    fi

    tetra_log_success "game" "Pulsar started (PID $_PULSAR_PID, ${cols}×${rows})"
    return 0
}

pulsar_stop() {
    if [[ -n "$_PULSAR_PID" ]] && kill -0 "$_PULSAR_PID" 2>/dev/null; then
        pulsar_cmd "QUIT" 2>/dev/null || true
        wait "$_PULSAR_PID" 2>/dev/null || true
        tetra_log_info "game" "Pulsar stopped"
    fi
    _PULSAR_PID=""
    PULSAR_FD_IN=""
    PULSAR_FD_OUT=""
}

pulsar_running() {
    [[ -n "$_PULSAR_PID" ]] && kill -0 "$_PULSAR_PID" 2>/dev/null
}

# ============================================================================
# PROTOCOL COMMANDS
# ============================================================================

pulsar_cmd() {
    local cmd="$1"
    if ! pulsar_running; then
        tetra_log_error "game" "Pulsar not running"
        return 1
    fi
    echo "$cmd" >&"$PULSAR_FD_IN"
}

pulsar_read_response() {
    local response
    read -r -u "$PULSAR_FD_OUT" response
    echo "$response"
}

# ============================================================================
# COORDINATE TRANSLATION
# ============================================================================

# Terminal cell (x,y) → microgrid (mx, my)
# Each cell = 2×4 micro pixels
pulsar_cell_to_micro() {
    local x=$1 y=$2
    local mx=$(( x * 2 ))
    local my=$(( y * 4 ))
    echo "$mx $my"
}

# Microgrid (mx, my) → terminal cell (x, y)
pulsar_micro_to_cell() {
    local mx=$1 my=$2
    local x=$(( mx / 2 ))
    local y=$(( my / 4 ))
    echo "$x $y"
}

# Terminal dimensions → microgrid dimensions
pulsar_get_micro_dimensions() {
    local mx_width=$(( PULSAR_COLS * 2 ))
    local my_height=$(( PULSAR_ROWS * 4 ))
    echo "$mx_width $my_height"
}

# ============================================================================
# SPRITE COMMANDS
# ============================================================================

pulsar_spawn_pulsar() {
    local mx=$1        # microgrid x
    local my=$2        # microgrid y
    local len0=$3      # base arm length
    local amp=$4       # pulse amplitude
    local freq=$5      # pulse frequency
    local dtheta=$6    # rotation speed (rad/s)
    local valence=$7   # color valence (0-5)

    pulsar_cmd "SPAWN_PULSAR $mx $my $len0 $amp $freq $dtheta $valence"

    # Read ID response
    local response
    response=$(pulsar_read_response)
    if [[ "$response" =~ ^ID[[:space:]]([0-9]+) ]]; then
        echo "${BASH_REMATCH[1]}"
        return 0
    else
        tetra_log_error "game" "SPAWN_PULSAR failed: $response"
        return 1
    fi
}

pulsar_spawn() {
    local kind=$1       # sprite kind (e.g., "pulsar8")
    local valence=$2    # 0-5
    local pri=$3        # priority (0-255)
    shift 3
    local kvs=("$@")    # key=value pairs

    pulsar_cmd "SPAWN $kind $valence $pri ${kvs[*]}"

    local response
    response=$(pulsar_read_response)
    if [[ "$response" =~ ^ID[[:space:]]([0-9]+) ]]; then
        echo "${BASH_REMATCH[1]}"
        return 0
    else
        tetra_log_error "game" "SPAWN failed: $response"
        return 1
    fi
}

pulsar_set() {
    local glyph_id=$1
    local key=$2
    local value=$3

    pulsar_cmd "SET $glyph_id $key $value"

    local response
    response=$(pulsar_read_response)
    if [[ "$response" != "OK SET" ]]; then
        tetra_log_warn "game" "SET failed: $response"
        return 1
    fi
    return 0
}

pulsar_kill() {
    local glyph_id=$1

    pulsar_cmd "KILL $glyph_id"

    local response
    response=$(pulsar_read_response)
    if [[ "$response" =~ ^OK[[:space:]]KILL ]]; then
        return 0
    else
        tetra_log_warn "game" "KILL failed: $response"
        return 1
    fi
}

pulsar_run() {
    local fps="${1:-60}"

    # This will block until the engine stops (stdin closes or QUIT)
    pulsar_cmd "RUN $fps"
}

# Query gamepad axis value
# Usage: value=$(pulsar_query_gamepad_axis <player_id> <axis_id>)
pulsar_query_gamepad_axis() {
    local player_id=$1
    local axis_id=$2

    pulsar_cmd "QUERY gamepad.${player_id}.axis.${axis_id}"

    local response
    response=$(pulsar_read_response)
    if [[ "$response" =~ ^VALUE[[:space:]][^[:space:]]+[[:space:]](.+)$ ]]; then
        echo "${BASH_REMATCH[1]}"
        return 0
    else
        echo "0.0"
        return 1
    fi
}

# Query pulsar property
# Usage: value=$(pulsar_query <pulsar_id> <property>)
pulsar_query() {
    local pulsar_id=$1
    local property=$2

    pulsar_cmd "QUERY pulsar.${pulsar_id}.${property}"

    local response
    response=$(pulsar_read_response)
    if [[ "$response" =~ ^VALUE[[:space:]][^[:space:]]+[[:space:]](.+)$ ]]; then
        echo "${BASH_REMATCH[1]}"
        return 0
    else
        echo "ERROR: Query failed: $response" >&2
        echo "0"
        return 1
    fi
}

# ============================================================================
# ENTITY INTEGRATION
# ============================================================================

pulsar_entity_register() {
    local entity_id=$1
    local glyph_id=$2

    PULSAR_ENTITY_MAP[$entity_id]=$glyph_id
    tetra_log_debug "game" "Registered entity $entity_id → glyph $glyph_id"
}

pulsar_entity_get_id() {
    local entity_id=$1
    echo "${PULSAR_ENTITY_MAP[$entity_id]:-}"
}

pulsar_entity_unregister() {
    local entity_id=$1
    local glyph_id="${PULSAR_ENTITY_MAP[$entity_id]:-}"

    if [[ -n "$glyph_id" ]]; then
        # Only try to kill if Pulsar is actually running
        if pulsar_running; then
            pulsar_kill "$glyph_id"
            tetra_log_debug "game" "Unregistered entity $entity_id (glyph $glyph_id)"
        fi
        unset "PULSAR_ENTITY_MAP[$entity_id]"
    fi
}

# ============================================================================
# VALENCE HELPERS
# ============================================================================

# Map semantic valence names to Pulsar integers
pulsar_valence_to_int() {
    local val=$1
    case "$val" in
        neutral|NEUTRAL|0)   echo 0 ;;
        info|INFO|1)         echo 1 ;;
        success|SUCCESS|2)   echo 2 ;;
        warning|WARNING|3)   echo 3 ;;
        danger|DANGER|4)     echo 4 ;;
        accent|ACCENT|5)     echo 5 ;;
        *)                   echo 0 ;;
    esac
}

# ============================================================================
# EXPORTS
# ============================================================================

export -f pulsar_start
export -f pulsar_stop
export -f pulsar_running
export -f pulsar_cmd
export -f pulsar_read_response
export -f pulsar_cell_to_micro
export -f pulsar_micro_to_cell
export -f pulsar_get_micro_dimensions
export -f pulsar_spawn_pulsar
export -f pulsar_spawn
export -f pulsar_set
export -f pulsar_kill
export -f pulsar_query_gamepad_axis
export -f pulsar_query
export -f pulsar_run
export -f pulsar_entity_register
export -f pulsar_entity_get_id
export -f pulsar_entity_unregister
export -f pulsar_valence_to_int
