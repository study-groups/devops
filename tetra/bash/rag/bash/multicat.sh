#!/usr/bin/env bash
# multicat.sh — Concatenates files into MULTICAT format
set -euo pipefail

# --- Global ---
include_files=()
exclude_patterns=()
recursive=0
dryrun=0
declare -A remap_patterns        # -d a=b mappings (apply to headers only)
manifest_path=""                 # -m <file> canonical list
root_dir=""                      # -C <dir> root for relativizing paths
tree_only=0                      # --tree-only: emit only the FILETREE section

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
  --dryrun               Show files that would be included
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
[[ $tree_only -eq 1 && -z "$manifest_path" ]] && { echo "--tree-only requires -m <manifest>"; exit 1; }

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
