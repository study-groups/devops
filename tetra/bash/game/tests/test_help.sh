#!/usr/bin/env bash

# Test the new help system

# Source tetra environment
source ~/tetra/tetra.sh

# Source TDS
TDS_SRC="$TETRA_SRC/bash/tds"
source "$TDS_SRC/tds.sh"

# Source game environment
GAME_SRC="$TETRA_SRC/bash/game"
export GAME_SRC

# Source the help system directly
source "$GAME_SRC/core/pulsar_help.sh"

# Set mock grid dimensions
PULSAR_REPL_GRID_W=160
PULSAR_REPL_GRID_H=96

echo "======================================================================"
echo "Testing Pulsar REPL Help System"
echo "======================================================================"
echo ""

# Test main help
echo "1. Testing: help (main)"
echo "----------------------------------------------------------------------"
pulsar_help
echo ""

# Test engine help
echo "2. Testing: help engine"
echo "----------------------------------------------------------------------"
pulsar_help engine
echo ""

# Test sprite help
echo "3. Testing: help sprite"
echo "----------------------------------------------------------------------"
pulsar_help sprite
echo ""

# Test preset help
echo "4. Testing: help preset"
echo "----------------------------------------------------------------------"
pulsar_help preset
echo ""

# Test script help
echo "5. Testing: help script"
echo "----------------------------------------------------------------------"
pulsar_help script
echo ""

# Test protocol help
echo "6. Testing: help protocol"
echo "----------------------------------------------------------------------"
pulsar_help protocol
echo ""

# Test params help
echo "7. Testing: help params"
echo "----------------------------------------------------------------------"
pulsar_help params
echo ""

# Test unknown topic
echo "8. Testing: help unknown (error case)"
echo "----------------------------------------------------------------------"
pulsar_help unknown
echo ""

echo "======================================================================"
echo "Help system test complete"
echo "======================================================================"
