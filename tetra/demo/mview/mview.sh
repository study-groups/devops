#!/usr/bin/env bash
# mview: top selector + middle renderer (glow|cat) + bottom status
# macOS Bash 3.2 compatible. Symlink-safe docs/. No DECSTBM.

set -euo pipefail

# --- config -------------------------------------------------------------------
DOC_DIR="./docs"
LOGFILE="./log.demo"
TOP_LINES=1
BOTTOM_LINES=4

# glow runtime config (overridable via ./glow.env.sh)
COLOR_ON=1                 # 1=color ANSI on, 0=monochrome
GLOW_STYLE="dark"          # dark|light|dracula|auto|notty
GLOW_OPTS_EXTRA=()         # e.g., ("--no-wrap")

# --- state --------------------------------------------------------------------
files=()
sel=0
rows=0 cols=0
mid_top=0 mid_bot=0
view_lines=()
scroll=0

# --- utils --------------------------------------------------------------------
log() { printf "[%s] %s\n" "$(date '+%F %T')" "$*" >>"$LOGFILE"; }
die() { printf "mview: %s\n" "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }
clear_line() { printf "%-${cols}s" ""; }

load_glow_config() {
  if [[ -f ./glow.env.sh ]]; then set +u; . ./glow.env.sh; set -u; fi
  [[ "${COLOR_ON:-}" =~ ^(0|1)$ ]] || COLOR_ON=1
  [[ -n "${GLOW_STYLE:-}" ]] || GLOW_STYLE="dark"
}

# --- IO/TTY -------------------------------------------------------------------
setup_tty() { stty -echo -icanon -icrnl -inlcr -ixon -ixoff -istrip cs8 min 1 time 0; }
restore_tty() { stty sane; }

read_key() {
  local a b c; IFS= read -rsn1 a || return 1
  case "$a" in
    $'\r'|$'\n'|' ') echo ENTER ;;
    r) echo REDRAW ;;
    c) echo TOGGLE_COLOR ;;
    s) echo CYCLE_STYLE ;;
    R) echo RELOAD_CONF ;;
    q) echo q ;;
    $'\x1b')
      IFS= read -rsn1 -t 0.03 b || { echo OTHER; return 0; }
      if [[ $b == "[" ]]; then
        IFS= read -rsn1 -t 0.03 c || { echo OTHER; return 0; }
        case "$c" in
          A) echo KUP ;; B) echo KDN ;; C) echo RIGHT ;; D) echo LEFT ;;
          5) IFS= read -rsn1 -t 0.03 _; echo PGUP ;;
          6) IFS= read -rsn1 -t 0.03 _; echo PGDN ;;
          *) echo OTHER ;;
        esac
      else echo OTHER; fi
      ;;
    j) echo KDN ;; k) echo KUP ;;
    *) echo OTHER ;;
  esac
}

# --- layout -------------------------------------------------------------------
geom() {
  rows=$(tput lines); cols=$(tput cols)
  (( rows > TOP_LINES + BOTTOM_LINES + 2 )) || die "terminal too small"
  mid_top=$((TOP_LINES + 1))
  mid_bot=$((rows - BOTTOM_LINES))
  log "geom rows=$rows cols=$cols mid_top=$mid_top mid_bot=$mid_bot"
}

clear_middle() { local r; for ((r=mid_top-1; r<=mid_bot-1; r++)); do tput cup "$r" 0; clear_line; done; }

