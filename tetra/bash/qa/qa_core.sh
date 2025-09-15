#!/usr/bin/env bash

# QA Core Functions - Extracted from original qa.sh

# Utility function for truncating text in the middle
_truncate_middle() {
  local input

  if [[ -n "$1" ]]; then
    input="$1"
  else
    input="$(cat)"
  fi

  # Set default COLUMNS if not set
  local cols=${COLUMNS:-80}
  local maxwidth=$((cols - 2))
  local len=${#input}

  if (( len <= maxwidth )); then
    echo "$input"
  else
    local keep=$(( (maxwidth - 3) / 2 ))
    local start="${input:0:keep}"
    local end="${input: -keep}"
    echo "${start}...${end}"
  fi
}

_get_openai_api() {
  if [[ -z "$OPENAI_API" ]] && [[ -f "$OPENAI_API_FILE" ]]; then
    OPENAI_API=$(cat "$OPENAI_API_FILE")
  fi
  echo "$OPENAI_API"
}

_get_qa_engine() {
  if [[ -z "$QA_ENGINE" ]] && [[ -f "$QA_ENGINE_FILE" ]]; then
    QA_ENGINE=$(cat "$QA_ENGINE_FILE")
  fi
  echo "$QA_ENGINE"
}

_get_qa_context() {
  if [[ -z "$QA_CONTEXT" ]] && [[ -f "$QA_CONTEXT_FILE" ]]; then
    QA_CONTEXT=$(cat "$QA_CONTEXT_FILE")
  fi
  echo "$QA_CONTEXT"
}

_qa_sanitize_index ()
{
    local index=$1
    if [[ -z "$index" ]]; then
	     index=0
    fi
    echo "$index"
}

_qa_sanitize_input()
{
    local input=$1
    # 1. Remove leading and trailing whitespace
    input=$(echo "$input" | awk '{$1=$1};1')

    # 2. Remove non-printable characters
    input=$(echo "$input" | tr -cd '[:print:]')

    # 3. Escape special characters
    #   Note: This is not a complete list of special characters
    input=$(echo "$input" | sed -e 's/"/\\\\"/g')

    # 4. Replace line breaks and tabs with spaces, preserving \n
    input=$(echo "$input" | sed -e 's/\t/ /g' -e 's/\n/\\n/g')

    # 5. Additional custom sanitation can be added here
    echo "$input"
}

qa_query() {
  local input

  if [[ "$1" == "-" ]]; then
    echo "Reading input from stdin (via placeholder '-')." >&2
    input=$(cat)
    shift
  elif [[ ! -z "$1" ]]; then
    echo "Reading input from command line arguments." >&2
    input="$*"
  else
    echo "Reading input from stdin." >&2
    input=$(cat)
  fi

  if [[ -z "$input" ]]; then
    echo "No input received." >&2
    return 1
  fi

  input=$(_qa_sanitize_input "$input")

  q_gpt_query "$input"
}

q_gpt_query ()
{
    #set -x # Keep tracing for now, can remove later

    echo "Using $(_get_qa_engine)" >&2
    local api_endpoint="https://api.openai.com/v1/chat/completions"
    local db="$QA_DIR/db"
    local id=$(date +%s)
    local input

    # --- REVERTED INPUT HANDLING ---
    if [[ -n "$1" ]]; then
        echo "Reading input from command line arguments." >&2
        input="$@"
    else
        # This will now read from stdin provided by Node's spawn
        echo "Reading input from stdin." >&2
        input=$(cat)
        if [ $? -ne 0 ]; then
             echo "[qa.sh ERROR] Failed reading from stdin." >&2
             return 1
        fi
        echo "Finished reading from stdin." >&2
    fi
    # --- END REVERTED INPUT HANDLING ---

    echo "$input" > "$db/$id.prompt"
    input=$(_qa_sanitize_input "$input") # Use the existing sanitize function
    local data
    data=$(jq -nc --arg model "$(_get_qa_engine)" \
                   --arg content "$input" \
   '{
     model: $model,
     messages: [ {
                   role: "user",
                   content: $content
                 }
               ]
   }')

   echo "$data" > "$db/$id.data"

    # Construct curl command using an array
    local curl_cmd=(
        curl -s --connect-timeout 10 -X POST "$api_endpoint"
        -H "Authorization: Bearer $(_get_openai_api)"
        -H "Content-Type: application/json" -d "$data"
    )

    local response
    response=$("${curl_cmd[@]}")

    if [ $? -ne 0 ]; then
        echo "Curl command failed. Check the API endpoint connection."
        return 1
    fi

    echo "$response" > "$db/$id.response"
    local answer=$(echo "$response" | jq -r '.choices[0].message.content')

    if [[ -z "$answer" || "$answer" == "null" ]]; then
        echo "No valid answer received or response is null."  > "$db/$id.answer"
        return 1
    fi

    echo "$answer" > "$db/$id.answer"
    echo "$answer" # Always output the final answer to stdout
    
    #set +x # Disable command tracing before exiting
} 

# Show documentation
qa_help() {
    cat <<EOF
   Q&A Command Line Tool Documentation:
   ------------------------------------
   qa help          - Show this documentation.
   qa status        - Display current system status.
   qa set-engine    - Set the Q&A engine (default: OpenAI).
   qa set-apikey    - Set the API key for the Q&A engine.
   qa set-context   - Set default context for queries.
   qa last          - Most recent answer
   qa query         - Query with detailed output
   qa repl          - Start interactive REPL

EOF
}

# Display current system status
qa_status() {
    echo
    echo "  Query and Answer system, ver 008"
    echo
    echo "API Key file: $OPENAI_API_FILE"
    echo "API Key: $(_get_openai_api)"
    echo "Engine: $(_get_qa_engine)"
    echo "Context: $(_get_qa_context)"
    echo "Database: $QA_DIR/db"
}

# Set the API key for the Q&A engine
qa_set_apikey() {
    if [[ -z "$1" ]]; then
        echo "Error: API key cannot be empty" >&2
        return 1
    fi
    # Create directory if it doesn't exist
    mkdir -p "$(dirname "$OPENAI_API_FILE")"
    # Set secure permissions
    echo "$1" > "$OPENAI_API_FILE"
    chmod 600 "$OPENAI_API_FILE"
    OPENAI_API="$1"
}

# Set the Q&A engine (default: OpenAI)
qa_set_engine() {
    QA_ENGINE="$1"
    echo "$QA_ENGINE" > "$QA_ENGINE_FILE"
}

# Set default context for queries
qa_set_context() {
    echo "$1" > "$QA_CONTEXT_FILE"
    QA_CONTEXT="$1"
}

# List and select an engine from OpenAI's available engines
qa_select_engine() {
    local engines=$(curl -s \
      -H "Authorization: Bearer $(_get_openai_api)" \
      "https://api.openai.com/v1/engines")

    echo "Available Engines:"
    echo "$engines" | jq -r '.data[].id'

    echo "Enter the engine you want to use: "
    read selected_engine

    # Validate if the selected engine is in the list
    if echo "$engines" | jq -r '.data[].id' | \
        grep -qx "$selected_engine"; then
        qa_set_engine "$selected_engine"
    else
        echo "Invalid engine selected."
    fi
}

# Initialize system
q-init() {
    # Ensure the db directory exists
    mkdir -p "$QA_DIR/db"       # all queries and responses
}

q() {
    # get the last question
    local db="$QA_DIR/db"
    local files=($(ls "$db"/*.prompt 2>/dev/null | sort -n))
    if [[ ${#files[@]} -eq 0 ]]; then
        echo "No queries found" >&2
        return 1
    fi
    local last=$((${#files[@]}-1))
    local indexFromLast=$(_qa_sanitize_index $1)
    local index=$(($last-$indexFromLast))
    cat "${files[$index]}"
}

qa_delete(){
    echo rm $QA_DIR/db/$1.*
}

a()
{
    # get the last answer
    local db="$QA_DIR/db"
    local files=($(ls "$db"/*.answer 2>/dev/null | sort -n))
    if [[ ${#files[@]} -eq 0 ]]; then
        echo "No answers found" >&2
        return 1
    fi
    local last=$((${#files[@]}-1))
    local lastIndex=$((${#files[@]}-1))
    local indexFromLast=$(_qa_sanitize_index $1)
    local index=$(($lastIndex-$indexFromLast))
    local file="${files[$index]}"
    local id=$(basename $file .answer)
    local info="[QA/global/$((index+1))/${lastIndex}${file} ]"

    printf "[$id: $(head -n 1 $db/$id.prompt | _truncate_middle )]"
    printf "\n\n"
    cat $file
    printf "\n$info\n"
}

qa_responses ()
{
    local db="$QA_DIR/db"
    local listing
    if ! listing=$(ls -1 "$db"/*.response 2>/dev/null); then
        echo "No responses found" >&2
        return 1
    fi
    local filenames=""
    readarray -t filenames <<< "$listing"
    for i in "${!filenames[@]}"
    do
        local msg=$(head -n 1 "${filenames[$i]}")
        echo "$((i+1))) ${filenames[$i]}: $msg"
    done
}

qa_test(){
  qq what is the fastest land animal?
  a
}

fa(){
    a "$@" | glow
}

# Functions are available when module is loaded via lazy loading
# No need to export since tetra handles module loading
