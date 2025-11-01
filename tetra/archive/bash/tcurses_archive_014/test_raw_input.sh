#!/usr/bin/env bash

# Test raw terminal input behavior

echo "Testing terminal input modes..."
echo ""

# Save original state
OLD_STATE=$(stty -g 2>/dev/null)

echo "Test 1: min 0 (non-blocking) - WRONG"
echo "Press 'a' key once:"
stty -echo -icanon min 0 time 0 </dev/tty 2>/dev/null
sleep 1

count=0
while [[ $count -lt 10 ]]; do
    key=""
    if read -rsn1 -t 0.1 key </dev/tty 2>/dev/null; then
        if [[ -n "$key" ]]; then
            echo "  Read #$count: '$key' (hex: $(echo -n "$key" | od -An -tx1))"
            ((count++))
        fi
    fi
done

# Restore
stty "$OLD_STATE" </dev/tty 2>/dev/null
echo ""

echo "Test 2: min 1 (blocking) - CORRECT"
echo "Press 'b' key once:"
stty -echo -icanon min 1 time 0 </dev/tty 2>/dev/null
sleep 1

count=0
while [[ $count -lt 3 ]]; do
    key=""
    if read -rsn1 -t 0.5 key </dev/tty 2>/dev/null; then
        if [[ -n "$key" ]]; then
            echo "  Read #$count: '$key' (hex: $(echo -n "$key" | od -An -tx1))"
            ((count++))
            [[ "$key" == "q" ]] && break
        fi
    else
        echo "  Timeout (no key pressed)"
    fi
done

# Restore
stty "$OLD_STATE" </dev/tty 2>/dev/null

echo ""
echo "Test complete. Press any key..."
read -rsn1 </dev/tty
