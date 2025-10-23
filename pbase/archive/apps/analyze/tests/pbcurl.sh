#!/bin/bash
source local.env
METHOD=POST
URL=http://localhost:2650
ENDPOINT=analyze
KEY=gridranger
# Define a test payload with only InputURL
JSON='{
  "InputURL":"https://staging.pixeljamarcade.com"
 
}'

curl -X "$METHOD" "$URL/$ENDPOINT" \
    -H "x-api-key: $KEY" \
    -H "Content-Type: application/json" \
    -d "$JSON" \
    || echo "Curl request failed"
echo
