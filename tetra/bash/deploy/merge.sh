# verbs.sh

tetra_deploy_merge() {
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
sudo -u "$REMOTE_USER" bash -c "
  cd $REPO_PATH &&
  git checkout $BRANCH &&
  git pull origin $BRANCH &&
  git fetch origin &&
  git merge origin/$MERGE_BRANCH -m 'Merging origin/$MERGE_BRANCH into $BRANCH' &&
  git push origin $BRANCH
  cd $REPO_PATH/pja/cabinet
"
systemctl restart $SERVICE1
systemctl restart $SERVICE2
EOF
}

