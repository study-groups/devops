#!/bin/bash

# Replaces a Go function in a file with new code.
#
# Usage:
# replace_go_function <file_path> <function_name> <new_function_code>
#
function replace_go_function() {
  local file_path="$1"
  local func_name="$2"
  local new_code="$3"
  
  # Check if the file exists
  if [[ ! -f "$file_path" ]]; then
    echo "Error: File not found at '$file_path'"
    return 1
  fi

  # Use awk to perform the replacement. This is safer than sed for multi-line blocks.
  # It uses a flag 'in_func' to track when it's inside the function-to-be-replaced.
  awk -v name="$func_name" -v new_code="$new_code" '
    BEGIN {
      # This regex will match the function signature, e.g., "func myFunc("
      start_pattern = "func " name "\\("
      # This regex will match the closing brace of a top-level function
      end_pattern = "^}"
      in_func = 0
    }

    # If we are inside the bad function and find its closing brace...
    $0 ~ end_pattern && in_func == 1 {
      in_func = 0        # Turn the flag off.
      print new_code     # Print the new, good function.
      next               # Skip printing the old closing brace.
    }

    # If we are inside the bad function, skip the line.
    in_func == 1 {
      next
    }

    # If we find the start of the bad function...
    $0 ~ start_pattern {
      in_func = 1        # Turn the flag on.
      next               # Skip printing the old function signature.
    }

    # For any other line, just print it as is.
    { print }
  ' "$file_path" > "${file_path}.tmp" && mv "${file_path}.tmp" "$file_path"
  
  echo "Function '$func_name' in '$file_path' has been replaced."
}
