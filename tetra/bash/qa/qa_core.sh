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

# =============================================================================
# ENTRY FILE EXTENSIONS
# =============================================================================

# All file extensions for a QA entry
# Used by promote, move, clear, export operations
QA_ENTRY_EXTENSIONS=(prompt answer data response meta metadata.json)

# Subset of extensions for views (RAG export - no raw API data)
QA_VIEW_EXTENSIONS=(prompt answer meta metadata.json)

# Get all existing files for an entry
# Usage: _qa_entry_files <dir> <id>
# Returns: list of existing file paths (one per line)
_qa_entry_files() {
    local dir="$1"
    local id="$2"
    for ext in "${QA_ENTRY_EXTENSIONS[@]}"; do
        [[ -f "$dir/$id.$ext" ]] && echo "$dir/$id.$ext"
    done
}

# Copy all files for an entry to destination
# Usage: _qa_entry_copy <src_dir> <id> <dest_dir>
_qa_entry_copy() {
    local src_dir="$1" id="$2" dest_dir="$3"
    local count=0
    for ext in "${QA_ENTRY_EXTENSIONS[@]}"; do
        [[ -f "$src_dir/$id.$ext" ]] && cp "$src_dir/$id.$ext" "$dest_dir/" && ((count++))
    done
    echo "$count"
}

# Move all files for an entry to destination
# Usage: _qa_entry_move <src_dir> <id> <dest_dir>
_qa_entry_move() {
    local src_dir="$1" id="$2" dest_dir="$3"
    local count=0
    for ext in "${QA_ENTRY_EXTENSIONS[@]}"; do
        [[ -f "$src_dir/$id.$ext" ]] && mv "$src_dir/$id.$ext" "$dest_dir/" && ((count++))
    done
    echo "$count"
}

