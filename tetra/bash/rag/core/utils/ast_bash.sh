#!/usr/bin/env bash
# ast_bash.sh - Bash-specific AST operations for function parsing and replacement

# Extract a single function from a bash file
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

  awk -v func="$func_name" '
    BEGIN {
      in_func = 0
      brace_count = 0
      found = 0
    }

    # Match function definition patterns
    # Pattern 1: func() {
    $0 ~ "^[[:space:]]*" func "[[:space:]]*\\(\\)[[:space:]]*\\{" {
      found = 1
      in_func = 1
      brace_count = 0

      # Count braces on this line
      temp = $0
      gsub(/[^\{\}]/, "", temp)
      for (i = 1; i <= length(temp); i++) {
        if (substr(temp, i, 1) == "{") brace_count++
        else if (substr(temp, i, 1) == "}") brace_count--
      }

      print $0

      if (brace_count <= 0) {
        in_func = 0
        exit
      }
      next
    }

    # Pattern 2: func()\n{
    $0 ~ "^[[:space:]]*" func "[[:space:]]*\\(\\)[[:space:]]*$" {
      found = 1
      in_func = 1
      brace_count = 0
      print $0
      next
    }

    in_func {
      # Count braces
      temp = $0
      gsub(/[^\{\}]/, "", temp)
      for (i = 1; i <= length(temp); i++) {
        if (substr(temp, i, 1) == "{") brace_count++
        else if (substr(temp, i, 1) == "}") brace_count--
      }

      print $0

      if (brace_count <= 0) {
        in_func = 0
        exit
      }
    }

    END {
      if (!found) {
        print "Error: Function \"" func "\" not found" > "/dev/stderr"
        exit 1
      }
    }
  ' "$file"
}

