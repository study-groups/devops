#!/usr/bin/env bash

# TSM Install Script
# Installs system dependencies required or recommended for TSM

set -e

echo "=== TSM Installation ===="
echo

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Platform: macOS"
    echo

    # Check if Homebrew is installed
    if ! command -v brew >/dev/null 2>&1; then
        echo "❌ Homebrew not found. Please install Homebrew first:"
        echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi

    echo "✓ Homebrew found"
    echo

    # Install util-linux (provides flock, setsid, etc)
    echo "Installing util-linux (provides flock, setsid)..."
    if brew list util-linux >/dev/null 2>&1; then
        echo "✓ util-linux already installed"
    else
        brew install util-linux
        echo "✓ util-linux installed"
    fi
    echo

    # Verify tools are available
    echo "Verifying tools..."

    # Add util-linux to PATH for this session
    for prefix in "/opt/homebrew" "/usr/local"; do
        if [[ -d "$prefix/opt/util-linux/bin" ]]; then
            export PATH="$prefix/opt/util-linux/bin:$PATH"
            break
        fi
    done

    if command -v flock >/dev/null 2>&1; then
        echo "✓ flock available"
    else
        echo "⚠ flock not found in PATH (add util-linux/bin to PATH)"
    fi

    if command -v setsid >/dev/null 2>&1; then
        echo "✓ setsid available"
    else
        echo "⚠ setsid not found in PATH (add util-linux/bin to PATH)"
    fi

elif [[ "$OSTYPE" == "linux"* ]]; then
    echo "Platform: Linux"
    echo

    # util-linux is usually pre-installed on Linux
    if command -v flock >/dev/null 2>&1 && command -v setsid >/dev/null 2>&1; then
        echo "✓ util-linux tools already available"
    else
        echo "Installing util-linux..."
        if command -v apt-get >/dev/null 2>&1; then
            sudo apt-get update && sudo apt-get install -y util-linux
        elif command -v yum >/dev/null 2>&1; then
            sudo yum install -y util-linux
        elif command -v pacman >/dev/null 2>&1; then
            sudo pacman -S util-linux
        else
            echo "⚠ Could not detect package manager. Please install util-linux manually."
            exit 1
        fi
        echo "✓ util-linux installed"
    fi

else
    echo "⚠ Unsupported platform: $OSTYPE"
    echo "Please install flock and setsid manually"
    exit 1
fi

echo
echo "=== Installation Complete ==="
echo
echo "Next steps:"
echo "  1. Reload your shell or run: source ~/tetra/tetra.sh"
echo "  2. Verify with: tsm doctor"
echo
