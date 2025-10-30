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

# Generic getter for QA configuration values
# Usage: _qa_get <var_name> <file_path>
_qa_get() {
  local var_name="$1"
  local file_path="$2"
  local -n var_ref="$var_name"

  if [[ -z "$var_ref" ]] && [[ -f "$file_path" ]]; then
    var_ref=$(cat "$file_path")
  fi
  echo "$var_ref"
}

# Convenience wrappers for specific configs
_get_openai_api() { _qa_get OPENAI_API "$OPENAI_API_FILE"; }
_get_qa_engine() { _qa_get QA_ENGINE "$QA_ENGINE_FILE"; }
_get_qa_context() { _qa_get QA_CONTEXT "$QA_CONTEXT_FILE"; }

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

# Unified input reading function
_qa_read_input() {
  local input

  if [[ "$1" == "-" ]]; then
    input=$(cat)
    shift
  elif [[ -n "$1" ]]; then
    input="$*"
  else
    input=$(cat)
    if [[ $? -ne 0 ]]; then
      echo "Error: Failed reading from stdin" >&2
      return 1
    fi
  fi

  if [[ -z "$input" ]]; then
    echo "Error: No input received" >&2
    return 1
  fi

  echo "$input"
}

qa_query() {
  local input
  input=$(_qa_read_input "$@") || return 1
  input=$(_qa_sanitize_input "$input")
  q_gpt_query "$input"
}

q_gpt_query ()
{
    echo "Using $(_get_qa_engine)" >&2
    local api_endpoint="https://api.openai.com/v1/chat/completions"
    local db="$QA_DIR/db"
    local id=$(date +%s)
    local input="$*"

    if [[ -z "$input" ]]; then
        echo "Error: No query provided" >&2
        return 1
    fi

    echo "$input" > "$db/$id.prompt"

    # Save metadata if provided via environment variable
    if [[ -n "${QA_FLOW_ID:-}" ]] || [[ -n "${QA_SOURCE:-}" ]]; then
        local metadata="{"
        metadata+="\"timestamp\":$id"
        metadata+=",\"created\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\""
        [[ -n "${QA_FLOW_ID:-}" ]] && metadata+=",\"flow_id\":\"$QA_FLOW_ID\""
        [[ -n "${QA_SOURCE:-}" ]] && metadata+=",\"source\":\"$QA_SOURCE\"" || metadata+=",\"source\":\"direct\""
        metadata+="}"
        echo "$metadata" > "$db/$id.metadata.json"
    fi

    input=$(_qa_sanitize_input "$input")
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

    # Output answer to stdout, timestamp to stderr for capture
    echo "QA_ID=$id" >&2
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
    local files=($(command ls --color=never "$db"/*.prompt 2>/dev/null | sort -n))
    if [[ ${#files[@]} -eq 0 ]]; then
        echo "No queries found" >&2
        return 1
    fi
    local last=$((${#files[@]}-1))
    local indexFromLast=$(_qa_sanitize_index $1)
    local index=$(($last-$indexFromLast))
    local file="${files[$index]}"
    # Strip ANSI color codes from file path
    file=$(echo "$file" | sed 's/\x1b\[[0-9;]*m//g')
    cat "$file"
}

qa_delete(){
    local id="$1"
    if [[ -z "$id" ]]; then
        echo "Error: No ID provided" >&2
        echo "Usage: qa_delete <id>" >&2
        return 1
    fi

    local files=("$QA_DIR/db/$id".*)
    if [[ ! -e "${files[0]}" ]]; then
        echo "Error: No files found for ID: $id" >&2
        return 1
    fi

    echo "Deleting: ${files[@]}" >&2
    rm -f "$QA_DIR/db/$id".*
}

a()
{
    # get the last answer
    local db="$QA_DIR/db"
    local files=($(command ls --color=never "$db"/*.answer 2>/dev/null | sort -n))
    if [[ ${#files[@]} -eq 0 ]]; then
        echo "No answers found" >&2
        return 1
    fi
    local last=$((${#files[@]}-1))
    local lastIndex=$((${#files[@]}-1))
    local indexFromLast=$(_qa_sanitize_index $1)
    local index=$(($lastIndex-$indexFromLast))
    local file="${files[$index]}"
    # Strip ANSI color codes from file path
    file=$(echo "$file" | sed 's/\x1b\[[0-9;]*m//g')
    local id=$(basename "$file" .answer)
    local info="[QA/global/$((index+1))/${lastIndex} $id]"

    printf "[$id: $(head -n 1 $db/$id.prompt | _truncate_middle )]"
    printf "\n\n"
    cat "$file"
    printf "\n$info\n"
}

qa_responses ()
{
    local db="$QA_DIR/db"
    local listing
    if ! listing=$(ls --color=never -1 "$db"/*.response 2>/dev/null); then
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
    # Format answer with TDS markdown renderer (via chroma wrapper)
    local chroma_cmd="bash ${TDS_SRC:-$(dirname "${BASH_SOURCE[0]}")/../tds}/chroma.sh"
    local file=$(a "$@" 2>/dev/null | grep -o "[0-9]*\.answer" | head -1)
    if [[ -n "$file" ]]; then
        $chroma_cmd "$QA_DIR/db/$file"
    else
        a "$@"
    fi
}

# Functions are available when module is loaded via lazy loading
# No need to export since tetra handles module loading
