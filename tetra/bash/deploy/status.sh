tetra_deploy_status() {
  # Usage:
  # tetra_deploy_status [env.sh] [REMOTE_HOST] [REMOTE_USER] [REPO_PATH] [BRANCH]

  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local REMOTE_HOST="${REMOTE_HOST:-pixeljamarcade.com}"
  local REMOTE_USER="${REMOTE_USER:-staging}"
  local REPO_PATH="${REPO_PATH:-$HOME/src/pixeljam}"
  local BRANCH="${BRANCH:-staging}"

  [ -n "$1" ] && REMOTE_HOST="$1"
  [ -n "$2" ] && REMOTE_USER="$2"
  [ -n "$3" ] && REPO_PATH="$3"
  [ -n "$4" ] && BRANCH="$4"

  ssh root@"$REMOTE_HOST" <<EOF
sudo -u "$REMOTE_USER" bash -c '
  cd $REPO_PATH &&
  echo "[$BRANCH] Latest Commit:" &&
  git log $BRANCH -1 --oneline --decorate &&
  echo &&
  echo "[$BRANCH] Status:" &&
  git status
'
EOF
}
