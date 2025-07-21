# verbs.sh

tetra_deploy_build() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local REMOTE_HOST="${REMOTE_HOST:-pixeljamarcade.com}"
  local REMOTE_USER="${REMOTE_USER:-staging}"
  local REPO_PATH="${REPO_PATH:-$HOME/src/pixeljam}"
  local BRANCH="${BRANCH:-staging}"
  local MERGE_BRANCH="${MERGE_BRANCH:-api-dev}"
  local SERVICE1="${SERVICE1:-nginx}"
  local SERVICE2="${SERVICE2:-arcade-staging}"

  [ -n "$1" ] && REMOTE_HOST="$1"
  [ -n "$2" ] && REMOTE_USER="$2"
  [ -n "$3" ] && REPO_PATH="$3"
  [ -n "$4" ] && BRANCH="$4"
  [ -n "$5" ] && MERGE_BRANCH="$5"
  [ -n "$6" ] && SERVICE1="$6"
  [ -n "$7" ] && SERVICE2="$7"

  ssh "$REMOTE_USER"@"$REMOTE_HOST" <<'EOF'
set -xe

# The user specified the project is in a subdirectory.
cd "${REPO_PATH:-/home/staging/src/pixeljam}/pja/cabinet" &&

# Manually source NVM because this is a non-interactive shell.
# We know the correct path from previous debugging.
export NVM_DIR="/home/staging/pj/nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
else
  echo "ERROR: nvm.sh not found in $NVM_DIR" >&2
  exit 1
fi

echo "--- Node/NPM versions ---"
which node
node -v
which npm
npm -v
echo "-------------------------"

echo "Running npm install and build in $(pwd)..."
npm install
npm run build

echo "Build successful."
EOF
}

