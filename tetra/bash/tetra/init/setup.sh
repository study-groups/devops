#!/usr/bin/env bash
# setup.sh - Tetra installation
# Detects TETRA_SRC from repo location, creates ~/tetra, wires shell rc.
# Idempotent: safe to re-run.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TETRA_SRC_DETECTED="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# --- Bash version gate ---
if [[ "${BASH_VERSINFO[0]}" -lt 5 ]] || [[ "${BASH_VERSINFO[0]}" -eq 5 && "${BASH_VERSINFO[1]}" -lt 2 ]]; then
    echo "ERROR: tetra requires bash 5.2+" >&2
    echo "Found: ${BASH_VERSION}" >&2
    echo "" >&2
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macOS ships bash 3.x. Install modern bash:" >&2
        echo "  brew install bash" >&2
        echo "Then re-run with: /opt/homebrew/bin/bash $0" >&2
    else
        echo "Install bash 5.2+ from your package manager." >&2
    fi
    exit 1
fi

# --- Prerequisite checks ---
_check() {
    local label="$1" cmd="$2"
    printf "  %-12s" "$label"
    if command -v "$cmd" &>/dev/null; then
        echo "ok ($("$cmd" --version 2>&1 | head -1))"
        return 0
    else
        echo "MISSING"
        return 1
    fi
}

echo "Checking prerequisites..."
prereqs_ok=true
_check "git" git       || prereqs_ok=false
_check "python3" python3 || prereqs_ok=false
_check "node" node     || { echo "    node is required. Install via nvm: https://github.com/nvm-sh/nvm"; prereqs_ok=false; }
_check "jq" jq         || { echo "    jq is optional but recommended"; }  # warn, don't fail

# Optional: bun (future runtime)
printf "  %-12s" "bun"
if command -v bun &>/dev/null; then
    echo "ok ($(bun --version 2>&1))"
else
    echo "not installed (optional)"
fi

if [[ "$prereqs_ok" != "true" ]]; then
    echo ""
    echo "Install missing prerequisites and re-run." >&2
    exit 1
fi

echo ""

# --- Create or update ~/tetra ---
TETRA_RUNTIME="$HOME/tetra"

if [[ -d "$TETRA_RUNTIME" ]]; then
    echo "Updating $TETRA_RUNTIME/tetra.sh ..."
else
    echo "Creating $TETRA_RUNTIME/ ..."
    cp -r "$SCRIPT_DIR/tetra-dir" "$TETRA_RUNTIME"
fi

# Write tetra.sh with detected TETRA_SRC (not hardcoded default)
cat > "$TETRA_RUNTIME/tetra.sh" <<ENTRY
#!/usr/bin/env bash
TETRA_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
TETRA_SRC="\${TETRA_SRC:-$TETRA_SRC_DETECTED}"
export TETRA_DIR TETRA_SRC
source "\$TETRA_SRC/bash/bootloader.sh"
ENTRY

echo "  Wrote $TETRA_RUNTIME/tetra.sh"
echo "  TETRA_SRC=$TETRA_SRC_DETECTED"

# --- Create ~/start-tetra.sh ---
START_SCRIPT="$HOME/start-tetra.sh"

echo ""
echo "Shell integration:"
cat > "$START_SCRIPT" <<'STARTER'
#!/usr/bin/env bash
# start-tetra.sh - Source this to load tetra into your shell
# Usage: source ~/start-tetra.sh
source "$HOME/tetra/tetra.sh"
STARTER
chmod +x "$START_SCRIPT"
echo "  Wrote $START_SCRIPT"

# --- Default org ---
ORGS_DIR="$TETRA_RUNTIME/orgs"
if [[ ! -d "$ORGS_DIR/tetra" ]]; then
    echo ""
    echo "Creating default org 'tetra'..."
    mkdir -p "$ORGS_DIR/tetra/sections"
    mkdir -p "$ORGS_DIR/tetra/pd/data/projects"
    mkdir -p "$ORGS_DIR/tetra/pd/config"
    mkdir -p "$ORGS_DIR/tetra/pd/cache"
    mkdir -p "$ORGS_DIR/tetra/tut/src"
    mkdir -p "$ORGS_DIR/tetra/tut/compiled"
    mkdir -p "$ORGS_DIR/tetra/workspace"
    mkdir -p "$ORGS_DIR/tetra/backups"
    echo "  Created $ORGS_DIR/tetra/"
fi

# --- Symlink active config ---
mkdir -p "$TETRA_RUNTIME/config"
if [[ ! -L "$TETRA_RUNTIME/config/tetra.toml" && -d "$ORGS_DIR/tetra" ]]; then
    # Create empty tetra.toml for default org if missing
    [[ ! -f "$ORGS_DIR/tetra/tetra.toml" ]] && echo "# tetra org config" > "$ORGS_DIR/tetra/tetra.toml"
    ln -sf "$ORGS_DIR/tetra/tetra.toml" "$TETRA_RUNTIME/config/tetra.toml"
    echo "  Linked config/tetra.toml -> orgs/tetra/tetra.toml"
fi

# --- Summary ---
echo ""
echo "============================================"
echo "Tetra installed."
echo ""
echo "  TETRA_SRC: $TETRA_SRC_DETECTED"
echo "  TETRA_DIR: $TETRA_RUNTIME"
echo "  Default org: tetra"
echo ""
echo "Next steps:"
echo "  1. Open a new terminal (or: source ~/tetra/tetra.sh)"
echo "  2. Run: tetra doctor"
echo "  3. Run: tetra status"
echo "============================================"