#!/usr/bin/env bash

# example_bash_agent.sh - Bash agent implementation example

# This demonstrates a Bash terminal as a TES agent that can execute
# commands sent via tubes.

set -euo pipefail

# Setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TETRA_SRC="${TETRA_SRC:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"

# Load tetra
source "$TETRA_SRC/bash/bootloader.sh"

# Load tubes
tmod load tubes

echo "Bash Agent Example"
echo "=================="
echo ""

# Get agent name
AGENT_NAME="${1:-bash-agent-$$}"

echo "Starting Bash agent: @tube:$AGENT_NAME"
echo ""

# Create agent tube
tubes create "$AGENT_NAME" "Bash agent: $AGENT_NAME"

# Command handler for bash agent
bash_agent_handler() {
    local tube_name="$1"
    local message="$2"
    local timestamp=$(date '+%H:%M:%S')

    echo "[$timestamp] Received: $message"

    # Parse command protocol: bash.<verb>:<args>
    if [[ "$message" =~ ^bash\.execute:(.+)$ ]]; then
        local command="${BASH_REMATCH[1]}"
        echo "[$timestamp] Executing: $command"

        # Execute command in subshell
        local output
        local exit_code

        set +e
        output=$(eval "$command" 2>&1)
        exit_code=$?
        set -e

        echo "[$timestamp] Result (exit: $exit_code):"
        echo "$output"
        echo ""

    elif [[ "$message" =~ ^bash\.eval:(.+)$ ]]; then
        local expression="${BASH_REMATCH[1]}"
        echo "[$timestamp] Evaluating: $expression"

        # Evaluate expression
        local result
        set +e
        result=$(eval "echo $expression" 2>&1)
        set -e

        echo "[$timestamp] Result: $result"
        echo ""

    elif [[ "$message" =~ ^bash\.state$ ]]; then
        echo "[$timestamp] Showing state:"
        echo "  PWD: $PWD"
        echo "  SHELL: $SHELL"
        echo "  Loaded modules: $(tmod list loaded | wc -l)"
        echo ""

    elif [[ "$message" == "bash.disconnect" ]]; then
        echo "[$timestamp] Disconnecting..."
        return 1  # Exit listen loop

    else
        echo "[$timestamp] Unknown command format: $message"
        echo "  Supported: bash.execute:<cmd>, bash.eval:<expr>, bash.state, bash.disconnect"
        echo ""
    fi
}

# Cleanup
cleanup() {
    echo ""
    echo "Shutting down agent..."
    tubes destroy "$AGENT_NAME" 2>/dev/null || true
    exit 0
}

trap cleanup EXIT INT TERM

echo "Agent ready. Listening for commands..."
echo ""
echo "Supported commands:"
echo "  bash.execute:<command>  - Execute shell command"
echo "  bash.eval:<expression>  - Evaluate expression"
echo "  bash.state             - Show agent state"
echo "  bash.disconnect        - Shutdown agent"
echo ""
echo "Example (from another terminal):"
echo "  tubes send $AGENT_NAME 'bash.execute:ls -la'"
echo "  tubes send $AGENT_NAME 'bash.eval:\$((2 + 2))'"
echo "  tubes send $AGENT_NAME 'bash.state'"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start listening
tubes listen "$AGENT_NAME" bash_agent_handler
