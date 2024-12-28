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

