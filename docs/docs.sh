#!/bin/bash
path=$(dirname $(readlink -f ${0}))
NODE_ENVIRONMENT=development # or production
PORT=${PORT:-4000}
echo path=$path
echo PWD=$(pwd)
export MD_DIR=$HOME/pj/md;
echo MD_DIR=$MD_DIR
echo NVM_DIR=$NVM_DIR
source $NVM_DIR/nvm.sh   # initializes runtime to same as CLI
echo starting: node  $path/server/server.js
node  $HOME/src/devops/docs/server/server.js
