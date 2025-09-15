# ast.sh — function indexing (pass 2 primitives)

# Index Bash functions in a file -> $out (format: "fun BASH <name> <start> <end>")
ast_bash_index() {
  local file="$1" out="$2"
  mkdir -p "$(dirname "$out")"
  awk -v OFS=' ' '
    function count(c, s,   n) { n=gsub(c,"",s); return n }
    BEGIN { in_fun=0; depth=0 }
    {
      line=$0
      # naive comment strip (does not handle quotes/heredocs robustly)
      hash=index(line,"#"); if (hash>0) line=substr(line,1,hash-1)

      if (!in_fun) {
        # name() { … }
        if (match(line, /^[ \t]*([a-zA-Z_][a-zA-Z0-9_]*)[ \t]*\(\)[ \t]*\{/, m)) {
          fun=m[1]; start=FNR; in_fun=1; depth=1; next
        }
        # function name { … }
        if (match(line, /^[ \t]*function[ \t]+([a-zA-Z_][a-zA-Z0-9_]*)[ \t]*\{/, m)) {
          fun=m[1]; start=FNR; in_fun=1; depth=1; next
        }
        next
      }

      # inside function: update brace depth (very approximate)
      open = gsub(/{/,"{", line)
      close = gsub(/}/,"}", line)
      depth += (open - close)

      if (depth<=0) {
        printf "fun BASH %s %d %d\n", fun, start, FNR
        in_fun=0; depth=0
      }
    }
    END {
      if (in_fun) {
        # unclosed function till EOF
        printf "fun BASH %s %d %d\n", fun, start, FNR
      }
    }
  ' "$file" > "$out"
}

# Find containing function for a given line. Echo "BASH <name> <start> <end>" or "NONE - 1 <nlines>"
ast_bash_lookup() {
  local idx="$1" line="$2" file="$3"
  if [[ -s "$idx" ]]; then
    awk -v L="$line" '
      $1=="fun" && $2=="BASH" { if (L>=$4 && L<=$5) { print $2, $3, $4, $5; found=1; exit } }
      END { if (!found) print "NONE - 1 0" }
    ' "$idx"
  else
    local n; n=$(wc -l < "$file")
    echo "NONE - 1 $n"
  fi
}
