#!/usr/bin/env bash
# multidiff.sh — Expand diff blocks in a MULTICAT file using disk content.

# Source shared MULTICAT library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/libmulticat.sh"

expand_diff() {
  local dir="$1"
  local file="$2"
  local patch="$3"

  local path
  path=$(mc_fullpath "$dir" "$file")
  if [[ ! -f "$path" ]]; then
    echo "__MISSING__"
    return 1
  fi

  if ! expanded=$(patch --silent --merge "$path" <<< "$patch" 2>/dev/null); then
    echo "__FAILED__"
    return 2
  fi

  echo "$expanded"
  return 0
}

process_multicat() {
  local in_block=0
  local mode=full requires=no note=
  local dir= file= content=

  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == "$MC_START" ]]; then
      in_block=1
      mode="full"
      requires="no"
      note=""
      dir=""
      file=""
      content=""
      continue
    elif [[ "$line" == "$MC_END" ]]; then
      if [[ "$mode" == "diff" ]]; then
        expanded=$(expand_diff "$dir" "$file" "$content") || status=$?
        if [[ "$expanded" == "__MISSING__" ]]; then
          requires="true"
          note="suspicious"
        elif [[ "$expanded" == "__FAILED__" ]]; then
          echo "Failed to apply patch to $(mc_fullpath "$dir" "$file")" >&2
          exit 1
        else
          content="$expanded"
          mode="full"
        fi
      fi

      # Output using library constants
      echo "$MC_START"
      echo "# dir: $dir"
      echo "# file: $file"
      [[ "$mode" == "diff" ]] && echo "# mode: diff"
      [[ "$requires" == "true" ]] && echo "# requires: true"
      [[ -n "$note" ]] && echo "# note: $note"
      echo "$MC_END"
      printf "%s\n\n" "$content"
      in_block=0
      continue
    fi

    if [[ "$in_block" -eq 1 ]]; then
      case "$line" in
        "# dir: "*) dir="${line#"# dir: "}" ;;
        "# file: "*) file="${line#"# file: "}" ;;
        "# mode: "*) mode="${line#"# mode: "}" ;;
        *) content+="$line"$'\n' ;;
      esac
    fi
  done
}

process_multicat
