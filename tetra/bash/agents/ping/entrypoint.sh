#!/usr/bin/env bash
# <integertime> <src> <dest> <type> <message-until-newline>
SRC="ping"            # Pico object src
DEST="pong"
TYPE="PING"
PING_DELAY=100
MSG_SIZE=128

# You could replace bootstrap.sh with pico_object.sh
# since it contains the definition for the only 
# tetra function used: tetra_pico_object_create()
#
# tetra_pico_object_create $SRC $DEST PING $MSG_SIZE
#
# or wait until pico_object.sh is factored out of 
# tetra and imported from pico.sh.
TETRA_DIR=$PWD
source $TETRA_SRC/bootstrap.sh

# Function to handle SIGUSR1 signal
sigusr1_handler() {
    echo "Signal SIGUSR1 received."
    echo "Destination: $DEST"
    echo "Ping Delay: $PING_DELAY seconds"
    echo "Message Size: $MSG_SIZE bytes"
}

# Function to handle SIGINT signal (Ctrl+C)
sigint_handler() {
    echo "Shutting down..."
    exit 0
}

# Function to handle user input
user_input_handler() {
    while true; do
        read -p "Enter your input: " input
        echo "You entered: $input"
    done
}

# Initialize signal handlers
trap sigusr1_handler SIGUSR1
trap sigint_handler SIGINT

# Start the user input handler
#user_input_handler &

# State machine loop
echo "Sending $TYPE to $DEST with message"
echo "size $MSG_SIZE and delay $PING_DELAY"

while true; do
    # Generate a PING message using the defined variables
    tetra_pico_object_create $SRC $DEST PING $MSG_SIZE
    sleep $PING_DELAY &
    wait $!  # this allows the sleep to be interrupted by the signal
done
