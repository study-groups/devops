#MULTICAT_START
# dir: .
# file: multisplit.sh
# notes:
#MULTICAT_END
#!/usr/bin/env bash
# multisplit.sh - Interactively recreates files from a multicat stream.

set -euo pipefail

# Don't execute main logic if script is being sourced
[[ "${BASH_SOURCE[0]}" != "${0}" ]] && return 0

# --- Functions ---
display_help() {
  local script_name
  script_name=$(basename "$0")
  cat <<EOF
multisplit: Splits a multicat stream back into original files or to stdout.

Usage: ${script_name} [OPTIONS] [INPUT_FILE]

Options:
  -y          Create files and directories. Will ask before overwriting.
  -Y          Create files and directories. Overwrites existing files without asking.
  -h, --help  Display this help message.

Description:
  Reads a multicat stream from an INPUT_FILE or stdin.

  - By default, it prints all file contents to stdout for piping and shows
    which files are being processed on stderr.
  - Use -y to extract files to the current directory.
  - Use -Y to force overwriting of existing files.
EOF
}

# --- Argument & Option Parsing ---
CREATE_FILES=0
OVERWRITE_ALL=0

while getopts ":yYh" opt; do
  case ${opt} in
    y) CREATE_FILES=1 ;;
    Y) CREATE_FILES=1; OVERWRITE_ALL=1 ;;
    h) display_help; exit 0 ;;
    \?) echo "Invalid option: -$OPTARG" >&2; display_help; exit 1 ;;
  esac
done
shift $((OPTIND -1)) # Remove parsed options

# --- Main Execution ---
echo "multisplit.sh: Starting..." >&2

# AWK script parses the multicat stream and outputs a NUL-delimited
# sequence: path\0content\0path\0content\0...
AWK_SCRIPT='
BEGIN { state="scan" }

function flush_block() {
    if (full_path != "") {
        sub(/^\n/, "", content_buffer)
        # Output using %c,0 for portable NUL bytes
        printf "%s%c%s%c", full_path, 0, content_buffer, 0
    }
}

# Normalize CRLF lines
/.\r?$/ { sub(/\r$/, "") }

# Block start
/^[[:space:]]*#MULTICAT_START[[:space:]]*$/ {
    flush_block()
    state="header"; dir=""; file=""; full_path=""; content_buffer=""
    print "DEBUG: Found #MULTICAT_START. State: header" > "/dev/stderr"
    next
}

# End of input
END {
    print "DEBUG: END block reached. Flushing last record." > "/dev/stderr"
    flush_block()
    print "DEBUG: AWK parsing complete. Total lines read: " NR > "/dev/stderr"
}

# Block header end
/^[[:space:]]*#MULTICAT_END[[:space:]]*$/ {
    state="content"
    if (dir != "" && file != "") {
        full_path = dir "/" file
        gsub(/\/\//, "/", full_path)
        print "DEBUG: Found #MULTICAT_END. Path constructed: \047" full_path "\047" > "/dev/stderr"
    } else {
        print "Warning: Malformed header. Dir=\047" dir "\047, File=\047" file "\047" > "/dev/stderr"
        state="scan"
    }
    next
}

state == "header" {
    if (match($0, /^#[[:space:]]*dir: /)) {
        dir = substr($0, RSTART + RLENGTH)
        print "DEBUG: Parsed dir: \047" dir "\047" > "/dev/stderr"
    }
    if (match($0, /^#[[:space:]]*file: /)) {
        file = substr($0, RSTART + RLENGTH)
        print "DEBUG: Parsed file: \047" file "\047" > "/dev/stderr"
    }
    next
}

state == "content" && full_path != "" {
    content_buffer = content_buffer $0 ORS
}
'

# --- Logic to handle parsed output ---
process_stream() {
  while IFS= read -r -d "" path && IFS= read -r -d "" content; do
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
}

# Determine input source
if [ "$#" -gt 0 ]; then
    input_file="$1"
    echo "DEBUG: Reading from file argument: ${input_file}" >&2
    if [ ! -f "$input_file" ]; then
        echo "Error: Input file not found: ${input_file}" >&2
        exit 1
    fi
    awk "${AWK_SCRIPT}" "$input_file" | process_stream
else
    echo "DEBUG: Reading from standard input (stdin)..." >&2
    awk "${AWK_SCRIPT}" | process_stream
fi

echo "multisplit.sh: Finished." >&2
