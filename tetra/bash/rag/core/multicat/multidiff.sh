#!/usr/bin/env bash
# multdiff.sh — Expand diff blocks in a MULTICAT file using disk content.

set -euo pipefail

expand_diff() {
  local dir="$1"
  local file="$2"
  local patch="$3"

  local path="$dir/$file"
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
    if [[ "$line" == "#MULTICAT_START" ]]; then
      in_block=1
      mode="full"
      requires="no"
      note=""
      dir=""
      file=""
      content=""
      continue
    elif [[ "$line" == "#MULTICAT_END" ]]; then
      if [[ "$mode" == "diff" ]]; then
        expanded=$(expand_diff "$dir" "$file" "$content") || status=$?
        if [[ "$expanded" == "__MISSING__" ]]; then
          requires="true"
          note="suspicious"
        elif [[ "$expanded" == "__FAILED__" ]]; then
          echo "Failed to apply patch to $dir/$file" >&2
          exit 1
        else
          content="$expanded"
          mode="full"
        fi
      fi

      echo "#MULTICAT_START"
      echo "# dir: $dir"
      echo "# file: $file"
      [[ "$mode" == "diff" ]] && echo "# mode: diff"
      [[ "$requires" == "true" ]] && echo "# requires: true"
      [[ -n "$note" ]] && echo "# note: $note"
      echo "#MULTICAT_END"
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
