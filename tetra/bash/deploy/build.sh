tetra_deploy_build() {
    # Source env file if provided and readable
    if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
        . "$1"
        shift
    fi

    export NVM_DIR="$HOME/pj/nvm"
    export PD_DIR="$HOME/pj/pd"

    # Set CLI or env vars, allow override by positional arguments
    local REMOTE_HOST="${REMOTE_HOST:-pixeljamarcade.com}"
    local REMOTE_USER="${REMOTE_USER:-staging}"
    local REPO_PATH="${REPO_PATH:-$HOME/src/pixeljam}"
    local BRANCH="${BRANCH:-staging}"
    local MERGE_BRANCH="${MERGE_BRANCH:-api-dev}"
    local SERVICE1="${SERVICE1:-nginx}"
    local SERVICE2="${SERVICE2:-arcade-staging}"
    local PROJECT_SUBDIR="${PROJECT_SUBDIR:-pja/cabinet}"

    [ -n "$1" ] && REMOTE_HOST="$1"
    [ -n "$2" ] && REMOTE_USER="$2"
    [ -n "$3" ] && REPO_PATH="$3"
    [ -n "$4" ] && BRANCH="$4"
    [ -n "$5" ] && MERGE_BRANCH="$5"
    [ -n "$6" ] && SERVICE1="$6"
    [ -n "$7" ] && SERVICE2="$7"
    [ -n "$8" ] && PROJECT_SUBDIR="$8"

    ssh "$REMOTE_USER@$REMOTE_HOST" "REPO_PATH='$REPO_PATH' PROJECT_SUBDIR='$PROJECT_SUBDIR' bash -l -s" <<'EOF'
set -e

# Expand ~ manually if present
if [[ "$REPO_PATH" == "~"* ]]; then
    REPO_PATH="${HOME}${REPO_PATH:1}"
fi
if [[ "$PROJECT_SUBDIR" == "~"* ]]; then
    PROJECT_SUBDIR="${HOME}${PROJECT_SUBDIR:1}"
fi

PROJECT_ROOT="${REPO_PATH:-$HOME/src/pixeljam}"
TARGET_DIR="${PROJECT_ROOT}/${PROJECT_SUBDIR}"

echo "[DEBUG] user: $(whoami)"
echo "[DEBUG] HOME: $HOME"
export NVM_DIR="$HOME/pj/nvm"
echo "[DEBUG] NVM_DIR: $NVM_DIR"
ls -l "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
echo "[DEBUG] nvm.sh exit code: $?"
nvm use 20 || nvm use default
echo "[DEBUG] nvm use exit code: $?"
which node
node -v
which npm
npm -v

echo "[INFO] cd to: $TARGET_DIR"
if [ ! -d "$TARGET_DIR" ]; then
    echo "[FAIL] Directory $TARGET_DIR does not exist"
    exit 2
fi
cd "$TARGET_DIR"
echo "[DEBUG] cd exit code: $?"

echo "[INFO] Directory listing:"
ls -la
echo "[DEBUG] ls exit code: $?"

echo "[INFO] Checking for env.sh..."
if [ ! -f ./env.sh ]; then
    echo "[FAIL] Missing ./env.sh in $TARGET_DIR"
    exit 2
fi
if ! grep -q . ./env.sh; then
    echo "[FAIL] ./env.sh is empty"
    exit 2
fi
echo "[DEBUG] env.sh exists and is not empty"

echo "[INFO] Sourcing env.sh..."
. ./env.sh
echo "[DEBUG] env.sh exit code: $?"

which node
echo "[DEBUG] which node exit code: $?"
node -v
echo "[DEBUG] node -v exit code: $?"
which npm
echo "[DEBUG] which npm exit code: $?"
npm -v
echo "[DEBUG] npm -v exit code: $?"

echo "[INFO] Removing node_modules and running npm install"
rm -rf ./node_modules
echo "[DEBUG] rm -rf exit code: $?"
npm install
echo "[DEBUG] npm install exit code: $?"

echo "[INFO] Sourcing env.sh (again) before build"
. ./env.sh
echo "[DEBUG] env.sh (pre-build) exit code: $?"

echo "[INFO] Running build..."
npm run build
echo "[DEBUG] npm run build exit code: $?"

echo "[SUCCESS] Build completed successfully."
EOF
}
