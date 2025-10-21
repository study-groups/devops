#!/usr/bin/env bash
# multicat.sh — Concatenates files into MULTICAT format

# Source agents utility
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/agents.sh"

# --- Global ---
include_files=()
exclude_patterns=()
recursive=0
dryrun=0
declare -A remap_patterns        # -d a=b mappings (apply to headers only)
manifest_path=""                 # -m <file> canonical list
root_dir=""                      # -C <dir> root for relativizing paths
tree_only=0                      # --tree-only: emit only the FILETREE section
agent_name=""                    # --agent <name> for LLM-specific formatting
ulm_ranking=0                    # --ulm-rank: use ULM for intelligent ranking
ulm_query=""                     # Query for ULM ranking
ulm_top=20                       # Top N files from ULM ranking

# Don't execute main logic if script is being sourced
[[ "${BASH_SOURCE[0]}" != "${0}" ]] && return 0

# --- Helpers ---
usage() {
  cat <<'EOF'
Usage: multicat.sh [OPTIONS] [file|dir ...]
  -r                     Recurse into directories
  -x <file>              Exclude patterns file
  -d <a>=<b>             Remap 'a' -> 'b' in # dir:/# file: headers
  -m <manifest.txt>      Canonical file list (one path per line; # comments ok)
  -C <dir>               Root for relativizing paths (default: $PWD)
  --tree-only            Emit only FILETREE section (requires -m)
  --agent <name>         Use agent-specific formatting and templates
  --ulm-rank <query>     Use ULM ranking with query for intelligent file selection
  --ulm-top N            Number of top files from ULM ranking (default: 20)
  --dryrun               Show files that would be included
  --example [agent]      Generate example MULTICAT (optionally for specific agent)
  --example-long         Generate comprehensive MULTICAT specification example
  -h, --help             Show help
Notes:
  * Exclude patterns are regex fragments matched against absolute paths.
  * Remaps affect header fields only, not file contents.
  * FILETREE compares canonical vs actual (pre-remap) by relative path to -C.
EOF
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

apply_remap() {
  local val="$1"
  for pat in "${!remap_patterns[@]}"; do
    val="${val//$pat/${remap_patterns[$pat]}}"
  done
  echo "$val"
}

generate_example() {
  cat <<'EOF'
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
    "$ulm_script" rank "$query" "$path" --algorithm multi_head --top "$ulm_top" --format text | \
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
    -r) recursive=1 ;;
    -x) shift; load_excludes "$1" ;;
    -d)
      shift
      [[ "${1:-}" =~ ^[^=]+=.+$ ]] || { echo "Invalid -d format, expected a=b" >&2; exit 1; }
      remap_patterns["${1%%=*}"]="${1#*=}"
      ;;
    -m) shift; manifest_path="${1:-}"; [[ -n "$manifest_path" && -f "$manifest_path" ]] || { echo "Missing/invalid -m file" >&2; exit 1; } ;;
    -C) shift; root_dir="${1:-}"; [[ -n "$root_dir" ]] || { echo "Missing -C <dir>" >&2; exit 1; } ;;
    --tree-only) tree_only=1 ;;
    --agent)
      shift
      if [[ -z "${1:-}" || "${1}" == -* ]]; then
        # No value or next arg is a flag → list agents
        list_available_agents "cli"
        exit 0
      fi
      agent_name="${1}"
      ;;
    --ulm-rank) shift; ulm_query="${1:-}"; ulm_ranking=1; [[ -n "$ulm_query" ]] || { echo "Missing --ulm-rank <query>" >&2; exit 1; } ;;
    --ulm-top) shift; ulm_top="${1:-20}"; [[ "$ulm_top" =~ ^[0-9]+$ ]] || { echo "Invalid --ulm-top value" >&2; exit 1; } ;;
    --dryrun) dryrun=1 ;;
    --example)
      if [[ -n "${2:-}" && "${2}" != -* ]]; then
        agent_name="$2"; shift
        generate_agent_example "$agent_name"
      else
        generate_example
      fi
      exit 0 ;;
    --example-long) cat "${RAG_SRC}/example-long.mc"; exit 0 ;;
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
[[ $tree_only -eq 1 && -z "$manifest_path" ]] && { echo "--tree-only requires -m <manifest>"; exit 1; }

# Load agent profile if specified
if [[ -n "$agent_name" ]]; then
    load_agent_profile "$agent_name" || true
fi

exclude_regex=$(array_to_regex "${exclude_patterns[@]}")

all_files=()

# ULM ranking mode
if [[ $ulm_ranking -eq 1 ]]; then
    echo "Using ULM ranking with query: '$ulm_query'" >&2

    # Use first include item as search path for ULM
    search_path="${include_files[0]}"

    while IFS= read -r f; do
        # Verify file exists and apply exclusions
        if [[ -f "$f" && ! "$f" =~ $exclude_regex ]]; then
            all_files+=("$f")
        fi
    done < <(ulm_rank_files "$ulm_query" "$search_path")

    echo "ULM selected ${#all_files[@]} files" >&2
else
    # Normal file discovery
    for item in "${include_files[@]}"; do
      while IFS= read -r f; do
        all_files+=("$f")
      done < <(resolve_files "$item")
    done
fi

if [[ $dryrun -eq 1 ]]; then
  printf "%s\n" "${all_files[@]}"
  exit 0
fi

# --- FILETREE section (optional) ---
if [[ -n "$manifest_path" ]]; then
  declare -a MANIFEST_RAW=()
  read_manifest "$manifest_path"
  print_filetree_section all_files "$root_dir"
  if [[ $tree_only -eq 1 ]]; then
    exit 0
  fi
fi

# --- Output MULTICAT Format ---
for f in "${all_files[@]}"; do
  dir=$(apply_remap "$(dirname "$f")")
  base=$(apply_remap "$(basename "$f")")
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
