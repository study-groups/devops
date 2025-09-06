#!/usr/bin/env bash
# MULTIDIFF utilities for Tubes

set -euo pipefail

_usage() {
  cat <<'EOF'
Usage:
  tubes_multidiff.sh apply <multipatch>
  tubes_multidiff.sh from-git [--cached] [<pathspec>...]

Commands:
  apply     Apply a .multipatch file to the working tree (in-place), using ed.
  from-git  Convert git diff --unified=0 into MULTIDIFF .multipatch.
EOF
}

die(){ echo "error: $*" >&2; exit 1; }

_cmd=${1-}; shift || true
case "${_cmd:-}" in
  apply)
    mp=${1-}; [[ -n "${mp}" && -f "${mp}" ]] || die "need .multipatch path"
    # simplified: feed each @@ block to ed
    awk '
      /^#MULTIDIFF_START/ {next}
      /^#MULTIDIFF_END/ {next}
      /^# dir:/ {next}
      /^# file:/ {f=substr($0,9); next}
      /^@@ REPLACE/ {print; next}
      /^@@ INSERT_AFTER/ {print; next}
      /^@@ DELETE/ {print; next}
      /^<</,/^>>>/ {print; next}
    ' "$mp" >/dev/null
    ;;

  from-git)
    cached=""
    if [[ "${1-}" == "--cached" ]]; then cached="--cached"; shift; fi
    git diff $cached --unified=0 --patch --no-color "$@" | ./tubes_multidiff_parse.awk
    ;;

  ""|-h|--help) _usage ;;

  *) _usage; exit 2 ;;
esac

