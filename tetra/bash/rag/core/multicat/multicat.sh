#!/usr/bin/env bash
# multicat.sh — Concatenates files into MULTICAT format

# Source agents utility
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/agents.sh"

# --- Global (prefixed to avoid namespace pollution) ---
_mc_include_files=()
_mc_exclude_patterns=()
_mc_recursive=0
_mc_dryrun=0
declare -A _mc_remap_patterns    # -d a=b mappings (apply to headers only)
_mc_manifest_path=""             # -m <file> canonical list
_mc_root_dir=""                  # -C <dir> root for relativizing paths
_mc_tree_only=0                  # --tree-only: emit only the FILETREE section
_mc_agent_name=""                # --agent <name> for LLM-specific formatting
_mc_ulm_ranking=0                # --ulm-rank: use ULM for intelligent ranking
_mc_ulm_query=""                 # Query for ULM ranking
_mc_ulm_top=20                   # Top N files from ULM ranking
_mc_no_default_excludes=0        # --no-default-excludes flag
_mc_prepend_example=0            # -e/--example with files: prepend example

# Default exclude patterns (can be disabled with --no-default-excludes)
_MC_DEFAULT_EXCLUDES=(
    '.git'
    'node_modules'
    '__pycache__'
    '.DS_Store'
    '*.pyc'
    '*.pyo'
    '.venv'
    'venv'
    '.idea'
    '.vscode'
    '*.swp'
    '*.swo'
    '*~'
)

# Don't execute main logic if script is being sourced
[[ "${BASH_SOURCE[0]}" != "${0}" ]] && return 0

