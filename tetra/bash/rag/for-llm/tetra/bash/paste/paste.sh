function tetra_paste_() {
  # Check for pngpaste
  if ! command -v pngpaste &> /dev/null; then
    echo "pngpaste not found. Installing via Homebrew..."
    brew install pngpaste || { echo "Failed to install pngpaste."; return 1; }
  fi

  # Check for aws CLI
  if ! command -v aws &> /dev/null; then
    echo "AWS CLI not found. Installing via Homebrew..."
    brew install awscli || { echo "Failed to install AWS CLI."; return 1; }
  fi

  # Prompt user for Space name and region
  local space_name="${1}"
  local region="${2}"

  if [[ -z "$space_name" ]]; then
    read -p "Enter your DigitalOcean Space name: " space_name
  fi

  if [[ -z "$region" ]]; then
    read -p "Enter your DigitalOcean Space region (e.g., nyc3): " region
  fi

  # Generate temporary filename
  local timestamp
  timestamp=$(date +"%Y%m%d_%H%M%S")
  local filename="/tmp/clipboard_${timestamp}.png"

  echo "Saving clipboard image to $filename ..."
  pngpaste "$filename" || { echo "Failed to capture image from clipboard. Make sure a PNG image is copied."; return 1; }

  echo "Uploading to DigitalOcean Space ..."
  aws --endpoint-url "https://${region}.digitaloceanspaces.com" \
    s3 cp "$filename" "s3://${space_name}/" && echo "✅ Upload successful!"

  # Optional cleanup prompt
  read -p "Delete local file $filename? [y/N]: " confirm
  if [[ "$confirm" == [yY] ]]; then
    rm "$filename"
  fi
}

tetra_paste_info() {
  echo "🧠 Tetra Paste Info"
  echo "----------------------"
  
  echo "🔍 Checking for required tools..."
  if command -v pngpaste &>/dev/null; then
    echo "✅ pngpaste: Found"
  else
    echo "❌ pngpaste: MISSING"
  fi

  if command -v aws &>/dev/null; then
    echo "✅ aws-cli: Found"
  else
    echo "❌ aws-cli: MISSING"
  fi

  echo ""
  echo "📁 Checking AWS configuration..."
  if [[ -f "$HOME/.aws/credentials" && -f "$HOME/.aws/config" ]]; then
    echo "✅ AWS Credentials and Config files present"
  else
    echo "⚠️ Missing ~/.aws/credentials or ~/.aws/config"
  fi

  echo ""
  echo "🖼 Clipboard check..."
  if command -v pngpaste &>/dev/null && pngpaste - > /dev/null 2>&1; then
    echo "✅ Clipboard seems to contain an image"
  else
    echo "⚠️ No valid PNG image found in clipboard"
  fi

  echo ""
  echo "📓 Current log file (if exists):"
  if [[ -f "$HOME/do_space_upload.log" ]]; then
    tail -n 5 "$HOME/do_space_upload.log"
  else
    echo "No log file yet."
  fi

  echo "----------------------"
  echo "Use tetra_paste_ to upload."
}

tetra_paste_status() {
  echo "📈 Checking environment readiness for tetra_paste_..."
  local ready=true

  printf "Tool Check:\n"
  command -v pngpaste &>/dev/null && echo "✅ pngpaste OK" || { echo "❌ pngpaste missing"; ready=false; }
  command -v aws &>/dev/null && echo "✅ aws-cli OK" || { echo "❌ aws-cli missing"; ready=false; }

  printf "\nAWS Config:\n"
  if [[ -f "$HOME/.aws/credentials" ]]; then
    echo "✅ ~.aws/credentials found"
  else
    echo "❌ ~/.aws/credentials missing"
    ready=false
  fi
  if [[ -f "$HOME/.aws/config" ]]; then
    echo "✅ ~.aws/config found"
  else
    echo "❌ ~/.aws/config missing"
    ready=false
  fi

  echo ""
  printf "Clipboard:\n"
  if command -v pngpaste &>/dev/null && pngpaste - > /dev/null 2>&1; then
    echo "✅ Clipboard image found"
  else
    echo "⚠️ Clipboard does not seem to contain a PNG image"
    ready=false
  fi

  echo ""
  if $ready; then
    echo "✔️  Environment looks good. Ready to use tetra_paste_."
    return 0
  else
    echo "❌ Some issues found. Please resolve before using tetra_paste_."
    return 1
  fi
}
