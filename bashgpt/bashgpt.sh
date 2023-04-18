bashgpt() {
  local message="$1"
  local escaped_message=$(echo "$message" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g')

  local data=$(cat <<EOF
{
  "model": "gpt-3.5-turbo",
  "messages": [{"role": "user", "content": "$escaped_message"}]
}
EOF
)

  curl https://api.openai.com/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -d "$data" \
    | jq -r	
}



bashgpt2() {
  local message="$1"

  curl https://api.openai.com/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -d @- <<EOF
{
  "model": "gpt-3.5-turbo",
  "messages": [{"role": "user", "content": "$message"}]
}
EOF
}
