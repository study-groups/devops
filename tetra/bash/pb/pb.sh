# shellcheck shell=bash
# pb.sh — define pb() only; safe to source even with `set -e` in the parent.

# --- no top-level commands; only defs below ---

# single-instance lock helpers (used only inside pb())
__pb_lockdir_default="/tmp/pb.lockdir"
__pb_acquire_lock() {
  local lockdir="${PB_LOCKDIR:-$__pb_lockdir_default}"
  if mkdir "$lockdir" 2>/dev/null; then
    # release on function exit of pb(); pb() installs the trap
    PB___LOCKDIR="$lockdir"
    return 0
  fi
  echo "pb: busy (another invocation is running)" >&2
  return 1
}
__pb_release_lock() {
  [[ -n "${PB___LOCKDIR:-}" ]] && rm -rf "$PB___LOCKDIR" 2>/dev/null || true
  unset PB___LOCKDIR
}

pb() {
  # DO NOT set shell options globally; keep this function self-contained.
  # Avoid `set -e/-u/-o pipefail` to prevent leaking to the caller when sourced.
  # Instead, check statuses explicitly and return nonzero on failure.

  # Basic arg parse
  local action="${1:-}"
  if [[ -z "$action" ]]; then
    _usage
    return 0
  fi
  shift || true

  # Acquire lock (serialize pb invocations)
  __pb_acquire_lock || return 2
  # Ensure we always release the lock when pb() returns
  trap '__pb_release_lock' RETURN

  # Require pm2 only when needed
  _need_pm2() {
    command -v pm2 >/dev/null 2>&1 || { echo "pb: pm2 not found in PATH" >&2; return 127; }
  }

  _usage() {
    cat <<'EOF'
Usage: pb <command> [args]
Commands:
  ls
  start <path/to/script.sh> [name]
  stop   <id|name ... | *>
  delete <id|name ... | *>
  kill   <id|name ... | *>
  restart <id|name ... | *>
  logs   <id|name ... | *>
  ports
  help
EOF
  }

  _is_uint() { [[ "$1" =~ ^[0-9]+$ ]]; }
  _valid_port() { _is_uint "$1" && (( $1 >= 1024 && $1 <= 65535 )); }

  _extract_port_from_script() {
    local script="$1" line val
    line="$(grep -E '^(export[[:space:]]+)?PORT=' "$script" | head -n1 || true)"
    [[ -z "$line" ]] && return 1
    val="${line#*=}"; val="${val%%#*}"
    val="${val//\"/}"; val="${val//\'/}"; val="${val//[[:space:]]/}"
    _valid_port "$val" || return 2
    printf '%s' "$val"
  }

  _pm2_all_or_forward() {
    local sub="$1"; shift || true
    _need_pm2 || return $?
    [[ $# -gt 0 ]] || { echo "pb: ${sub} requires args or '*'" >&2; return 64; }
    if [[ "$1" == "*" ]]; then
      pm2 "$sub" all || { echo "pb: pm2 ${sub} all failed" >&2; return 1; }
    else
      pm2 "$sub" "$@" || { echo "pb: pm2 ${sub} $* failed" >&2; return 1; }
    fi
  }

  case "$action" in
    ls)
      printf 'PM2_HOME=%s\n' "${PM2_HOME:-}"
      _need_pm2 || return $?
      pm2 ls
      ;;

    start)
      _need_pm2 || return $?
      local script="${1:-}"; local custom="${2:-}"
      [[ -n "$script" ]] || { echo "pb: start <script.sh> [name]" >&2; return 64; }
      [[ -f "$script" && -x "$script" ]] || { echo "pb: '$script' not found or not executable" >&2; return 66; }

      local port="${PORT:-}"
      if [[ -z "$port" ]]; then
        port="$(_extract_port_from_script "$script")" || {
          echo "pb: PORT not set; no valid PORT= in script" >&2; return 65;
        }
      fi
      _valid_port "$port" || { echo "pb: invalid PORT '$port'" >&2; return 65; }

      local base; base="$(basename "$script" .sh)"
      local name="${custom:-$base}-${port}"

      pm2 start "$script" --name "$name" ${PM2_EXTRA:-} --instances 1
      ;;

    stop)    _pm2_all_or_forward stop "$@";;
    delete|del) _pm2_all_or_forward delete "$@";;
    kill)    _pm2_all_or_forward kill "$@";;
    restart) _pm2_all_or_forward restart "$@";;
    logs)    _pm2_all_or_forward logs "$@";;

    ports)
      _need_pm2 || return $?
      if command -v jq >/dev/null 2>&1; then
        pm2 jlist \
          | jq -r '.[] | select(.pm2_env.status=="online") | .name' \
          | awk 'match($0,/-([0-9]+)$/,m){ port=m[1]; name=substr($0,1,RSTART-1); print "Process: " name ", Port: " port }'
      else
        pm2 jlist \
          | grep -Eo '"name":[^,]+' \
          | sed -E 's/.*"name":"?([^",}]+)".*/\1/' \
          | awk 'match($0,/-([0-9]+)$/,m){ port=m[1]; name=substr($0,1,RSTART-1); print "Process: " name ", Port: " port }'
      fi
      ;;

    help) _usage ;;

    *)
      echo "pb: unknown command '$action'" >&2
      _usage
      return 64
      ;;
  esac
}

# --- sourcing/exec guard (do nothing when sourced; print hint if executed) ---
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "This file is meant to be sourced:  . \"$0\"" >&2
  exit 0
fi
# ensure a zero status when sourced even under `set -e`
true
