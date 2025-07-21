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
  # New parameter for the project's subdirectory within the repo
  local PROJECT_SUBDIR="${PROJECT_SUBDIR:-pja/cabinet}"

  [ -n "$1" ] && REMOTE_HOST="$1"
  [ -n "$2" ] && REMOTE_USER="$2"
  [ -n "$3" ] && REPO_PATH="$3"
  [ -n "$4" ] && BRANCH="$4"
  [ -n "$5" ] && MERGE_BRANCH="$5"
  [ -n "$6" ] && SERVICE1="$6"
  [ -n "$7" ] && SERVICE2="$7"
  [ -n "$8" ] && PROJECT_SUBDIR="$8"

  # Pass local variables to the remote shell and execute the script.
  ssh "$REMOTE_USER"@"$REMOTE_HOST" "REPO_PATH='${REPO_PATH}' PROJECT_SUBDIR='${PROJECT_SUBDIR}' bash -s" <<'EOF'
# Exit immediately if a command exits with a non-zero status.
set -e

# Expand potential tilde in REPO_PATH on the remote host.
eval "REPO_PATH=${REPO_PATH}"

# Change to the project directory. Provide a default for REPO_PATH as a safeguard.
PROJECT_ROOT="${REPO_PATH:-/home/staging/src/pixeljam}"
cd "${PROJECT_ROOT}/${PROJECT_SUBDIR}"
echo "Changed to directory: $(pwd)"

# Manually source NVM, resolving $HOME on the remote machine.
export NVM_DIR="$HOME/pj/nvm"
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

# Set the PD_DIR environment variable, resolving $HOME on the remote.
export PD_DIR="$HOME/pj/pd"
echo "PD_DIR set to: $PD_DIR"

echo "Running npm install and build in $(pwd)..."
npm install
npm run build

echo "Build successful."
EOF
}