# List all function names in a bash file
bash_list_functions() {
  local file="$1"

  if [[ -z "$file" || ! -f "$file" ]]; then
    echo "Error: File not found: $file" >&2
    return 1
  fi

  # Extract function names using multiple patterns
  awk '
    # Pattern 1: function func_name() {
    /^[[:space:]]*function[[:space:]]+[a-zA-Z0-9_]+[[:space:]]*\(\)[[:space:]]*\{?[[:space:]]*$/ {
      match($0, /function[[:space:]]+([a-zA-Z0-9_]+)/, arr)
      if (arr[1] != "") print arr[1]
      next
    }

    # Pattern 2: func_name() {
    /^[[:space:]]*[a-zA-Z0-9_]+[[:space:]]*\(\)[[:space:]]*\{/ {
      match($0, /^[[:space:]]*([a-zA-Z0-9_]+)[[:space:]]*\(\)/, arr)
      if (arr[1] != "") print arr[1]
      next
    }

    # Pattern 3: func_name() on its own line (followed by { on next line)
    /^[[:space:]]*[a-zA-Z0-9_]+[[:space:]]*\(\)[[:space:]]*$/ {
      match($0, /^[[:space:]]*([a-zA-Z0-9_]+)[[:space:]]*\(\)/, arr)
      if (arr[1] != "") {
        # Peek ahead to confirm next line is {
        getline next_line
        if (next_line ~ /^[[:space:]]*\{[[:space:]]*$/) {
          print arr[1]
        }
      }
    }
  ' "$file" | sort -u
}

# Replace a function in a bash file (reads new function from stdin)
bash_replace_function() {
  local file="$1"

  if [[ -z "$file" || ! -f "$file" ]]; then
    echo "Error: File not found: $file" >&2
    return 1
  fi

  # Read input function into an array
  mapfile -t new_func_lines
  if [[ ${#new_func_lines[@]} -eq 0 ]]; then
    echo "Error: No function input provided via stdin" >&2
    return 1
  fi

  # Detect function name from first or second line
  local first_line="${new_func_lines[0]}"
  local func_name

  # Try multiple patterns to extract function name
  if [[ "$first_line" =~ ^[[:space:]]*function[[:space:]]+([a-zA-Z0-9_]+)[[:space:]]*\(\) ]]; then
    # Pattern: function func_name()
    func_name="${BASH_REMATCH[1]}"
  elif [[ "$first_line" =~ ^[[:space:]]*([a-zA-Z0-9_]+)[[:space:]]*\(\)[[:space:]]*\{?$ ]]; then
    # Pattern: func_name() { or func_name()
    func_name="${BASH_REMATCH[1]}"
  else
    echo "Error: Could not extract function name from input" >&2
    echo "First line: '$first_line'" >&2
    return 1
  fi

  # Prepare new function code for awk by exporting it
  export AWK_REPLACE_NEW_FUNCTION_CODE
  AWK_REPLACE_NEW_FUNCTION_CODE="$(printf "%s\n" "${new_func_lines[@]}")"

  # Use awk to replace or append the function
  awk -v func="$func_name" '
    BEGIN {
      in_func = 0
      func_found = 0
      brace_count = 0

      # Retrieve the new function code from the environment variable
      raw_new_code = ENVIRON["AWK_REPLACE_NEW_FUNCTION_CODE"]

      # Remove trailing newline
      sub(/\n$/, "", raw_new_code)

      # Split the new function code into lines
      split(raw_new_code, new_lines, "\n")
    }

    function print_new_code() {
      for (i = 1; i <= length(new_lines); i++) {
        print new_lines[i]
      }
    }

    {
      if (in_func) {
        # Count braces on this line
        current_line_stripped_braces = $0
        gsub(/[^\{\}]/, "", current_line_stripped_braces)
        for (j = 1; j <= length(current_line_stripped_braces); j++) {
          char = substr(current_line_stripped_braces, j, 1)
          if (char == "{") brace_count++
          else if (char == "}") brace_count--
        }
        if (brace_count <= 0) {
          in_func = 0
        }
        next # Skip printing this old line
      }

      # Match function definition (covers func() { and func()\n{ styles)
      # Also handle "function func_name()" style
      if ($0 ~ "^[[:space:]]*(function[[:space:]]+)?" func "[[:space:]]*\\(\\)[[:space:]]*\\{[[:space:]]*$") {
        # func() { or function func() {
        in_func = 1
        brace_count = 0
        temp_braces = $0
        gsub(/[^\{\}]/, "", temp_braces)
        for (j = 1; j <= length(temp_braces); j++) {
          if (substr(temp_braces, j, 1) == "{") brace_count++
          else if (substr(temp_braces, j, 1) == "}") brace_count--
        }

        func_found = 1
        print_new_code()
        if (brace_count <= 0) {
          in_func = 0
        }
        next
      } else if ($0 ~ "^[[:space:]]*(function[[:space:]]+)?" func "[[:space:]]*\\(\\)[[:space:]]*$") {
        # func() or function func() (alone on a line)
        getline next_line
        if (next_line ~ "^[[:space:]]*\\{[[:space:]]*$") {
          # next line is {
          in_func = 1
          brace_count = 0
          temp_braces = next_line
          gsub(/[^\{\}]/, "", temp_braces)
          for (j = 1; j <= length(temp_braces); j++) {
            if (substr(temp_braces, j, 1) == "{") brace_count++
            else if (substr(temp_braces, j, 1) == "}") brace_count--
          }

          func_found = 1
          print_new_code()
          # Do not print original $0 or next_line
          if (brace_count <= 0) {
            in_func = 0
          }
          next
        } else {
          # Not the function we are looking for
          print $0
          print next_line
          next
        }
      }

      print $0 # Print lines that are not part of the function being replaced
    }

    END {
      if (!func_found) {
        # Append new function if not found
        print ""
        print "# Function \"" func "\" not found. Appending new function."
        print_new_code()
      }
    }
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"

  local status=$?

  # Unset the environment variable after use
  unset AWK_REPLACE_NEW_FUNCTION_CODE

  # Clean up temp file if it exists
  if [[ -f "$file.tmp" ]]; then
    rm "$file.tmp"
  fi

  return $status
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
