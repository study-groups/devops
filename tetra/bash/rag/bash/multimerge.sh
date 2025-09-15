#!/usr/bin/env bash
# multimerge.sh - Enhanced merge tool supporting both diff and function cursor modes

set -euo pipefail

# Get the directory where this script resides
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source AST functionality
source "$SCRIPT_DIR/ast.sh"

usage() {
  cat <<'EOF'
multimerge.sh - Enhanced merge tool with AST-aware function replacement

Usage: multimerge.sh [OPTIONS] [INPUT_FILE]

Options:
  --rag-dir <dir>    Store session data in RAG_DIR (creates timestamped session)
  -h, --help         Show this help

Modes Supported:
  mode: diff         Traditional unified diff (delegates to multidiff.sh)
  mode: function     AST-aware function replacement using cursors
  mode: full         Complete file replacement (passthrough)

Function Cursor Format:
  #MULTICAT_START
  # dir: /path/to/dir
  # file: script.sh
  # mode: function
  # cursor: function_name
  #MULTICAT_END
  function_name() {
    # new function body
  }

Description:
  Processes MULTICAT streams with enhanced merge capabilities:
  - Traditional diffs applied with patch
  - Function-level replacements using AST
  - Session tracking in RAG_DIR with timestamps
  - Git diff integration for conflict resolution
EOF
}

# Initialize session tracking
init_session() {
  local rag_dir="$1"
  local timestamp
  timestamp=$(date +%s)
  
  local session_dir="$rag_dir/sessions/$timestamp"
  mkdir -p "$session_dir"
  
  echo "$session_dir"
}

# Apply function cursor replacement
apply_function_cursor() {
  local dir="$1"
  local file="$2"
  local cursor="$3"
  local new_function="$4"
  local session_dir="${5:-}"
  
  local target_path="$dir/$file"
  
  if [[ ! -f "$target_path" ]]; then
    echo "Error: Target file not found: $target_path" >&2
    return 1
  fi
  
  # Log the operation if session tracking is enabled
  if [[ -n "$session_dir" ]]; then
    echo "$(date): Replacing function '$cursor' in $target_path" >> "$session_dir/operations.log"
    # Backup original function
    ast_extract_function "$target_path" "$cursor" > "$session_dir/backup_${cursor}_$(basename "$file").txt" 2>/dev/null || true
  fi
  
  # Create temp file with new function
  local tmpfn
  tmpfn=$(mktemp)
  echo "$new_function" > "$tmpfn"
  
  # Use AST-aware function replacement
  if ast_replace_function "$target_path" < "$tmpfn"; then
    if [[ -n "$session_dir" ]]; then
      echo "$(date): Successfully replaced function '$cursor' in $target_path" >> "$session_dir/operations.log"
    fi
    rm -f "$tmpfn"
    return 0
  else
    if [[ -n "$session_dir" ]]; then
      echo "$(date): Failed to replace function '$cursor' in $target_path" >> "$session_dir/operations.log"
    fi
    rm -f "$tmpfn"
    return 1
  fi
}

# Apply traditional diff (delegate to multidiff.sh)
apply_diff() {
  local dir="$1"
  local file="$2"
  local patch="$3"
  local session_dir="${4:-}"
  
  local target_path="$dir/$file"
  
  if [[ ! -f "$target_path" ]]; then
    echo "__MISSING__"
    return 1
  fi
  
  if [[ -n "$session_dir" ]]; then
    echo "$(date): Applying diff to $target_path" >> "$session_dir/operations.log"
  fi
  
  # Use git apply for better diff handling
  if expanded=$(git apply --no-index /dev/null <(echo "$patch") 2>/dev/null); then
    echo "$expanded"
    if [[ -n "$session_dir" ]]; then
      echo "$(date): Successfully applied diff to $target_path" >> "$session_dir/operations.log"
    fi
    return 0
  elif expanded=$(patch --silent --merge "$target_path" <<< "$patch" 2>/dev/null); then
    echo "$expanded"
    if [[ -n "$session_dir" ]]; then
      echo "$(date): Successfully applied patch to $target_path" >> "$session_dir/operations.log"
    fi
    return 0
  else
    echo "__FAILED__"
    if [[ -n "$session_dir" ]]; then
      echo "$(date): Failed to apply diff to $target_path" >> "$session_dir/operations.log"
    fi
    return 2
  fi
}

