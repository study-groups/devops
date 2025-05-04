curl -X POST $PBASE_URL/analyze  -H "x-api-key: $PBASE_API_KEY" \
 -H "Content-Type: application/json" \
 -d '{"InputURL": "https://www.example.com"}'
echo
