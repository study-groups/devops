#!/usr/bin/env bash
# test_parser_basic.sh - Basic parser tests

#==============================================================================
# SIMPLE COMMAND PARSING
#==============================================================================

CURRENT_TEST="parse_simple_command"
input="echo hello"
_parse_load_tokens "$input"
_parse_script
type=$(echo "$_PARSE_RESULT" | jq -r '.type')
assert_equals "script" "$type" "Root node type"

CURRENT_TEST="parse_simple_command_count"
cmd_count=$(echo "$_PARSE_RESULT" | jq '.body.commands | length')
assert_equals "1" "$cmd_count" "Command count"

CURRENT_TEST="parse_simple_command_type"
cmd_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].type')
assert_equals "simple_command" "$cmd_type" "Command type"

CURRENT_TEST="parse_simple_command_words"
word0=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].words[0].value')
word1=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].words[1].value')
assert_equals "echo" "$word0" "First word"
assert_equals "hello" "$word1" "Second word"

#==============================================================================
# MULTIPLE COMMANDS
#==============================================================================

CURRENT_TEST="parse_multiple_commands"
input=$'echo one\necho two'
_parse_load_tokens "$input"
_parse_script
cmd_count=$(echo "$_PARSE_RESULT" | jq '.body.commands | length')
assert_equals "2" "$cmd_count" "Two commands"

CURRENT_TEST="parse_multiple_commands_values"
cmd1=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].words[1].value')
cmd2=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[1].words[1].value')
assert_equals "one" "$cmd1" "First command arg"
assert_equals "two" "$cmd2" "Second command arg"

CURRENT_TEST="parse_semicolon_separated"
input="echo a; echo b; echo c"
_parse_load_tokens "$input"
_parse_script
cmd_count=$(echo "$_PARSE_RESULT" | jq '.body.commands | length')
assert_equals "3" "$cmd_count" "Three semicolon-separated commands"

#==============================================================================
# STRINGS AND VARIABLES
#==============================================================================

CURRENT_TEST="parse_with_string"
input="echo 'hello world'"
_parse_load_tokens "$input"
_parse_script
str_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].words[1].type')
assert_equals "string" "$str_type" "String type"

CURRENT_TEST="parse_with_variable"
input='echo $foo'
_parse_load_tokens "$input"
_parse_script
var_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].words[1].type')
assert_equals "variable" "$var_type" "Variable type"

CURRENT_TEST="parse_with_braced_variable"
input='echo ${foo:-default}'
_parse_load_tokens "$input"
_parse_script
var_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].words[1].type')
assert_equals "variable" "$var_type" "Braced variable type"

#==============================================================================
# POSITION TRACKING
#==============================================================================

CURRENT_TEST="parse_position_line"
input="echo hello"
_parse_load_tokens "$input"
_parse_script
line=$(echo "$_PARSE_RESULT" | jq '.body.commands[0].pos.line')
assert_equals "1" "$line" "Command line"

CURRENT_TEST="parse_position_col"
col=$(echo "$_PARSE_RESULT" | jq '.body.commands[0].pos.col')
assert_equals "1" "$col" "Command column"

CURRENT_TEST="parse_position_word_col"
word_col=$(echo "$_PARSE_RESULT" | jq '.body.commands[0].words[1].pos.col')
assert_equals "6" "$word_col" "Second word column"

#==============================================================================
# EDGE CASES
#==============================================================================

CURRENT_TEST="parse_empty_input"
input=""
_parse_load_tokens "$input"
_parse_script
type=$(echo "$_PARSE_RESULT" | jq -r '.type')
assert_equals "script" "$type" "Empty input produces script"

CURRENT_TEST="parse_empty_commands"
cmd_count=$(echo "$_PARSE_RESULT" | jq '.body.commands | length')
assert_equals "0" "$cmd_count" "No commands in empty input"

CURRENT_TEST="parse_comment_only"
input="# just a comment"
_parse_load_tokens "$input"
_parse_script
cmd_count=$(echo "$_PARSE_RESULT" | jq '.body.commands | length')
assert_equals "0" "$cmd_count" "Comment-only produces no commands"
