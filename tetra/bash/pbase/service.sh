#!/usr/bin/env bash

# pdata.sh - Bash wrapper for pdata service management
# Requires TETRA_DIR, PBASE_DIR to be set

pdata_info(){
    echo "=== PData Configuration ==="
    echo "PD_DIR:       ${PD_DIR:-not set}"
    echo "PDATA_PORT:   ${PDATA_PORT:-3000}"
    echo "PDATA_SRC:    ${PDATA_SRC:-not set}"
    echo "NODE_ENV:     ${NODE_ENV:-development}"
    echo ""
    echo "=== TETRA Environment ==="
    echo "TETRA_DIR:    ${TETRA_DIR:-not set}"
    echo "TETRA_SRC:    ${TETRA_SRC:-not set}"
    echo "PBASE_DIR:    ${PBASE_DIR:-not set}"
    echo "PBASE_SRC:    ${PBASE_SRC:-not set}"
}

pdata_check_env(){
    local errors=0

    if [ -z "$TETRA_DIR" ]; then
        echo "ERROR: TETRA_DIR not set" >&2
        errors=$((errors + 1))
    fi

    if [ -z "$PBASE_DIR" ]; then
        echo "ERROR: PBASE_DIR not set (should be \$TETRA_DIR/pbase)" >&2
        errors=$((errors + 1))
    fi

    if [ -z "$PD_DIR" ]; then
        echo "ERROR: PD_DIR not set (required by pdata)" >&2
        errors=$((errors + 1))
    fi

    if [ -z "$PDATA_SRC" ]; then
        echo "WARNING: PDATA_SRC not set, using default: $HOME/src/devops/devpages/pdata" >&2
        export PDATA_SRC="$HOME/src/devops/devpages/pdata"
    fi

    if [ ! -d "$PDATA_SRC" ]; then
        echo "ERROR: PDATA_SRC directory does not exist: $PDATA_SRC" >&2
        errors=$((errors + 1))
    fi

    return $errors
}

pdata_start(){
    pdata_check_env || return 1

    local port=${1:-${PDATA_PORT:-3000}}

    echo "Starting pdata service..."
    echo "  Source: $PDATA_SRC"
    echo "  Data:   $PD_DIR"
    echo "  Port:   $port"

    cd "$PDATA_SRC" || {
        echo "ERROR: Failed to cd to $PDATA_SRC" >&2
        return 1
    }

    # Start with node
    export PORT=$port
    export PD_DIR
    node index.js
}

pdata_stop(){
    echo "Stopping pdata service..."
    # Find and kill node processes running pdata
    pkill -f "node.*index.js" && echo "Stopped pdata" || echo "No pdata process found"
}

pdata_status(){
    echo "=== PData Status ==="

    if pgrep -f "node.*index.js" > /dev/null; then
        echo "Status: RUNNING"
        echo "PID(s): $(pgrep -f 'node.*index.js' | tr '\n' ' ')"

        # Show port if we can find it
        if [ -n "$PDATA_PORT" ]; then
            echo "Port: $PDATA_PORT"
        fi
    else
        echo "Status: STOPPED"
    fi

    echo ""
    pdata_info
}

pdata_test(){
    pdata_check_env || return 1

    echo "Running pdata tests..."
    cd "$PDATA_SRC" || return 1
    npm test
}

# Main dispatcher
pdata(){
    case "$1" in
        start)
            pdata_start "${2:-3000}"
            ;;
        stop)
            pdata_stop
            ;;
        restart)
            pdata_stop
            sleep 1
            pdata_start "${2:-3000}"
            ;;
        status)
            pdata_status
            ;;
        test)
            pdata_test
            ;;
        info)
            pdata_info
            ;;
        check)
            pdata_check_env && echo "✓ All environment checks passed"
            ;;
        *)
            echo "Usage: pdata {start|stop|restart|status|test|info|check} [port]"
            return 1
            ;;
    esac
}
