# Minify HTML + inline JS/CSS to index-min.html and report size savings on stderr.
tetra_web_min() {
  local src="${1:-index.html}"
  local dst="${2:-index-min.html}"

  if ! command -v npx >/dev/null 2>&1; then
    echo "error: npx not found in PATH" >&2
    return 127
  fi
  if [ ! -f "$src" ]; then
    echo "error: source '$src' not found" >&2
    return 2
  fi

  npx --yes html-minifier-terser \
    --collapse-whitespace --remove-comments --remove-redundant-attributes \
    --remove-attribute-quotes --minify-css true \
    --minify-js '{"compress":{"passes":2},"mangle":true}' \
    "$src" -o "$dst" || return $?

  local s_src s_dst saved pct
  s_src=$(wc -c <"$src" | tr -d ' ')
  s_dst=$(wc -c <"$dst" | tr -d ' ')
  saved=$(( s_src - s_dst ))
  if [ "$s_src" -gt 0 ]; then
    pct=$(awk -v a="$s_src" -v b="$s_dst" 'BEGIN{ printf("%.2f", (a-b)*100.0/a) }')
  else
    pct="0.00"
  fi
  printf "minified %s → %s\n%d → %d bytes | saved %d bytes (%s%%)\n" \
    "$src" "$dst" "$s_src" "$s_dst" "$saved" "$pct" >&2
}