draw_top() {
  tput cup 0 0; clear_line
  local x=0 i
  for i in "${!files[@]}"; do
    local base; base="${files[i]##*/}"
    local seg; seg=" ${base} "
    local seglen; seglen=${#seg}
    (( x + seglen >= cols )) && break
    tput cup 0 "$x"
    if (( i == sel )); then printf "\033[1m%s\033[22m" "$seg"; else printf "%s" "$seg"; fi
    x=$((x + seglen))
  done
}

draw_bottom() {
  tput cup $((rows - BOTTOM_LINES)) 0; printf "%-${cols}s" ">"
  tput cup $((rows - BOTTOM_LINES + 1)) 0; clear_line
  tput cup $((rows - BOTTOM_LINES + 2)) 0; clear_line
  local total=${#view_lines[@]}
  local win=$(( mid_bot - mid_top + 1 ))
  local shown=$(( total==0 ? 0 : ( (scroll + win <= total) ? (scroll + win) : total ) ))
  local colors_cap; colors_cap=$(tput colors 2>/dev/null || echo "?")
  tput cup $((rows - 1)) 0
  printf "%-${cols}s" "←/→ select • ENTER/SPACE open • j/k PgUp/PgDn scroll • c color • s style • R reload • r redraw • q quit • [$shown/$total] • color=${COLOR_ON} style=${GLOW_STYLE} • tput_colors=${colors_cap}"
}

draw_frame() { tput clear; tput civis; geom; draw_top; draw_bottom; }

paint_middle() {
  local win=$(( mid_bot - mid_top + 1 )) total=${#view_lines[@]}
  clear_middle
  local r
  for ((r=0; r<win; r++)); do
    local idx=$(( scroll + r ))
    (( idx >= 0 && idx < total )) || break
    tput cup $(( (mid_top - 1) + r )) 0
    printf "%s\033[K" "${view_lines[idx]}"   # keep ANSI intact
  done
  draw_bottom
}

# --- data ---------------------------------------------------------------------
init_files() {
  : >"$LOGFILE"
  [[ -d "$DOC_DIR" ]] || die "missing $DOC_DIR"
  files=(); shopt -s nullglob
  local f; for f in "$DOC_DIR"/*; do [[ -f "$f" ]] || continue; [[ "$(basename "$f")" == .* ]] && continue; files+=( "$f" ); done
  shopt -u nullglob
  ((${#files[@]})) || die "no files in $DOC_DIR"
  IFS=$'\n' files=($(printf '%s\n' "${files[@]}" | LC_ALL=C sort))
  log "found ${#files[@]} files (symlink-safe)"
}

# --- rendering (FIX: ensure NO_COLOR truly unset; force color if enabled) -----
render_file() {
  local f="${files[sel]}"
  view_lines=(); scroll=0

  if have glow; then
    log "glow render file=$f width=$cols style=$GLOW_STYLE color_on=$COLOR_ON"
    if (( COLOR_ON )); then
      # Unset NO_COLOR for this invocation; force color hints; ensure color-capable TERM vars.
      if ! env -u NO_COLOR CLICOLOR_FORCE=1 FORCE_COLOR=1 \
           TERM="${TERM:-xterm-256color}" COLORTERM="${COLORTERM:-truecolor}" \
           bash -c 'LANG=C glow --style="'"$GLOW_STYLE"'" --width "'"$cols"'" '"${GLOW_OPTS_EXTRA[@]+"${GLOW_OPTS_EXTRA[@]}"}"' -- "$1"' _ "$f" \
           | { mapfile -t view_lines; printf ''; }; then
        log "glow failed; fallback to cat (color)"
        mapfile -t view_lines < <(cat -- "$f")
      fi
    else
      if ! NO_COLOR=1 CLICOLOR_FORCE=0 FORCE_COLOR=0 \
           LANG=C glow --style=notty --width "$cols" "${GLOW_OPTS_EXTRA[@]}" -- "$f" \
           | { mapfile -t view_lines; printf ''; }; then
        log "glow failed; fallback to cat (mono)"
        mapfile -t view_lines < <(cat -- "$f")
      fi
    fi
  else
    log "glow missing; fallback to cat"
    mapfile -t view_lines < <(cat -- "$f")
  fi

  log "rendered ${#view_lines[@]} lines"
  paint_middle
}

scroll_by() {
  local delta=$1 total=${#view_lines[@]} win=$(( mid_bot - mid_top + 1 ))
  local max_scroll=$(( total>win ? total - win : 0 ))
  local ns=$(( scroll + delta ))
  (( ns < 0 )) && ns=0
  (( ns > max_scroll )) && ns=$max_scroll
  if (( ns != scroll )); then scroll=$ns; log "scroll=$scroll"; paint_middle; fi
}

# --- key handling -------------------------------------------------------------
handle_key() {
  case "$1" in
    LEFT)  (( sel = (sel + ${#files[@]} - 1) % ${#files[@]} )); draw_top; draw_bottom; render_file ;;
    RIGHT) (( sel = (sel + 1) % ${#files[@]} ));               draw_top; draw_bottom; render_file ;;
    ENTER) render_file ;;
    KUP)   scroll_by -1 ;;
    KDN)   scroll_by 1 ;;
    PGUP)  scroll_by -5 ;;
    PGDN)  scroll_by 5 ;;
    TOGGLE_COLOR) COLOR_ON=$((1-COLOR_ON)); log "toggle color -> $COLOR_ON"; render_file ;;
    CYCLE_STYLE)
      case "$GLOW_STYLE" in
        dark)    GLOW_STYLE="light" ;;
        light)   GLOW_STYLE="dracula" ;;
        dracula) GLOW_STYLE="auto" ;;
        auto|*)  GLOW_STYLE="dark" ;;
      esac
      log "cycle style -> $GLOW_STYLE"; render_file ;;
    RELOAD_CONF) load_glow_config; log "reloaded glow.env.sh: color=$COLOR_ON style=$GLOW_STYLE"; render_file ;;
    REDRAW)      draw_frame; paint_middle ;;
    q)           return 1 ;;
    *)           : ;;
  esac
  return 0
}

# --- main ---------------------------------------------------------------------
cleanup() { tput cnorm; restore_tty; printf "\n"; }

main() {
  load_glow_config
  init_files
  setup_tty
  trap 'cleanup; exit 0' INT TERM EXIT
  trap 'tput sc; draw_frame; tput rc; paint_middle' SIGWINCH

  draw_frame
  render_file

  while :; do
    key=$(read_key) || continue
    log "key=$key"
    handle_key "$key" || break
  done
}

main "$@"
