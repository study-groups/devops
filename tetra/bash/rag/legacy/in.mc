#MULTICAT_START
# dir: /Users/mricos/src/bash/rag
# file: mcinfo.sh
# notes:
#MULTICAT_END
#!/bin/bash
# mcinfo.sh
# Summarizes a multicat file by listing each file block’s directory and filename, plus a total count.
set -euo pipefail

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


#MULTICAT_START
# dir: /Users/mricos/src/bash/rag
# file: multicat.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash
# multicat.sh — Concatenates files into MULTICAT format
set -euo pipefail

# --- Global ---
include_files=()
exclude_patterns=()
recursive=0
dryrun=0

# --- Helpers ---
usage() {
  echo "Usage: $0 [-r] [-x exclude.txt] [file|dir ...]"
  echo "  -r               Recurse into directories"
  echo "  -x <file>        Exclude patterns file"
  echo "  --dryrun         Show files that would be included"
  exit 1
}

array_to_regex() {
  local IFS="|"
  [[ $# -eq 0 ]] && echo '^$' || echo ".*($*)$"
}

load_excludes() {
  local path="$1"
  [[ -f "$path" ]] || return
  while IFS= read -r line; do
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
    exclude_patterns+=("$line")
  done < "$path"
}

resolve_files() {
  local item="$1"
  local resolved
  if ! resolved=$(realpath "$item" 2>/dev/null); then
    echo "Warning: cannot resolve $item" >&2; return
  fi

  if [[ -f "$resolved" ]]; then
    [[ "$resolved" =~ $exclude_regex ]] || echo "$resolved"
  elif [[ -d "$resolved" && $recursive -eq 1 ]]; then
    find "$resolved" -type f -print0 | while IFS= read -r -d '' f; do
      [[ "$f" =~ $exclude_regex ]] || realpath "$f"
    done
  elif [[ -d "$resolved" ]]; then
    echo "Skipping dir $resolved (use -r to recurse)" >&2
  fi
}

# --- Parse Arguments ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    -r) recursive=1 ;;
    -x) shift; load_excludes "$1" ;;
    --dryrun) dryrun=1 ;;
    -h|--help) usage ;;
    -*)
      echo "Unknown option: $1" >&2
      usage
      ;;
    *) include_files+=("$1") ;;
  esac
  shift
done

[[ ${#include_files[@]} -eq 0 ]] && usage

exclude_regex=$(array_to_regex "${exclude_patterns[@]}")

all_files=()
for item in "${include_files[@]}"; do
  while IFS= read -r f; do
    all_files+=("$f")
  done < <(resolve_files "$item")
done

if [[ $dryrun -eq 1 ]]; then
  printf "%s\n" "${all_files[@]}"
  exit 0
fi

# --- Output MULTICAT Format ---
for f in "${all_files[@]}"; do
  dir=$(dirname "$f")
  base=$(basename "$f")
  {
    echo "#MULTICAT_START"
    echo "# dir: $dir"
    echo "# file: $base"
    echo "# notes:"
    echo "#MULTICAT_END"
    cat "$f"
    echo
  }
done

#MULTICAT_START
# dir: /Users/mricos/src/bash/rag
# file: multisplit.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash
# multisplit.sh: Extract MULTICAT blocks from a file or stdin.

set -euo pipefail

CUTOFF_DIR="$(pwd)"
OUTPUT_ROOT="./"

safe_printf() {
  local fmt="$1"; shift
  [[ "$fmt" == -* ]] && fmt=" $fmt"
  printf "$fmt\n" "$@"
}

write_block() {
  local idx="$1" dir="$2" name="$3" body="$4" yolo="$5" print="$6"
  local rel="${dir#$CUTOFF_DIR}"
  rel="${rel#/}"
  local path="$OUTPUT_ROOT/$rel/$name"

  if [[ "$print" -eq 1 ]]; then
    safe_printf "------------------------------"
    safe_printf "file %d: %s" "$idx" "$name"
    safe_printf "location: %s" "$dir"
    safe_printf "------------------------------"
    safe_printf "%s" "$body"
    safe_printf "------------------------------"
    return
  fi

  mkdir -p "$(dirname "$path")"
  if [[ -f "$path" && "$yolo" -eq 0 ]]; then
    printf "File exists: %s\nOverwrite? [y/N]: " "$path"
    read -r ans </dev/tty || true
    ans=$(echo "$ans" | tr '[:upper:]' '[:lower:]')
    [[ "$ans" != "y" ]] && echo "Skipping $path" && return
  fi
  printf "%s" "$body" > "$path"
  echo "Wrote $path"
}

process_input() {
  local stream="$1" yolo="$2" print="$3"
  local idx=0 dir="" name="" content="" state="none"

  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$state" in
      none)
        [[ "$line" == "#MULTICAT_START" ]] && state="header"
        ;;
      header)
        [[ "$line" == "#MULTICAT_END" ]] && state="content"
        [[ "$line" == "# dir: "* ]] && dir="${line#"# dir: "}"
        [[ "$line" == "# file: "* ]] && name="${line#"# file: "}"
        ;;
      content)
        if [[ "$line" == "#MULTICAT_START" ]]; then
          idx=$((idx+1))
          write_block "$idx" "$dir" "$name" "$content" "$yolo" "$print"
          dir="" name="" content=""
          state="header"
        else
          content+="$line"$'\n'
        fi
        ;;
    esac
  done <<< "$stream"

  [[ "$state" == "content" ]] && idx=$((idx+1)) && write_block "$idx" "$dir" "$name" "$content" "$yolo" "$print"
}

show_help() {
  cat <<EOF
multisplit: Extract MULTICAT-defined files.

Usage:
  $0 [OPTIONS] INPUT_FILE|-    (use '-' for stdin)

Options:
  -y, --yolo     Overwrite files without prompting
  -p, --print    Print to stdout instead of writing files
  -h, --help     Show this help message

Examples:
  $0 out.mc
  $0 -y out.mc
  $0 -p -
  pbpaste | $0 -p -
EOF
}

main() {
  local yolo=0 print=0 input=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -y|--yolo) yolo=1 ;;
      -p|--print) print=1 ;;
      -h|--help) show_help; exit 0 ;;
      -*)
        echo "Unknown option: $1" >&2; exit 1
        ;;
      *)
        input="$1"
        ;;
    esac
    shift
  done

  if [[ -z "$input" ]]; then
    echo "Error: INPUT_FILE or '-' required" >&2
    show_help
    exit 1
  fi

  if [[ "$input" == "-" ]]; then
    process_input "$(cat)" "$yolo" "$print"
  elif [[ -f "$input" ]]; then
    process_input "$(cat "$input")" "$yolo" "$print"
  else
    echo "Invalid file: $input" >&2
    exit 1
  fi
}

main "$@"


