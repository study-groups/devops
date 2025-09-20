#!/usr/bin/env bash
source "$(dirname "$0")/../env/local.env"
cd "$TETRA_SRC"
node server/server.js