#!/bin/bash

_create_location_block() {
    local route_path="$1"
    local proxy_pass_url="$2"
    echo "    location $route_path {"
    echo "        proxy_pass $proxy_pass_url;"
    echo "    }"
}


pbase_nginx_route_proxy_add() {

   local start_tag=${PBASE_TAG_START:-"# PBASE_START"}
   local end_tag=${PBASE_TAG_END:-"# PBASE_END"}

    local route_path="$1"
    local proxy_pass_url="$2"
    local config_file="$3"
    local VERBOSE=${4:-false}

    $VERBOSE && echo "Attempting to add proxy_pass: $proxy_pass_url for route: $route_path in $config_file"

    # Create a temporary file
    local temp_file=$(mktemp)

    # Variables to track state
    local inside_pbase=0
    local inside_target_location=0
    local location_block_found=0

    # Process the file line by line
    while IFS= read -r line; do
        $VERBOSE && echo "Processing line: $line"

        # Check for PBASE block
        if is_pbase_tag "$line" "$start_tag"; then
            inside_pbase=1
            $VERBOSE && echo "Entered PBASE block"
        elif is_pbase_tag "$line" "$end_tag"; then
            inside_pbase=0
            $VERBOSE && echo "Exited PBASE block"
        fi

        # If we're inside the PBASE block, look for the target location
        if (( inside_pbase )); then
            $VERBOSE && echo "Inside PBASE block"
            if is_location_block "$line" "$route_path"; then
                inside_target_location=1
                location_block_found=1
                $VERBOSE && echo "Found route to add proxy_pass: $line"
            fi
        fi

        # If we're inside the target location, add the proxy_pass
        if (( inside_target_location )); then
            $VERBOSE && echo "Inside target location block"
            if is_opening_brace "$line"; then
                echo "$line" >> "$temp_file"
                echo "    proxy_pass $proxy_pass_url;" >> "$temp_file"
                inside_target_location=0
                $VERBOSE && echo "Added proxy_pass $proxy_pass_url to location $route_path"
                continue
            fi
        fi

        # Write the line to the temp file
        echo "$line" >> "$temp_file"
    done < "$config_file"

    # If no location block was found, add it before the PBASE_END tag
    if (( !location_block_found )); then
        $VERBOSE && echo "No location block found, adding new location block"
        temp_file_with_location=$(mktemp)
        while IFS= read -r line; do
            if is_pbase_tag "$line" "$end_tag"; then
                $VERBOSE && echo "Adding new location block before PBASE_END"
                _create_location_block "$route_path" "$proxy_pass_url" >> "$temp_file_with_location"
            fi
            echo "$line" >> "$temp_file_with_location"
        done < "$temp_file"
        mv "$temp_file_with_location" "$config_file"
    else
        mv "$temp_file" "$config_file"
    fi

    echo "Attempted to add route to config file."
    $VERBOSE && echo "Updated config file"

    # Check if the proxy_pass was successfully added
    if grep -q "proxy_pass[[:space:]]\+$proxy_pass_url" "$config_file"; then
        $VERBOSE && echo "Proxy_pass $proxy_pass_url successfully added"
        return 0
    else
        $VERBOSE && echo "Failed to add proxy_pass $proxy_pass_url"
        return 1
    fi
}