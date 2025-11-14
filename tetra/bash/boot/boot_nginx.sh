#!/usr/bin/env bash
# boot_nginx.sh - Auto-load nginx utilities during tetra initialization
# Part of tetra boot sequence

# Only load if nginx module exists
if [[ -f "$TETRA_SRC/bash/nginx/spaces_proxy.sh" ]]; then
    source "$TETRA_SRC/bash/nginx/spaces_proxy.sh"

    # Optional: Set flag for other modules to check
    export TETRA_NGINX_LOADED=1
fi

# Load other nginx utilities if they exist
if [[ -f "$TETRA_SRC/bash/nginx/nginx.sh" ]]; then
    source "$TETRA_SRC/bash/nginx/nginx.sh"
fi
