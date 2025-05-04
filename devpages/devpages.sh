#!/bin/bash

source ./env.sh
#export NODE_ENV=production
export NODE_ENV=development
export PD_DIR=${PD_DIR:-/var/www/devpages/pdata} # Example production path
echo "--- DevPages Production Environment ---"
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "PD_DIR: $PD_DIR"
source $HOME/pj/nvm/nvm.sh
node server/server.js
