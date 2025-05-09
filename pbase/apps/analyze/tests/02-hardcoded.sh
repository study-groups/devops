curl -X POST http://localhost:5200/analyze \
  -H "x-api-key: gridranger" \
  -H "Content-Type: application/json" \
  -d '{"InputURL": "https://www.example.com"}'
