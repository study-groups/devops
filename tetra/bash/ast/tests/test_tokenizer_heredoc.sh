#!/usr/bin/env bash
# test_tokenizer_heredoc.sh - Heredoc tokenizer and parser tests

#==============================================================================
# TOKENIZER TESTS
#==============================================================================

CURRENT_TEST="heredoc_basic_tokenize"
input=$'cat <<EOF\nhello\nEOF'
result=$(bash_cst_tokenize "$input")
assert_contains "$result" "HEREDOC:<<" "Heredoc operator"
assert_contains "$result" "WORD:EOF" "Delimiter word"
assert_contains "$result" "HEREDOC_BODY:hello" "Heredoc body"

CURRENT_TEST="heredoc_strip_tabs_tokenize"
input=$'cat <<-EOF\n\thello\nEOF'
result=$(bash_cst_tokenize "$input")
assert_contains "$result" "HEREDOC:<<-" "Strip tabs operator"

CURRENT_TEST="heredoc_quoted_delimiter"
input="cat <<'EOF'
hello \$var
EOF"
result=$(bash_cst_tokenize "$input")
assert_contains "$result" "WORD:EOF" "Quoted delimiter"
assert_contains "$result" 'hello $var' "Body preserves dollar"

CURRENT_TEST="heredoc_multiple"
input=$'cat <<A <<B\nbody A\nA\nbody B\nB'
result=$(bash_cst_tokenize "$input")
first_body=$(echo "$result" | grep "HEREDOC_BODY" | head -1)
second_body=$(echo "$result" | grep "HEREDOC_BODY" | tail -1)
assert_contains "$first_body" "body A" "First heredoc body"
assert_contains "$second_body" "body B" "Second heredoc body"

#==============================================================================
# PARSER TESTS
#==============================================================================

CURRENT_TEST="heredoc_parse_basic"
input=$'cat <<EOF\nhello world\nEOF'
_parse_load_tokens "$input"
_parse_script
hd_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].redirects[0].type')
assert_equals "heredoc" "$hd_type" "Heredoc node type"

CURRENT_TEST="heredoc_parse_delimiter"
hd_delim=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].redirects[0].delimiter')
assert_equals "EOF" "$hd_delim" "Heredoc delimiter"

CURRENT_TEST="heredoc_parse_body"
hd_body=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].redirects[0].body')
assert_contains "$hd_body" "hello world" "Heredoc body content"

CURRENT_TEST="heredoc_in_function"
input=$'myfunc() {\n    cat <<EOF\nhelp text\nEOF\n}'
_parse_load_tokens "$input"
_parse_script
func_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].type')
assert_equals "function_def" "$func_type" "Function with heredoc"

CURRENT_TEST="heredoc_function_name"
func_name=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].name')
assert_equals "myfunc" "$func_name" "Function name extracted"

CURRENT_TEST="heredoc_multiline_body"
input=$'cat <<END\nline 1\nline 2\nline 3\nEND'
_parse_load_tokens "$input"
_parse_script
body=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].redirects[0].body')
line_count=$(echo "$body" | wc -l | tr -d ' ')
assert_equals "3" "$line_count" "Three lines in heredoc body"
