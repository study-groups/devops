#!/usr/bin/env bash
# ast_go.sh - Go-specific AST operations for function parsing and replacement

# Extract a single function from a Go file
go_extract_function() {
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

    # Match Go function definition patterns
    # Pattern 1: func FuncName(...) ... {
    # Pattern 2: func (receiver Type) FuncName(...) ... {
    $0 ~ "^[[:space:]]*func[[:space:]]+(\\([^)]+\\)[[:space:]]+)?" func "[[:space:]]*\\(" {
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

# List all function names in a Go file
go_list_functions() {
  local file="$1"

  if [[ -z "$file" || ! -f "$file" ]]; then
    echo "Error: File not found: $file" >&2
    return 1
  fi

  # Extract function names using Go patterns
  awk '
    # Pattern 1: func FuncName(...)
    /^[[:space:]]*func[[:space:]]+[A-Za-z0-9_]+[[:space:]]*\(/ {
      match($0, /func[[:space:]]+([A-Za-z0-9_]+)[[:space:]]*\(/, arr)
      if (arr[1] != "") print arr[1]
      next
    }

    # Pattern 2: func (receiver Type) FuncName(...)
    /^[[:space:]]*func[[:space:]]+\([^)]+\)[[:space:]]+[A-Za-z0-9_]+[[:space:]]*\(/ {
      match($0, /func[[:space:]]+\([^)]+\)[[:space:]]+([A-Za-z0-9_]+)[[:space:]]*\(/, arr)
      if (arr[1] != "") print arr[1]
      next
    }
  ' "$file" | sort -u
}

# Replace a function in a Go file (reads new function from stdin)
go_replace_function() {
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

  # Detect function name from first line
  local first_line="${new_func_lines[0]}"
  local func_name

  # Try to extract function name from Go patterns
  if [[ "$first_line" =~ func[[:space:]]+\([^)]+\)[[:space:]]+([A-Za-z0-9_]+)[[:space:]]*\( ]]; then
    # Pattern: func (receiver Type) FuncName(...)
    func_name="${BASH_REMATCH[1]}"
  elif [[ "$first_line" =~ func[[:space:]]+([A-Za-z0-9_]+)[[:space:]]*\( ]]; then
    # Pattern: func FuncName(...)
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

      # Match Go function definition
      # Pattern 1: func FuncName(...) ... {
      # Pattern 2: func (receiver Type) FuncName(...) ... {
      if ($0 ~ "^[[:space:]]*func[[:space:]]+(\\([^)]+\\)[[:space:]]+)?" func "[[:space:]]*\\(") {
        in_func = 1
        brace_count = 0

        # Count braces on signature line
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
      }

      print $0 # Print lines that are not part of the function being replaced
    }

    END {
      if (!func_found) {
        # Append new function if not found
        print ""
        print "// Function \"" func "\" not found. Appending new function."
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
