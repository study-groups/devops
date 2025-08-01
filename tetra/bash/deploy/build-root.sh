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

  ssh root@"$REMOTE_HOST" <<EOF
set -xe
sudo -u "$REMOTE_USER" bash -l -c "
  cd $REPO_PATH &&
  pwd &&
  echo 'DEBUG: Current user:' &&
  whoami &&
  echo 'DEBUG: Home directory before:' &&
  echo \$HOME &&
  echo 'DEBUG: Current PATH:' &&
  echo \$PATH &&
  echo 'DEBUG: Loading NVM from correct location...' &&
  export HOME=/home/$REMOTE_USER &&
  export NVM_DIR=\"/home/$REMOTE_USER/pj/nvm\" &&
  echo \"DEBUG: NVM_DIR set to: \$NVM_DIR\" &&
  echo \"DEBUG: Checking if \$NVM_DIR/nvm.sh exists...\" &&
  ls -la \"\$NVM_DIR/nvm.sh\" || echo \"File not found\" &&
  [ -s \"\$NVM_DIR/nvm.sh\" ] && source \"\$NVM_DIR/nvm.sh\" && echo 'NVM sourced successfully' || echo \"NVM not found at \$NVM_DIR\" &&
  echo 'DEBUG: Updated PATH:' &&
  echo \$PATH &&
  echo 'DEBUG: Looking for node...' &&
  which node || echo 'node not found' &&
  echo 'DEBUG: Looking for npm...' &&
  which npm || echo 'npm not found' &&
  npm install &&
  npm run build
"
EOF
}

