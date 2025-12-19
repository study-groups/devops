#!/usr/bin/env bash
# TSM Service: Trax Bridge
# Connects trax game to Quasar server

TSM_NAME="trax-bridge"
TSM_COMMAND="node trax_bridge.js"
TSM_CWD="$TETRA_DIR/orgs/tetra/games/trax"
TSM_PORT="auto"

# Environment for flax engine
TSM_ENV_SETUP="TETRA_SRC=$TETRA_SRC TRAX_NO_CENTER=1 TRAX_NO_COLOR=1"
