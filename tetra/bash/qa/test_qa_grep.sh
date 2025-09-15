#!/usr/bin/env bash
# test_qa_grep.sh — refactored tests for K/Q/T/V .grep and enrichment (.grep2)
set -euo pipefail

# --- ensure fresh test-qa-dir ---
rm -rf "$QA_DIR"
mkdir -p "$QA_DIR/db" "$QA_DIR/grep" "$QA_DIR/ast"


# --- config ---
export QA_DIR="${QA_DIR:-./test-qa-dir}"
QA_DB="$QA_DIR/db"
QA_GREP="$QA_DIR/grep"
AST_DIR="$QA_DIR/ast"

# --- preflight ---
[[ -r ./melvin.sh ]] || { echo "missing: ./melvin.sh" >&2; exit 1; }
[[ -r ./grep.sh   ]] || { echo "missing: ./grep.sh"   >&2; exit 1; }
[[ -r ./ast.sh    ]] || { echo "missing: ./ast.sh"    >&2; exit 1; }

# --- fresh fixture ---
rm -rf "$QA_DIR"
mkdir -p "$QA_DB" "$QA_GREP" "$AST_DIR"

# Fixtures
cat > "$QA_DB/1111.prompt" <<'EOF'
what is the capital of france
EOF
cat > "$QA_DB/1111.answer" <<'EOF'
Paris is the capital of France.
EOF

cat > "$QA_DB/2222.prompt" <<'EOF'
what is 2+2
EOF
cat > "$QA_DB/2222.answer" <<'EOF'
The answer is 4.
EOF

cat > "$QA_DB/3333.prompt" <<'EOF'
tell me about Octave plotting
EOF
cat > "$QA_DB/3333.answer" <<'EOF'
Octave can plot with the `plot` function.
EOF

# Function-containing answer for AST test
cat > "$QA_DB/4444.answer" <<'EOF'
pre
foo() {
  echo France
  echo bar
}
post
EOF
: > "$QA_DB/4444.prompt"

# --- load system under test into current shell ---
# (qa.sh respects QA_DIR via : "${QA_DIR:=...}" guard)
source ./melvin.sh
source ./ast.sh

# --- helpers ---
pass=0; fail=0
last_grep_file() { ls -1t "$QA_GREP"/*.grep 2>/dev/null | head -n1; }
last_grep2_file(){ ls -1t "$QA_GREP"/*.grep2 2>/dev/null | head -n1; }
assert_grep() { local pat="$1" file="$2"; grep -Eq "$pat" "$file"; }
assert_eq() { local exp="$1" got="$2"; [[ "$exp" == "$got" ]]; }
ok() { echo "PASS: $*"; ((pass++)); }
ng() { echo "FAIL: $*"; ((fail++)); }

# --- T1: basic K/Q/T/V and body lines (france) ---
qa_grep "france" 0 >/dev/null
g1=$(last_grep_file)
if [[ -z "${g1:-}" ]]; then ng "T1: no .grep produced"; else
  assert_grep '^#K: france$' "$g1"           && \
  assert_grep '^\#V: score\(answer\)=2, score\(prompt\)=1, unit=line$' "$g1" && \
  assert_grep '^2: 1111\.answer, 1$' "$g1"   && \
  assert_grep '^1: 1111\.prompt, 1$' "$g1"   && ok "T1"
  [[ $? -eq 0 ]] || ng "T1: schema/body mismatch"
fi

# --- T2: dilation recorded in #Q (no effect on body; unit=line) ---
qa_grep "france" 2 >/dev/null
g2=$(last_grep_file)
if [[ -z "${g2:-}" ]]; then ng "T2: no .grep produced"; else
  assert_grep '^\#Q: db=\*\.\{prompt,answer\} dilation=2$' "$g2" && ok "T2" || ng "T2: #Q dilation missing"
fi

# --- T3: negative (no matches) → header-only file (4 lines) ---
qa_grep "ZZZ_NO_MATCH_TOKEN" 0 >/dev/null
g3=$(last_grep_file)
if [[ -z "${g3:-}" ]]; then ng "T3: no .grep produced"; else
  lines=$(wc -l < "$g3")
  # Expect exactly the 4 header lines (no body)
  if [[ "$lines" -eq 4 ]]; then ok "T3"; else ng "T3: expected 4 header lines, got $lines"; fi
fi

# --- T4: AST enrichment on 4444.answer (function foo) ---
qa_grep "France" 1 >/dev/null         # should hit 4444.answer line 3
g4=$(last_grep_file)
[[ -n "${g4:-}" ]] || { ng "T4: no .grep produced"; }

# Enrich (produces .grep2 with ctx and fun bounds)
g4e=$(qa_grep_enrich "$g4")
[[ -n "${g4e:-}" && -r "$g4e" ]] || { ng "T4: enrichment failed"; }

# Validate enriched line: score=2 (answer), id.ext=4444.answer, line=3, ctx:2,4, fun:BASH.foo:2,5
if assert_grep '^2: 4444\.answer, 3, ctx:2,4, fun:BASH\.foo:2,5$' "$g4e"; then
  ok "T4"
else
  echo "--- grep2 dump ---"; cat "$g4e" || true
  ng "T4: enriched record mismatch"
fi

# --- T5: enrichment header integrity ---
assert_grep '^#K: France$' "$g4e" && \
assert_grep '^\#Q: db=\*\.\{prompt,answer\} dilation=1$' "$g4e" && \
assert_grep '^\#T: [0-9]+$' "$g4e" && \
assert_grep '^\#V: unit=line, ctx, fun-range$' "$g4e" \
&& ok "T5" || ng "T5: grep2 header mismatch"

echo
echo "Tests: $((pass+fail))  Passed: $pass  Failed: $fail"
exit $(( fail==0 ? 0 : 1 ))
