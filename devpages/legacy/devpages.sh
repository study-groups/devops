#!/bin/bash
NVM_DIR=${NVM_DIR:-$HOME/pj/nvm}
source env.sh
echo "--- DevPages Production Environment ---"
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "PD_DIR: $PD_DIR"
source $NVM_DIR/nvm.sh
node server/server.js
