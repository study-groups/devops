#!/bin/bash
path=$(dirname $(readlink -f ${0}))
NODE_ENVIRONMENT=development
# Set and export PJ_DIR
export PD_DB=$HOME/pj/pd
export PD_DIR=$HOME/pj/pd
export PD_DATA=$HOME/pj/pd/data
export MD_DIR=$HOME/pj/md;
source $HOME/pj/nvm/nvm.sh
#node --inspect-brk $HOME/src/devops/devpages/server/server.js
node $HOME/src/devops/devpages/server/server.js
