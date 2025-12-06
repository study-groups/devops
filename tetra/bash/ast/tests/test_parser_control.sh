#!/usr/bin/env bash
# test_parser_control.sh - Control flow parser tests

#==============================================================================
# IF STATEMENTS
#==============================================================================

CURRENT_TEST="parse_if_simple"
input='if true; then echo yes; fi'
_parse_load_tokens "$input"
_parse_script
cmd_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].type')
assert_equals "if_clause" "$cmd_type" "If clause type"

CURRENT_TEST="parse_if_condition"
input='if test -f foo; then echo exists; fi'
_parse_load_tokens "$input"
_parse_script
cond_cmd=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].condition.commands[0].words[0].value')
assert_equals "test" "$cond_cmd" "If condition command"

CURRENT_TEST="parse_if_then_body"
input='if true; then echo one; echo two; fi'
_parse_load_tokens "$input"
_parse_script
then_count=$(echo "$_PARSE_RESULT" | jq '.body.commands[0].then_body.commands | length')
assert_equals "2" "$then_count" "Two commands in then body"

CURRENT_TEST="parse_if_else"
input='if false; then echo yes; else echo no; fi'
_parse_load_tokens "$input"
_parse_script
else_body=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].else_body.commands[0].words[1].value')
assert_equals "no" "$else_body" "Else body content"

CURRENT_TEST="parse_if_elif"
input='if test1; then echo 1; elif test2; then echo 2; fi'
_parse_load_tokens "$input"
_parse_script
elif_count=$(echo "$_PARSE_RESULT" | jq '.body.commands[0].elif_clauses | length')
assert_equals "1" "$elif_count" "One elif clause"

#==============================================================================
# FOR LOOPS
#==============================================================================

CURRENT_TEST="parse_for_simple"
input='for i in a b c; do echo $i; done'
_parse_load_tokens "$input"
_parse_script
cmd_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].type')
assert_equals "for_clause" "$cmd_type" "For clause type"

CURRENT_TEST="parse_for_variable"
var=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].variable')
assert_equals "i" "$var" "For loop variable"

CURRENT_TEST="parse_for_items"
input='for x in one two three; do echo $x; done'
_parse_load_tokens "$input"
_parse_script
item_count=$(echo "$_PARSE_RESULT" | jq '.body.commands[0].items | length')
assert_equals "3" "$item_count" "Three items in for loop"

CURRENT_TEST="parse_for_first_item"
item1=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].items[0].value')
assert_equals "one" "$item1" "First item"

CURRENT_TEST="parse_for_body"
input='for i in 1 2; do echo start; echo $i; echo end; done'
_parse_load_tokens "$input"
_parse_script
body_count=$(echo "$_PARSE_RESULT" | jq '.body.commands[0].body.commands | length')
assert_equals "3" "$body_count" "Three commands in for body"

#==============================================================================
# WHILE/UNTIL LOOPS
#==============================================================================

CURRENT_TEST="parse_while_simple"
input='while true; do echo loop; done'
_parse_load_tokens "$input"
_parse_script
cmd_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].type')
assert_equals "while_clause" "$cmd_type" "While clause type"

CURRENT_TEST="parse_while_condition"
input='while test -f lock; do sleep 1; done'
_parse_load_tokens "$input"
_parse_script
cond_cmd=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].condition.commands[0].words[0].value')
assert_equals "test" "$cond_cmd" "While condition command"

CURRENT_TEST="parse_until_simple"
input='until false; do echo waiting; done'
_parse_load_tokens "$input"
_parse_script
cmd_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].type')
assert_equals "until_clause" "$cmd_type" "Until clause type"

#==============================================================================
# CASE STATEMENTS
#==============================================================================

CURRENT_TEST="parse_case_simple"
input='case $x in foo) echo foo;; esac'
_parse_load_tokens "$input"
_parse_script
cmd_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].type')
assert_equals "case_clause" "$cmd_type" "Case clause type"

#==============================================================================
# GROUPS AND SUBSHELLS
#==============================================================================

CURRENT_TEST="parse_group"
input='{ echo one; echo two; }'
_parse_load_tokens "$input"
_parse_script
cmd_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].type')
assert_equals "group" "$cmd_type" "Group type"

CURRENT_TEST="parse_group_body"
body_count=$(echo "$_PARSE_RESULT" | jq '.body.commands[0].body.commands | length')
assert_equals "2" "$body_count" "Two commands in group"

CURRENT_TEST="parse_subshell"
input='(echo one; echo two)'
_parse_load_tokens "$input"
_parse_script
cmd_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].type')
assert_equals "subshell" "$cmd_type" "Subshell type"

CURRENT_TEST="parse_subshell_body"
body_count=$(echo "$_PARSE_RESULT" | jq '.body.commands[0].body.commands | length')
assert_equals "2" "$body_count" "Two commands in subshell"

#==============================================================================
# NESTED CONTROL FLOW
#==============================================================================

CURRENT_TEST="parse_nested_if_for"
input='if true; then for i in 1 2; do echo $i; done; fi'
_parse_load_tokens "$input"
_parse_script
outer_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].type')
assert_equals "if_clause" "$outer_type" "Outer if"

CURRENT_TEST="parse_nested_inner_for"
inner_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].then_body.commands[0].type')
assert_equals "for_clause" "$inner_type" "Inner for loop"
