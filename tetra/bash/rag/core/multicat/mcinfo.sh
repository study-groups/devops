#!/usr/bin/env bash
# mcinfo.sh
# Summarizes a multicat file by listing each file block's directory and filename, plus a total count.

# Don't execute main logic if script is being sourced
[[ "${BASH_SOURCE[0]}" != "${0}" ]] && return 0

# --- Options ---
_mi_json_output=0
_mi_input_file=""

display_help() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS] <multicat_file>

Options:
  -j, --json    Output as JSON (for scripting)
  -h, --help    Display this help message

Examples:
  mi file.mc              # Human-readable output
  mi --json file.mc       # JSON output for scripting
  mi file.mc | wc -l      # Count files (subtract 1 for total line)
EOF
}

# --- Argument Parsing ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    -j|--json) _mi_json_output=1; shift ;;
    -h|--help) display_help; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; display_help; exit 1 ;;
    *) _mi_input_file="$1"; shift ;;
  esac
done

if [[ -z "$_mi_input_file" ]]; then
  display_help
  exit 1
fi

if [[ ! -f "$_mi_input_file" ]]; then
  echo "Error: Input file '$_mi_input_file' not found." >&2
  exit 1
fi

# --- Parse and Output ---
_mi_block_count=0
_mi_in_block=0
_mi_file_dir=""
_mi_file_name=""
_mi_file_note=""
_mi_first_json=1

# Start JSON array if needed
[[ $_mi_json_output -eq 1 ]] && printf '{"files":['

while IFS= read -r line; do
  if [[ "$line" == "#MULTICAT_START" ]]; then
    _mi_in_block=1
    _mi_file_dir=""
    _mi_file_name=""
    _mi_file_note=""
    continue
  elif [[ "$line" == "#MULTICAT_END" ]]; then
    _mi_in_block=0
    _mi_block_count=$((_mi_block_count + 1))

    if [[ $_mi_json_output -eq 1 ]]; then
      # JSON output
      [[ $_mi_first_json -eq 0 ]] && printf ','
      _mi_first_json=0
      printf '{"dir":"%s","file":"%s"' "$_mi_file_dir" "$_mi_file_name"
      [[ -n "$_mi_file_note" ]] && printf ',"note":"%s"' "$_mi_file_note"
      printf '}'
    else
      # Human-readable output
      printf "[%d] Dir: %s, File: %s\n" "$_mi_block_count" "$_mi_file_dir" "$_mi_file_name"
    fi
    continue
  fi

  if [[ $_mi_in_block -eq 1 ]]; then
    case "$line" in
      "# dir: "*) _mi_file_dir="${line#"# dir: "}" ;;
      "# file: "*) _mi_file_name="${line#"# file: "}" ;;
      "# note: "*) _mi_file_note="${line#"# note: "}" ;;
    esac
  fi
done < "$_mi_input_file"

if [[ $_mi_json_output -eq 1 ]]; then
  # Close JSON
  printf '],"count":%d}\n' "$_mi_block_count"
else
  echo "Total file blocks: $_mi_block_count"
fi
