#!/usr/bin/env bash

echo "Press keys to see their codes (Ctrl-C to exit)"
echo "Try pressing: Ctrl-O, Ctrl-L, o, O"
echo ""

while true; do
    read -rsn1 key

    # Show hex representation
    if [[ -n "$key" ]]; then
        hex=$(printf '%s' "$key" | od -An -tx1 | tr -d ' \n')
        echo "Key: '$key' | Hex: 0x$hex | Bash escape: \$'\\x$hex'"
    else
        echo "Key: <ENTER> | Hex: 0x0a | Bash escape: \$'\\n'"
    fi

    # Check if it's Ctrl-C
    if [[ "$key" == $'\x03' ]]; then
        echo "Caught Ctrl-C, exiting..."
        break
    fi
done
