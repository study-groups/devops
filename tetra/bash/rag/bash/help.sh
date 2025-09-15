#!/usr/bin/env bash
# help.sh - Defines the display_help function for multicat.sh

display_help() {
    # $1 should be the path used to invoke the calling script (passed as $0 from caller)
    local caller_path="${1:-multicat.sh}" # Default to multicat.sh if argument is empty
    local script_name
    script_name=$(basename "$caller_path")

    # Use unquoted EOF to allow variable expansion for ${script_name}
    cat <<EOF
multicat: Concatenate files into a multicat stream with metadata headers.
Usage: ${script_name} [OPTIONS] [FILES_OR_DIRECTORIES...]

Options:
  -i FILE_OR_DIR  Directly include one or more files or directories. Can be used multiple times or provide multiple items.
  -f FILE         Load list of files/directories to include from FILE (one per line).
  -x FILE         Load list of exclusion patterns from FILE (one per line).
  -r              Recursively process files within specified directories.
  -h, --help      Display this help message.

Description:
Processes specified files and, if -r is used, files within specified directories.
Exclusion patterns from .gitignore and .multignore files found in the current directory downwards are loaded automatically, and can be added via -x.
The output consists of a header block for each processed file, formatted as:
#MULTICAT_START#
# dir: /original/path/to/dir
# file: filename.txt
# notes:
#MULTICAT_END#
followed by the file's contents.

Examples:
  ${script_name} file1.txt dir1/
  ${script_name} -r dir1/ file2.txt
  ${script_name} -f my_files.txt -r 
  ${script_name} -x ignore.txt -r dir1/
EOF
}

# Optional: Prevent this script from doing anything if executed directly
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    echo "This script should be sourced by multicat.sh, not executed directly." >&2
    exit 1
fi
