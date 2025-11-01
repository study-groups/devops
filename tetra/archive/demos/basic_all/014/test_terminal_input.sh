#!/usr/bin/env bash

# Minimal terminal input test - diagnose what's wrong

echo "=== Terminal Input Diagnostic ==="
echo ""
echo "Terminal device: /dev/tty"
echo "Testing 'read' command with different configurations..."
echo ""

# Save current state
old_state=$(stty -g)

echo "--- Test 1: Current terminal state ---"
stty -a | head -5
echo ""

echo "--- Test 2: Basic read test (5 second timeout) ---"
echo "Press any key within 5 seconds..."
if read -rsn1 -t 5 key </dev/tty; then
    echo "✓ Key received: '$key' (hex: $(echo -n "$key" | od -An -tx1))"
else
    echo "✗ No key received (timeout or error)"
fi
echo ""

echo "--- Test 3: Configure terminal for raw input ---"
stty -echo -icanon -isig min 0 time 0 </dev/tty 2>&1
echo "Terminal configured: -echo -icanon -isig min 0 time 0"
stty -a | grep -E "(echo|icanon|isig)" | head -3
echo ""

echo "Press any key within 5 seconds (raw mode)..."
if read -rsn1 -t 5 key </dev/tty; then
    echo "✓ Key received: '$key' (hex: $(echo -n "$key" | od -An -tx1))"
else
    echo "✗ No key received (timeout or error)"
fi
echo ""

echo "--- Test 4: Rapid polling test (like main loop) ---"
echo "Will poll for 3 seconds with 0.05s timeout..."
count=0
received=0
start_time=$(date +%s)
while [[ $(($(date +%s) - start_time)) -lt 3 ]]; do
    ((count++))
    if read -rsn1 -t 0.05 key </dev/tty; then
        echo "✓ Key #$received: '$key' (hex: $(echo -n "$key" | od -An -tx1))"
        ((received++))
    fi
done
echo "Polled $count times, received $received keys"
echo ""

echo "--- Test 5: Check file descriptors ---"
ls -la /dev/tty /dev/stdin /dev/stdout 2>&1
echo ""
echo "Process fd 0 (stdin): $(readlink /dev/fd/0 2>/dev/null || echo 'not a symlink')"
echo "Process fd 1 (stdout): $(readlink /dev/fd/1 2>/dev/null || echo 'not a symlink')"
echo ""

# Restore terminal
stty "$old_state"
echo "=== Diagnostic complete - terminal restored ==="
