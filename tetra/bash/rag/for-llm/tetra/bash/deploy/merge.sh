# verbs.sh

tetra_deploy_merge() {
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
  local HARD_MERGE="${HARD_MERGE:-false}"

  # Prepare commands for hard merge (discard local changes)
  local reset_cmd=""
  local clean_cmd=""
  if [ "$HARD_MERGE" = "true" ]; then
    reset_cmd="git reset --hard &&"
    clean_cmd="git clean -fd &&"
  fi

  # Execute remote commands
  ssh $REMOTE_USER@"$REMOTE_HOST" <<EOF
  cd $REPO_PATH &&
  git checkout $BRANCH &&
  $reset_cmd
  $clean_cmd
  git pull origin $BRANCH &&
  git fetch origin &&
  git merge origin/$MERGE_BRANCH -m 'Merging origin/$MERGE_BRANCH into $BRANCH' &&
  git push origin $BRANCH &&
  cd $REPO_PATH/$PROJECT_SUBDIR
EOF
}
