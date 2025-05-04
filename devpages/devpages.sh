#!/bin/bash
path=$(dirname $(readlink -f ${0}))
NODE_ENVIRONMENT=development # or production

source $path/env.sh 
export PD_DIR=$HOME/pj/pd
export PD_DB=$HOME/pj/pd
export PD_DATA=$HOME/pj/pd/data
source $HOME/pj/nvm/nvm.sh
PORT=4000
export PORT
node $HOME/src/devops/devpages/server/server.js
