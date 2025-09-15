# grep.sh — pass 1 (K/Q/T/V line hits) and pass 2 enrichment (bloom + function)

qa_grep() {
  local regex="$1"; shift || { echo "Usage: qa_grep <regex> [dilation]"; return 2; }
  local ctx="${1:-0}"                       # stored in header; unit=line for V
  : "${QA_DIR:=$HOME/.qa}"
  local db="$QA_DIR/db"
  local logdir="$QA_DIR/grep"; mkdir -p "$logdir"
  local ts; ts=$(date +%s)
  local out="$logdir/$ts.grep"

  local files=("$db"/*.prompt "$db"/*.answer)
  [[ -e "${files[0]}" ]] || { echo "qa_grep: no files under $db" >&2; return 1; }

  awk -v re="$regex" -v ts="$ts" -v ctx="$ctx" -v out="$out" '
    BEGIN {
      o = out; IGNORECASE=1
      print "#K: " re                                > o
      print "#Q: db=*.{prompt,answer} dilation="ctx  > o
      print "#T: " ts                                > o
      print "#V: score(answer)=2, score(prompt)=1, unit=line" > o
    }
    FNR==1 {
      file = FILENAME
      id = file; sub(/^.*\//,"",id); sub(/\.[^.]+$/,"",id)
      ext = file; sub(/^.*\./,"",ext)
    }
    tolower($0) ~ tolower(re) {
      score = (ext == "answer" ? 2 : 1)
      printf "%d: %s.%s, %d\n", score, id, ext, FNR >> o
    }
  ' "${files[@]}"

  echo "$out"
}

# Enrich a .grep file (pass 2): add bloom window and function bounds
# Output: <same-dir>/<ts>.grep2 with lines:
#   <score>: <id>.<ext>, <line>, ctx:<start>,<end>, fun:BASH.<name>:<fstart>,<fend>
qa_grep_enrich() {
  local grep_file="$1"; shift || { echo "Usage: qa_grep_enrich <file.grep>"; return 2; }
  : "${QA_DIR:=$HOME/.qa}"
  local db="$QA_DIR/db"
  local ast_dir="$QA_DIR/ast"; mkdir -p "$ast_dir"

  # parse header: get K, ctx, ts
  local K Qdil T
  K=$(grep -m1 '^#K:' "$grep_file" | sed 's/^#K:[[:space:]]*//')
  Qdil=$(grep -m1 '^#Q:' "$grep_file" | sed -n 's/.*dilation=\([0-9][0-9]*\).*/\1/p')
  T=$(grep -m1 '^#T:' "$grep_file" | sed 's/^#T:[[:space:]]*//')
  [[ -z "$Qdil" ]] && Qdil=0

  local out="${grep_file%.*}.grep2"
  {
    echo "#K: $K"
    echo "#Q: db=*.{prompt,answer} dilation=$Qdil"
    echo "#T: $T"
    echo "#V: unit=line, ctx, fun-range"
  } > "$out"

  # process each match line
  grep -E '^[0-9]+: .+\.(prompt|answer), [0-9]+' "$grep_file" | while IFS= read -r rec; do
    # parse: "<score>: <id>.<ext>, <line>"
    local score id ext line
    score=${rec%%:*}; rest=${rec#*: }
    idext=${rest%%,*}; line=${rest##*, }; line=${line//[[:space:]]/}
    id=${idext%.*}; ext=${idext##*.}
    local file="$db/$id.$ext"

    # bloom window
    local nlines; nlines=$(wc -l < "$file")
    local cstart=$(( line - Qdil )); (( cstart<1 )) && cstart=1
    local cend=$(( line + Qdil ));  (( cend>nlines )) && cend=$nlines

    # function index + lookup (bash)
    local idx="$ast_dir/$id.$ext.bashfun"
    [[ -s "$idx" ]] || ast_bash_index "$file" "$idx"
    read lang fname fstart fend < <(ast_bash_lookup "$idx" "$line" "$file")

    if [[ "$lang" == "BASH" ]]; then
      echo "$score: $id.$ext, $line, ctx:$cstart,$cend, fun:BASH.$fname:$fstart,$fend" >> "$out"
    else
      echo "$score: $id.$ext, $line, ctx:$cstart,$cend, fun:BASH.NONE:1,$nlines"      >> "$out"
    fi
  done

  echo "$out"
}
