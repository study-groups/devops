#!/usr/bin/env bash
# ast_go.sh - Go AST operations using go/ast tools

set -euo pipefail

# Convert Go to JSON AST (requires custom Go tool)
go_to_ast() {
  # This would require a custom Go program to output AST as JSON
  # For now, placeholder that shows the concept
  echo "Error: go_to_ast not implemented yet" >&2
  echo "Would use: go-ast-tool --to-json < input.go" >&2
  return 1
}

# Convert JSON AST back to Go
ast_to_go() {
  echo "Error: ast_to_go not implemented yet" >&2
  echo "Would use: go-ast-tool --from-json < input.json" >&2
  return 1
}

# Replace or append function in Go file using gofmt and basic parsing
go_replace_function() {
  local replace_only=0

  # Parse flags
  while [[ "$1" == -* ]]; do
    case "$1" in
      -r|--replace-only) replace_only=1 ;;
      --) shift; break ;;
      *) echo "Unknown flag: $1" >&2; return 1 ;;
    esac
    shift
  done

  local file="$1"
  [[ -z "$file" || ! -f "$file" ]] && { echo "Usage: $FUNCNAME [-r|--replace-only] <file>" >&2; return 1; }
  shift

  local tmpfn
  tmpfn=$(mktemp)
  cat > "$tmpfn"

  # Extract function name using basic regex (temporary solution)
  local fn_name
  fn_name=$(grep -E '^func\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(' "$tmpfn" | head -1 | sed -E 's/^func\s+([a-zA-Z_][a-zA-Z0-9_]*).*/\1/')

  if [[ -z "$fn_name" ]]; then
    echo "Error: No function declaration found in input" >&2
    rm -f "$tmpfn"
    return 1
  fi

  # Find function in target file using basic pattern matching
  local start_line end_line brace_count=0 in_func=0
  start_line=$(grep -n "^func\s\+$fn_name\s*(" "$file" | cut -d: -f1 | head -1)

  if [[ -z "$start_line" ]]; then
    if (( replace_only )); then
      echo "Function '$fn_name' not found in $file (strict mode)." >&2
      rm -f "$tmpfn"
      return 1
    else
      # Append
      cat "$file"
      echo
      cat "$tmpfn"
      rm -f "$tmpfn"
      return 0
    fi
  fi

  # Find function end by counting braces (simplified approach)
  local line_num="$start_line"
  while IFS= read -r line; do
    if (( line_num >= start_line )); then
      # Count braces to find function end
      local open_braces=$(echo "$line" | tr -cd '{' | wc -c)
      local close_braces=$(echo "$line" | tr -cd '}' | wc -c)
      brace_count=$((brace_count + open_braces - close_braces))
      
      if (( brace_count == 0 && line_num > start_line )); then
        end_line="$line_num"
        break
      fi
    fi
    ((line_num++))
  done < "$file"

  if [[ -z "$end_line" ]]; then
    echo "Error: Could not find end of function '$fn_name'" >&2
    rm -f "$tmpfn"
    return 1
  fi

  # Replace function region
  {
    head -n $((start_line - 1)) "$file"
    cat "$tmpfn"
    tail -n +"$((end_line + 1))" "$file"
  } | gofmt

  rm -f "$tmpfn"
}

# List all functions in a Go file
go_list_functions() {
  local file="$1"
  [[ -z "$file" || ! -f "$file" ]] && { echo "Usage: $FUNCNAME <file>" >&2; return 1; }

  grep -n "^func\s\+[a-zA-Z_][a-zA-Z0-9_]*\s*(" "$file" | sed 's/:/ (line /'| sed 's/$/)/'
}

# Extract specific function from Go file
go_extract_function() {
  local file="$1"
  local fn_name="$2"
  [[ -z "$file" || ! -f "$file" || -z "$fn_name" ]] && { 
    echo "Usage: $FUNCNAME <file> <function_name>" >&2; return 1; 
  }

  # Find function start
  local start_line
  start_line=$(grep -n "^func\s\+$fn_name\s*(" "$file" | cut -d: -f1 | head -1)

  if [[ -z "$start_line" ]]; then
    echo "Function '$fn_name' not found in $file" >&2
    return 1
  fi

  # Find function end by counting braces
  local line_num="$start_line" brace_count=0 end_line
  while IFS= read -r line; do
    if (( line_num >= start_line )); then
      local open_braces=$(echo "$line" | tr -cd '{' | wc -c)
      local close_braces=$(echo "$line" | tr -cd '}' | wc -c)
      brace_count=$((brace_count + open_braces - close_braces))
      
      if (( brace_count == 0 && line_num > start_line )); then
        end_line="$line_num"
        break
      fi
    fi
    ((line_num++))
  done < "$file"

  if [[ -z "$end_line" ]]; then
    echo "Error: Could not find end of function '$fn_name'" >&2
    return 1
  fi

  sed -n "${start_line},${end_line}p" "$file"
}

# Note: Full Go AST support would require:
# 1. A custom Go program that uses go/ast, go/parser, go/format
# 2. JSON serialization of the AST
# 3. Precise function replacement based on AST nodes
# This is a simplified implementation for the tutorial