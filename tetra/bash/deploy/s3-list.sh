# s3-list.sh

tetra_deploy_s3_list() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  local BUCKET="${BUCKET:-pja-games}"
  local PREFIX="${PREFIX:-}"
  local DO_SPACES_KEY="${DO_SPACES_KEY:-}"
  local DO_SPACES_SECRET="${DO_SPACES_SECRET:-}"

  [ -n "$1" ] && BUCKET="$1"
  [ -n "$2" ] && PREFIX="$2"

  echo "🔍 Listing files in DO Spaces bucket: $BUCKET"
  
  # Check if we have DO Spaces credentials in environment
  if [ -z "$DO_SPACES_KEY" ] || [ -z "$DO_SPACES_SECRET" ]; then
    echo "⚠️  DO Spaces credentials not found in environment"
    echo "💡 Expected variables: DO_SPACES_KEY, DO_SPACES_SECRET"
    echo "📋 Available environment variables:"
    env | grep -i "do_spaces\|aws" || echo "   No relevant variables found"
    echo
    echo "💡 You may need to source an environment file first:"
    echo "   source /tmp/tetra-env/env.sh  # after running tetra_deploy_env_get"
    return 1
  fi

  # Setup S3 client with DO Spaces credentials
  if ! tetra_s3_setup_from_env; then
    echo "❌ Failed to setup S3 client"
    return 1
  fi

  # List files in the bucket
  if [ -n "$PREFIX" ]; then
    echo "🔍 With prefix: $PREFIX"
    tetra_s3_list_files "$BUCKET" "$PREFIX"
  else
    echo "📁 Listing all files in bucket"
    tetra_s3_list_files "$BUCKET"
  fi
}

tetra_deploy_s3_test() {
  if [ -n "$1" ] && [ -f "$1" ] && [ -r "$1" ]; then
    . "$1"
    shift
  fi

  echo "🧪 Testing DO Spaces connection and credentials..."
  
  # Test connection
  if tetra_s3_test_connection; then
    echo "✅ Connection test passed"
    
    # Test listing files in pja-games bucket
    echo "📁 Testing file listing in pja-games bucket..."
    tetra_deploy_s3_list "pja-games"
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
  tetra_deploy_s3_list "pja-games" "$PREFIX"
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
  
  local BUCKET="${2:-pja-games}"
  local PREFIX="${3:-}"
  
  tetra_deploy_s3_list "$BUCKET" "$PREFIX"
} 