# s3-list.sh

# Source the DO Spaces functions if not already loaded
if ! command -v tetra_deploy_do_spaces_setup_from_env &> /dev/null; then
  # Try to source do-spaces.sh from the same directory
  if [ -f "$(dirname "$0")/do-spaces.sh" ]; then
    source "$(dirname "$0")/do-spaces.sh"
  else
    echo "⚠️  do-spaces.sh not found. Please source it first:"
    echo "   source do-spaces.sh"
    return 1
  fi
fi

tetra_deploy_s3_list() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local BUCKET="${DO_SPACES_BUCKET:-pja-games}"
  local PREFIX=""

  # Intelligent argument handling
  if [ "$#" -eq 1 ]; then
    # If one argument, treat it as a prefix for the default bucket
    PREFIX="$1"
    echo "▶️  One argument provided, treating as prefix for default bucket '$BUCKET'"
  elif [ "$#" -ge 2 ]; then
    # If two or more arguments, treat as bucket and prefix
    BUCKET="$1"
    PREFIX="$2"
    echo "▶️  Two arguments provided, treating as bucket and prefix"
  fi

  # List files in the bucket
  if [ -n "$PREFIX" ]; then
    echo "🔍 With prefix: $PREFIX"
    tetra_deploy_do_spaces_list_files "$BUCKET" "$PREFIX"
  else
    echo "📁 Listing all files in bucket"
    tetra_deploy_do_spaces_list_files "$BUCKET"
  fi
}

tetra_deploy_s3_list_prefix() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local PREFIX="${1:-}"
  local BUCKET="${2:-${DO_SPACES_BUCKET:-pja-games}}"

  if [ -z "$PREFIX" ]; then
    echo "Usage: tetra_deploy_s3_list_prefix <prefix> [bucket]"
    echo "Example: tetra_deploy_s3_list_prefix cheap-golf/latest/"
    return 1
  fi

  echo "🔍 Listing files with prefix '$PREFIX' in bucket '$BUCKET'..."
  tetra_deploy_do_spaces_list_files "$BUCKET" "$PREFIX"
}

tetra_deploy_s3_test() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  echo "🧪 Testing DO Spaces connection and credentials..."
  
  # Test connection
  if tetra_deploy_do_spaces_test_connection; then
    echo "✅ Connection test passed"
    
    # Test listing files in pja-games bucket
    echo "📁 Testing file listing in pja-games bucket..."
    tetra_deploy_do_spaces_list_games
  else
    echo "❌ Connection test failed"
    return 1
  fi
}

tetra_deploy_s3_list_games() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local PREFIX="${1:-}"
  
  echo "🎮 Listing game files in pja-games bucket..."
  tetra_deploy_do_spaces_list_games "$PREFIX"
}

tetra_deploy_s3_list_with_env() {
  local ENV_FILE="${1:-}"
  
  if [ -z "$ENV_FILE" ]; then
    echo "Usage: tetra_deploy_s3_list_with_env <env_file> [bucket] [prefix]"
    echo "Example: tetra_deploy_s3_list_with_env api-dev-to-staging.env pja-games"
    return 1
  fi

  if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Environment file not found: $ENV_FILE"
    return 1
  fi

  echo "📋 Loading environment from: $ENV_FILE"
  source "$ENV_FILE"
  
  local BUCKET="${2:-${DO_SPACES_BUCKET:-pja-games}}"
  local PREFIX="${3:-}"
  
  tetra_deploy_s3_list "$BUCKET" "$PREFIX"
}

tetra_deploy_s3_list_simple() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local BUCKET="${BUCKET:-${DO_SPACES_BUCKET:-pja-games}}"
  local PREFIX="${PREFIX:-}"

  [ -n "$1" ] && BUCKET="$1"
  [ -n "$2" ] && PREFIX="$2"

  echo "🔍 Listing files in DO Spaces bucket: $BUCKET (simple method)"
  
  # Check if we have DO Spaces credentials in environment
  if [ -z "$DO_SPACES_KEY" ] || [ -z "$DO_SPACES_SECRET" ]; then
    echo "⚠️  DO Spaces credentials not found in environment"
    echo "💡 Expected variables: DO_SPACES_KEY, DO_SPACES_SECRET"
    return 1
  fi

  # Setup S3 client with DO Spaces credentials
  if ! tetra_deploy_do_spaces_setup_from_env; then
    echo "❌ Failed to setup S3 client"
    return 1
  fi

  # Use the alternative listing method
  tetra_deploy_do_spaces_list_files_simple "$BUCKET" "$PREFIX"
}

tetra_deploy_s3_list_curl() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local BUCKET="${BUCKET:-${DO_SPACES_BUCKET:-pja-games}}"
  local PREFIX="${PREFIX:-}"

  [ -n "$1" ] && BUCKET="$1"
  [ -n "$2" ] && PREFIX="$2"

  echo "🔍 Listing files in DO Spaces bucket: $BUCKET (curl method)"
  
  # Check if we have DO Spaces credentials in environment
  if [ -z "$DO_SPACES_KEY" ] || [ -z "$DO_SPACES_SECRET" ]; then
    echo "⚠️  DO Spaces credentials not found in environment"
    echo "💡 Expected variables: DO_SPACES_KEY, DO_SPACES_SECRET"
    return 1
  fi

  # Setup S3 client with DO Spaces credentials
  if ! tetra_deploy_do_spaces_setup_from_env; then
    echo "❌ Failed to setup S3 client"
    return 1
  fi

  # Use the curl listing method
  tetra_deploy_do_spaces_list_curl "$BUCKET" "$PREFIX"
}

