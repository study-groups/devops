function tetra_functions() {
  echo "Scanning for functions starting with 'tetra_'" >&2
  mapfile -t tetra_funcs < <(declare -F | awk '{print $3}' | grep -E '^tetra_')
  echo "Found ${#tetra_funcs[@]} function(s) matching pattern 'tetra_*'" >&2

  if [[ ${#tetra_funcs[@]} -eq 0 ]]; then
    echo "No matching functions found." >&2
    return 1
  fi

  if [[ "$1" == "all" ]]; then
    echo "Function Definitions:"
    echo "---------------------"
    for fname in "${tetra_funcs[@]}"; do
      declare -f "$fname"
      echo
    done
  else
    echo "Matching Function Names:"
    echo "------------------------"
    for fname in "${tetra_funcs[@]}"; do
      echo "$fname"
    done
  fi
}
