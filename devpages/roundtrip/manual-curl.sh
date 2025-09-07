#!/bin/bash

# Manual curl commands for testing file save functionality

BASE_URL="http://localhost:4000"
COOKIE_FILE="/tmp/devpages-cookies.txt"

echo "=== Manual cURL Commands for DevPages File Testing ==="
echo

echo "1. Check authentication status:"
echo "curl -s -c \"$COOKIE_FILE\" \"$BASE_URL/api/auth/user\""
echo

echo "2. Save a test file (users/mike/001.md):"
echo "curl -s -b \"$COOKIE_FILE\" -X POST \"$BASE_URL/api/files/save\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"pathname\": \"users/mike/001.md\", \"content\": \"# Test File\\n\\nThis is a test created via curl API.\\nCreated at: $(date)\\n\"}'"
echo

echo "3. Read the file back:"
echo "curl -s -b \"$COOKIE_FILE\" \"$BASE_URL/api/files/read?pathname=users/mike/001.md\""
echo

echo "4. Monitor pm2 logs (in separate terminal):"
echo "pm2 logs devpages-4000 --lines 50 --nostream"
echo

echo "5. Watch for real-time logs:"
echo "pm2 logs devpages-4000 --lines 10"
echo

echo "=== Test JSON payload example ==="
cat << 'EOF'
{
  "pathname": "users/mike/001.md",
  "content": "# Test Markdown File\n\nThis is a test file.\n\n## Features\n- Created via API\n- Roundtrip testing\n- PM2 log monitoring\n"
}
EOF