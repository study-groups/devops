#!/usr/bin/env bash

# Nginx Module Includes - Standard tetra module entry point
# Controls nginx reverse proxy and spaces proxy functionality

# Follow tetra convention: MOD_SRC for source code, MOD_DIR for runtime data
# Per CLAUDE.md: "MOD_SRC is a strong global. A module can count on it."
MOD_SRC="$TETRA_SRC/bash/nginx"
MOD_DIR="$TETRA_DIR/nginx"

# Backward compatibility
NGINX_SRC="$MOD_SRC"
NGINX_DIR="$MOD_DIR"

# Create runtime directories if they don't exist
[[ ! -d "$MOD_DIR" ]] && mkdir -p "$MOD_DIR"
[[ ! -d "$MOD_DIR/conf.d" ]] && mkdir -p "$MOD_DIR/conf.d"
[[ ! -d "$MOD_DIR/logs" ]] && mkdir -p "$MOD_DIR/logs"

# Export for subprocesses
export MOD_SRC MOD_DIR NGINX_SRC NGINX_DIR

# Source the main nginx module
source "$MOD_SRC/nginx.sh"

# Source nginx helpers
source "$MOD_SRC/nginx_helpers.sh"

# Register nginx actions with action registry
if [[ -f "$TETRA_SRC/bash/actions/registry.sh" ]]; then
    source "$TETRA_SRC/bash/actions/registry.sh"

    # Configuration actions
    action_register "nginx" "config.proxy" "Configure nginx reverse proxy" "<upstream_port> [server_name]" "no"
    action_register "nginx" "config.spaces" "Configure DigitalOcean Spaces proxy" "<space_name> [region]" "no"

    # Service actions
    action_register "nginx" "test.config" "Test nginx configuration" "" "no"
    action_register "nginx" "reload.service" "Reload nginx configuration" "" "no"
    action_register "nginx" "status.service" "Show nginx status" "" "no"
fi
