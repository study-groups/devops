# ================== Top-Level Guard (sourcable) ==================
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Please source this file: source transfer.sh"
  exit 1
fi

# ================== Config Loader ==================
tetra_transfer_load_config() {
  local config_file="$1"

  if [ ! -f "$config_file" ]; then
    echo "❌ Transfer config file not found: $config_file"
    return 1
  fi

  # shellcheck source=/dev/null
  . "$config_file"
  export TRANSFER_CONFIG="$config_file"
}

# ================== Validation ==================
tetra_transfer_require_vars() {
  local missing=0
  for var in "$@"; do
    if [ -z "${!var:-}" ]; then
      echo "❗ Missing required variable: $var"
      missing=1
    fi
  done
  if [[ $missing -eq 1 ]]; then
    return 1
  fi
}

# ================== Commands ==================
tetra_transfer_status() {
  tetra_transfer_require_vars LOCAL_ENV_FILE REMOTE_ENV_FILE REMOTE_USER REMOTE_HOST || return 1

  echo "🔍 tetra_transfer_status"
  echo " Local : $LOCAL_ENV_FILE"

  if [ -f "$LOCAL_ENV_FILE" ]; then
    stat_local=$(stat --format="exists: yes | size: %s bytes | mtime: %y | perms: %A" "$LOCAL_ENV_FILE")
    echo " Local File: $stat_local"
  else
    echo " Local File: exists: NO"
  fi

  echo " Remote: $REMOTE_USER@$REMOTE_HOST:$REMOTE_ENV_FILE"

  ssh "$REMOTE_USER@$REMOTE_HOST" \
    "if [ -f '$REMOTE_ENV_FILE' ]; then stat --format='exists: yes | size: %s bytes | mtime: %y | perms: %A' '$REMOTE_ENV_FILE'; else echo 'exists: NO'; fi" \
    2>/dev/null | sed 's/^/ Remote File: /'

  echo "=================================="
}

tetra_transfer_push() {
  tetra_transfer_require_vars LOCAL_ENV_FILE REMOTE_ENV_FILE REMOTE_USER REMOTE_HOST || return 1

  if [ ! -f "$LOCAL_ENV_FILE" ]; then
    echo "❌ Local file not found: $LOCAL_ENV_FILE"
    return 1
  fi

  echo "🚀 Pushing $LOCAL_ENV_FILE → $REMOTE_USER@$REMOTE_HOST:$REMOTE_ENV_FILE"
  scp "$LOCAL_ENV_FILE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_ENV_FILE"
}

tetra_transfer_pull() {
  tetra_transfer_require_vars LOCAL_ENV_FILE REMOTE_ENV_FILE REMOTE_USER REMOTE_HOST || return 1

  mkdir -p "$(dirname "$LOCAL_ENV_FILE")"
  echo "📥 Pulling $REMOTE_USER@$REMOTE_HOST:$REMOTE_ENV_FILE → $LOCAL_ENV_FILE"
  scp "$REMOTE_USER@$REMOTE_HOST:$REMOTE_ENV_FILE" "$LOCAL_ENV_FILE"
}

# ================== Shortcut Runner (optional) ==================
tetra_transfer() {
  local cmd="$1"
  local config=${2:-./transfer.conf.sh}

  if ! tetra_transfer_load_config "$config"; then
    echo "⚠️  Failed to load config: $config"
    return 1
  fi

  tetra_transfer_require_vars LOCAL_ENV_FILE REMOTE_ENV_FILE REMOTE_USER REMOTE_HOST || return 1

  case "$cmd" in
    push)    tetra_transfer_push ;;
    pull)    tetra_transfer_pull ;;
    status)  tetra_transfer_status ;;
    *)
      echo "Usage: tetra_transfer {push|pull|status} [path/to/transfer.conf.sh]"
      return 1
      ;;
  esac
}

