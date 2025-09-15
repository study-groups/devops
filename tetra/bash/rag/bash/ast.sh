#!/usr/bin/env bash
# ast.sh - Language-agnostic AST dispatcher and legacy function wrappers

set -euo pipefail

# Get the directory where this script resides
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source language-specific AST modules
source "$SCRIPT_DIR/ast_bash.sh"
source "$SCRIPT_DIR/ast_go.sh"

# Detect language from file extension
detect_language() {
  local file="$1"
  case "${file##*.}" in
    sh|bash) echo "bash" ;;
    go) echo "go" ;;
    js|ts|jsx|tsx) echo "javascript" ;;
    md|markdown) echo "markdown" ;;
    *) echo "unknown" ;;
  esac
}

# Generic function replacement dispatcher
ast_replace_function() {
  local file="$1"
  shift
  
  local lang
  lang=$(detect_language "$file")
  
  case "$lang" in
    bash) bash_replace_function "$file" "$@" ;;
    go) go_replace_function "$file" "$@" ;;
    *) echo "Error: Language '$lang' not supported for function replacement" >&2; return 1 ;;
  esac
}

# Generic function listing dispatcher
ast_list_functions() {
  local file="$1"
  
  local lang
  lang=$(detect_language "$file")
  
  case "$lang" in
    bash) bash_list_functions "$file" ;;
    go) go_list_functions "$file" ;;
    *) echo "Error: Language '$lang' not supported for function listing" >&2; return 1 ;;
  esac
}

# Generic function extraction dispatcher
ast_extract_function() {
  local file="$1"
  local fn_name="$2"
  
  local lang
  lang=$(detect_language "$file")
  
  case "$lang" in
    bash) bash_extract_function "$file" "$fn_name" ;;
    go) go_extract_function "$file" "$fn_name" ;;
    *) echo "Error: Language '$lang' not supported for function extraction" >&2; return 1 ;;
  esac
}

# Legacy wrapper functions for backward compatibility
rag_bash_ast() {
  bash_to_ast
}

rag_ast_bash() {
  ast_to_bash
}

rag_ast_pathvars() {
  bash_ast_pathvars
}

rag_ast_patchfn() {
  bash_replace_function "$@"
}
 
