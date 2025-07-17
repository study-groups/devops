#!/bin/bash

# Source shared environment variables
source ./env.sh

# Ensure PD_DIR is set (typically inherited from env.sh for dev)
export PD_DIR=${PD_DIR:-$HOME/pj/pd} # Default dev path if not set by env.sh

# Set development-specific variables (could override env.sh)
export NODE_ENV=development
# export PORT=3001 # Example: use a different port for dev

echo "--- DevPages Development Environment ---"
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "PD_DIR: $PD_DIR"
echo "-------------------------------------"

# Start the server using nodemon for auto-reloading
# --ignore '.sessions/*' prevents nodemon from restarting when session files are written
nodemon --ignore '.sessions/*' server/server.js
