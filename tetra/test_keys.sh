#!/usr/bin/env bash

# Test key reading - very simple

test_keys() {
    echo "Key test - press i,k,l,j, or ESC:"
    echo "(will show what key was pressed, then exit)"

    while true; do
        read -n1 -s key

        case "$key" in
            'i') echo "Got: i (up)"; break ;;
            'k') echo "Got: k (down)"; break ;;
            'l') echo "Got: l (expand)"; break ;;
            'j') echo "Got: j (exit)"; break ;;
            $'\e'|$'\033') echo "Got: ESC"; break ;;
            *) echo "Got: '$key' (unknown)" ;;
        esac
    done

    echo "Test complete"
}

test_keys