#!/bin/bash

START_TAG=${NGINX_TAG_START:-"# PBASE_START"}
END_TAG=${NGINX_TAG_END:-"# PBASE_END"}

# Function to check if the NGINX block exists in the config file
pbase_nginx_block_exists() {
    local config_file="$1"
    grep -q "$START_TAG" "$config_file" && grep -q "$END_TAG" "$config_file"
}

# Function to remove the NGINX block from the config file
pbase_nginx_block_remove() {
    local config_file="$1"
    if ! pbase_nginx_block_exists "$config_file"; then
        echo "NGINX block does not exist in $config_file"
        return 1
    fi

    awk -v start_tag="$START_TAG" -v end_tag="$END_TAG" '
    BEGIN {skip=0}
    $0 ~ start_tag {skip=1}
    $0 ~ end_tag {skip=0; next}
    !skip {print}
    ' "$config_file" > "${config_file}.tmp" && mv "${config_file}.tmp" "$config_file"

    echo "NGINX block removed from $config_file"
}

# Function to show the NGINX block in the config file
pbase_nginx_block_show() {
    local config_file="$1"
    if ! pbase_nginx_block_exists "$config_file"; then
        echo "NGINX block does not exist in $config_file"
        return 1
    fi

    awk "/$START_TAG/,/$END_TAG/" "$config_file"
}

# Function to replace the NGINX block in the config file
pbase_nginx_block_replace() {
    local config_file="$1"
    local new_content="$2"
    if ! pbase_nginx_block_exists "$config_file"; then
        echo "NGINX block does not exist in $config_file"
        return 1
    fi

    awk -v start_tag="$START_TAG" -v end_tag="$END_TAG" -v new_content="$new_content" '
    BEGIN {skip=0}
    $0 ~ start_tag {print; print new_content; skip=1}
    $0 ~ end_tag {skip=0; print; next}
    !skip {print}
    ' "$config_file" > "${config_file}.tmp" && mv "${config_file}.tmp" "$config_file"

    echo "NGINX block replaced in $config_file"
}

# Function to add a new NGINX block to the config file
pbase_nginx_block_add() {
    local config_file="$1"
    local new_content="$2"

    # Check if the block already exists
    if pbase_nginx_block_exists "$config_file"; then
        echo "NGINX block already exists in $config_file"
        return 1
    fi

    # Insert the new content just before the closing } of the server block
    awk -v start_tag="$START_TAG" -v end_tag="$END_TAG" -v new_content="$new_content" '
    /server {/ {print; in_block=1; next}
    in_block && /}/ {
        print start_tag;
        print new_content;
        print end_tag;
        print;
        in_block=0;
        next
    }
    {print}
    ' "$config_file" > "${config_file}.tmp" && mv "${config_file}.tmp" "$config_file"

    echo "NGINX block added to $config_file"
}