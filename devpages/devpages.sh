#!/bin/bash
path=$(dirname $(readlink -f ${0}))
NODE_ENVIRONMENT=development # or production
# Set and export PJ_DIR
export PJ_DIR=$HOME/pj
echo "[ENV] PJ_DIR=$PJ_DIR"
echo "[ENV] path=$path"
echo "[ENV] PWD=$(pwd)"
export MD_DIR=$HOME/pj/md;
echo "[ENV] MD_DIR=$MD_DIR"
echo "[ENV] NVM_DIR=$NVM_DIR"
source $HOME/pj/nvm/nvm.sh   # initializes runtime to same as CLI
echo "[SERVER] Starting: node $path/server/server.js"
PORT=4000
export PORT
node $HOME/src/devops/devpages/server/server.js
