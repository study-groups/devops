#!/usr/bin/env bash
# Quick test to verify the demo starts without hanging

echo "Testing demo startup..."
echo "The demo should start and show a TUI interface."
echo "Press 'q' to quit when you see it."
echo ""
echo "Starting in 2 seconds..."
sleep 2

exec ./demo.sh
