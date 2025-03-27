#!/bin/bash

# fix-import-style.sh
# Shell script to run the fix-imports-style.js utility

# Script location
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
FIX_SCRIPT="$SCRIPT_DIR/fix-imports-style.js"

echo "DevPages Import Style Fixer"
echo "==========================="
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js to run this script."
    exit 1
fi

# Parse arguments
DRY_RUN=false
VERBOSE=false

for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: ./fix-import-style.sh [options]"
            echo
            echo "Options:"
            echo "  --dry-run   Run without making changes (preview mode)"
            echo "  --verbose   Show detailed output"
            echo "  --help      Show this help message"
            exit 0
            ;;
    esac
done

# Build arguments for Node script
NODE_ARGS=""
if [ "$DRY_RUN" = true ]; then
    NODE_ARGS="$NODE_ARGS --dry-run"
    echo "Running in DRY RUN mode (no changes will be made)"
fi

if [ "$VERBOSE" = true ]; then
    NODE_ARGS="$NODE_ARGS --verbose"
    echo "Verbose output enabled"
fi

echo "Starting import style fixer..."
echo

# Run the script
cd "$SCRIPT_DIR"
node "$FIX_SCRIPT" $NODE_ARGS

# Make the script executable
chmod +x "$FIX_SCRIPT"

echo
echo "Done!" 