tetra_typst_watch() {
  local input_file="$1"
  local output_file="${input_file%.typ}.pdf"

  if [[ ! -f "$input_file" ]]; then
    echo "Input file does not exist: $input_file"
    return 1
  fi

  while true; do
    inotifywait -e modify "$input_file"
    typst compile "$input_file" -o "$output_file"
  done
}
