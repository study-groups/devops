#!/usr/bin/env bash
# qpatch-inspect.sh — inspect a patch without applying.
# - Normalizes input (BOM/CRLF stripped, prose/``` before first header removed)
# - Prints kind, size, file headers, per-directory strip trial matrix
# Flags: [ID] --from-file FILE --dir DIR --tool {git|patch|auto}
set -euo pipefail

# Don't execute main logic if script is being sourced
[[ "${BASH_SOURCE[0]}" != "${0}" ]] && return 0

QA_DIR="${QA_DIR:-$HOME/.qa}"
DB="$QA_DIR/db"
DIR="."; TOOL="auto"
TRY_STRIPS="0 1 2 3"

usage(){ cat <<EOF
qpatch-inspect.sh [ID] [--from-file FILE] [--dir DIR] [--tool patch|git|auto]
(no args: paste patch, Ctrl-D)
EOF
}
die(){ printf 'qpatch-inspect: %s\n' "$*" >&2; exit 1; }
have(){ command -v "$1" >/dev/null 2>&1; }

normalize_patch(){ local in="$1" out="$2"
  tr -d '\r' <"$in" | sed $'1s/^\xEF\xBB\xBF//' \
  | awk 'BEGIN{s=0} /^```/{next} s==0&&$0~/^(diff --git |---[ \t]|Index: )/{s=1} s{print}' >"$out"
}
read_patch_from_stdin(){ local out="$1"; [[ -t 0 ]] && printf 'qpatch-inspect: paste patch, Ctrl-D\n' >&2; cat >"$out" || true; [[ -s "$out" ]] || die "no data on stdin"; }
extract_patch_from_answer(){ local in="$1" out="$2"
  awk 'BEGIN{b=0}/^```/{b=!b;next}{if(b)print}' "$in" >"$out.tmp" || true
  [[ -s "$out.tmp" ]] || awk 'BEGIN{s=0} s==0&&$0~/^(diff --git |---[ \t]|Index: )/{s=1} s{print}' "$in" >"$out.tmp" || true
  normalize_patch "$out.tmp" "$out"; rm -f "$out.tmp"
}

looks_like_patch(){ grep -qE '^(diff --git |---[ \t][^[:space:]]|Index: )' "$1"; }
patch_kind(){ grep -q '^diff --git ' "$1" && printf git || printf unified; }
list_headers(){ local pf="$1"
  if grep -q '^diff --git ' "$pf"; then
    awk '/^diff --git /{s=$3;d=$4;sub(/^a\//,"",s);sub(/^b\//,"",d);print s,d}' "$pf" | awk 'NF==2 && $1!="" && $2!=""'
  else
    awk '/^---[ \t]/{src=$2}/^\+\+\+[ \t]/{dst=$2;sub(/^a\//,"",src);sub(/^b\//,"",dst);print src,dst}' "$pf" | awk 'NF==2 && $1!="" && $2!=""'
  fi
}
apply_strip(){ local path="${1-}" n="${2-}" rel; [[ -z "$path" || -z "$n" ]] && { printf '%s' ""; return 0; }
  rel="$path"; for((i=0;i<n;i++));do [[ "$rel" == */* ]]||{ rel=""; break; }; rel="${rel#*/}"; done; printf '%s' "$rel"; }
candidate_dirs(){ local d="$PWD"; while :; do printf '%s\n' "$d"; [[ "$d" == "/" ]] && break; d="$(dirname "$d")"; done; }
decide_tool(){ local pf="$1"; [[ "$TOOL" == git || "$TOOL" == patch ]] && { printf '%s' "$TOOL"; return; }
  [[ "$(patch_kind "$pf")" == git && $(have git; echo $?) -eq 0 ]] && printf git || printf patch; }
try_apply_check_dir(){ local tool="$1" pf="$2" p="$3" dir="$4"
  if [[ "$tool" == git ]]; then (cd "$dir" && git apply --check -p"$p" "$pf") >/dev/null 2>&1
  else (cd "$dir" && patch --dry-run -p"$p" -i "$pf") >/dev/null 2>&1; fi
}

main(){
  local ID="" FROM_FILE=""
  if [[ $# -gt 0 ]]; then
    case "$1" in -h|--help) usage; exit 0;; --from-file) FROM_FILE="${2:-}"; shift 2 || true;; --*) : ;; *) ID="$1"; shift || true;; esac
    while [[ $# -gt 0 ]]; do
      case "$1" in --dir) DIR="$2"; shift 2;; --tool) TOOL="$2"; shift 2;;
        -h|--help) usage; exit 0;; *) die "unknown arg: $1";; esac
    done
  fi

  local work; work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
  local raw="$work/raw.diff" pf="$work/p.diff"

  if [[ -n "$FROM_FILE" ]]; then [[ -f "$FROM_FILE" ]] || die "patch file not found: $FROM_FILE"; cat "$FROM_FILE" >"$raw"
  elif [[ -n "$ID" ]]; then [[ -f "$DB/$ID.answer" ]] || die "answer not found: $DB/$ID.answer"; extract_patch_from_answer "$DB/$ID.answer" "$raw"
  else read_patch_from_stdin "$raw"; fi

  normalize_patch "$raw" "$pf"
  [[ -s "$pf" ]] || die "empty patch after normalization"
  looks_like_patch "$pf" || die "not a git/unified patch after normalization"

  printf 'kind     : %s\n' "$(patch_kind "$pf")"
  printf 'bytes    : %8d\n' "$(wc -c <"$pf")"
  printf 'lines    : %8d\n' "$(wc -l <"$pf")"
  printf 'files    :\n'; list_headers "$pf" | awk '{print "  src="$1"  dst="$2}'

  local tool; tool="$(decide_tool "$pf")"
  printf 'strip trials by dir:\n'
  local d p
  while read -r d; do
    printf '  [%s]\n' "$d"
    for p in $TRY_STRIPS; do
      if try_apply_check_dir "$tool" "$pf" "$p" "$d"; then
        printf '    -p%-2s OK\n' "$p"
      else
        printf '    -p%-2s FAIL\n' "$p"
      fi
    done
  done < <(candidate_dirs)

  if ! grep -q '^@@' "$pf"; then printf 'note: no @@ hunks found; patch may be malformed or truncated\n' >&2; fi
}
main "$@"
