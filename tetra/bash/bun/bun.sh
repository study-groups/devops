#!/usr/bin/env bash
# bun.sh - Bun runtime helpers for tetra
# Provides activation and version info for tetra-managed bun install.

BUN_SRC="${BUN_SRC:-$TETRA_SRC/bash/bun}"

tetra_bun_activate() {
    local bun_dir="$TETRA_DIR/bun"
    if [[ -x "$bun_dir/bin/bun" ]]; then
        export BUN_INSTALL="$bun_dir"
        export PATH="$bun_dir/bin:$PATH"
        return 0
    fi
    return 1
}

tetra_bun_install() {
    local bun_dir="${TETRA_DIR:-$HOME/tetra}/bun"
    if [[ -x "$bun_dir/bin/bun" ]]; then
        echo "bun already installed: $(bun --version 2>/dev/null)"
        return 0
    fi
    echo "Installing bun..."
    export BUN_INSTALL="$bun_dir"
    curl -fsSL https://bun.sh/install | bash >/dev/null 2>&1 || true
    if [[ -x "$bun_dir/bin/bun" ]]; then
        export PATH="$bun_dir/bin:$PATH"
        echo "bun installed: $(bun --version 2>/dev/null)"
    else
        echo "bun install failed" >&2
        return 1
    fi
}

tetra_bun_version() {
    if command -v bun &>/dev/null; then
        bun --version 2>/dev/null
    else
        echo "not installed"
    fi
}

export -f tetra_bun_activate tetra_bun_install tetra_bun_version
