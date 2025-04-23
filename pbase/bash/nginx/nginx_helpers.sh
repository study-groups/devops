#!/bin/bash

# Helper function to check for PBASE tags with flexible matching
is_pbase_tag() {
    local line="$1"
    local tag="$2"
    [[ "$line" =~ ^[[:space:]]*#?[[:space:]]*$tag ]]
}

# Helper function to check for NGINX tags with flexible matching
is_nginx_tag() {
    local line="$1"
    local tag="$2"
    [[ "$line" =~ ^[[:space:]]*#?[[:space:]]*$tag ]]
}

# Helper function to check for location block
is_location_block() {
    local line="$1"
    local route_path="$2"
    [[ "$line" =~ location[[:space:]]+$route_path[[:space:]]*\{ ]]
}

# Helper function to check for opening brace
is_opening_brace() {
    local line="$1"
    [[ "$line" =~ \{ ]]
}

# Helper function to check for closing brace
is_closing_brace() {
    local line="$1"
    [[ "$line" =~ \} ]]
}