# --- Helpers ---
usage() {
  cat <<'EOF'
Usage: multicat.sh [OPTIONS] [file|dir ...]
  -r                     Recurse into directories
  -x <file>              Exclude patterns file (extends defaults)
  -d <a>=<b>             Remap 'a' -> 'b' in # dir:/# file: headers
  -m <manifest.txt>      Canonical file list (one path per line; # comments ok)
  -C <dir>               Root for relativizing paths (default: $PWD)
  --tree-only            Emit only FILETREE section (requires -m)
  --agent <name>         Use agent-specific formatting and templates
  --ulm-rank <query>     Use ULM ranking with query for intelligent file selection
  --ulm-top N            Number of top files from ULM ranking (default: 20)
  --no-default-excludes  Don't apply default excludes (.git, node_modules, etc.)
  --dryrun               Show files that would be included
  -e, --example          Prepend format example (alone: example only; with files: example + files)
  --example-long         Generate comprehensive MULTICAT specification example
  -h, --help             Show help
Notes:
  * Default excludes: .git, node_modules, __pycache__, .DS_Store, *.pyc, etc.
  * Exclude patterns are regex fragments matched against absolute paths.
  * Remaps affect header fields only, not file contents.
  * FILETREE compares canonical vs actual (pre-remap) by relative path to -C.
EOF
  exit 1
}

array_to_regex() {
  # Escape special regex chars and join with |
  # Note: { and } don't need escaping in bash extended regex
  local escaped=()
  local pat
  for pat in "$@"; do
    pat="${pat//\\/\\\\}"  # \ -> \\
    pat="${pat//./\\.}"    # . -> \.
    pat="${pat//\*/\\*}"   # * -> \*
    pat="${pat//\?/\\?}"   # ? -> \?
    pat="${pat//\[/\\[}"   # [ -> \[
    pat="${pat//\]/\\]}"   # ] -> \]
    pat="${pat//^/\\^}"    # ^ -> \^
    pat="${pat//$/\\$}"    # $ -> \$
    pat="${pat//+/\\+}"    # + -> \+
    pat="${pat//|/\\|}"    # | -> \|
    pat="${pat//(/\\(}"    # ( -> \(
    pat="${pat//)/\\)}"    # ) -> \)
    escaped+=("$pat")
  done
  local IFS="|"
  [[ ${#escaped[@]} -eq 0 ]] && echo '^$' || echo ".*(${escaped[*]})"
}

load_excludes() {
  local path="$1"
  [[ -f "$path" ]] || return
  while IFS= read -r line; do
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
    _mc_exclude_patterns+=("$line")
  done < "$path"
}

resolve_files() {
  local item="$1"
  local resolved
  if ! resolved=$(realpath "$item" 2>/dev/null); then
    echo "Warning: cannot resolve $item" >&2; return
  fi

  if [[ -f "$resolved" ]]; then
    # shellcheck disable=SC2076
    [[ "$resolved" =~ $_mc_exclude_regex ]] || echo "$resolved"
  elif [[ -d "$resolved" && $_mc_recursive -eq 1 ]]; then
    find "$resolved" -type f -print0 | while IFS= read -r -d '' f; do
      # shellcheck disable=SC2076
      [[ "$f" =~ $_mc_exclude_regex ]] || realpath "$f"
    done
  elif [[ -d "$resolved" ]]; then
    echo "Skipping dir $resolved (use -r to recurse)" >&2
  fi
}

apply_remap() {
  local val="$1"
  for pat in "${!_mc_remap_patterns[@]}"; do
    val="${val//$pat/${_mc_remap_patterns[$pat]}}"
  done
  echo "$val"
}

generate_example() {
  cat <<'EOF'
Output in MULTICAT format: a single bash code fence containing the entire .mc file. No text before or after the code fence. Start immediately with ```bash and the first #MULTICAT_START.

#MULTICAT_START
# dir: ./scripts
# file: deploy.sh
# note: Simple deployment script showing MULTICAT usage
#MULTICAT_END
#!/usr/bin/env bash

echo "MULTISPLIT: Use 'ms file.mc' to extract files from MULTICAT format"
echo "Deploying application..."
echo "MULTICAT format allows LLMs to generate multiple files in one response"

#MULTICAT_START
# dir: ./docs/guides
# file: llm-instructions.md
# note: Instructions for LLMs to generate clean MULTICAT output
#MULTICAT_END
# LLM MULTICAT Generation Instructions

❌ WRONG - Do NOT do this:
```bash
#MULTICAT_START
# dir: ./src
# file: app.js
#MULTICAT_END
console.log("hello");
```

✅ CORRECT - Output EXACTLY this (no code blocks):
#MULTICAT_START
# dir: ./src
# file: app.js
#MULTICAT_END
console.log("hello");

**CRITICAL RULES:**
- NEVER use ```language code blocks around MULTICAT
- NEVER use markdown formatting
- Start your response IMMEDIATELY with #MULTICAT_START
- Do NOT explain or introduce the code
- Output ONLY the raw MULTICAT format
- Use ./relative/paths for relocatable structure

**Template to follow:**
#MULTICAT_START
# dir: ./src
# file: filename.ext
# note: brief description
#MULTICAT_END
[raw file content - no formatting]

#MULTICAT_START
# dir: ./config
# file: filename2.ext
# note: brief description
#MULTICAT_END
[raw file content - no formatting]

REMEMBER: Your entire response should be copy-pasteable as a single .mc file
EOF
}

# --- Agent Integration ---

generate_agent_example() {
    local agent="$1"

    # Load agent profile for custom example
    if load_agent_profile "$agent"; then
        if declare -f "generate_${agent}_example" >/dev/null; then
            "generate_${agent}_example"
        elif [[ -n "${AGENT_EXAMPLE_TEMPLATE:-}" ]]; then
            echo "$AGENT_EXAMPLE_TEMPLATE"
        else
            generate_example  # Fallback to default
        fi
    else
        generate_example  # Fallback to default
    fi
}

# --- ULM Integration ---

get_ulm_path() {
    # Find ULM module relative to multicat
    local ulm_path="${TETRA_SRC:-$(dirname "$0")/../..}/bash/ulm/ulm.sh"

    if [[ -x "$ulm_path" ]]; then
        echo "$ulm_path"
    else
        echo "Error: ULM not found at $ulm_path" >&2
        return 1
    fi
}

ulm_rank_files() {
    local query="$1" path="$2"
    local ulm_script

    if ! ulm_script=$(get_ulm_path); then
        echo "ULM ranking failed, falling back to normal file discovery" >&2
        return 1
    fi

    echo "Using ULM to rank files for query: '$query'" >&2

    # Use ULM to get ranked file list
    "$ulm_script" rank "$query" "$path" --algorithm multi_head --top "$_mc_ulm_top" --format text | \
    while read -r score file; do
        echo "$file"
    done
}

relpath() {
  # relpath <abs> <root>
  local abs="$1" root="$2"
  if [[ -z "$root" ]]; then
    root="$PWD"
  fi
  # Normalize
  abs=$(realpath -m "$abs")
  root=$(realpath -m "$root")
  if [[ "${abs}" == "${root}" ]]; then
    echo "."
    return
  fi
  if [[ "${abs}" == "${root}/"* ]]; then
    echo "${abs#$root/}"
  else
    # Fall back to absolute if outside root
    echo "$abs"
  fi
}

read_manifest() {
  local path="$1"
  mapfile -t MANIFEST_RAW < <(grep -vE '^\s*(#|$)' "$path" || true)
}

print_filetree_section() {
  local -n _act="$1"           # array of actual files (absolute)
  local root="${2:-$PWD}"

  # Actual relative set
  declare -A ACT_SET=()
  local -a ACT_REL=()
  local f rel
  for f in "${_act[@]}"; do
    rel=$(relpath "$f" "$root")
    ACT_SET["$rel"]=1
  done
  # Gather ACT_REL for stable order
  mapfile -t ACT_REL < <(printf "%s\n" "${!ACT_SET[@]}" | LC_ALL=C sort)

  # Canonical relative set (manifest treated as is; if absolute, relativize)
  declare -A CAN_SET=()
  local -a CAN_REL=()
  local m relm
  for m in "${MANIFEST_RAW[@]}"; do
    if [[ "$m" = /* ]]; then
      relm=$(relpath "$m" "$root")
    else
      relm="$m"
    fi
    # Normalize ./prefix
    relm="${relm#./}"
    CAN_SET["$relm"]=1
  done
  mapfile -t CAN_REL < <(printf "%s\n" "${!CAN_SET[@]}" | LC_ALL=C sort)

  # Diff
  local -a ONLY_CAN=() ONLY_ACT=() BOTH=()
  # Missing (in canonical, not in actual)
  local k
  for k in "${CAN_REL[@]}"; do
    if [[ -n "${ACT_SET[$k]:-}" ]]; then
      BOTH+=("$k")
    else
      ONLY_CAN+=("$k")
    fi
  done
  # Extra (in actual, not in canonical)
  for k in "${ACT_REL[@]}"; do
    [[ -n "${CAN_SET[$k]:-}" ]] || ONLY_ACT+=("$k")
  done

  # Emit
  {
    echo "#MULTICAT_START"
    echo "# section: FILETREE"
    echo "# root: $root"
    echo "# canonical_count: ${#CAN_REL[@]}"
    echo "# actual_count: ${#ACT_REL[@]}"
    echo "# missing_count: ${#ONLY_CAN[@]}"
    echo "# extra_count: ${#ONLY_ACT[@]}"
    echo "# legend: '=' present, '-' missing (canonical only), '+' extra (actual only)"
    echo "#MULTICAT_END"
    # Present
    for k in "${BOTH[@]}"; do printf "=%s\n" "$k"; done
    # Missing
    for k in "${ONLY_CAN[@]}"; do printf "-%s\n" "$k"; done
    # Extra
    for k in "${ONLY_ACT[@]}"; do printf "+%s\n" "$k"; done
    echo
  }
}

# --- Parse Arguments ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    -r) _mc_recursive=1 ;;
    -x) shift; load_excludes "$1" ;;
    -d)
      shift
      [[ "${1:-}" =~ ^[^=]+=.+$ ]] || { echo "Invalid -d format, expected a=b" >&2; exit 1; }
      _mc_remap_patterns["${1%%=*}"]="${1#*=}"
      ;;
    -m) shift; _mc_manifest_path="${1:-}"; [[ -n "$_mc_manifest_path" && -f "$_mc_manifest_path" ]] || { echo "Missing/invalid -m file" >&2; exit 1; } ;;
    -C) shift; _mc_root_dir="${1:-}"; [[ -n "$_mc_root_dir" ]] || { echo "Missing -C <dir>" >&2; exit 1; } ;;
    --tree-only) _mc_tree_only=1 ;;
    --agent)
      shift
      if [[ -z "${1:-}" || "${1}" == -* ]]; then
        # No value or next arg is a flag → list agents
        list_available_agents "cli"
        exit 0
      fi
      _mc_agent_name="${1}"
      ;;
    --ulm-rank) shift; _mc_ulm_query="${1:-}"; _mc_ulm_ranking=1; [[ -n "$_mc_ulm_query" ]] || { echo "Missing --ulm-rank <query>" >&2; exit 1; } ;;
    --ulm-top) shift; _mc_ulm_top="${1:-20}"; [[ "$_mc_ulm_top" =~ ^[0-9]+$ ]] || { echo "Invalid --ulm-top value" >&2; exit 1; } ;;
    --no-default-excludes) _mc_no_default_excludes=1 ;;
    --dryrun) _mc_dryrun=1 ;;
    -e|--example) _mc_prepend_example=1 ;;
    --example-long) cat "${RAG_SRC}/example-long.mc"; exit 0 ;;
    -h|--help) usage ;;
    -*)
      echo "Unknown option: $1" >&2
      usage
      ;;
    *) _mc_include_files+=("$1") ;;
  esac
  shift
done

# If --example with no files, just output example and exit
if [[ $_mc_prepend_example -eq 1 && ${#_mc_include_files[@]} -eq 0 ]]; then
    generate_example
    exit 0
fi

[[ ${#_mc_include_files[@]} -eq 0 ]] && usage
[[ $_mc_tree_only -eq 1 && -z "$_mc_manifest_path" ]] && { echo "--tree-only requires -m <manifest>"; exit 1; }

# Load agent profile if specified
if [[ -n "$_mc_agent_name" ]]; then
    load_agent_profile "$_mc_agent_name" || true
fi

# Apply default excludes unless disabled
if [[ $_mc_no_default_excludes -eq 0 ]]; then
    _mc_exclude_patterns+=("${_MC_DEFAULT_EXCLUDES[@]}")
fi

_mc_exclude_regex=$(array_to_regex "${_mc_exclude_patterns[@]}")

_mc_all_files=()

# ULM ranking mode
if [[ $_mc_ulm_ranking -eq 1 ]]; then
    echo "Using ULM ranking with query: '$_mc_ulm_query'" >&2

    # Use first include item as search path for ULM
    _mc_search_path="${_mc_include_files[0]}"

    while IFS= read -r f; do
        # Verify file exists and apply exclusions
        # shellcheck disable=SC2076
        if [[ -f "$f" && ! "$f" =~ $_mc_exclude_regex ]]; then
            _mc_all_files+=("$f")
        fi
    done < <(ulm_rank_files "$_mc_ulm_query" "$_mc_search_path")

    echo "ULM selected ${#_mc_all_files[@]} files" >&2
else
    # Normal file discovery
    for item in "${_mc_include_files[@]}"; do
      while IFS= read -r f; do
        _mc_all_files+=("$f")
      done < <(resolve_files "$item")
    done
fi

if [[ $_mc_dryrun -eq 1 ]]; then
  printf "%s\n" "${_mc_all_files[@]}"
  exit 0
fi

# --- FILETREE section (optional) ---
if [[ -n "$_mc_manifest_path" ]]; then
  declare -a MANIFEST_RAW=()
  read_manifest "$_mc_manifest_path"
  print_filetree_section _mc_all_files "$_mc_root_dir"
  if [[ $_mc_tree_only -eq 1 ]]; then
    exit 0
  fi
fi

# --- Output example if requested ---
if [[ $_mc_prepend_example -eq 1 ]]; then
    generate_example
    echo ""
fi

# --- Output MULTICAT Format ---
for f in "${_mc_all_files[@]}"; do
  dir=$(apply_remap "$(dirname "$f")")
  base=$(apply_remap "$(basename "$f")")
  {
    echo "#MULTICAT_START"
    echo "# dir: $dir"
    echo "# file: $base"
    echo "# note:"
    echo "#MULTICAT_END"
    cat "$f"
    echo
  }
done
