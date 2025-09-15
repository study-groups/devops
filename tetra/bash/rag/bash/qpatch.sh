#!/usr/bin/env bash
# qpatch.sh — apply a pasted patch (stdin), a QA answer ID, or a file.
# - Uses git-apply to handle both unified and git-style diffs.
# - Normalizes input (BOM/CRLF stripped, prose/``` before first header removed).
# - Auto-detects strip level (-p) and target directory.
#
# Flags: --dir DIR --strip N --dry-run --reverse --fuzz N --from-file FILE
#        --explain --verbose

set -euo pipefail

# Don't execute main logic if script is being sourced
[[ "${BASH_SOURCE[0]}" != "${0}" ]] && return 0

# --- Configuration ---
QA_DIR="${QA_DIR:-$HOME/.qa}"
DB_DIR="$QA_DIR/db"
TRY_STRIPS="0 1 2 3"

# --- Utility Functions ---
usage() {
  cat <<EOF
Usage: qpatch.sh [ID] [OPTIONS]
Applies a patch using 'git apply'.

  ID                A numeric ID to find a patch in '$DB_DIR/<ID>.answer'.

Options:
  --from-file FILE  Read patch from FILE instead of stdin.
  --dir DIR         Apply patch in DIR (default: auto-detect).
  --strip N         Use strip level N (default: auto-detect).
  --dry-run         Check patch without applying (uses git apply --check).
  --reverse, -R     Apply the patch in reverse.
  --fuzz N          Set fuzz factor for git apply.
  --explain         On failure, show detailed diagnostics.
  --verbose, -v     Enable verbose output for git apply.
  -h, --help        Show this help message.

If no ID or --from-file is given, the script reads from stdin.
EOF
}

die() {
  printf 'qpatch: %s\n' "$*" >&2
  exit 1
}

have() {
  command -v "$1" >/dev/null 2>&1
}

# --- Patch Processing Functions ---
normalize_patch() {
  local in="$1" out="$2"
  tr -d '\r' <"$in" |
    sed '1s/^\xEF\xBB\xBF//' |
    awk '
      BEGIN { in_patch=0 }
      /^```/ { next }
      !in_patch && /^(diff --git |--- |\+\+\+ |Index: )/ { in_patch=1 }
      in_patch { print }
    ' >"$out"
}

extract_patch_from_answer() {
  local answer_file="$1" raw_patch_file="$2"
  awk '/^```/ { in_block=!in_block; next } in_block' "$answer_file" >"$raw_patch_file"
  if [[ ! -s "$raw_patch_file" ]]; then
    cp "$answer_file" "$raw_patch_file"
  fi
}

looks_like_patch() {
  grep -qE '^(diff --git |--- [^[:space:]]|\+\+\+ [^[:space:]]|Index: )' "$1"
}

list_headers() {
  if grep -q '^diff --git ' "$1"; then
    awk '/^diff --git / { s=$3; d=$4; sub(/^a\//,"",s); sub(/^b\//,"",d); if (s!="" && d!="") print s,d }' "$1"
  else
    awk '/^--- / { src=$2; sub(/^a\//,"",src) } /^\+\+\+ / { dst=$2; sub(/^b\//,"",dst); if (src!="" && dst!="") print src,dst; src="" }' "$1"
  fi
}

# --- Auto-detection Logic ---
check_apply() { # <patch_file> <strip_level> <dir>
  (cd "$2" && git apply --check -p"$1" "$0") >/dev/null 2>&1
}

guess_strip() { # <patch_file>
  # git diffs usually require -p1, unified diffs -p0.
  if grep -q '^diff --git ' "$1"; then printf 1; else printf 0; fi
}

autodetect_dir_and_strip() { # <patch_file> -> "dir p_level"
  local patch_file="$1" p_level d
  d="$PWD"
  while :; do
    for p_level in $TRY_STRIPS; do
      if check_apply "$p_level" "$d" <"$patch_file"; then
        printf '%s %s\n' "$d" "$p_level"
        return 0
      fi
    done
    [[ "$d" == "/" ]] && break
    d="$(dirname "$d")"
  done
  return 1
}

# --- Main Execution ---
apply_patch() { # <patch_file> <strip_level> <dir>
  local patch_file="$1" p_level="$2" dir="$3"
  local args=()
  ((DRYRUN)) && args+=(--check)
  ((REVERSE)) && args+=(-R)
  ((VERBOSE)) && args+=(--verbose)
  [[ -n "$FUZZ" ]] && args+=("--fuzz=$FUZZ")

  (cd "$dir" && git apply -p"$p_level" "${args[@]}" "$patch_file")
}

