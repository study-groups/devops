#!/usr/bin/env bash
# TSM Service: Quasar Server
# QUASAR - PT100 MERIDIAN Game System

TSM_NAME="quasar"
TSM_COMMAND="node quasar_server.js"
TSM_CWD="$TETRA_SRC/bash/quasar"
TSM_PORT="1985"

# Use local.env for environment variables
TSM_ENV="local"
