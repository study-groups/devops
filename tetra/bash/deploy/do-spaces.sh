# do-spaces.sh

# Function to set up environment variables for DigitalOcean Spaces
tetra_deploy_do_spaces_setup() {
  export AWS_ACCESS_KEY_ID="$1"
  export AWS_SECRET_ACCESS_KEY="$2"
  export AWS_DEFAULT_REGION="${DO_SPACES_REGION:-sfo3}"
  
  # Fix endpoint URL format - ensure it has proper https:// format
  local endpoint="${DO_SPACES_ENDPOINT:-https://sfo3.digitaloceanspaces.com}"
  
  # Clean up the endpoint URL
  # Remove any leading/trailing whitespace
  endpoint=$(echo "$endpoint" | xargs)
  
  # Ensure the endpoint starts with https://
  if [[ "$endpoint" != https://* ]]; then
    if [[ "$endpoint" == https:/ ]]; then
      endpoint="https://"
    elif [[ "$endpoint" == https:* ]]; then
      endpoint="https://${endpoint#https:}"
    else
      endpoint="https://$endpoint"
    fi
  fi
  
  # Remove any extra slashes after https://
  if [[ "$endpoint" == "https:///"* ]]; then
    endpoint="https://${endpoint#https:///}"
  fi
  
  export AWS_ENDPOINT_URL="$endpoint"
  echo "Environment variables set for DigitalOcean Spaces."
  echo "🔧 Endpoint URL: $AWS_ENDPOINT_URL"
}

# Function to clear the environment variables
tetra_deploy_do_spaces_clear() {
  unset AWS_ACCESS_KEY_ID
  unset AWS_SECRET_ACCESS_KEY
  unset AWS_DEFAULT_REGION
  unset AWS_ENDPOINT_URL
  echo "Environment variables cleared."
}

# Function to check the current environment variables
tetra_deploy_do_spaces_status() {
  echo "AWS_ACCESS_KEY_ID: $AWS_ACCESS_KEY_ID"
  echo "AWS_SECRET_ACCESS_KEY: $AWS_SECRET_ACCESS_KEY"
  echo "AWS_DEFAULT_REGION: $AWS_DEFAULT_REGION"
  echo "AWS_ENDPOINT_URL: $AWS_ENDPOINT_URL"
  echo "DO_SPACES_ENDPOINT: $DO_SPACES_ENDPOINT"
  echo "DO_SPACES_BUCKET: $DO_SPACES_BUCKET"
  echo "DO_SPACES_REGION: $DO_SPACES_REGION"
}

# Function to check for DO Spaces credentials in environment
tetra_deploy_do_spaces_check_credentials() {
  local DO_SPACES_KEY="${DO_SPACES_KEY:-}"
  local DO_SPACES_SECRET="${DO_SPACES_SECRET:-}"
  
  if [ -z "$DO_SPACES_KEY" ] || [ -z "$DO_SPACES_SECRET" ]; then
    echo "✗ DO Spaces credentials not found in environment"
    echo "💡 Expected variables: DO_SPACES_KEY, DO_SPACES_SECRET"
    echo "📋 Current environment variables:"
    env | grep -i "do_spaces\|aws" || echo "   No relevant variables found"
    return 1
  else
    echo "✓ DO Spaces credentials found"
    echo "🔑 Key: ${DO_SPACES_KEY:0:8}..."
    echo "🔐 Secret: ${DO_SPACES_SECRET:0:8}..."
    return 0
  fi
}

# Function to validate and fix endpoint URL
tetra_deploy_do_spaces_validate_endpoint() {
  local endpoint="${DO_SPACES_ENDPOINT:-https://sfo3.digitaloceanspaces.com}"
  
  # Check if endpoint is malformed
  if [[ "$endpoint" == "https:/"* ]] && [[ "$endpoint" != "https://"* ]]; then
    echo "⚠️  Detected malformed endpoint URL: $endpoint"
    echo "🔧 Fixing endpoint URL format..."
    
    # Fix the missing slash
    if [[ "$endpoint" == "https:/" ]]; then
      endpoint="https://"
    else
      endpoint="https://${endpoint#https:/}"
    fi
    
    export DO_SPACES_ENDPOINT="$endpoint"
    echo "✅ Fixed endpoint URL: $endpoint"
  fi
  
  # Remove any extra slashes after https://
  if [[ "$endpoint" == "https:///"* ]]; then
    echo "⚠️  Detected extra slashes in endpoint URL: $endpoint"
    echo "🔧 Fixing endpoint URL format..."
    endpoint="https://${endpoint#https:///}"
    export DO_SPACES_ENDPOINT="$endpoint"
    echo "✅ Fixed endpoint URL: $endpoint"
  fi
  
  echo "🔧 Using endpoint: $endpoint"
  return 0
}

# Function to setup S3 client with DO Spaces credentials
tetra_deploy_do_spaces_setup_from_env() {
  if tetra_deploy_do_spaces_check_credentials; then
    # Validate and fix endpoint URL before setup
    tetra_deploy_do_spaces_validate_endpoint
    tetra_deploy_do_spaces_setup "$DO_SPACES_KEY" "$DO_SPACES_SECRET"
    echo "✅ S3 client configured with DO Spaces credentials"
    return 0
  else
    echo "❌ Cannot setup S3 client - credentials missing"
    return 1
  fi
}

# Function to list files in DO Spaces bucket
tetra_deploy_do_spaces_list_files() {
  local BUCKET="${1:-${DO_SPACES_BUCKET:-pja-games}}"
  local PREFIX="${2:-}"
  
  if [ -z "$BUCKET" ]; then
    echo "Usage: tetra_deploy_do_spaces_list_files <bucket_name> [prefix]"
    echo "Example: tetra_deploy_do_spaces_list_files phmedia logs/"
    return 1
  fi
  
  # Check if AWS CLI is available
  if ! command -v aws &> /dev/null; then
    echo "✗ AWS CLI not found. Please install awscli first."
    echo "💡 Install with: brew install awscli"
    return 1
  fi
  
  # Setup credentials if not already set
  if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    if ! tetra_deploy_do_spaces_setup_from_env; then
      return 1
    fi
  fi
  
  echo "📁 Listing files in bucket: $BUCKET"
  if [ -n "$PREFIX" ]; then
    echo "🔍 With prefix: $PREFIX"
  fi
  
  # Debug: Show AWS CLI version and configuration
  echo "🔧 AWS CLI version:"
  aws --version
  
  echo "🔧 AWS configuration:"
  echo "  AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:0:8}..."
  echo "  AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY:0:8}..."
  echo "  AWS_DEFAULT_REGION: $AWS_DEFAULT_REGION"
  echo "  AWS_ENDPOINT_URL: $AWS_ENDPOINT_URL"
  
  # List files using AWS CLI with S3-compatible endpoint
  # Use --no-sign-request for public buckets or ensure proper authentication
  local aws_cmd="aws s3 ls"
  
  if [ -n "$PREFIX" ]; then
    aws_cmd="$aws_cmd s3://$BUCKET/$PREFIX"
  else
    aws_cmd="$aws_cmd s3://$BUCKET/"
  fi
  
  aws_cmd="$aws_cmd --endpoint-url=\"$AWS_ENDPOINT_URL\""
  
  echo "🔧 Executing: $aws_cmd"
  
  # Execute the command with proper error handling
  if eval "$aws_cmd" 2>&1; then
    echo "✅ File listing completed"
  else
    echo "❌ Failed to list files"
    echo "💡 Debugging tips:"
    echo "   - Check if bucket exists: $BUCKET"
    echo "   - Verify credentials have proper permissions"
    echo "   - Try with --no-sign-request if bucket is public"
    return 1
  fi
}

# Alternative function that tries different approaches
tetra_deploy_do_spaces_list_files_simple() {
  local BUCKET="${1:-${DO_SPACES_BUCKET:-pja-games}}"
  local PREFIX="${2:-}"
  
  if [ -z "$BUCKET" ]; then
    echo "Usage: tetra_deploy_do_spaces_list_files_simple <bucket_name> [prefix]"
    return 1
  fi
  
  # Setup credentials
  if ! tetra_deploy_do_spaces_setup_from_env; then
    return 1
  fi
  
  echo "📁 Listing files in bucket: $BUCKET (simple method)"
  
  # Try different approaches
  echo "🔧 Trying method 1: Basic ls..."
  if aws s3 ls "s3://$BUCKET/" --endpoint-url="$AWS_ENDPOINT_URL" 2>/dev/null; then
    echo "✅ Method 1 successful"
    return 0
  fi
  
  echo "🔧 Trying method 2: With --no-sign-request..."
  if aws s3 ls "s3://$BUCKET/" --endpoint-url="$AWS_ENDPOINT_URL" --no-sign-request 2>/dev/null; then
    echo "✅ Method 2 successful"
    return 0
  fi
  
  echo "🔧 Trying method 3: Using s3api..."
  if aws s3api list-objects --bucket "$BUCKET" --endpoint-url="$AWS_ENDPOINT_URL" 2>/dev/null; then
    echo "✅ Method 3 successful"
    return 0
  fi
  
  echo "❌ All methods failed"
  return 1
}

# Function to check DO Spaces connectivity and credentials
tetra_deploy_do_spaces_test_connection() {
  echo "🧪 Testing DO Spaces connection..."
  
  if ! tetra_deploy_do_spaces_setup_from_env; then
    return 1
  fi
  
  # Test basic connectivity
  if aws s3 ls --endpoint-url="$AWS_ENDPOINT_URL" &>/dev/null; then
    echo "✅ DO Spaces connection successful"
    return 0
  else
    echo "❌ DO Spaces connection failed"
    return 1
  fi
}

# Function to list files in pja-games bucket specifically
tetra_deploy_do_spaces_list_games() {
  local PREFIX="${1:-}"
  
  echo "🎮 Listing game files in pja-games bucket..."
  tetra_deploy_do_spaces_list_files "${DO_SPACES_BUCKET:-pja-games}" "$PREFIX"
}

# Function to list files in pja-games bucket with simple method
tetra_deploy_do_spaces_list_games_simple() {
  local PREFIX="${1:-}"
  
  echo "🎮 Listing game files in pja-games bucket (simple method)..."
  tetra_deploy_do_spaces_list_files_simple "${DO_SPACES_BUCKET:-pja-games}" "$PREFIX"
}

# Function to fix the endpoint URL manually
tetra_deploy_do_spaces_fix_endpoint() {
  echo "🔧 Fixing DO Spaces endpoint URL..."
  
  # Set the correct endpoint
  export DO_SPACES_ENDPOINT="https://sfo3.digitaloceanspaces.com"
  
  echo "✅ Endpoint URL fixed to: $DO_SPACES_ENDPOINT"
  echo "💡 You can now run your S3 commands again"
}

# Function to show current endpoint and fix if needed
tetra_deploy_do_spaces_show_endpoint() {
  echo "🔧 Current DO_SPACES_ENDPOINT: ${DO_SPACES_ENDPOINT:-not set}"
  echo "🔧 Current AWS_ENDPOINT_URL: ${AWS_ENDPOINT_URL:-not set}"
  
  if [[ "$DO_SPACES_ENDPOINT" == *"//"* ]] && [[ "$DO_SPACES_ENDPOINT" != "https://sfo3.digitaloceanspaces.com" ]]; then
    echo "⚠️  Endpoint URL appears to be malformed"
    echo "💡 Run: tetra_deploy_do_spaces_fix_endpoint"
  fi
}

# Function to upload a single file to DO Spaces
tetra_deploy_do_spaces_upload_file() {
  local LOCAL_FILE="${1:-}"
  local REMOTE_PATH="${2:-}"
  local BUCKET="${3:-${DO_SPACES_BUCKET:-pja-games}}"
  
  if [ -z "$LOCAL_FILE" ] || [ -z "$REMOTE_PATH" ]; then
    echo "Usage: tetra_deploy_do_spaces_upload_file <local_file> <remote_path> [bucket]"
    echo "Example: tetra_deploy_do_spaces_upload_file ./game.js cornhole-hero/game.js"
    return 1
  fi
  
  if [ ! -f "$LOCAL_FILE" ]; then
    echo "❌ Local file not found: $LOCAL_FILE"
    return 1
  fi
  
  # Setup credentials
  if ! tetra_deploy_do_spaces_setup_from_env; then
    return 1
  fi
  
  echo "📤 Uploading file: $LOCAL_FILE"
  echo "🎯 Destination: s3://$BUCKET/$REMOTE_PATH"
  
  # Upload file using AWS CLI
  if aws s3 cp "$LOCAL_FILE" "s3://$BUCKET/$REMOTE_PATH" --endpoint-url="$AWS_ENDPOINT_URL"; then
    echo "✅ File uploaded successfully"
    return 0
  else
    echo "❌ File upload failed"
    return 1
  fi
}

# Function to upload entire directory to DO Spaces
tetra_deploy_do_spaces_upload_dir() {
  local LOCAL_DIR="${1:-}"
  local REMOTE_DIR="${2:-}"
  local BUCKET="${3:-${DO_SPACES_BUCKET:-pja-games}}"
  
  if [ -z "$LOCAL_DIR" ] || [ -z "$REMOTE_DIR" ]; then
    echo "Usage: tetra_deploy_do_spaces_upload_dir <local_dir> <remote_dir> [bucket]"
    echo "Example: tetra_deploy_do_spaces_upload_dir ./build/ cornhole-hero/"
    return 1
  fi
  
  if [ ! -d "$LOCAL_DIR" ]; then
    echo "❌ Local directory not found: $LOCAL_DIR"
    return 1
  fi
  
  # Setup credentials
  if ! tetra_deploy_do_spaces_setup_from_env; then
    return 1
  fi
  
  echo "📤 Uploading directory: $LOCAL_DIR"
  echo "🎯 Destination: s3://$BUCKET/$REMOTE_DIR"
  
  # Upload directory using AWS CLI sync
  if aws s3 sync "$LOCAL_DIR" "s3://$BUCKET/$REMOTE_DIR" --endpoint-url="$AWS_ENDPOINT_URL"; then
    echo "✅ Directory uploaded successfully"
    return 0
  else
    echo "❌ Directory upload failed"
    return 1
  fi
}

# Function to sync local directory with DO Spaces (upload only new/changed files)
tetra_deploy_do_spaces_sync_dir() {
  local LOCAL_DIR="${1:-}"
  local REMOTE_DIR="${2:-}"
  local BUCKET="${3:-${DO_SPACES_BUCKET:-pja-games}}"
  
  if [ -z "$LOCAL_DIR" ] || [ -z "$REMOTE_DIR" ]; then
    echo "Usage: tetra_deploy_do_spaces_sync_dir <local_dir> <remote_dir> [bucket]"
    echo "Example: tetra_deploy_do_spaces_sync_dir ./build/ cornhole-hero/"
    return 1
  fi
  
  if [ ! -d "$LOCAL_DIR" ]; then
    echo "❌ Local directory not found: $LOCAL_DIR"
    return 1
  fi
  
  # Setup credentials
  if ! tetra_deploy_do_spaces_setup_from_env; then
    return 1
  fi
  
  echo "🔄 Syncing directory: $LOCAL_DIR"
  echo "🎯 Destination: s3://$BUCKET/$REMOTE_DIR"
  
  # Sync directory using AWS CLI sync (only uploads new/changed files)
  if aws s3 sync "$LOCAL_DIR" "s3://$BUCKET/$REMOTE_DIR" --endpoint-url="$AWS_ENDPOINT_URL"; then
    echo "✅ Directory synced successfully"
    return 0
  else
    echo "❌ Directory sync failed"
    return 1
  fi
}

# Function to upload directory with specific file types
tetra_deploy_do_spaces_upload_dir_filtered() {
  local LOCAL_DIR="${1:-}"
  local REMOTE_DIR="${2:-}"
  local FILE_PATTERN="${3:-*}"
  local BUCKET="${4:-${DO_SPACES_BUCKET:-pja-games}}"
  
  if [ -z "$LOCAL_DIR" ] || [ -z "$REMOTE_DIR" ]; then
    echo "Usage: tetra_deploy_do_spaces_upload_dir_filtered <local_dir> <remote_dir> [file_pattern] [bucket]"
    echo "Example: tetra_deploy_do_spaces_upload_dir_filtered ./build/ cornhole-hero/ '*.js'"
    return 1
  fi
  
  if [ ! -d "$LOCAL_DIR" ]; then
    echo "❌ Local directory not found: $LOCAL_DIR"
    return 1
  fi
  
  # Setup credentials
  if ! tetra_deploy_do_spaces_setup_from_env; then
    return 1
  fi
  
  echo "📤 Uploading filtered directory: $LOCAL_DIR"
  echo "🎯 Destination: s3://$BUCKET/$REMOTE_DIR"
  echo "🔍 File pattern: $FILE_PATTERN"
  
  # Upload filtered files using AWS CLI sync with include pattern
  if aws s3 sync "$LOCAL_DIR" "s3://$BUCKET/$REMOTE_DIR" --include "$FILE_PATTERN" --endpoint-url="$AWS_ENDPOINT_URL"; then
    echo "✅ Filtered directory uploaded successfully"
    return 0
  else
    echo "❌ Filtered directory upload failed"
    return 1
  fi
}

# Function to upload game build to DO Spaces
tetra_deploy_do_spaces_upload_game() {
  local GAME_NAME="${1:-}"
  local BUILD_DIR="${2:-./build}"
  local BUCKET="${3:-${DO_SPACES_BUCKET:-pja-games}}"
  
  if [ -z "$GAME_NAME" ]; then
    echo "Usage: tetra_deploy_do_spaces_upload_game <game_name> [build_dir] [bucket]"
    echo "Example: tetra_deploy_do_spaces_upload_game cornhole-hero ./dist"
    return 1
  fi
  
  if [ ! -d "$BUILD_DIR" ]; then
    echo "❌ Build directory not found: $BUILD_DIR"
    return 1
  fi
  
  local REMOTE_DIR="$GAME_NAME/"
  
  echo "🎮 Uploading game: $GAME_NAME"
  echo "📁 Build directory: $BUILD_DIR"
  echo "🎯 Destination: s3://$BUCKET/$REMOTE_DIR"
  
  # Upload game directory
  if tetra_deploy_do_spaces_upload_dir "$BUILD_DIR" "$REMOTE_DIR" "$BUCKET"; then
    echo "✅ Game '$GAME_NAME' uploaded successfully"
    return 0
  else
    echo "❌ Game upload failed"
    return 1
  fi
}

# Function to sync game build to DO Spaces
tetra_deploy_do_spaces_sync_game() {
  local GAME_NAME="${1:-}"
  local BUILD_DIR="${2:-./build}"
  local BUCKET="${3:-${DO_SPACES_BUCKET:-pja-games}}"
  
  if [ -z "$GAME_NAME" ]; then
    echo "Usage: tetra_deploy_do_spaces_sync_game <game_name> [build_dir] [bucket]"
    echo "Example: tetra_deploy_do_spaces_sync_game cornhole-hero ./dist"
    return 1
  fi
  
  if [ ! -d "$BUILD_DIR" ]; then
    echo "❌ Build directory not found: $BUILD_DIR"
    return 1
  fi
  
  local REMOTE_DIR="$GAME_NAME/"
  
  echo "🎮 Syncing game: $GAME_NAME"
  echo "📁 Build directory: $BUILD_DIR"
  echo "🎯 Destination: s3://$BUCKET/$REMOTE_DIR"
  
  # Sync game directory
  if tetra_deploy_do_spaces_sync_dir "$BUILD_DIR" "$REMOTE_DIR" "$BUCKET"; then
    echo "✅ Game '$GAME_NAME' synced successfully"
    return 0
  else
    echo "❌ Game sync failed"
    return 1
  fi
}

# Function to delete a file from DO Spaces
tetra_deploy_do_spaces_delete_file() {
  local REMOTE_PATH="${1:-}"
  local BUCKET="${2:-${DO_SPACES_BUCKET:-pja-games}}"
  
  if [ -z "$REMOTE_PATH" ]; then
    echo "Usage: tetra_deploy_do_spaces_delete_file <remote_path> [bucket]"
    echo "Example: tetra_deploy_do_spaces_delete_file cornhole-hero/latest/index.html"
    return 1
  fi
  
  # Setup credentials
  if ! tetra_deploy_do_spaces_setup_from_env; then
    return 1
  fi
  
  echo "🗑️  Deleting file: s3://$BUCKET/$REMOTE_PATH"
  
  # Delete file using AWS CLI
  if aws s3 rm "s3://$BUCKET/$REMOTE_PATH" --endpoint-url="$AWS_ENDPOINT_URL"; then
    echo "✅ File deleted successfully"
    return 0
  else
    echo "❌ File deletion failed"
    return 1
  fi
}

# Function to delete a directory and all its contents from DO Spaces
tetra_deploy_do_spaces_delete_dir() {
  local REMOTE_DIR="${1:-}"
  local BUCKET="${2:-${DO_SPACES_BUCKET:-pja-games}}"
  
  if [ -z "$REMOTE_DIR" ]; then
    echo "Usage: tetra_deploy_do_spaces_delete_dir <remote_dir> [bucket]"
    echo "Example: tetra_deploy_do_spaces_delete_dir cornhole-hero/latest/"
    return 1
  fi
  
  # Setup credentials
  if ! tetra_deploy_do_spaces_setup_from_env; then
    return 1
  fi
  
  echo "🗑️  Deleting directory and all contents: s3://$BUCKET/$REMOTE_DIR"
  
  # Delete directory and all contents using AWS CLI
  if aws s3 rm "s3://$BUCKET/$REMOTE_DIR" --recursive --endpoint-url="$AWS_ENDPOINT_URL"; then
    echo "✅ Directory and all contents deleted successfully"
    return 0
  else
    echo "❌ Directory deletion failed"
    return 1
  fi
}

# Function to replace directory contents (delete then upload)
tetra_deploy_do_spaces_replace_dir() {
  local LOCAL_DIR="${1:-}"
  local REMOTE_DIR="${2:-}"
  local BUCKET="${3:-${DO_SPACES_BUCKET:-pja-games}}"
  
  if [ -z "$LOCAL_DIR" ] || [ -z "$REMOTE_DIR" ]; then
    echo "Usage: tetra_deploy_do_spaces_replace_dir <local_dir> <remote_dir> [bucket]"
    echo "Example: tetra_deploy_do_spaces_replace_dir ./cornhole cornhole-hero/latest/"
    return 1
  fi
  
  if [ ! -d "$LOCAL_DIR" ]; then
    echo "❌ Local directory not found: $LOCAL_DIR"
    return 1
  fi
  
  echo "🔄 Replacing directory contents..."
  echo "📁 Local directory: $LOCAL_DIR"
  echo "🎯 Remote directory: s3://$BUCKET/$REMOTE_DIR"
  
  # Step 1: Delete existing contents
  echo "🗑️  Step 1: Deleting existing contents..."
  if tetra_deploy_do_spaces_delete_dir "$REMOTE_DIR" "$BUCKET"; then
    echo "✅ Existing contents deleted"
  else
    echo "⚠️  No existing contents to delete (or deletion failed)"
  fi
  
  # Step 2: Upload new contents
  echo "📤 Step 2: Uploading new contents..."
  if tetra_deploy_do_spaces_upload_dir "$LOCAL_DIR" "$REMOTE_DIR" "$BUCKET"; then
    echo "✅ Directory contents replaced successfully"
    return 0
  else
    echo "❌ Directory replacement failed"
    return 1
  fi
}

# Function to replace game version
tetra_deploy_do_spaces_replace_game_version() {
  local GAME_NAME="${1:-}"
  local VERSION="${2:-latest}"
  local LOCAL_DIR="${3:-./build}"
  local BUCKET="${4:-${DO_SPACES_BUCKET:-pja-games}}"
  
  if [ -z "$GAME_NAME" ]; then
    echo "Usage: tetra_deploy_do_spaces_replace_game_version <game_name> [version] [local_dir] [bucket]"
    echo "Example: tetra_deploy_do_spaces_replace_game_version cornhole-hero latest ./cornhole"
    return 1
  fi
  
  if [ ! -d "$LOCAL_DIR" ]; then
    echo "❌ Local directory not found: $LOCAL_DIR"
    return 1
  fi
  
  local REMOTE_DIR="$GAME_NAME/$VERSION/"
  
  echo "🎮 Replacing game version: $GAME_NAME/$VERSION"
  echo "📁 Local directory: $LOCAL_DIR"
  echo "🎯 Remote directory: s3://$BUCKET/$REMOTE_DIR"
  
  # Replace directory contents
  if tetra_deploy_do_spaces_replace_dir "$LOCAL_DIR" "$REMOTE_DIR" "$BUCKET"; then
    echo "✅ Game version '$GAME_NAME/$VERSION' replaced successfully"
    return 0
  else
    echo "❌ Game version replacement failed"
    return 1
  fi
}

# Function to test DO Spaces using curl (bypasses AWS CLI issues)
tetra_deploy_do_spaces_test_curl() {
  echo "🧪 Testing DO Spaces connection using curl..."
  
  if ! tetra_deploy_do_spaces_setup_from_env; then
    return 1
  fi
  
  # Test basic connectivity using curl
  local endpoint="${DO_SPACES_ENDPOINT:-https://sfo3.digitaloceanspaces.com}"
  local bucket="${DO_SPACES_BUCKET:-pja-games}"
  
  echo "🔧 Testing connection to: $endpoint"
  
  # Try to list bucket contents using curl
  if curl -s -I "$endpoint/$bucket/" >/dev/null 2>&1; then
    echo "✅ Basic connectivity successful"
    
    # Try to get a list of files
    echo "📁 Attempting to list files..."
    if curl -s "$endpoint/$bucket/" | grep -o 'href="[^"]*"' | sed 's/href="//;s/"//g' | grep -v '^$'; then
      echo "✅ File listing successful with curl"
      return 0
    else
      echo "⚠️  No files found or listing not available"
      return 0
    fi
  else
    echo "❌ Connection failed"
    return 1
  fi
}

# Function to list files using curl (alternative to AWS CLI)
tetra_deploy_do_spaces_list_curl() {
  local BUCKET="${1:-${DO_SPACES_BUCKET:-pja-games}}"
  local PREFIX="${2:-}"
  
  echo "📁 Listing files in bucket: $BUCKET (curl method)"
  
  if ! tetra_deploy_do_spaces_setup_from_env; then
    return 1
  fi
  
  local endpoint="${DO_SPACES_ENDPOINT:-https://sfo3.digitaloceanspaces.com}"
  local url="$endpoint/$BUCKET/"
  
  if [ -n "$PREFIX" ]; then
    url="$url$PREFIX"
    echo "🔍 With prefix: $PREFIX"
  fi
  
  echo "🔧 Fetching from: $url"
  
  # Use curl to get the bucket listing
  local response=$(curl -s "$url" 2>/dev/null)
  
  if [ $? -eq 0 ] && [ -n "$response" ]; then
    echo "✅ Retrieved bucket listing"
    echo "📋 Files found:"
    echo "$response" | grep -o 'href="[^"]*"' | sed 's/href="//;s/"//g' | grep -v '^$' | sort
  else
    echo "❌ Failed to retrieve bucket listing"
    echo "💡 This might be a private bucket requiring authentication"
    return 1
  fi
} 