tetra_deploy_s3_test_curl() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  echo "🧪 Testing DO Spaces connection using curl..."
  
  # Test connection using curl
  if tetra_deploy_do_spaces_test_curl; then
    echo "✅ Connection test passed"
    
    # Test listing files in pja-games bucket
    echo "📁 Testing file listing in pja-games bucket..."
    tetra_deploy_do_spaces_list_curl "${DO_SPACES_BUCKET:-pja-games}"
  else
    echo "❌ Connection test failed"
    return 1
  fi
}

# Convenience functions for uploading
tetra_deploy_s3_upload_file() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local LOCAL_FILE="${1:-}"
  local REMOTE_PATH="${2:-}"
  local BUCKET="${3:-${DO_SPACES_BUCKET:-pja-games}}"

  [ -n "$1" ] && LOCAL_FILE="$1"
  [ -n "$2" ] && REMOTE_PATH="$2"
  [ -n "$3" ] && BUCKET="$3"

  echo "📤 Uploading file to DO Spaces..."
  tetra_deploy_do_spaces_upload_file "$LOCAL_FILE" "$REMOTE_PATH" "$BUCKET"
}

tetra_deploy_s3_upload_dir() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local LOCAL_DIR="${1:-}"
  local REMOTE_DIR="${2:-}"
  local BUCKET="${3:-${DO_SPACES_BUCKET:-pja-games}}"

  [ -n "$1" ] && LOCAL_DIR="$1"
  [ -n "$2" ] && REMOTE_DIR="$2"
  [ -n "$3" ] && BUCKET="$3"

  echo "📤 Uploading directory to DO Spaces..."
  tetra_deploy_do_spaces_upload_dir "$LOCAL_DIR" "$REMOTE_DIR" "$BUCKET"
}

tetra_deploy_s3_sync_dir() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local LOCAL_DIR="${1:-}"
  local REMOTE_DIR="${2:-}"
  local BUCKET="${3:-${DO_SPACES_BUCKET:-pja-games}}"

  [ -n "$1" ] && LOCAL_DIR="$1"
  [ -n "$2" ] && REMOTE_DIR="$2"
  [ -n "$3" ] && BUCKET="$3"

  echo "🔄 Syncing directory to DO Spaces..."
  tetra_deploy_do_spaces_sync_dir "$LOCAL_DIR" "$REMOTE_DIR" "$BUCKET"
}

tetra_deploy_s3_upload_game() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local GAME_NAME="${1:-}"
  local BUILD_DIR="${2:-./build}"
  local BUCKET="${3:-${DO_SPACES_BUCKET:-pja-games}}"

  [ -n "$1" ] && GAME_NAME="$1"
  [ -n "$2" ] && BUILD_DIR="$2"
  [ -n "$3" ] && BUCKET="$3"

  echo "🎮 Uploading game to DO Spaces..."
  tetra_deploy_do_spaces_upload_game "$GAME_NAME" "$BUILD_DIR" "$BUCKET"
}

tetra_deploy_s3_sync_game() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local GAME_NAME="${1:-}"
  local BUILD_DIR="${2:-./build}"
  local BUCKET="${3:-${DO_SPACES_BUCKET:-pja-games}}"

  [ -n "$1" ] && GAME_NAME="$1"
  [ -n "$2" ] && BUILD_DIR="$2"
  [ -n "$3" ] && BUCKET="$3"

  echo "🎮 Syncing game to DO Spaces..."
  tetra_deploy_do_spaces_sync_game "$GAME_NAME" "$BUILD_DIR" "$BUCKET"
}

# Convenience functions for deleting
tetra_deploy_s3_delete_file() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local REMOTE_PATH="${1:-}"
  local BUCKET="${2:-${DO_SPACES_BUCKET:-pja-games}}"

  [ -n "$1" ] && REMOTE_PATH="$1"
  [ -n "$2" ] && BUCKET="$2"

  echo "🗑️  Deleting file from DO Spaces..."
  tetra_deploy_do_spaces_delete_file "$REMOTE_PATH" "$BUCKET"
}

tetra_deploy_s3_delete_dir() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local REMOTE_DIR="${1:-}"
  local BUCKET="${2:-${DO_SPACES_BUCKET:-pja-games}}"

  [ -n "$1" ] && REMOTE_DIR="$1"
  [ -n "$2" ] && BUCKET="$2"

  echo "🗑️  Deleting directory from DO Spaces..."
  tetra_deploy_do_spaces_delete_dir "$REMOTE_DIR" "$BUCKET"
}

tetra_deploy_s3_replace_dir() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local LOCAL_DIR="${1:-}"
  local REMOTE_DIR="${2:-}"
  local BUCKET="${3:-${DO_SPACES_BUCKET:-pja-games}}"

  [ -n "$1" ] && LOCAL_DIR="$1"
  [ -n "$2" ] && REMOTE_DIR="$2"
  [ -n "$3" ] && BUCKET="$3"

  echo "🔄 Replacing directory contents in DO Spaces..."
  tetra_deploy_do_spaces_replace_dir "$LOCAL_DIR" "$REMOTE_DIR" "$BUCKET"
}

tetra_deploy_s3_replace_game_version() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local GAME_NAME="${1:-}"
  local VERSION="${2:-latest}"
  local LOCAL_DIR="${3:-./build}"
  local BUCKET="${4:-${DO_SPACES_BUCKET:-pja-games}}"

  [ -n "$1" ] && GAME_NAME="$1"
  [ -n "$2" ] && VERSION="$2"
  [ -n "$3" ] && LOCAL_DIR="$3"
  [ -n "$4" ] && BUCKET="$4"

  echo "🎮 Replacing game version in DO Spaces..."
  tetra_deploy_do_spaces_replace_game_version "$GAME_NAME" "$VERSION" "$LOCAL_DIR" "$BUCKET"
} 