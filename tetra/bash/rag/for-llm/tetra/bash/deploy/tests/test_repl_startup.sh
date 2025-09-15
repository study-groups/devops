#!/usr/bin/env bash

# test_repl_startup.sh
# Tests if the deploy REPL starts correctly and responds to /help.

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
DEPLOY_REPL_SCRIPT="$SCRIPT_DIR/../deploy_repl.sh"

if [ ! -f "$DEPLOY_REPL_SCRIPT" ]; then
    echo "Error: deploy_repl.sh not found at $DEPLOY_REPL_SCRIPT"
    exit 1
fi

# Source the script to get the functions
# shellcheck source=../deploy_repl.sh
source "$DEPLOY_REPL_SCRIPT"

# Run the REPL with piped input and capture the output
# We send /help and then /exit to gracefully terminate the REPL
output=$(echo -e "/help\n/exit" | tetra_deploy_repl)

# Check if the output contains the REPL welcome message and help text
if [[ "$output" == *"Tetra Deployment REPL"* && "$output" == *"Built-in Commands:"* && "$output" == *"/help, /?"* ]]; then
  echo "✅ Test Passed: REPL started and help command works."
  exit 0
else
  echo "❌ Test Failed: REPL did not start correctly or help command failed."
  echo "-------------------- OUTPUT --------------------"
  echo "$output"
  echo "----------------------------------------------"
  exit 1
fi
