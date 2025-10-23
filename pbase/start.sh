#!/bin/bash

# Quick start script for pdata service
# Usage: ./start.sh [port]

# Source init to set up environment
source init.sh || {
    echo "ERROR: Failed to initialize pbase environment" >&2
    exit 1
}

# Start pdata with optional port argument
PORT=${1:-${PDATA_PORT:-3000}}

echo "Starting pdata on port $PORT..."
pdata start $PORT
