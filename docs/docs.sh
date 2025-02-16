#!/bin/bash
path=$(dirname $(readlink -f ${0}))
NODE_ENVIRONMENT=development # or production
PORT=${PORT:-4000}
source $NVM_DIR/nvm.sh   # initializes runtime to same as CLI
export PWD=$HOME/pj/md; node  $path/server.js
