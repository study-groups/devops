#!/bin/bash

validate_environment() {
    # Check for required environment variables
    if [ -z "$NH_DIR" ]; then
        log_status "NH_DIR environment variable is not set"
        return 1
    fi
    if [ -z "$NH_CONTEXT" ]; then
        log_status "NH_CONTEXT environment variable is not set"
        return 1
    fi

    log_status "NH_DIR: $NH_DIR"
    log_status "NH_CONTEXT: $NH_CONTEXT"

    # Construct and validate the DIGOCEAN_JSON path
    DIGOCEAN_JSON="$NH_DIR/$NH_CONTEXT/digocean.json"
    log_status "Using DigitalOcean JSON file at: $DIGOCEAN_JSON"
    
    if [ ! -f "$DIGOCEAN_JSON" ]; then
        log_status "DigitalOcean JSON file not found at: $DIGOCEAN_JSON"
        return 1
    fi

    if [ ! -r "$DIGOCEAN_JSON" ]; then
        log_status "DigitalOcean JSON file is not readable: $DIGOCEAN_JSON"
        return 1
    fi
    
    return 0
}

validate_ip_format() {
    local ip="$1"
    if [[ ! $ip =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        log_status "Invalid IP format: $ip"
        return 1
    fi
    return 0
} 