#!/bin/bash

# Roundtrip test for devpages file saving functionality
# Tests saving a file via API and monitoring pm2 logs for confirmation

BASE_URL="http://localhost:4000"
COOKIE_FILE="/tmp/devpages-cookies.txt"
TEST_FILE="users/mike/001.md"
TEST_CONTENT="# Test File

This is a test markdown file created via curl API.
Created at: $(date)

## Testing roundtrip functionality
- API endpoint: POST /api/files/save
- File path: $TEST_FILE
- Monitoring pm2 logs for confirmation
"

echo "=== DevPages File Save Roundtrip Test ==="
echo "Target file: $TEST_FILE"
echo

# Step 1: Login with credentials
echo "1. Logging in with credentials..."
login_response=$(curl -s -c "$COOKIE_FILE" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username": "mike", "password": "nigelt"}')

if echo "$login_response" | grep -q '"username":"mike"'; then
    echo "✓ Login successful"
    
    # Verify authentication
    auth_response=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/auth/user")
    if echo "$auth_response" | grep -q "username"; then
        username=$(echo "$auth_response" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
        echo "  Authenticated as: $username"
    fi
else
    echo "✗ Login failed"
    echo "  Response: $login_response"
    exit 1
fi

echo

# Step 2: Save the test file
echo "2. Saving test file via API..."
save_response=$(curl -s -b "$COOKIE_FILE" -X POST "$BASE_URL/api/files/save" \
    -H "Content-Type: application/json" \
    -d "{\"pathname\": \"$TEST_FILE\", \"content\": $(echo "$TEST_CONTENT" | jq -R -s .)}")

echo "Save response: $save_response"

if echo "$save_response" | grep -q '"success".*true'; then
    echo "✓ File save API call successful"
else
    echo "✗ File save API call failed"
fi

echo

# Step 3: Check pm2 logs for confirmation
echo "3. Checking pm2 logs for save confirmation..."
echo "Recent pm2 logs (last 20 lines):"
pm2 logs devpages-4000 --lines 20 --nostream | grep -E "(save|Save|API|$TEST_FILE)" || echo "No matching log entries found"

echo
echo "=== Test Complete ==="
echo "Monitor pm2 logs with: pm2 logs devpages-4000 --lines 50 --nostream"