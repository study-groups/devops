tetra_deploy_build() {
    # Source config file if first argument is a readable file
    if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
        echo "Sourcing config file: $1"
        . "$1"
    fi

    # Set defaults for ENV_VARS_IN_CAPS (can be overridden by sourced file)
    local REMOTE_HOST="${REMOTE_HOST:-pixeljamarcade.com}"
    local REMOTE_USER="${REMOTE_USER:-staging}"
    local REPO_PATH="${REPO_PATH:-~/src/pixeljam}"
    local BRANCH="${BRANCH:-staging}"
    local MERGE_BRANCH="${MERGE_BRANCH:-api-dev}"
    local SERVICE1="${SERVICE1:-nginx}"
    local SERVICE2="${SERVICE2:-arcade-staging}"
    local PROJECT_SUBDIR="${PROJECT_SUBDIR:-pja/arcade}"

    ssh "$REMOTE_USER@$REMOTE_HOST" "REPO_PATH='$REPO_PATH' PROJECT_SUBDIR='$PROJECT_SUBDIR' bash -l -c '
set -e

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

echo \"[INFO] Build started at: \$(date)\"
echo \"[INFO] Navigating to: \$TARGET_DIR\"

if [ ! -d \"\$TARGET_DIR\" ]; then
    echo \"[FAIL] Directory \$TARGET_DIR does not exist\"
    exit 2
fi

cd \"\$TARGET_DIR\"

echo \"[INFO] Running npm run build\"
npm run build

echo \"[SUCCESS] Build completed at: \$(date)\"
echo \"\$(date): Build completed successfully\" >> ~/.build_history
'"
}
