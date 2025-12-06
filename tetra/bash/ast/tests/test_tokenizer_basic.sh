#!/usr/bin/env bash
# Basic tokenizer tests

#==============================================================================
# BASIC WORD TOKENIZATION
#==============================================================================

CURRENT_TEST="word_simple"
output=$(bash_cst_tokenize "echo")
assert_equals "WORD:echo:1:1" "$output" "Single word"

CURRENT_TEST="word_multiple"
output=$(bash_cst_tokenize "echo hello world")
assert_contains "$output" "WORD:echo:1:1" "First word"
assert_contains "$output" "WORD:hello:1:6" "Second word"
assert_contains "$output" "WORD:world:1:12" "Third word"

CURRENT_TEST="word_with_dash"
output=$(bash_cst_tokenize "ls -la")
assert_contains "$output" "WORD:ls:1:1" "Command"
assert_contains "$output" "WORD:-la:1:4" "Flag with dash"

CURRENT_TEST="word_with_numbers"
output=$(bash_cst_tokenize "file123")
assert_contains "$output" "WORD:file123:1:1" "Word with numbers"

#==============================================================================
# NEWLINE HANDLING
#==============================================================================

CURRENT_TEST="newline_basic"
output=$(bash_cst_tokenize $'foo\nbar')
assert_contains "$output" "WORD:foo:1:1" "Word before newline"
assert_contains "$output" "NEWLINE:" "Newline token"
assert_contains "$output" "WORD:bar:2:1" "Word after newline on line 2"

CURRENT_TEST="newline_multiple"
output=$(bash_cst_tokenize $'a\nb\nc')
line_count=$(echo "$output" | grep -c "NEWLINE")
assert_equals "2" "$line_count" "Two newlines"

CURRENT_TEST="newline_empty_lines"
output=$(bash_cst_tokenize $'foo\n\nbar')
assert_contains "$output" "WORD:bar:3:1" "Word after empty line on line 3"

#==============================================================================
# COMMENT HANDLING
#==============================================================================

CURRENT_TEST="comment_basic"
output=$(bash_cst_tokenize "# this is a comment")
assert_contains "$output" "COMMENT:# this is a comment:1:1" "Full comment"

CURRENT_TEST="comment_after_code"
output=$(bash_cst_tokenize $'echo hello\n# comment')
assert_contains "$output" "WORD:echo:1:1" "Code before comment"
assert_contains "$output" "COMMENT:# comment:2:1" "Comment on line 2"

CURRENT_TEST="comment_preserves_content"
output=$(bash_cst_tokenize "# TODO: fix this bug")
assert_contains "$output" "COMMENT:# TODO: fix this bug:1:1" "Comment with special chars"

#==============================================================================
# KEYWORD DETECTION
#==============================================================================

CURRENT_TEST="keyword_if"
output=$(bash_cst_tokenize "if then else elif fi")
assert_contains "$output" "KW_IF:if:1:1" "if keyword"
assert_contains "$output" "KW_THEN:then:1:4" "then keyword"
assert_contains "$output" "KW_ELSE:else:1:9" "else keyword"
assert_contains "$output" "KW_ELIF:elif:1:14" "elif keyword"
assert_contains "$output" "KW_FI:fi:1:19" "fi keyword"

CURRENT_TEST="keyword_loops"
output=$(bash_cst_tokenize "for while until do done")
assert_contains "$output" "KW_FOR:for:1:1" "for keyword"
assert_contains "$output" "KW_WHILE:while:1:5" "while keyword"
assert_contains "$output" "KW_UNTIL:until:1:11" "until keyword"
assert_contains "$output" "KW_DO:do:1:17" "do keyword"
assert_contains "$output" "KW_DONE:done:1:20" "done keyword"

CURRENT_TEST="keyword_case"
output=$(bash_cst_tokenize "case esac in")
assert_contains "$output" "KW_CASE:case:1:1" "case keyword"
assert_contains "$output" "KW_ESAC:esac:1:6" "esac keyword"
assert_contains "$output" "KW_IN:in:1:11" "in keyword"

CURRENT_TEST="keyword_function"
output=$(bash_cst_tokenize "function")
assert_contains "$output" "KW_FUNCTION:function:1:1" "function keyword"

#==============================================================================
# FUNCTION DEFINITION PATTERNS
#==============================================================================

CURRENT_TEST="function_posix_style"
output=$(bash_cst_tokenize "foo() { echo; }")
assert_contains "$output" "WORD:foo:1:1" "Function name"
assert_contains "$output" "LPAREN:(:1:4" "Open paren"
assert_contains "$output" "RPAREN:):1:5" "Close paren"
assert_contains "$output" "LBRACE:{:1:7" "Open brace"
assert_contains "$output" "RBRACE:}:1:15" "Close brace"

CURRENT_TEST="function_bash_style"
output=$(bash_cst_tokenize "function bar { echo; }")
assert_contains "$output" "KW_FUNCTION:function:1:1" "function keyword"
assert_contains "$output" "WORD:bar:1:10" "Function name"
assert_contains "$output" "LBRACE:{:1:14" "Open brace"

#==============================================================================
# ASSIGNMENT DETECTION
#==============================================================================

CURRENT_TEST="assignment_simple"
output=$(bash_cst_tokenize "x=1")
assert_contains "$output" "WORD:x:1:1" "Variable name"
assert_contains "$output" "ASSIGN:=:1:2" "Assignment operator"
assert_contains "$output" "WORD:1:1:3" "Value"

CURRENT_TEST="assignment_with_string"
output=$(bash_cst_tokenize 'name="value"')
assert_contains "$output" "WORD:name:1:1" "Variable name"
assert_contains "$output" "ASSIGN:=:1:5" "Assignment operator"
assert_contains "$output" 'STRING_DQ:"value":1:6' "String value"

#==============================================================================
# POSITION TRACKING
#==============================================================================

CURRENT_TEST="position_line_tracking"
output=$(bash_cst_tokenize $'line1\nline2\nline3')
assert_contains "$output" "WORD:line1:1:1" "Line 1"
assert_contains "$output" "WORD:line2:2:1" "Line 2"
assert_contains "$output" "WORD:line3:3:1" "Line 3"

CURRENT_TEST="position_column_tracking"
output=$(bash_cst_tokenize "a bb ccc")
assert_contains "$output" "WORD:a:1:1" "Column 1"
assert_contains "$output" "WORD:bb:1:3" "Column 3"
assert_contains "$output" "WORD:ccc:1:6" "Column 6"
