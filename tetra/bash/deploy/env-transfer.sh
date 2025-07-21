# env-transfer.sh

tetra_deploy_env_get() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local REMOTE_HOST="${REMOTE_HOST:-pixeljamarcade.com}"
  local REMOTE_USER="${REMOTE_USER:-staging}"
  local REPO_DIR="${REPO_DIR:-~/src/pixeljam}"
  local PROJECT_SUBDIR="${PROJECT_SUBDIR:-pja/cabinet}"
  local TMP_DIR="${TMP_DIR:-/tmp/tetra-env}"

  [ -n "$1" ] && REMOTE_HOST="$1"
  [ -n "$2" ] && REMOTE_USER="$2"
  [ -n "$3" ] && REPO_DIR="$3"
  [ -n "$4" ] && PROJECT_SUBDIR="$4"

  # Create temporary directory for sensitive data
  mkdir -p "$TMP_DIR"
  
  echo "Getting env.sh from $REMOTE_USER@$REMOTE_HOST:$REPO_DIR/$PROJECT_SUBDIR/env.sh"
  
  # Download the env.sh file to temporary location
  scp "$REMOTE_USER@$REMOTE_HOST:$REPO_DIR/$PROJECT_SUBDIR/env.sh" "$TMP_DIR/env.sh" 2>/dev/null
  
  if [ $? -eq 0 ]; then
    echo "✓ Environment file retrieved and stored in $TMP_DIR/env.sh"
    echo "⚠️  WARNING: This file contains sensitive data. Handle with care."
    echo "📁 Temporary location: $TMP_DIR/env.sh"
  else
    echo "✗ Failed to retrieve environment file"
    return 1
  fi
}

tetra_deploy_env_put() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local REMOTE_HOST="${REMOTE_HOST:-pixeljamarcade.com}"
  local REMOTE_USER="${REMOTE_USER:-staging}"
  local REPO_DIR="${REPO_DIR:-~/src/pixeljam}"
  local PROJECT_SUBDIR="${PROJECT_SUBDIR:-pja/cabinet}"
  local TMP_DIR="${TMP_DIR:-/tmp/tetra-env}"
  local SOURCE_FILE="${SOURCE_FILE:-$TMP_DIR/env.sh}"

  [ -n "$1" ] && REMOTE_HOST="$1"
  [ -n "$2" ] && REMOTE_USER="$2"
  [ -n "$3" ] && REPO_DIR="$3"
  [ -n "$4" ] && PROJECT_SUBDIR="$4"
  [ -n "$5" ] && SOURCE_FILE="$5"

  # Check if source file exists
  if [ ! -f "$SOURCE_FILE" ]; then
    echo "✗ Source file not found: $SOURCE_FILE"
    echo "💡 Run tetra_deploy_env_get first to retrieve the environment file"
    return 1
  fi

  echo "Putting env.sh to $REMOTE_USER@$REMOTE_HOST:$REPO_DIR/$PROJECT_SUBDIR/env.sh"
  
  # Upload the env.sh file to destination
  scp "$SOURCE_FILE" "$REMOTE_USER@$REMOTE_HOST:$REPO_DIR/$PROJECT_SUBDIR/env.sh" 2>/dev/null
  
  if [ $? -eq 0 ]; then
    echo "✓ Environment file transferred successfully"
    echo "🎯 Destination: $REMOTE_USER@$REMOTE_HOST:$REPO_DIR/$PROJECT_SUBDIR/env.sh"
  else
    echo "✗ Failed to transfer environment file"
    return 1
  fi
}

tetra_deploy_env_transfer() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local SOURCE_ENV="${SOURCE_ENV:-}"
  local DEST_ENV="${DEST_ENV:-}"
  
  [ -n "$1" ] && SOURCE_ENV="$1"
  [ -n "$2" ] && DEST_ENV="$2"

  if [ -z "$SOURCE_ENV" ] || [ -z "$DEST_ENV" ]; then
    echo "Usage: tetra_deploy_env_transfer <source_env_file> <dest_env_file>"
    echo "Example: tetra_deploy_env_transfer api-dev-to-staging.env staging-to-prod.env"
    return 1
  fi

  echo "🔄 Transferring environment from $SOURCE_ENV to $DEST_ENV"
  
  # Step 1: Get environment from source
  echo "📥 Step 1: Getting environment from source..."
  tetra_deploy_env_get "$SOURCE_ENV"
  
  if [ $? -ne 0 ]; then
    echo "✗ Failed to get environment from source"
    return 1
  fi
  
  # Step 2: Put environment to destination
  echo "📤 Step 2: Putting environment to destination..."
  tetra_deploy_env_put "$DEST_ENV"
  
  if [ $? -eq 0 ]; then
    echo "✅ Environment transfer completed successfully"
  else
    echo "✗ Failed to transfer environment to destination"
    return 1
  fi
}

tetra_deploy_env_cleanup() {
  local TMP_DIR="${TMP_DIR:-/tmp/tetra-env}"
  
  if [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
    echo "🧹 Cleaned up temporary environment files from $TMP_DIR"
  else
    echo "ℹ️  No temporary files to clean up"
  fi
} 