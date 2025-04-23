#!/bin/bash

# Check for verbose flag
VERBOSE=${VERBOSE:-false}

# Function to remove the temporary directory
remove_temp_dir() {
    if [ -d "$TEMP_DIR" ]; then
        $VERBOSE && echo "Removing temporary directory: $TEMP_DIR"
        rm -rf "$TEMP_DIR"
    else
        $VERBOSE && echo "Temporary directory not found: $TEMP_DIR"
    fi
}

# Function to remove the log file
remove_log_file() {
    if [ -f "$LOG_FILE" ]; then
        $VERBOSE && echo "Removing log file: $LOG_FILE"
        rm -f "$LOG_FILE"
    else
        $VERBOSE && echo "Log file not found: $LOG_FILE"
    fi
}

# Main teardown function
main_teardown() {
    remove_temp_dir
    remove_log_file
    # Add any other teardown tasks here
}

# Run the main teardown
main_teardown

$VERBOSE && echo "Teardown complete."