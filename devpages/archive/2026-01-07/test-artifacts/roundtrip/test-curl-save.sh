#!/bin/bash
# test-curl-save.sh - Test save functionality with curl using extracted cookies

echo "🧪 Testing curl save functionality with cookies"

COOKIE_FILE="/tmp/devpages-cookies.txt"
BASE_URL="http://localhost:4000"

# Check if cookie file exists
if [ ! -f "$COOKIE_FILE" ]; then
    echo "❌ Cookie file not found: $COOKIE_FILE"
    echo "📝 To create it:"
    echo "1. Open browser dev console on devpages"
    echo "2. Run: extractCookiesForCurl()"
    echo "3. Copy the cookie file content to $COOKIE_FILE"
    exit 1
fi

echo "🍪 Using cookies from: $COOKIE_FILE"

# Test 1: List files (to verify auth works)
echo -e "\n📂 Test 1: List files"
curl -s -b "$COOKIE_FILE" \
     "$BASE_URL/api/files/list?pathname=users/mike" | \
     python3 -m json.tool 2>/dev/null || echo "Raw response: $(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/files/list?pathname=users/mike")"

# Test 2: Get file content
echo -e "\n📄 Test 2: Get file content" 
curl -s -b "$COOKIE_FILE" \
     "$BASE_URL/api/files/content?pathname=users/mike/001.md" | \
     head -3

# Test 3: Save file
echo -e "\n💾 Test 3: Save file via curl"
TEST_CONTENT="# Curl Save Test

This file was saved via curl using extracted cookies.
Timestamp: $(date)

## Testing save functionality
- Using cookies from browser session
- Bypassing UI issues
- Direct API call
"

curl -s -b "$COOKIE_FILE" \
     -H "Content-Type: application/json" \
     -X POST \
     -d "{\"pathname\":\"users/mike/curl-test.md\",\"content\":$(echo "$TEST_CONTENT" | python3 -c "import sys, json; print(json.dumps(sys.stdin.read()))")}" \
     "$BASE_URL/api/files/save" | \
     python3 -m json.tool 2>/dev/null || echo "Raw response: $(curl -s -b "$COOKIE_FILE" -H "Content-Type: application/json" -X POST -d "{\"pathname\":\"users/mike/curl-test.md\",\"content\":$(echo "$TEST_CONTENT" | python3 -c "import sys, json; print(json.dumps(sys.stdin.read()))")}" "$BASE_URL/api/files/save")"

# Test 4: Verify the file was saved
echo -e "\n✅ Test 4: Verify file was saved"
curl -s -b "$COOKIE_FILE" \
     "$BASE_URL/api/files/content?pathname=users/mike/curl-test.md" | \
     head -5

echo -e "\n🏁 Curl save test completed"