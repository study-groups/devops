#!/bin/bash

pbase_nginx_route_alias_remove() {
    local route_path="${1:-$NGINX_ROUTE}"
    local config_file="${2:-$NGINX_CONF_PATH}"

    $VERBOSE && echo "Attempting to remove route: $route_path from $config_file"

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
        if is_pbase_tag "$line" "$PBASE_TAG_START"; then
            inside_pbase=1
            $VERBOSE && echo "Entered PBASE block"
        elif is_pbase_tag "$line" "$PBASE_TAG_END"; then
            inside_pbase=0
            $VERBOSE && echo "Exited PBASE block"
        fi

        # If we're inside the PBASE block, look for the target location
        if (( inside_pbase )); then
            if is_location_block "$line" "$route_path"; then
                inside_target_location=1
                location_block_found=1
                $VERBOSE && echo "Found route to remove: $line"
                continue
            fi
        fi

        # If we're not inside the target location, write the line to the temp file
        if (( !inside_target_location )); then
            echo "$line" >> "$temp_file"
        fi
    done < "$config_file"

    # If the location block was found, remove it
    if (( location_block_found )); then
        $VERBOSE && echo "Removing location block for $route_path"
    else
        $VERBOSE && echo "Location block for $route_path not found"
        return 1
    fi

    # Replace the original file with the modified content
    mv "$temp_file" "$config_file"

    $VERBOSE && echo "Updated config file"

    # Check if the route was successfully removed
    if grep -q "location[[:space:]]\+$route_path" "$config_file"; then
        $VERBOSE && echo "Failed to remove route $route_path"
        return 1
    else
        $VERBOSE && echo "Route $route_path successfully removed"
        return 0
    fi
}