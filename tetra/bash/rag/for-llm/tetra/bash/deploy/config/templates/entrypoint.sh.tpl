#!/usr/bin/env bash

export PORT={{PORT}}
export PD_DIR={{PD_DIR}}
export NODE_ENV={{NODE_ENV}}

health_check() {
    local port=$1
    local timeout=30
    local start_time=$(date +%s)
    while true; do
        if curl -s --max-time 5 http://127.0.0.1:$port >/dev/null 2>&1; then
            echo "Service healthy on port $port"
            return 0
        fi
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        if [ $elapsed -ge $timeout ]; then
            echo "Health check timeout after ${timeout}s"
            return 1
        fi
        echo "Waiting for service to be healthy... (${elapsed}s)"
        sleep 2
    done
}

source {{NVM_PATH}}
source {{ENV_FILE}}

nvm use {{NVM_VERSION}}

node ./build/index.js &
SERVICE_PID=$!

if health_check $PORT; then
    wait $SERVICE_PID
else
    kill $SERVICE_PID 2>/dev/null || true
    exit 1
fi
