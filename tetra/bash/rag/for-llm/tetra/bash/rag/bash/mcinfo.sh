#!/bin/bash
# mcinfo.sh
# Summarizes a multicat file by listing each file block's directory and filename, plus a total count.
set -euo pipefail

# Don't execute main logic if script is being sourced
[[ "${BASH_SOURCE[0]}" != "${0}" ]] && return 0

display_help() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS] <multicat_file>
Options:
  -h, --help    Display this help message.
EOF
}

if [[ $# -eq 0 ]]; then
  display_help
  exit 1
fi

if [[ "$1" == "-h" || "$1" == "--help" ]]; then
  display_help
  exit 0
fi

input_file="$1"

if [[ ! -f "$input_file" ]]; then
  echo "Error: Input file '$input_file' not found." >&2
  exit 1
fi

block_count=0
in_block=0
file_dir=""
file_name=""

while IFS= read -r line; do
  if [[ "$line" == "#MULTICAT_START#" ]]; then
    in_block=1
    file_dir=""
    file_name=""
    continue
  elif [[ "$line" == "#MULTICAT_END#" ]]; then
    in_block=0
    block_count=$((block_count + 1))
    printf "[%d] Dir: %s, File: %s\n" "$block_count" "$file_dir" "$file_name"
    continue
  fi
  if [[ $in_block -eq 1 ]]; then
    if [[ "$line" == "# dir: "* ]]; then
      file_dir="${line#"# dir: "}"
    elif [[ "$line" == "# file: "* ]]; then
      file_name="${line#"# file: "}"
    fi
  fi
done < "$input_file"

echo "Total file blocks: $block_count"

