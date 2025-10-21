#!/usr/bin/env bash

source tcurses.sh

# Initialize
echo "Initializing..."
tcurses_init
tcurses_setup_cleanup_trap

echo "Reading keys for 5 seconds (press any key)..."

for i in {1..10}; do
    echo -n "[$i] "
    key=$(tcurses_input_read_key 0.5)
    if [[ -n "$key" ]]; then
        echo "Got key: '$key' ($(tcurses_input_key_name "$key"))"
    else
        echo "timeout"
    fi
done

tcurses_cleanup
echo "Done."
