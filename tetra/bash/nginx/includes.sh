#!/usr/bin/env bash

# Nginx Module Includes - Standard tetra module entry point
# Controls nginx reverse proxy and spaces proxy functionality

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "nginx" "NGINX" "conf.d:logs"

# Source the main nginx module
source "$MOD_SRC/nginx.sh"

# Source nginx helpers
tetra_source_if_exists "$MOD_SRC/nginx_helpers.sh"

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
