#!/bin/bash
source $HOME/src/devops/devpages/env.sh
NVM_DIR=/root/pj/nvm
echo "--- DevPages Production Environment ---"
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "PD_DIR: $PD_DIR"
source $NVM_DIR/nvm.sh
node server/server.js
