tetra_deploy_logs() {
  # Usage:
  # tetra_deploy_logs [env.sh] [REMOTE_HOST] [SERVICE1] [SERVICE2] [...]

  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local REMOTE_HOST="${REMOTE_HOST:-pixeljamarcade.com}"
  local SERVICE1="${SERVICE1:-nginx}"
  local SERVICE2="${SERVICE2:-arcade-staging}"

  [ -n "$1" ] && REMOTE_HOST="$1" && shift
  [ -n "$1" ] && SERVICE1="$1" && shift
  [ -n "$1" ] && SERVICE2="$1" && shift

  # Accept additional services as arguments
  local SERVICES=("$SERVICE1" "$SERVICE2" "$@")

  for SERVICE in "${SERVICES[@]}"; do
    echo "===== $SERVICE logs ====="
    ssh root@"$REMOTE_HOST" "journalctl -u $SERVICE --no-pager -n 100"
    echo
  done
}
