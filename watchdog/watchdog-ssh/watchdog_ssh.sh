#!/bin/bash

# Define the target hosts and corresponding tags
hosts=("$do1" "$do4_n2")
tags=("do1" "do4_n2")

# Define the directory to store last timestamps
timestamp_dir="/tmp/nectar_timestamps"

# Create the timestamp directory if it doesn't exist
mkdir -p "$timestamp_dir"

# Loop through the hosts and collect data
for ((i = 0; i < ${#hosts[@]}; i++)); do
    host="${hosts[i]}"
    tag="${tags[i]}"

    # Define the file to store the last timestamp for this host
    timestamp_file="$timestamp_dir/$tag.timestamp"

    # Provide feedback to the user
    echo "Collecting data from $tag at $host"
    # Use SSH to execute the remote command and retrieve the data
    new_data=$(ssh -o StrictHostKeyChecking=no root@$host \
        "cat /tmp/watchdog/recent")

    # Check if the data is different from the previous one
    if [ -f "$timestamp_file" ]; then
        last_data=$(cat "$timestamp_file")
        if [ "$new_data" != "$last_data" ]; then
            # Data has changed, update the timestamp and save the new data
            echo "$new_data" > "$timestamp_file"
            echo "$new_data" | sed "s/^/$tag,/" >> \
                "./db/watchdog_$tag.log"
        fi
    else
        # First time collecting data, create the timestamp file and save the data
        echo "$new_data" > "$timestamp_file"
        echo "$new_data" | sed "s/^/$tag,/" >> \
            "./db/watchdog_$tag.log"
    fi
done