# Main processing function
process_multicat() {
  local session_dir="$1"
  
  local in_block=0
  local mode="full" cursor="" requires="no" note=""
  local dir="" file="" content=""
  
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == "#MULTICAT_START" ]]; then
      in_block=1
      mode="full"
      cursor=""
      requires="no"
      note=""
      dir=""
      file=""
      content=""
      continue
    elif [[ "$line" == "#MULTICAT_END" ]]; then
      # Process the block based on mode
      case "$mode" in
        function)
          if [[ -z "$cursor" ]]; then
            echo "Error: function mode requires cursor specification" >&2
            exit 1
          fi
          
          if expanded=$(apply_function_cursor "$dir" "$file" "$cursor" "$content" "$session_dir"); then
            content="$expanded"
            mode="full"  # Convert to full after successful merge
          else
            echo "Failed to apply function cursor '$cursor' to $dir/$file" >&2
            exit 1
          fi
          ;;
        diff)
          expanded=$(apply_diff "$dir" "$file" "$content" "$session_dir") || status=$?
          if [[ "$expanded" == "__MISSING__" ]]; then
            requires="true"
            note="suspicious"
          elif [[ "$expanded" == "__FAILED__" ]]; then
            echo "Failed to apply diff to $dir/$file" >&2
            exit 1
          else
            content="$expanded"
            mode="full"  # Convert to full after successful merge
          fi
          ;;
        full)
          # Passthrough - no processing needed
          ;;
        *)
          echo "Error: Unknown mode '$mode'" >&2
          exit 1
          ;;
      esac
      
      # Output the processed block
      echo "#MULTICAT_START"
      echo "# dir: $dir"
      echo "# file: $file"
      [[ "$mode" == "diff" ]] && echo "# mode: diff"
      [[ "$mode" == "function" ]] && echo "# mode: function" && [[ -n "$cursor" ]] && echo "# cursor: $cursor"
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
        "# cursor: "*) cursor="${line#"# cursor: "}" ;;
        *) content+="$line"$'\n' ;;
      esac
    fi
  done
  
  # Create session summary if tracking enabled
  if [[ -n "$session_dir" && -f "$session_dir/operations.log" ]]; then
    {
      echo "MULTIMERGE SESSION SUMMARY"
      echo "=========================="
      echo "Session: $(basename "$session_dir")"
      echo "Date: $(date)"
      echo ""
      echo "Operations performed:"
      cat "$session_dir/operations.log"
    } > "$session_dir/summary.txt"
  fi
}

# Main execution
main() {
  local rag_dir=""
  local input_file=""
  
  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --rag-dir)
        rag_dir="$2"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      -*)
        echo "Unknown option: $1" >&2
        usage
        exit 1
        ;;
      *)
        input_file="$1"
        shift
        ;;
    esac
  done
  
  # Initialize session if RAG_DIR specified
  local session_dir=""
  if [[ -n "$rag_dir" ]]; then
    session_dir=$(init_session "$rag_dir")
    echo "Session tracking enabled: $session_dir" >&2
    
    # Save input for reference
    if [[ -n "$input_file" ]]; then
      cp "$input_file" "$session_dir/input.mc"
    else
      cat > "$session_dir/input.mc"
    fi
  fi
  
  # Process the multicat stream
  if [[ -n "$input_file" ]]; then
    process_multicat "$session_dir" < "$input_file"
  else
    process_multicat "$session_dir"
  fi
}

main "$@"