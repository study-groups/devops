#!/usr/bin/env bash
# pb.sh — PM2 helper with safeguards against process storms and fork exhaustion.
# Usage: source this file, then run: pb <cmd> [args...]

# --- portable single-instance lock (avoids concurrent pb invocations) ---
__pb_lockdir="${PB_LOCKDIR:-/tmp/pb.lockdir}"
__pb_acquire_lock() {
  if mkdir "${__pb_lockdir}" 2>/dev/null; then
    trap '__pb_release_lock' EXIT INT TERM
    return 0
  else
    echo "pb: busy (another invocation is running)" >&2
    return 1
  fi
}
__pb_release_lock() { rm -rf "${__pb_lockdir}" 2>/dev/null || true; }

# --- hard fails & predictable word-splitting inside pb() only ---
pb() {
  # shellcheck disable=SC2034 # we intentionally localize IFS
  local IFS=$' \t\n'
  set -o nounset
  set -o errexit
  set -o pipefail

  __pb_acquire_lock || return 2

  # --- deps ---
  command -v pm2 >/dev/null 2>&1 || { echo "pb: pm2 not found in PATH" >&2; return 127; }

  # --- helpers ---
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
Notes:
  - 'restart/stop/delete/logs' forward all args to pm2 in a single call.
  - 'start' extracts PORT from environment or from the script (PORT= / export PORT=).
EOF
  }

  _is_uint() { [[ "$1" =~ ^[0-9]+$ ]]; }
  _valid_port() { _is_uint "$1" && (( $1 >= 1 && $1 <= 65535 )); }

  _extract_port_from_script() {
    # No eval. Parse the first assignment safely: PORT=... or export PORT=...
    local script="$1" line val
    line="$(grep -E '^(export[[:space:]]+)?PORT=' "$script" | head -n1 || true)"
    [[ -z "${line}" ]] && return 1
    # strip leading "export ", take after first "=", strip quotes and spaces
    val="${line#*=}"
    val="${val%%#*}"
    val="${val//\"/}"
    val="${val//\'/}"
    val="${val//[[:space:]]/}"
    if _valid_port "${val}"; then
      printf '%s' "${val}"
      return 0
    fi
    return 2
  }

  _pm2_all_or_forward() {
    # $1 is subcommand, rest are args
    local sub="$1"; shift || true
    if (($# == 0)); then echo "pb: ${sub} requires args or '*'" >&2; return 64; fi
    if [[ "$1" == "*" ]]; then
      pm2 "${sub}" all
    else
      # Single pm2 invocation with all targets to avoid per-target forks.
      pm2 "${sub}" "$@"
    fi
  }

  # --- dispatch ---
  local action="${1:-}"
  if [[ -z "${action}" ]]; then _usage; return 0; fi
  shift || true

  case "${action}" in
    ls)
      printf 'PM2_HOME=%s\n' "${PM2_HOME:-}"
      pm2 ls
      ;;

    start)
      local script="${1:-}"; local custom="${2:-}"
      [[ -n "${script}" ]] || { echo "pb: start <script.sh> [name]" >&2; return 64; }
      [[ -f "${script}" && -x "${script}" ]] || { echo "pb: '${script}' not found or not executable" >&2; return 66; }

      # Determine PORT: env overrides, else parse script.
      local port="${PORT:-}"
      if [[ -z "${port:-}" ]]; then
        port="$(_extract_port_from_script "${script}")" || {
          echo "pb: PORT not set; no PORT= found in script" >&2; return 65;
        }
      fi
      _valid_port "${port}" || { echo "pb: invalid PORT '${port}'" >&2; return 65; }

      local script_basename; script_basename="$(basename "${script}" .sh)"
      local name="${custom:-${script_basename}}-${port}"

      # Single spawn; disable watch unless explicitly wanted via env.
      # Allow caller to pass PM2_EXTRA (e.g., '--update-env').
      pm2 start "${script}" --name "${name}" ${PM2_EXTRA:-} --instances 1
      ;;

    stop)    _pm2_all_or_forward stop "$@";;
    delete|del|kill) _pm2_all_or_forward delete "$@";;
    restart) _pm2_all_or_forward restart "$@";;
    logs)    _pm2_all_or_forward logs "$@";;

    ports)
      # Prefer jq if available; fall back to name parsing.
      if command -v jq >/dev/null 2>&1; then
        pm2 jlist \
          | jq -r '.[] | select(.pm2_env.status=="online") | .name' \
          | awk '
              match($0,/-([0-9]+)$/,m){ port=m[1]; name=substr($0,1,RSTART-1); print "Process: " name ", Port: " port }
            '
      else
        pm2 jlist \
          | grep -Eo '"name":[^,]+' \
          | sed -E 's/.*"name":"?([^",}]+)".*/\1/' \
          | awk '
              match($0,/-([0-9]+)$/,m){ port=m[1]; name=substr($0,1,RSTART-1); print "Process: " name ", Port: " port }
            '
      fi
      ;;

    help) _usage ;;

    *)
      echo "pb: unknown command '${action}'" >&2
      _usage
      return 64
      ;;
  esac
}

