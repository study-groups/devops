#!/bin/bash

# Use lsof to find all listening TCP ports
lsof -iTCP -sTCP:LISTEN -n -P | awk 'NR>1 {print $1, $2, $9}' | while read process pid port; do
  # Extract the port number
  port_number=$(echo $port | awk -F':' '{print $NF}')
  echo "Process: $process (PID: $pid) - Port: $port_number"
done
