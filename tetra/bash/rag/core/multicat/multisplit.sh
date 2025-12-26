#!/usr/bin/env bash
# multisplit.sh - Interactively recreates files from a multicat stream.

# Don't execute main logic if script is being sourced
[[ "${BASH_SOURCE[0]}" != "${0}" ]] && return 0

# --- Debug helper ---
_ms_debug() {
    [[ ${MS_DEBUG:-0} -eq 1 ]] && echo "DEBUG: $*" >&2
}

# --- Functions ---
display_help() {
  local script_name
  script_name=$(basename "$0")
  cat <<EOF
multisplit: Splits a multicat stream back into original files or to stdout.

Usage: ${script_name} [OPTIONS] [INPUT_FILE]

Options:
  -y           Create files and directories. Will ask before overwriting.
  -Y           Create files and directories. Overwrites without asking.
  -n, --dryrun Show what would be extracted without writing files.
  -h, --help   Display this help message.

Environment:
  MS_DEBUG=1   Enable verbose debug output to stderr.

Description:
  Reads a multicat stream from an INPUT_FILE or stdin.

  - By default, it prints all file contents to stdout for piping and shows
    which files are being processed on stderr.
  - Use -y to extract files to the current directory.
  - Use -Y to force overwriting of existing files.
  - Use -n/--dryrun to preview extraction without writing.
EOF
}

# --- Argument & Option Parsing ---
CREATE_FILES=0
OVERWRITE_ALL=0
DRYRUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -y) CREATE_FILES=1; shift ;;
    -Y) CREATE_FILES=1; OVERWRITE_ALL=1; shift ;;
    -n|--dryrun) DRYRUN=1; shift ;;
    -h|--help) display_help; exit 0 ;;
    -*) echo "Invalid option: $1" >&2; display_help; exit 1 ;;
    *) break ;;
  esac
done

# --- Main Execution ---
[[ ${MS_DEBUG:-0} -eq 1 ]] && echo "multisplit.sh: Starting..." >&2

# AWK script parses the multicat stream and outputs a NUL-delimited
# sequence: path\0content\0path\0content\0...
AWK_SCRIPT='
BEGIN { state="scan"; debug=ENVIRON["MS_DEBUG"]+0 }

function dbg(msg) {
    if (debug) print "DEBUG: " msg > "/dev/stderr"
}

function flush_block() {
    if (full_path != "") {
        sub(/^\n/, "", content_buffer)
        # Output using %c,0 for portable NUL bytes
        printf "%s%c%s%c", full_path, 0, content_buffer, 0
    }
}

# Normalize CRLF lines
{ sub(/\r$/, "") }

# Block start
/^[[:space:]]*#MULTICAT_START[[:space:]]*$/ {
    flush_block()
    state="header"; dir=""; file=""; full_path=""; content_buffer=""
    dbg("Found #MULTICAT_START. State: header")
    next
}

# End of input
END {
    dbg("END block reached. Flushing last record.")
    flush_block()
    dbg("AWK parsing complete. Total lines read: " NR)
}

# Block header end
/^[[:space:]]*#MULTICAT_END[[:space:]]*$/ {
    state="content"
    if (dir != "" && file != "") {
        full_path = dir "/" file
        gsub(/\/\//, "/", full_path)
        dbg("Found #MULTICAT_END. Path: " full_path)
    } else {
        print "Warning: Malformed header. Dir=" dir ", File=" file > "/dev/stderr"
        state="scan"
    }
    next
}

state == "header" {
    if (match($0, /^#[[:space:]]*dir:[[:space:]]*/)) {
        dir = substr($0, RSTART + RLENGTH)
        dbg("Parsed dir: " dir)
    }
    if (match($0, /^#[[:space:]]*file:[[:space:]]*/)) {
        file = substr($0, RSTART + RLENGTH)
        dbg("Parsed file: " file)
    }
    next
}

state == "content" && full_path != "" {
    content_buffer = content_buffer $0 ORS
}
'

# --- Logic to handle parsed output ---
process_stream() {
  local file_count=0
  local bytes_total=0

  while IFS= read -r -d "" path && IFS= read -r -d "" content; do
    file_count=$((file_count + 1))
    local size=${#content}
    bytes_total=$((bytes_total + size))

    # Dryrun mode: just show what would be extracted
    if [[ ${DRYRUN} -eq 1 ]]; then
      local status="new"
      [[ -e "${path}" ]] && status="exists"
      printf "%-8s %6d bytes  %s\n" "[$status]" "$size" "${path}"
      continue
    fi

    echo "Processing: ${path}" >&2

    if [[ ${CREATE_FILES} -eq 0 ]]; then
      printf '%s' "${content}"
    else
      local should_write=0
      if [[ ! -e "${path}" ]]; then
        should_write=1
      elif [[ ${OVERWRITE_ALL} -eq 1 ]]; then
        echo "Overwriting: ${path}" >&2
        should_write=1
      else
        read -p "Overwrite '${path}'? (y/N) " -n 1 reply </dev/tty
        echo >&2
        if [[ "${reply}" =~ ^[Yy]$ ]]; then
          echo "Overwriting: ${path}" >&2
          should_write=1
        else
          echo "Skipping: ${path}" >&2
        fi
      fi

      if [[ ${should_write} -eq 1 ]]; then
        mkdir -p "$(dirname "${path}")"
        printf '%s' "${content}" > "${path}"
        echo "Created: ${path}" >&2
      fi
    fi
  done

  # Dryrun summary
  if [[ ${DRYRUN} -eq 1 ]]; then
    echo "---" >&2
    echo "Total: ${file_count} files, ${bytes_total} bytes" >&2
  fi
}

# Determine input source
if [ "$#" -gt 0 ]; then
    input_file="$1"
    _ms_debug "Reading from file: ${input_file}"
    if [ ! -f "$input_file" ]; then
        echo "Error: Input file not found: ${input_file}" >&2
        exit 1
    fi
    awk "${AWK_SCRIPT}" "$input_file" | process_stream
else
    _ms_debug "Reading from stdin..."
    awk "${AWK_SCRIPT}" | process_stream
fi

_ms_debug "Finished."
exit 0
