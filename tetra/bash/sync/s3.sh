# Function to set up environment variables for DigitalOcean Spaces
tetra_s3_setup() {
  export AWS_ACCESS_KEY_ID="$1"
  export AWS_SECRET_ACCESS_KEY="$2"
  export AWS_DEFAULT_REGION="nyc3"
  export AWS_ENDPOINT_URL="https://phmedia.nyc3.digitaloceanspaces.com"
  echo "Environment variables set for DigitalOcean Spaces."
}

# Function to clear the environment variables
tetra_s3_clear() {
  unset AWS_ACCESS_KEY_ID
  unset AWS_SECRET_ACCESS_KEY
  unset AWS_DEFAULT_REGION
  unset AWS_ENDPOINT_URL
  echo "Environment variables cleared."
}

# Function to check the current environment variables
tetra_s3_status() {
  echo "AWS_ACCESS_KEY_ID: $AWS_ACCESS_KEY_ID"
  echo "AWS_SECRET_ACCESS_KEY: $AWS_SECRET_ACCESS_KEY"
  echo "AWS_DEFAULT_REGION: $AWS_DEFAULT_REGION"
  echo "AWS_ENDPOINT_URL: $AWS_ENDPOINT_URL"
}

# Function to check for DO Spaces credentials in environment
tetra_s3_check_credentials() {
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

# Function to setup S3 client with DO Spaces credentials
tetra_s3_setup_from_env() {
  if tetra_s3_check_credentials; then
    tetra_s3_setup "$DO_SPACES_KEY" "$DO_SPACES_SECRET"
    echo "✅ S3 client configured with DO Spaces credentials"
    return 0
  else
    echo "❌ Cannot setup S3 client - credentials missing"
    return 1
  fi
}

# Function to list files in DO Spaces bucket
tetra_s3_list_files() {
  local BUCKET="${1:-}"
  local PREFIX="${2:-}"
  
  if [ -z "$BUCKET" ]; then
    echo "Usage: tetra_s3_list_files <bucket_name> [prefix]"
    echo "Example: tetra_s3_list_files phmedia logs/"
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
    if ! tetra_s3_setup_from_env; then
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

# Function to check DO Spaces connectivity and credentials
tetra_s3_test_connection() {
  echo "🧪 Testing DO Spaces connection..."
  
  if ! tetra_s3_setup_from_env; then
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

# Alternative function that tries different approaches
tetra_s3_list_files_simple() {
  local BUCKET="${1:-}"
  local PREFIX="${2:-}"
  
  if [ -z "$BUCKET" ]; then
    echo "Usage: tetra_s3_list_files_simple <bucket_name> [prefix]"
    return 1
  fi
  
  # Setup credentials
  if ! tetra_s3_setup_from_env; then
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

