#!/usr/bin/env bash
source "$HOME/src/devops/tetra/env/dev.env"
cd "$TETRA_SRC"
$HOME/tetra/nvm/versions/node/v20.19.5/bin/node server/server.js
