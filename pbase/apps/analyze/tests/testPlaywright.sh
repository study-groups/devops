testUrl="${1:-'https://www.example.com'}"
curl -X POST $PBASE_URL/test-playwright \
  -H "x-api-key: $PBASE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"InputURL": "$testUrl"}'
