#!/bin/bash

# Function to show SSH tunneling instructions
hotrod_ssh_help() {
    echo "To connect to a remote Hotrod server, create an SSH tunnel:"
    echo ""
    echo "   ssh -N -L 9999:localhost:9999 user@remote-server"
    echo ""
    echo "Then you can send messages as if Hotrod is running locally."
    echo ""
    exit 0
}
