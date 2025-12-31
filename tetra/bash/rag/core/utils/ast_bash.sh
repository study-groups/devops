#!/usr/bin/env bash
# ast_bash.sh - Bash-specific AST operations
# Uses tree-sitter (via bash/lib/treesitter.sh) when available,
# falls back to pure bash 5.2+ regex parsing

# Source tree-sitter module if available
_AST_TREESITTER_LOADED=false
if [[ -f "${TETRA_SRC:-}/bash/lib/treesitter.sh" ]]; then
    source "${TETRA_SRC}/bash/lib/treesitter.sh"
    _AST_TREESITTER_LOADED=true
fi

# Check if tree-sitter is available for bash
_ast_has_treesitter() {
    $_AST_TREESITTER_LOADED && ts_available bash
}

# Extract a single function from a bash file
# Usage: bash_extract_function <file> <func_name>
bash_extract_function() {
  local file="$1"
  local func_name="$2"

  if [[ -z "$file" || ! -f "$file" ]]; then
    echo "Error: File not found: $file" >&2
    return 1
  fi

  if [[ -z "$func_name" ]]; then
    echo "Error: Function name required" >&2
    return 1
  fi

  # Try tree-sitter first if available
  if _ast_has_treesitter; then
    local result
    result=$(ts_extract_function "$file" "$func_name" 2>/dev/null)
    if [[ $? -eq 0 && -n "$result" ]]; then
      echo "$result"
      return 0
    fi
    # Fall through to pure bash
  fi

  # Pure bash 5.2+ fallback
  local in_func=0
  local brace_count=0
  local found=0
  local line trimmed name

  while IFS= read -r line || [[ -n "$line" ]]; do
    if ((in_func == 0)); then
      # Check for function definition patterns
      trimmed="${line#"${line%%[![:space:]]*}"}"  # ltrim

      # Pattern 1: funcname() {
      if [[ "$trimmed" =~ ^([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*\(\)[[:space:]]*\{ ]]; then
        name="${BASH_REMATCH[1]}"
        if [[ "$name" == "$func_name" ]]; then
          found=1
          in_func=1
          brace_count=0
          # Count braces in this line
          local temp="${line//[^\{\}]/}"
          local i
          for ((i=0; i<${#temp}; i++)); do
            [[ "${temp:$i:1}" == "{" ]] && ((brace_count++))
            [[ "${temp:$i:1}" == "}" ]] && ((brace_count--))
          done
          printf '%s\n' "$line"
          ((brace_count <= 0)) && break
          continue
        fi
      fi

      # Pattern 2: funcname() alone (brace on next line)
      if [[ "$trimmed" =~ ^([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*\(\)[[:space:]]*$ ]]; then
        name="${BASH_REMATCH[1]}"
        if [[ "$name" == "$func_name" ]]; then
          found=1
          in_func=1
          brace_count=0
          printf '%s\n' "$line"
          continue
        fi
      fi
    else
      # Inside function - count braces
      local temp="${line//[^\{\}]/}"
      local i
      for ((i=0; i<${#temp}; i++)); do
        [[ "${temp:$i:1}" == "{" ]] && ((brace_count++))
        [[ "${temp:$i:1}" == "}" ]] && ((brace_count--))
      done
      printf '%s\n' "$line"
      ((brace_count <= 0)) && break
    fi
  done < "$file"

  if ((found == 0)); then
    echo "Error: Function \"$func_name\" not found" >&2
    return 1
  fi
  return 0
}

# List all function names in a bash file
# Usage: bash_list_functions <file>
bash_list_functions() {
  local file="$1"

  if [[ -z "$file" || ! -f "$file" ]]; then
    echo "Error: File not found: $file" >&2
    return 1
  fi

  # Try tree-sitter first if available
  if _ast_has_treesitter; then
    local result
    result=$(ts_list_functions "$file" 2>/dev/null)
    if [[ $? -eq 0 && -n "$result" ]]; then
      echo "$result"
      return 0
    fi
    # Fall through to pure bash
  fi

  # Pure bash 5.2+ fallback
  local -A seen
  local line trimmed name peek_next=0 pending_name=""

  while IFS= read -r line || [[ -n "$line" ]]; do
    trimmed="${line#"${line%%[![:space:]]*}"}"  # ltrim

    # Check if previous line was funcname() alone
    if ((peek_next)); then
      peek_next=0
      if [[ "$trimmed" =~ ^\{[[:space:]]*$ ]]; then
        if [[ -z "${seen[$pending_name]:-}" ]]; then
          echo "$pending_name"
          seen[$pending_name]=1
        fi
      fi
      pending_name=""
    fi

    # Pattern 1: function funcname() { or function funcname {
    if [[ "$trimmed" =~ ^function[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*(\(\))?[[:space:]]*\{? ]]; then
      name="${BASH_REMATCH[1]}"
      if [[ -z "${seen[$name]:-}" ]]; then
        echo "$name"
        seen[$name]=1
      fi
      continue
    fi

    # Pattern 2: funcname() {
    if [[ "$trimmed" =~ ^([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*\(\)[[:space:]]*\{ ]]; then
      name="${BASH_REMATCH[1]}"
      if [[ -z "${seen[$name]:-}" ]]; then
        echo "$name"
        seen[$name]=1
      fi
      continue
    fi

    # Pattern 3: funcname() alone (need to peek at next line)
    if [[ "$trimmed" =~ ^([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*\(\)[[:space:]]*$ ]]; then
      pending_name="${BASH_REMATCH[1]}"
      peek_next=1
      continue
    fi
  done < "$file"
}

# Replace a function in a bash file (reads new function from stdin)
# Usage: echo "$new_func" | bash_replace_function <file>
bash_replace_function() {
  local file="$1"

  if [[ -z "$file" || ! -f "$file" ]]; then
    echo "Error: File not found: $file" >&2
    return 1
  fi

  # Read input function
  local -a new_func_lines
  mapfile -t new_func_lines

  if [[ ${#new_func_lines[@]} -eq 0 ]]; then
    echo "Error: No function input provided via stdin" >&2
    return 1
  fi

  # Detect function name from first line
  local first_line="${new_func_lines[0]}"
  local trimmed="${first_line#"${first_line%%[![:space:]]*}"}"
  local func_name=""

  # Extract function name
  if [[ "$trimmed" =~ ^function[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*) ]]; then
    func_name="${BASH_REMATCH[1]}"
  elif [[ "$trimmed" =~ ^([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*\(\) ]]; then
    func_name="${BASH_REMATCH[1]}"
  else
    echo "Error: Could not extract function name from input" >&2
    echo "First line: '$first_line'" >&2
    return 1
  fi

  # Read original file
  local -a original_lines
  mapfile -t original_lines < "$file"

  # Find and replace function
  local in_func=0
  local brace_count=0
  local func_found=0
  local -a output_lines
  local line trimmed name

  for line in "${original_lines[@]}"; do
    if ((in_func)); then
      # Count braces
      local temp="${line//[^\{\}]/}"
      local i
      for ((i=0; i<${#temp}; i++)); do
        [[ "${temp:$i:1}" == "{" ]] && ((brace_count++))
        [[ "${temp:$i:1}" == "}" ]] && ((brace_count--))
      done
      ((brace_count <= 0)) && in_func=0
      # Skip old function lines
      continue
    fi

    trimmed="${line#"${line%%[![:space:]]*}"}"

    # Check if this line starts the function we're replacing
    local is_match=0

    # Pattern 1: funcname() {
    if [[ "$trimmed" =~ ^([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*\(\)[[:space:]]*\{ ]]; then
      name="${BASH_REMATCH[1]}"
      [[ "$name" == "$func_name" ]] && is_match=1
    fi

    # Pattern 2: function funcname() { or function funcname {
    if ((is_match == 0)) && [[ "$trimmed" =~ ^function[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*) ]]; then
      name="${BASH_REMATCH[1]}"
      [[ "$name" == "$func_name" ]] && is_match=1
    fi

    if ((is_match)); then
      # Insert new function
      for new_line in "${new_func_lines[@]}"; do
        output_lines+=("$new_line")
      done
      func_found=1

      # Start counting braces for old function
      in_func=1
      brace_count=0
      local temp="${line//[^\{\}]/}"
      local i
      for ((i=0; i<${#temp}; i++)); do
        [[ "${temp:$i:1}" == "{" ]] && ((brace_count++))
        [[ "${temp:$i:1}" == "}" ]] && ((brace_count--))
      done
      ((brace_count <= 0)) && in_func=0
      continue
    fi

    output_lines+=("$line")
  done

  # If function not found, append it
  if ((func_found == 0)); then
    output_lines+=("")
    output_lines+=("# Function \"$func_name\" not found. Appending new function.")
    for new_line in "${new_func_lines[@]}"; do
      output_lines+=("$new_line")
    done
  fi

  # Write output
  printf '%s\n' "${output_lines[@]}" > "$file"
}

# Legacy compatibility wrappers
bash_to_ast() {
  echo "Error: bash_to_ast not yet implemented" >&2
  return 1
}

ast_to_bash() {
  echo "Error: ast_to_bash not yet implemented" >&2
  return 1
}

bash_ast_pathvars() {
  echo "Error: bash_ast_pathvars not yet implemented" >&2
  return 1
}