diagnostics() { # <patch_file> <base_dir_for_trials>
  local pf="$1" base_dir="$2"
  printf '--- diagnostics ---\n' >&2
  printf 'dir tried : %s\n' "$base_dir" >&2
  printf 'first lines of patch:\n' >&2
  nl -ba "$pf" | head -n 20 | sed 's/^/  /' >&2
  printf 'trial matrix:\n' >&2
  local p d ok
  d="$base_dir"
  while :; do
    printf '  [%s]\n' "$d" >&2
    for p in $TRY_STRIPS; do
      if check_apply "$p" "$d" <"$pf"; then ok=OK; else ok=FAIL; fi
      printf '    -p%-2s %s\n' "$p" "$ok" >&2
    done
    [[ "$d" == "/" ]] && break
    d="$(dirname "$d")"
  done
}

main() {
  # --- Argument Parsing ---
  local ID="" FROM_FILE="" DIR_OPT="" STRIP_OPT="" FUZZ=""
  local DRYRUN=0 REVERSE=0 EXPLAIN=0 VERBOSE=0

  while [[ $# -gt 0 ]]; do
    case "$1" in
    --from-file) FROM_FILE="$2"; shift 2 ;;
    --dir) DIR_OPT="$2"; shift 2 ;;
    --strip) STRIP_OPT="$2"; shift 2 ;;
    --fuzz) FUZZ="$2"; shift 2 ;;
    --dry-run) DRYRUN=1; shift ;;
    --reverse | -R) REVERSE=1; shift ;;
    --explain) EXPLAIN=1; shift ;;
    --verbose | -v) VERBOSE=1; shift ;;
    -h | --help) usage; exit 0 ;;
    --*) die "Unknown argument: $1" ;;
    *) ID="$1"; shift ;;
    esac
  done

  # --- Setup ---
  have git || die "'git' command not found, but is required."
  local work_dir; work_dir="$(mktemp -d)"; trap 'rm -rf "$work_dir"' EXIT
  local raw_patch="$work_dir/raw.diff"
  local norm_patch="$work_dir/p.diff"

  # --- Input Gathering ---
  if [[ -n "$FROM_FILE" ]]; then
    [[ -f "$FROM_FILE" ]] || die "Patch file not found: $FROM_FILE"
    cp "$FROM_FILE" "$raw_patch"
  elif [[ -n "$ID" ]]; then
    have jq || die "'jq' command is required to use QA answer IDs."
    local answer_file="$DB_DIR/$ID.answer"
    [[ -f "$answer_file" ]] || die "Answer file not found: $answer_file"
    extract_patch_from_answer "$answer_file" "$raw_patch"
  else
    [[ -t 0 ]] && printf 'qpatch: Paste patch and press Ctrl-D to finish.\n' >&2
    cat >"$raw_patch"
    [[ -s "$raw_patch" ]] || die "No data received on stdin."
  fi

  # --- Normalization and Validation ---
  normalize_patch "$raw_patch" "$norm_patch"
  [[ -s "$norm_patch" ]] || die "Patch is empty after normalization."
  looks_like_patch "$norm_patch" || die "Input does not look like a git/unified patch."

  # --- Auto-detection ---
  local apply_dir apply_strip
  if [[ -n "$DIR_OPT" || -n "$STRIP_OPT" ]]; then
    apply_dir="${DIR_OPT:-$PWD}"
    apply_strip="${STRIP_OPT:-$(guess_strip "$norm_patch")}"
  else
    if ! read -r apply_dir apply_strip < <(autodetect_dir_and_strip "$norm_patch"); then
      printf 'qpatch: warning: auto-detection failed, falling back to defaults.\n' >&2
      apply_dir="$PWD"
      apply_strip="$(guess_strip "$norm_patch")"
    fi
    [[ "$apply_dir" != "$PWD" ]] && printf 'qpatch: auto-dir=%s\n' "$apply_dir" >&2
  fi

  printf 'qpatch: dir=%s strip=%s dry-run=%s reverse=%s\n' \
    "$apply_dir" "$apply_strip" "$DRYRUN" "$REVERSE" >&2

  # --- Application ---
  set +e # Temporarily disable exit-on-error to capture status code
  apply_patch "$norm_patch" "$apply_strip" "$apply_dir"
  local rc=$?
  set -e # Re-enable exit-on-error

  # --- Result ---
  if ((rc != 0)); then
    printf 'qpatch: apply failed (exit code %d)\n' "$rc" >&2
    ((EXPLAIN)) && diagnostics "$norm_patch" "$apply_dir"
    exit "$rc"
  fi

  printf 'qpatch: success!\n' >&2
}

main "$@"
