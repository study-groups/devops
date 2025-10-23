curl -X POST $PBASE_URL/test-playwright \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"InputURL": "'"$TEST_URL"'"}'
