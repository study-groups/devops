#!/bin/bash

check_prereqs() {
    log_status "start"
    
    # Check for required environment variables
    if [ -z "$NH_DIR" ]; then
        log_status "NH_DIR environment variable not set"
        return 1
    fi

    # Set context from NH_CONTEXT or DIGITALOCEAN_CONTEXT
    if [ -n "$NH_CONTEXT" ]; then
        CONTEXT="$NH_CONTEXT"
    elif [ -n "$DIGITALOCEAN_CONTEXT" ]; then
        CONTEXT="$DIGITALOCEAN_CONTEXT"
    else
        log_status "Neither NH_CONTEXT nor DIGITALOCEAN_CONTEXT is set"
        return 1
    fi

    # Set DIGOCEAN_JSON path using the context
    export DIGOCEAN_JSON="$NH_DIR/contexts/$CONTEXT/digitalocean.json"
    
    # Check if digitalocean.json exists
    if [ ! -f "$DIGOCEAN_JSON" ]; then
        log_status "DigitalOcean JSON file not found at $DIGOCEAN_JSON"
        return 1
    fi
    
    # Check for required commands
    for cmd in jq dig ssh; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            log_status "Required command not found: $cmd"
            return 1
        fi
    done
    
    log_status "end"
    return 0
} 