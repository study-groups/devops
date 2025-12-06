#!/usr/bin/env bash
# test_parser_pipelines.sh - Pipeline and list parser tests

#==============================================================================
# SIMPLE PIPELINES
#==============================================================================

CURRENT_TEST="parse_simple_pipeline"
input="cat foo | grep bar"
_parse_load_tokens "$input"
_parse_script
cmd_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].type')
assert_equals "pipeline" "$cmd_type" "Pipeline type"

CURRENT_TEST="parse_pipeline_count"
pipe_count=$(echo "$_PARSE_RESULT" | jq '.body.commands[0].commands | length')
assert_equals "2" "$pipe_count" "Two commands in pipeline"

CURRENT_TEST="parse_multi_pipeline"
input="cat foo | grep bar | wc -l"
_parse_load_tokens "$input"
_parse_script
pipe_count=$(echo "$_PARSE_RESULT" | jq '.body.commands[0].commands | length')
assert_equals "3" "$pipe_count" "Three commands in pipeline"

CURRENT_TEST="parse_pipeline_commands"
cmd1=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].commands[0].words[0].value')
cmd2=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].commands[1].words[0].value')
cmd3=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].commands[2].words[0].value')
assert_equals "cat" "$cmd1" "First pipeline command"
assert_equals "grep" "$cmd2" "Second pipeline command"
assert_equals "wc" "$cmd3" "Third pipeline command"

#==============================================================================
# NEGATED PIPELINES
#==============================================================================

CURRENT_TEST="parse_negated_pipeline"
input="! grep error log.txt"
_parse_load_tokens "$input"
_parse_script
cmd_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].type')
assert_equals "pipeline" "$cmd_type" "Negated pipeline type"

CURRENT_TEST="parse_negated_flag"
negated=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].negated')
assert_equals "true" "$negated" "Pipeline is negated"

#==============================================================================
# AND/OR LISTS
#==============================================================================

CURRENT_TEST="parse_and_list"
input="cmd1 && cmd2"
_parse_load_tokens "$input"
_parse_script
cmd_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].type')
assert_equals "list" "$cmd_type" "AND list type"

CURRENT_TEST="parse_and_list_count"
item_count=$(echo "$_PARSE_RESULT" | jq '.body.commands[0].items | length')
assert_equals "2" "$item_count" "Two items in AND list"

CURRENT_TEST="parse_and_operator"
op=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].operators[0]')
assert_equals "&&" "$op" "AND operator"

CURRENT_TEST="parse_or_list"
input="cmd1 || cmd2"
_parse_load_tokens "$input"
_parse_script
cmd_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].type')
assert_equals "list" "$cmd_type" "OR list type"

CURRENT_TEST="parse_or_operator"
op=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].operators[0]')
assert_equals "||" "$op" "OR operator"

#==============================================================================
# MIXED LISTS
#==============================================================================

CURRENT_TEST="parse_mixed_list"
input="cmd1 && cmd2 || cmd3 && cmd4"
_parse_load_tokens "$input"
_parse_script
item_count=$(echo "$_PARSE_RESULT" | jq '.body.commands[0].items | length')
assert_equals "4" "$item_count" "Four items in mixed list"

CURRENT_TEST="parse_mixed_list_ops"
op1=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].operators[0]')
op2=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].operators[1]')
op3=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].operators[2]')
assert_equals "&&" "$op1" "First operator"
assert_equals "||" "$op2" "Second operator"
assert_equals "&&" "$op3" "Third operator"

CURRENT_TEST="parse_pipeline_in_list"
input="cat foo | grep bar && echo found"
_parse_load_tokens "$input"
_parse_script
cmd_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].type')
assert_equals "list" "$cmd_type" "List containing pipeline"

CURRENT_TEST="parse_pipeline_in_list_type"
first_item_type=$(echo "$_PARSE_RESULT" | jq -r '.body.commands[0].items[0].type')
assert_equals "pipeline" "$first_item_type" "First item is pipeline"
