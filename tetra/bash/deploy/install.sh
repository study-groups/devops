tetra_deploy_install() {
    # Source config file if first argument is a readable file
    if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
        echo "Sourcing config file: $1"
        . "$1"
    fi

    # Set defaults (can be overridden by sourced file)
    local REMOTE_HOST="${REMOTE_HOST:-pixeljamarcade.com}"
    local REMOTE_USER="${REMOTE_USER:-staging}"
    local REPO_PATH="${REPO_PATH:-~/src/pixeljam}"
    local PROJECT_SUBDIR="${PROJECT_SUBDIR:-pja/arcade}"

    ssh "$REMOTE_USER@$REMOTE_HOST" "REPO_PATH='$REPO_PATH' PROJECT_SUBDIR='$PROJECT_SUBDIR' bash -l -c '
set -e

# Source bashrc to ensure environment is loaded
[ -f \"\$HOME/.bashrc\" ] && source \"\$HOME/.bashrc\"

# Load NVM from standard location
export NVM_DIR=\"\$HOME/pj/nvm\"
[ -s \"\$NVM_DIR/nvm.sh\" ] && source \"\$NVM_DIR/nvm.sh\"

# Expand ~ manually if present
if [[ \"\$REPO_PATH\" == \"~\"* ]]; then
    REPO_PATH=\"\${HOME}\${REPO_PATH:1}\"
fi
if [[ \"\$PROJECT_SUBDIR\" == \"~\"* ]]; then
    PROJECT_SUBDIR=\"\${HOME}\${PROJECT_SUBDIR:1}\"
fi

PROJECT_ROOT=\"\${REPO_PATH:-\$HOME/src/pixeljam}\"
TARGET_DIR=\"\$PROJECT_ROOT/\$PROJECT_SUBDIR\"

echo \"[INFO] Install started at: \$(date)\"
echo \"[INFO] Navigating to: \$TARGET_DIR\"

if [ ! -d \"\$TARGET_DIR\" ]; then
    echo \"[FAIL] Directory \$TARGET_DIR does not exist\"
    exit 2
fi

cd \"\$TARGET_DIR\"

echo \"[INFO] Running npm install...\"
if ! npm install; then
    echo \"[FAIL] npm install failed.\"
    exit 1
fi

echo \"[SUCCESS] Install completed at: \$(date)\"
'"
}
