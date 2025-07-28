tetra_deploy_status() {  # Source config file if first argument is a readable file
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    echo "Sourcing config file: $1"
    . "$1"
  fi

  # Set defaults for ENV_VARS_IN_CAPS (can be overridden by sourced file)
  local REMOTE_HOST="${REMOTE_HOST:-pixeljamarcade.com}"
  local REMOTE_USER="${REMOTE_USER:-staging}"
  local REPO_PATH="${REPO_PATH:-~/src/pixeljam}"
  local BRANCH="${BRANCH:-staging}"
  local SERVICE1="${SERVICE1:-nginx}"
  local SERVICE2="${SERVICE2:-arcade-staging}"
  local PROJECT_SUBDIR="${PROJECT_SUBDIR:-pja/arcade}"

  ssh "$REMOTE_USER"@"$REMOTE_HOST" "
    echo '=== SYSTEM STATUS ==='
    echo 'Uptime:'
    uptime
    echo
    echo 'Load Average:'
    cat /proc/loadavg
    echo
    echo '=== SERVICE STATUS ==='
    echo 'Service: $SERVICE1'
    sudo systemctl is-active $SERVICE1 || echo 'inactive'
    sudo systemctl is-enabled $SERVICE1 || echo 'disabled'
    echo
    echo 'Service: $SERVICE2'
    sudo systemctl is-active $SERVICE2 || echo 'inactive'
    sudo systemctl is-enabled $SERVICE2 || echo 'disabled'
    echo
    echo '=== GIT STATUS ==='
    cd $REPO_PATH
    echo '[$BRANCH] Latest Commit:'
    git log $BRANCH -1 --oneline --decorate
    echo
    echo '[$BRANCH] Status:'
    git status --porcelain
    echo
    echo '=== BUILD STATUS ==='
    if [ -d '$REPO_PATH/$PROJECT_SUBDIR' ]; then
      cd '$REPO_PATH/$PROJECT_SUBDIR'
      echo 'Build artifacts:'
      ls -la dist/ build/ public/ 2>/dev/null || echo 'No build directories found'
      echo
      echo 'Package.json modification time:'
      stat package.json 2>/dev/null || echo 'No package.json'
      echo
      echo 'Node modules status:'
      [ -d node_modules ] && echo 'node_modules exists' || echo 'node_modules missing'
    else
      echo 'Project directory not found: $REPO_PATH/$PROJECT_SUBDIR'
    fi
    echo
    echo '=== PROCESS INFO ==='
    echo 'Running processes (nginx, node, npm):'
    ps aux | grep -E '(nginx|node|npm)' | grep -v grep || echo 'No matching processes found'
  "
}
