#!/usr/bin/env bash
# error.sh - Standardized error handling for RAG module
#
# Provides consistent error reporting and handling across all RAG modules

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"

# Error codes
declare -r ERR_GENERAL=1
declare -r ERR_NOT_FOUND=2
declare -r ERR_INVALID_ARG=3
declare -r ERR_NO_FLOW=4
declare -r ERR_NO_SESSION=5
declare -r ERR_NO_EVIDENCE=6
declare -r ERR_FILE_NOT_FOUND=7
declare -r ERR_COMMAND_FAILED=8

# Error with message and optional hint
rag_error() {
    local code="${1:?Error code required}"
    local msg="${2:?Error message required}"
    local hint="${3:-}"

    echo "Error: $msg" >&2

    if [[ -n "$hint" ]]; then
        echo "" >&2
        echo "Hint: $hint" >&2
    fi

    return "$code"
}

# No active flow error with suggestions
rag_error_no_flow() {
    local hint="To create a flow:
  rag flow create \"your question\"

Or use no-flow mode:
  rag quick \"question\" file1.sh file2.js

To resume an existing flow:
  rag flow list      # See available flows
  rag flow resume 1  # Resume by number"

    rag_error "$ERR_NO_FLOW" "No active flow" "$hint"
}

# No active session error
rag_error_no_session() {
    local hint="To create a session:
  rag session create \"your workspace\"

To resume an existing session:
  rag session list      # See available sessions
  rag session resume 1  # Resume by number"

    rag_error "$ERR_NO_SESSION" "No active session" "$hint"
}

# File not found error
rag_error_file_not_found() {
    local file="$1"
    rag_error "$ERR_FILE_NOT_FOUND" "File not found: $file"
}

# Invalid argument error
rag_error_invalid_arg() {
    local arg="$1"
    local expected="${2:-}"

    local msg="Invalid argument: $arg"
    [[ -n "$expected" ]] && msg="$msg (expected: $expected)"

    rag_error "$ERR_INVALID_ARG" "$msg"
}

# Command failed error
rag_error_command_failed() {
    local command="$1"
    local reason="${2:-}"

    local msg="Command failed: $command"
    [[ -n "$reason" ]] && msg="$msg - $reason"

    rag_error "$ERR_COMMAND_FAILED" "$msg"
}

# Warn without exiting
rag_warn() {
    local msg="$1"
    echo "Warning: $msg" >&2
}

# Info message
rag_info() {
    local msg="$1"
    echo "$msg"
}

# Success message
rag_success() {
    local msg="$1"
    echo "✓ $msg"
}

# Export functions
export -f rag_error
export -f rag_error_no_flow
export -f rag_error_no_session
export -f rag_error_file_not_found
export -f rag_error_invalid_arg
export -f rag_error_command_failed
export -f rag_warn
export -f rag_info
export -f rag_success

# Export error codes
export ERR_GENERAL ERR_NOT_FOUND ERR_INVALID_ARG ERR_NO_FLOW ERR_NO_SESSION ERR_NO_EVIDENCE ERR_FILE_NOT_FOUND ERR_COMMAND_FAILED
