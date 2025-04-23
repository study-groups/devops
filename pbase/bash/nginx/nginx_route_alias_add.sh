#!/bin/bash

pbase_nginx_route_alias_add() {
    local route_path="${1:-$NGINX_ROUTE}"
    local alias_path="${2:-$NGINX_ALIAS}"
    local config_file="${3:-$NGINX_CONF_PATH}"

    echo "Route Path: $route_path"  # Debugging line
    echo "Alias Path: $alias_path"  # Debugging line
    echo "Config File: $config_file"  # Debugging line

    local intermediate_file="${config_file}.if"

    $VERBOSE && echo "Attempting to add alias: $alias_path for route: $route_path in $config_file"

    # Create an intermediate file
    > "$intermediate_file"

    # Variables to track state
    local inside_nginx=0
    local inside_target_location=0
    local location_block_found=0

    # Process the file line by line
    while IFS= read -r line; do
        $VERBOSE && echo "Processing line: $line"

        # Check for NGINX block
        if is_nginx_tag "$line" "$NGINX_TAG_START"; then
            inside_nginx=1
            $VERBOSE && echo "Entered NGINX block"
        elif is_nginx_tag "$line" "$NGINX_TAG_END"; then
            inside_nginx=0
            $VERBOSE && echo "Exited NGINX block"
        fi

        # If we're inside the NGINX block, look for the target location
        if (( inside_nginx )); then
            $VERBOSE && echo "Inside NGINX block"
            if is_location_block "$line" "$route_path"; then
                inside_target_location=1
                location_block_found=1
                $VERBOSE && echo "Found route to add alias: $line"
            fi
        fi

        # If we're inside the target location, add the alias
        if (( inside_target_location )); then
            $VERBOSE && echo "Inside target location block"
            if is_opening_brace "$line"; then
                echo "$line" >> "$intermediate_file"
                echo "    alias $alias_path;" >> "$intermediate_file"
                inside_target_location=0
                $VERBOSE && echo "Added alias $alias_path to location $route_path"
                continue
            fi
        fi

        # Write the line to the intermediate file
        echo "$line" >> "$intermediate_file"
    done < "$config_file"

    # If no location block was found, add it before the NGINX_END tag
    if (( !location_block_found )); then
        $VERBOSE && echo "No location block found, adding new location block"
        local final_file="${config_file}.final"
        > "$final_file"
        while IFS= read -r line; do
            if is_nginx_tag "$line" "$NGINX_TAG_END"; then
                $VERBOSE && echo "Adding new location block before NGINX_END"
                {
                    echo "    location $route_path {"
                    echo "        alias $alias_path;"
                    echo "    }"
                } >> "$final_file"
            fi
            echo "$line" >> "$final_file"
        done < "$intermediate_file"
        mv "$final_file" "$config_file"
    else
        mv "$intermediate_file" "$config_file"
    fi

    echo "Attempted to add alias route to config file."
    $VERBOSE && echo "Updated config file"
}