# Count entries in a directory
# Usage: _qa_count_entries <dir>
_qa_count_entries() {
    local dir="$1"
    local -a files=("$dir"/*.prompt)
    [[ -e "${files[0]}" ]] && echo "${#files[@]}" || echo 0
}

# Validate channel name (alphanumeric, dash, underscore)
# Usage: _qa_validate_channel <name>
_qa_validate_channel() {
    local name="$1"
    if [[ ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo "Invalid channel name '$name': use a-z, 0-9, _, -" >&2
        return 1
    fi
}

# Get channel directory path
# Usage: _qa_get_channel_dir <channel>
# Returns: path to channel directory
_qa_get_channel_dir() {
    local channel="$1"
    local base="${QA_DIR:-$TETRA_DIR/qa}"

    case "$channel" in
        db|main|"")
            echo "$base/db"
            ;;
        [0-9]|[0-9][0-9])
            echo "$base/channels/$channel"
            ;;
        *)
            echo "$base/channels/$channel"
            ;;
    esac
}

# Platform-agnostic date calculation
# Usage: _qa_date_ago <spec>
# Examples: _qa_date_ago 1d, _qa_date_ago 2h, _qa_date_ago yesterday
_qa_date_ago() {
    local spec="$1"

    # Try GNU date first (Linux), then BSD date (macOS)
    if date --version &>/dev/null 2>&1; then
        # GNU date
        case "$spec" in
            yesterday) date -d 'yesterday' +%s ;;
            *h) date -d "${spec%h} hours ago" +%s ;;
            *d) date -d "${spec%d} days ago" +%s ;;
            *) date -d "$spec" +%s 2>/dev/null || echo 0 ;;
        esac
    else
        # BSD/macOS date
        case "$spec" in
            yesterday) date -v-1d +%s ;;
            *h) date -v-"${spec%h}"H +%s ;;
            *d) date -v-"${spec%d}"d +%s ;;
            *) date -jf "%Y-%m-%d" "$spec" +%s 2>/dev/null || echo 0 ;;
        esac
    fi
}

# Get all entry IDs from a channel, sorted by time
# Usage: _qa_get_entry_ids <channel>
_qa_get_entry_ids() {
    local channel="$1"
    local dir="$(_qa_get_channel_dir "$channel")"
    ls -1 "$dir"/*.prompt 2>/dev/null |
        sed 's/.*\///' | sed 's/\.prompt$//' | sort -n
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

# Show documentation (deprecated - use `qa` with no args for org-style help)
qa_help() {
    qa
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

# Get question - wrapper around _q_channel with smart argument parsing
# Usage:
#   q              - Last question from db
#   q 3            - 3rd from last in db
#   q myproject    - Last question from channel 'myproject'
#   q myproject 2  - 2nd from last in channel 'myproject'
q() {
    # No args: db, index 0
    if [[ -z "$1" ]]; then
        _q_channel db 0
        return
    fi

    # Pure number: db with index
    if [[ "$1" =~ ^[0-9]+$ ]]; then
        _q_channel db "$1"
        return
    fi

    # Channel name (with optional @ prefix)
    local channel="${1#@}"
    shift
    _q_channel "$channel" "${1:-0}"
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

# Get answer - wrapper around _a_channel with smart argument parsing
# Usage:
#   a              - Last answer from db
#   a 3            - 3rd from last in db
#   a myproject    - Last answer from channel 'myproject'
#   a myproject 2  - 2nd from last in channel 'myproject'
#   a @foo         - Last answer from channel 'foo' (@ prefix)
a() {
    # No args: db, index 0
    if [[ -z "$1" ]]; then
        _a_channel db 0
        return
    fi

    # Pure number: db with index
    if [[ "$1" =~ ^[0-9]+$ ]]; then
        _a_channel db "$1"
        return
    fi

    # Channel name (with optional @ prefix)
    local channel="${1#@}"
    shift
    _a_channel "$channel" "${1:-0}"
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

# List QA entries in numbered list format for chroma pattern rendering
# Usage: qa_list [--truncate] [count]
# Output: numbered list suitable for chroma pattern rendering
qa_list() {
    local db="$QA_DIR/db"
    local truncate_flag=""
    local count=10

    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --truncate|-t) truncate_flag="--truncate"; shift ;;
            [0-9]*) count="$1"; shift ;;
            *) shift ;;
        esac
    done

    local files
    mapfile -t files < <(ls -t "$db"/*.answer 2>/dev/null | head -"$count")

    if [[ ${#files[@]} -eq 0 ]]; then
        echo "No answers found" >&2
        return 1
    fi

    # Build markdown list
    local i=1
    local output=""
    for file in "${files[@]}"; do
        local id=$(basename "$file" .answer)
        local prompt=""
        [[ -f "$db/$id.prompt" ]] && prompt=$(head -n 1 "$db/$id.prompt")
        # Clean prompt for display
        prompt="${prompt//[$'\n\r']/}"
        output+="$i. $id – $prompt"$'\n'
        ((i++))
    done

    # Pipe through chroma if available
    if declare -f chroma &>/dev/null; then
        echo "$output" | chroma -m 4 $truncate_flag
    else
        echo "$output"
    fi
}

# Show answer with chroma rendering
# Usage: fa [index]
fa() {
    local db="$QA_DIR/db"
    local files
    mapfile -t files < <(ls -t "$db"/*.answer 2>/dev/null)

    if [[ ${#files[@]} -eq 0 ]]; then
        echo "No answers found" >&2
        return 1
    fi

    local index="${1:-0}"
    local file="${files[$index]}"
    [[ -z "$file" || ! -f "$file" ]] && { echo "No answer at index $index" >&2; return 1; }

    local id=$(basename "$file" .answer)
    local total=${#files[@]}
    local prompt=""
    [[ -f "$db/$id.prompt" ]] && prompt=$(head -n 1 "$db/$id.prompt")

    # Build output with header + answer content
    local output=""
    output+="[$id: $prompt]"$'\n'
    output+=$'\n'
    output+=$(cat "$file")
    output+=$'\n'
    output+="[QA/global/$((index+1))/$total $id]"

    # Pipe through chroma if available
    if declare -f chroma &>/dev/null; then
        echo "$output" | chroma -m 4
    else
        echo "$output"
    fi
}

# =============================================================================
# EXPORTS
# =============================================================================

export QA_ENTRY_EXTENSIONS QA_VIEW_EXTENSIONS

export -f _truncate_middle _qa_get
export -f _get_openai_api _get_qa_engine _get_qa_context
export -f _qa_entry_files _qa_entry_copy _qa_entry_move
export -f _qa_count_entries _qa_validate_channel _qa_get_channel_dir _qa_date_ago
export -f _qa_get_entry_ids _qa_sanitize_index _qa_sanitize_input
export -f _qa_read_input qa_query q_gpt_query
export -f qa_help qa_status qa_set_apikey qa_set_engine qa_set_context
export -f q a qa_delete qa_responses qa_test qa_list fa
