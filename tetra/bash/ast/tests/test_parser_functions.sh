#!/usr/bin/env bash
# test_parser_functions.sh - Function definition parser tests

#==============================================================================
# POSIX STYLE FUNCTIONS
#==============================================================================

CURRENT_TEST="parse_posix_function"
input='foo() { echo hello; }'
_parse_load_tokens "$input"
_parse_script
cmd_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].type')
assert_equals "function_def" "$cmd_type" "POSIX function type"

CURRENT_TEST="parse_posix_function_name"
name=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].name')
assert_equals "foo" "$name" "Function name"

#==============================================================================
# BASH STYLE FUNCTIONS
#==============================================================================

CURRENT_TEST="parse_bash_function"
input='function bar { echo world; }'
_parse_load_tokens "$input"
_parse_script
cmd_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].type')
assert_equals "function_def" "$cmd_type" "Bash function type"

CURRENT_TEST="parse_bash_function_name"
name=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].name')
assert_equals "bar" "$name" "Function name"

CURRENT_TEST="parse_bash_function_with_parens"
input='function baz() { echo test; }'
_parse_load_tokens "$input"
_parse_script
cmd_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].type')
assert_equals "function_def" "$cmd_type" "Bash function with parens"

CURRENT_TEST="parse_bash_function_with_parens_name"
name=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].name')
assert_equals "baz" "$name" "Function name"

#==============================================================================
# FUNCTION BODY
#==============================================================================

CURRENT_TEST="parse_function_body_type"
input='foo() { echo one; echo two; }'
_parse_load_tokens "$input"
_parse_script
body_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].body.type')
assert_equals "compound_list" "$body_type" "Function body type"

CURRENT_TEST="parse_function_body_count"
body_count=$(echo "$_PARSE_RESULT" | jq '.body.commands[0].body.commands | length')
assert_equals "2" "$body_count" "Two commands in function body"

CURRENT_TEST="parse_function_with_local"
input='foo() { local x=1; echo $x; }'
_parse_load_tokens "$input"
_parse_script
first_cmd=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].body.commands[0].words[0].value')
assert_equals "local" "$first_cmd" "Local declaration"

CURRENT_TEST="parse_function_with_pipeline"
input='foo() { cat file | grep pattern; }'
_parse_load_tokens "$input"
_parse_script
body_cmd_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].body.commands[0].type')
assert_equals "pipeline" "$body_cmd_type" "Pipeline in function body"

#==============================================================================
# MULTIPLE FUNCTIONS
#==============================================================================

CURRENT_TEST="parse_multiple_functions"
input=$'foo() { echo foo; }\nbar() { echo bar; }'
_parse_load_tokens "$input"
_parse_script
cmd_count=$(echo "$_PARSE_RESULT" | jq '.body.commands | length')
assert_equals "2" "$cmd_count" "Two functions"

CURRENT_TEST="parse_multiple_functions_names"
name1=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].name')
name2=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[1].name')
assert_equals "foo" "$name1" "First function name"
assert_equals "bar" "$name2" "Second function name"

#==============================================================================
# SPECIAL FUNCTION NAMES
#==============================================================================

CURRENT_TEST="parse_function_underscore_name"
input='_private_func() { echo private; }'
_parse_load_tokens "$input"
_parse_script
name=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].name')
assert_equals "_private_func" "$name" "Underscore function name"

CURRENT_TEST="parse_function_with_numbers"
input='func123() { echo numbered; }'
_parse_load_tokens "$input"
_parse_script
name=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].name')
assert_equals "func123" "$name" "Function name with numbers"

#==============================================================================
# NESTED FUNCTIONS
#==============================================================================

CURRENT_TEST="parse_nested_function_outer"
input='outer() { inner() { echo nested; }; inner; }'
_parse_load_tokens "$input"
_parse_script
outer_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].type')
assert_equals "function_def" "$outer_type" "Outer function"

CURRENT_TEST="parse_nested_function_inner"
inner_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].body.commands[0].type')
assert_equals "function_def" "$inner_type" "Inner function"
