#!/bin/bash
path=$(dirname $(readlink -f ${0}))
NODE_ENVIRONMENT=development # or production
# Set and export PJ_DIR
export PD_DIR=$HOME/pj/pd
export MD_DIR=$HOME/pj/md;
source $HOME/pj/nvm/nvm.sh   # initializes runtime to same as CLI
export PORT=4001
node $HOME/src/devops/devpages/server/server.js
