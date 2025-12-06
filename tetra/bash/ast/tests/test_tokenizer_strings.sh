#!/usr/bin/env bash
# String tokenizer tests

#==============================================================================
# SINGLE-QUOTED STRINGS
#==============================================================================

CURRENT_TEST="string_sq_simple"
output=$(bash_cst_tokenize "echo 'hello'")
assert_contains "$output" "STRING_SQ:'hello':1:6" "Simple single-quoted string"

CURRENT_TEST="string_sq_with_spaces"
output=$(bash_cst_tokenize "echo 'hello world'")
assert_contains "$output" "STRING_SQ:'hello world':1:6" "Single-quoted with spaces"

CURRENT_TEST="string_sq_with_special"
output=$(bash_cst_tokenize "echo 'hello \$var'")
assert_contains "$output" 'STRING_SQ:'"'"'hello $var'"'" "Single-quoted preserves dollar"

CURRENT_TEST="string_sq_with_double_quotes"
output=$(bash_cst_tokenize "echo 'say \"hi\"'")
assert_contains "$output" 'STRING_SQ:' "Single-quoted with double quotes inside"

CURRENT_TEST="string_sq_empty"
output=$(bash_cst_tokenize "echo ''")
assert_contains "$output" "STRING_SQ:'':1:6" "Empty single-quoted string"

#==============================================================================
# DOUBLE-QUOTED STRINGS
#==============================================================================

CURRENT_TEST="string_dq_simple"
output=$(bash_cst_tokenize 'echo "hello"')
assert_contains "$output" 'STRING_DQ:"hello":1:6' "Simple double-quoted string"

CURRENT_TEST="string_dq_with_spaces"
output=$(bash_cst_tokenize 'echo "hello world"')
assert_contains "$output" 'STRING_DQ:"hello world":1:6' "Double-quoted with spaces"

CURRENT_TEST="string_dq_with_variable"
output=$(bash_cst_tokenize 'echo "$var"')
assert_contains "$output" 'STRING_DQ:"$var":1:6' "Double-quoted with variable"

CURRENT_TEST="string_dq_with_braced_var"
output=$(bash_cst_tokenize 'echo "${var}"')
assert_contains "$output" 'STRING_DQ:"${var}":1:6' "Double-quoted with braced variable"

CURRENT_TEST="string_dq_with_escape"
output=$(bash_cst_tokenize 'echo "hello\"world"')
assert_contains "$output" 'STRING_DQ:"hello\"world":1:6' "Double-quoted with escaped quote"

CURRENT_TEST="string_dq_empty"
output=$(bash_cst_tokenize 'echo ""')
assert_contains "$output" 'STRING_DQ:"":1:6' "Empty double-quoted string"

#==============================================================================
# DOLLAR-QUOTED STRINGS
#==============================================================================

CURRENT_TEST="string_dlr_simple"
output=$(bash_cst_tokenize "echo \$'hello'")
assert_contains "$output" "STRING_DLR:\$'hello':1:6" "Simple dollar-quoted string"

CURRENT_TEST="string_dlr_with_escape"
output=$(bash_cst_tokenize "echo \$'hello\\nworld'")
assert_contains "$output" "STRING_DLR:\$'hello\\nworld':1:6" "Dollar-quoted with escape"

CURRENT_TEST="string_dlr_with_tab"
output=$(bash_cst_tokenize "echo \$'col1\\tcol2'")
assert_contains "$output" "STRING_DLR:\$'col1\\tcol2':1:6" "Dollar-quoted with tab"

#==============================================================================
# MIXED STRINGS
#==============================================================================

CURRENT_TEST="string_mixed_types"
output=$(bash_cst_tokenize "echo 'single' \"double\"")
assert_contains "$output" "STRING_SQ:'single':1:6" "Single-quoted in mixed"
assert_contains "$output" 'STRING_DQ:"double":1:15' "Double-quoted in mixed"

CURRENT_TEST="string_adjacent"
output=$(bash_cst_tokenize "echo 'a''b'")
assert_contains "$output" "STRING_SQ:'a':1:6" "First adjacent string"
assert_contains "$output" "STRING_SQ:'b':1:9" "Second adjacent string"

#==============================================================================
# MULTILINE STRINGS
#==============================================================================

CURRENT_TEST="string_dq_multiline"
output=$(bash_cst_tokenize $'echo "line1\nline2"')
assert_contains "$output" 'STRING_DQ:"line1' "Multiline string start"

CURRENT_TEST="string_sq_multiline"
output=$(bash_cst_tokenize $'echo \'line1\nline2\'')
assert_contains "$output" "STRING_SQ:'line1" "Multiline single-quoted"
