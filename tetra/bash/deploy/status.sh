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
  local SERVICE1="${SERVICE1:-nginx}"
  local SERVICE2="${SERVICE2:-arcade-staging}"

  [ -n "$1" ] && REMOTE_HOST="$1"
  [ -n "$2" ] && REMOTE_USER="$2"
  [ -n "$3" ] && REPO_PATH="$3"
  [ -n "$4" ] && BRANCH="$4"

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
    git status
    echo
    echo '=== PROCESS INFO ==='
    echo 'Running processes (nginx, node):'
    ps aux | grep -E '(nginx|node)' | grep -v grep || echo 'No matching processes found'
  "
}
