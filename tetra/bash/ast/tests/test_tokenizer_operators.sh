#!/usr/bin/env bash
# Operator tokenizer tests

#==============================================================================
# SINGLE CHARACTER OPERATORS
#==============================================================================

CURRENT_TEST="op_semicolon"
output=$(bash_cst_tokenize 'echo a; echo b')
assert_contains "$output" 'SEMI:;:1:7' "Semicolon"

CURRENT_TEST="op_ampersand"
output=$(bash_cst_tokenize 'cmd &')
assert_contains "$output" 'AMP:&:1:5' "Background ampersand"

CURRENT_TEST="op_pipe"
output=$(bash_cst_tokenize 'cmd1 | cmd2')
assert_contains "$output" 'PIPE:|:1:6' "Pipe"

CURRENT_TEST="op_less"
output=$(bash_cst_tokenize 'cmd < file')
assert_contains "$output" 'LESS:<:1:5' "Input redirect"

CURRENT_TEST="op_great"
output=$(bash_cst_tokenize 'cmd > file')
assert_contains "$output" 'GREAT:>:1:5' "Output redirect"

CURRENT_TEST="op_lparen"
output=$(bash_cst_tokenize '(cmd)')
assert_contains "$output" 'LPAREN:(:1:1' "Left paren"
assert_contains "$output" 'RPAREN:):1:5' "Right paren"

CURRENT_TEST="op_lbrace"
output=$(bash_cst_tokenize '{ cmd; }')
assert_contains "$output" 'LBRACE:{:1:1' "Left brace"
assert_contains "$output" 'RBRACE:}:1:8' "Right brace"

CURRENT_TEST="op_lbracket"
output=$(bash_cst_tokenize '[ -f file ]')
assert_contains "$output" 'LBRACKET:[:1:1' "Left bracket"
assert_contains "$output" 'RBRACKET:]:1:11' "Right bracket"

CURRENT_TEST="op_assign"
output=$(bash_cst_tokenize 'x=y')
assert_contains "$output" 'ASSIGN:=:1:2' "Assignment"

CURRENT_TEST="op_bang"
output=$(bash_cst_tokenize '! cmd')
assert_contains "$output" 'BANG:!:1:1' "Negation"

#==============================================================================
# DOUBLE CHARACTER OPERATORS
#==============================================================================

CURRENT_TEST="op_damp"
output=$(bash_cst_tokenize 'cmd1 && cmd2')
assert_contains "$output" 'DAMP:&&:1:6' "Logical AND"

CURRENT_TEST="op_dpipe"
output=$(bash_cst_tokenize 'cmd1 || cmd2')
assert_contains "$output" 'DPIPE:||:1:6' "Logical OR"

CURRENT_TEST="op_dsemi"
output=$(bash_cst_tokenize 'case x in a) ;; esac')
assert_contains "$output" 'DSEMI:;;:1:14' "Case terminator"

CURRENT_TEST="op_dgreat"
output=$(bash_cst_tokenize 'cmd >> file')
assert_contains "$output" 'DGREAT:>>:1:5' "Append redirect"

CURRENT_TEST="op_dblbracket"
output=$(bash_cst_tokenize '[[ -f file ]]')
assert_contains "$output" 'DBLBRACKET:[[:1:1' "Double bracket open"
assert_contains "$output" 'DBLBRACKET_END:]]:1:12' "Double bracket close"

CURRENT_TEST="op_heredoc"
output=$(bash_cst_tokenize 'cat << EOF')
assert_contains "$output" 'HEREDOC:<<:1:5' "Heredoc marker"

CURRENT_TEST="op_herestring"
output=$(bash_cst_tokenize 'cat <<< "text"')
assert_contains "$output" 'HERESTRING:<<<:1:5' "Herestring"

CURRENT_TEST="op_lessand"
output=$(bash_cst_tokenize 'cmd <& 3')
assert_contains "$output" 'LESSAND:<&:1:5' "Input from fd"

CURRENT_TEST="op_greatand"
output=$(bash_cst_tokenize 'cmd >& 2')
assert_contains "$output" 'GREATAND:>&:1:5' "Output to fd"

#==============================================================================
# PROCESS SUBSTITUTION
#==============================================================================

CURRENT_TEST="op_proc_sub_in"
output=$(bash_cst_tokenize 'diff <(cmd1) <(cmd2)')
assert_contains "$output" 'PROC_SUB_IN:<(:1:6' "Process substitution input"

CURRENT_TEST="op_proc_sub_out"
output=$(bash_cst_tokenize 'cmd >(tee file)')
assert_contains "$output" 'PROC_SUB_OUT:>(:1:5' "Process substitution output"

#==============================================================================
# ARITHMETIC OPERATORS
#==============================================================================

CURRENT_TEST="op_darith"
output=$(bash_cst_tokenize '((x++))')
assert_contains "$output" 'DARITH:((:1:1' "Arithmetic double paren"

#==============================================================================
# COMPLEX EXPRESSIONS
#==============================================================================

CURRENT_TEST="op_complex_redirect"
output=$(bash_cst_tokenize 'cmd 2>&1 > file')
assert_contains "$output" 'GREATAND:>&:1:6' "Stderr to stdout"
assert_contains "$output" 'GREAT:>:1:10' "Stdout to file"

CURRENT_TEST="op_complex_conditional"
output=$(bash_cst_tokenize '[[ -f file && -r file ]]')
assert_contains "$output" 'DBLBRACKET:[[:1:1' "Open bracket"
assert_contains "$output" 'DAMP:&&:1:12' "Logical AND in test"
assert_contains "$output" 'DBLBRACKET_END:]]:1:23' "Close bracket"

CURRENT_TEST="op_subshell"
output=$(bash_cst_tokenize '(cd /tmp && ls)')
assert_contains "$output" 'LPAREN:(:1:1' "Subshell start"
assert_contains "$output" 'DAMP:&&:1:10' "AND in subshell"
assert_contains "$output" 'RPAREN:):1:15' "Subshell end"

#==============================================================================
# EDGE CASES
#==============================================================================

CURRENT_TEST="op_adjacent"
output=$(bash_cst_tokenize 'cmd;cmd')
assert_contains "$output" 'WORD:cmd:1:1' "First command"
assert_contains "$output" 'SEMI:;:1:4' "Semicolon (no space)"
assert_contains "$output" 'WORD:cmd:1:5' "Second command"

CURRENT_TEST="op_multiple_pipes"
output=$(bash_cst_tokenize 'a | b | c | d')
pipe_count=$(echo "$output" | grep -c "PIPE:|")
assert_equals "3" "$pipe_count" "Three pipes"

CURRENT_TEST="op_mixed_logic"
output=$(bash_cst_tokenize 'a && b || c && d')
and_count=$(echo "$output" | grep -c "DAMP:&&")
or_count=$(echo "$output" | grep -c "DPIPE:||")
assert_equals "2" "$and_count" "Two ANDs"
assert_equals "1" "$or_count" "One OR"
