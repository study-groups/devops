#MULTICAT_START#
# dir: /Users/mricos/src/bash/rag
# file: replace.sh
# notes:
#MULTICAT_END#
replace() {
  local file="$1"

  if [[ -z "$file" || ! -f "$file" ]]; then
    echo "Usage: $0 <filename>  # Provide function via stdin"
    return 1
  fi

  # Read input function into an array
  mapfile -t new_func_lines
  if [[ ${#new_func_lines[@]} -eq 0 ]]; then
    echo "No function input provided via stdin."
    return 1
  fi

  # Detect function name from first or second line
  local first_line="${new_func_lines[0]}"
  local func_name
  if [[ "$first_line" =~ ^([a-zA-Z0-9_]+)[[:space:]]*\(\)[[:space:]]*\{?$ ]]; then
    func_name="${BASH_REMATCH[1]}"
  elif [[ "${#new_func_lines[@]}" -gt 1 && "${new_func_lines[1]}" =~ ^\{$ && "$first_line" =~ ^([a-zA-Z0-9_]+)[[:space:]]*\(\)[[:space:]]*$ ]]; then
    func_name="${BASH_REMATCH[1]}"
  else
    echo "Could not extract function name from input."
    echo "First line: '$first_line'"
    if [[ ${#new_func_lines[@]} -gt 1 ]]; then
      echo "Second line: '${new_func_lines[1]}'"
    fi
    return 1
  fi

  # Prepare new function code for awk by exporting it
  # This avoids issues with newlines and special characters in -v argument
  export AWK_REPLACE_NEW_FUNCTION_CODE
  AWK_REPLACE_NEW_FUNCTION_CODE="$(printf "%s\n" "${new_func_lines[@]}")"

  # Use awk to replace or append the function
  # The awk script will read AWK_REPLACE_NEW_FUNCTION_CODE from ENVIRON
  awk -v func="$func_name" '
    BEGIN {
      in_func = 0
      func_found = 0
      # Retrieve the new function code from the environment variable
      raw_new_code = ENVIRON["AWK_REPLACE_NEW_FUNCTION_CODE"]
      
      # Remove a single trailing newline that printf "%s\n" might have added.
      # This ensures that splitting by \n doesn'\''t create an unwanted empty last element
      # if the original input didn'\''t end with a completely blank line.
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
        # This brace counting logic needs to be robust for various function styles.
        current_line_stripped_braces = $0
        gsub(/[^\{\}]/, "", current_line_stripped_braces) # Keep only braces
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
      # Regex for func_name() { or func_name () {
      if ($0 ~ "^[[:space:]]*" func "[[:space:]]*\\(\\)[[:space:]]*\\{[[:space:]]*$") { # func() {
        in_func = 1
        brace_count = 0 
        temp_braces = $0; gsub(/[^\{\}]/, "", temp_braces)
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
      } else if ($0 ~ "^[[:space:]]*" func "[[:space:]]*\\(\\)[[:space:]]*$") { # func() (alone on a line)
        getline next_line 
        if (next_line ~ "^[[:space:]]*\\{[[:space:]]*$") { # next line is {
          in_func = 1
          brace_count = 0 
          temp_braces = next_line; gsub(/[^\{\}]/, "", temp_braces)
          for (j = 1; j <= length(temp_braces); j++) {
            if (substr(temp_braces, j, 1) == "{") brace_count++
            else if (substr(temp_braces, j, 1) == "}") brace_count--
          }
          
          func_found = 1
          print_new_code()
          # Do not print original $0 (func()) or next_line ({})
          if (brace_count <= 0) { 
              in_func = 0
          }
          next 
        } else {
          # Not the function we are looking for, or malformed (func() followed by not-{)
          print $0      # Print the func() line
          print next_line # Print the line we consumed
          next # Get a fresh line for the main loop, crucial after getline
        }
      }

      print $0 # Print lines that are not part of the function being replaced or handled above
    }

    END {
      if (!func_found) {
        # Add a newline before appending if the file doesn'\''t end with one (awk'\''s print adds one)
        # or if there was content printed before this.
        if (NR > 0 && prev_line_printed !~ /\n$/) print "" # Add a separator newline if file was not empty and last line didnt have NL
        print "# Function \"" func "\" not found. Appending new function."
        print_new_code()
      }
    }
    { prev_line_printed = $0 } # Keep track of last printed line for END block
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"

  # Unset the environment variable after use
  unset AWK_REPLACE_NEW_FUNCTION_CODE
  # Check if temp file exists, in case awk failed before creating it or mv failed
  if [ -f "$file.tmp" ]; then
    rm "$file.tmp"
  fi
}
