#OPENAI_API_KEY="your-api-key"
#PROMPT="A painting of a cat"

tetra_openai_prompt_to_image(){
  echo "Assumes OPENAI_API_KEY=$OPENAI_API_KEY"
  echo "Assumes PROMPT=$PROMPT"
  echo "Assumes CONTENT=$CONTEXT"

MODEL="clip-dall-e/medium"
MAX_WIDTH=512
MAX_HEIGHT=512

# Make a request to the OpenAI API using the generic endpoint for image generation
curl -X POST "https://api.openai.com/v1/images/generations" \
     -H "Authorization: Bearer $OPENAI_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "prompt": "'"$CONTEXT"'",
       "prompt": "'"$PROMPT"'",
       "size": "'"$MAX_WIDTH"x"$MAX_HEIGHT"'"
     }'

}
