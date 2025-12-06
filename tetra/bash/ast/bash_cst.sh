#!/usr/bin/env bash
# bash_cst.sh - Bash 5.2 Concrete Syntax Tree Parser
# Pure bash tokenizer and parser for bash source files
#
# Usage:
#   bash_cst_parse file.sh          # Parse file to JSON CST
#   bash_cst_tokenize file.sh       # Tokenize only (debug)
#   echo 'foo() { echo $x; }' | bash_cst_parse -
#
# Requires: bash 5.2+

[[ ${BASH_VERSINFO[0]} -lt 5 || (${BASH_VERSINFO[0]} -eq 5 && ${BASH_VERSINFO[1]} -lt 2) ]] && {
    echo "Error: bash_cst requires bash 5.2+" >&2
    exit 1
}

#==============================================================================
# TOKEN TYPES
#==============================================================================
# Tokens are stored as: TYPE:VALUE:LINE:COL
#
# Literal tokens:
#   WORD        - unquoted word (command, argument, name)
#   STRING_SQ   - single-quoted 'string'
#   STRING_DQ   - double-quoted "string"
#   STRING_DLR  - dollar-quoted $'string'
#   NUMBER      - integer literal
#   COMMENT     - # comment to EOL
#
# Operator tokens:
#   LPAREN (    RPAREN )
#   LBRACE {    RBRACE }
#   LBRACKET [  RBRACKET ]
#   DBLBRACKET [[  DBLBRACKET_END ]]
#   SEMI ;      DSEMI ;;
#   NEWLINE \n  AMP &    DAMP &&
#   PIPE |      DPIPE ||
#   LESS <      GREAT >   DLESS <<  DGREAT >>
#   LESSAND <&  GREATAND >&
#   HEREDOC <<< (here-string) or << (here-doc marker)
#   ASSIGN =
#   BANG !
#
# Compound tokens:
#   VAR_SIMPLE    $name
#   VAR_BRACED    ${name} ${name:-default} etc
#   CMD_SUB       $(command) or `command`
#   ARITH         $((expr)) or ((expr))
#   PROC_SUB      <(cmd) or >(cmd)
#
# Keywords (context-sensitive):
#   KW_IF KW_THEN KW_ELSE KW_ELIF KW_FI
#   KW_CASE KW_ESAC KW_IN
#   KW_FOR KW_WHILE KW_UNTIL KW_DO KW_DONE
#   KW_FUNCTION KW_SELECT KW_TIME KW_COPROC
#   KW_IN

#==============================================================================
# CST NODE TYPES
#==============================================================================
# Document structure:
#   script          - root node, contains statements
#   function_def    - function name() { body } or function name { body }
#
# Commands:
#   simple_command  - cmd [args...] [redirections...]
#   pipeline        - cmd1 | cmd2 | cmd3
#   list            - cmd1 && cmd2 || cmd3
#   subshell        - ( list )
#   group           - { list; }
#
# Control flow:
#   if_clause       - if/then/elif/else/fi
#   case_clause     - case/in/esac
#   for_clause      - for/in/do/done or for((;;))/do/done
#   while_clause    - while/do/done
#   until_clause    - until/do/done
#   select_clause   - select/in/do/done
#
# Expressions:
#   assignment      - name=value or name+=value
#   array_assign    - name=(elem1 elem2)
#   arithmetic      - ((expr)) or $((expr))
#   conditional     - [[ expr ]]
#
# Atoms:
#   word            - literal word
#   string          - quoted string (with interpolation info)
#   variable        - $x ${x} ${x:-y}
#   command_sub     - $(cmd) or `cmd`
#   redirection     - < > >> 2>&1 etc

#==============================================================================
# TOKENIZER STATE
#==============================================================================

declare -g _TOK_INPUT=""      # Full input string
declare -g _TOK_POS=0         # Current position
declare -g _TOK_LEN=0         # Input length
declare -g _TOK_LINE=1        # Current line number
declare -g _TOK_COL=1         # Current column
declare -ga _TOK_TOKENS=()    # Output token array
declare -ga _TOK_HEREDOCS=()  # Pending heredoc delimiters (delim:strip_tabs)

#==============================================================================
# JSON HELPERS (from chroma pattern)
#==============================================================================

_cst_escape_json() {
    local s="$1"
    s="${s//\\/\\\\}"     # backslash first
    s="${s//\"/\\\"}"     # quotes
    s="${s//$'\n'/\\n}"   # newline
    s="${s//$'\r'/\\r}"   # carriage return
    s="${s//$'\t'/\\t}"   # tab
    printf '%s' "$s"
}

_cst_pos_json() {
    printf '{"line":%d,"col":%d}' "$1" "$2"
}

#==============================================================================
# TOKENIZER PRIMITIVES
#==============================================================================

# Character constants
declare -g _NL=$'\n'

# Peek at current character without advancing
# Returns via _TOK_CHAR (must use this for newlines since $() strips them)
_tok_peek() {
    _TOK_CHAR=""
    (( _TOK_POS < _TOK_LEN )) && _TOK_CHAR="${_TOK_INPUT:_TOK_POS:1}"
}

# Peek at next n characters (returns via _TOK_CHARS)
_tok_peek_n() {
    local n="${1:-1}"
    _TOK_CHARS=""
    (( _TOK_POS < _TOK_LEN )) && _TOK_CHARS="${_TOK_INPUT:_TOK_POS:n}"
}

# Advance position and track line/col
_tok_advance() {
    local n="${1:-1}"
    local i
    for (( i=0; i<n && _TOK_POS<_TOK_LEN; i++ )); do
        local char="${_TOK_INPUT:_TOK_POS:1}"
        if [[ "$char" == $'\n' ]]; then
            (( _TOK_LINE++ )) || true
            _TOK_COL=1
        else
            (( _TOK_COL++ )) || true
        fi
        (( _TOK_POS++ )) || true
    done
}

# Check if at end of input
_tok_eof() {
    (( _TOK_POS >= _TOK_LEN ))
}

# Emit a token
_tok_emit() {
    local type="$1" value="$2" line="$3" col="$4"
    _TOK_TOKENS+=("${type}:${value}:${line}:${col}")
}

# Check if character is whitespace (not newline)
_tok_is_space() {
    [[ "$1" == " " || "$1" == $'\t' ]]
}

# Check if character is word constituent
_tok_is_word_char() {
    [[ "$1" =~ ^[a-zA-Z0-9_]$ ]]
}

# Check if string is a keyword
_tok_is_keyword() {
    case "$1" in
        if|then|else|elif|fi|case|esac|in|for|while|until|do|done|\
        function|select|time|coproc|'[[') return 0 ;;
        *) return 1 ;;
    esac
}

#==============================================================================
# TOKENIZER - CONSUME FUNCTIONS
#==============================================================================

# Skip whitespace (not newlines)
_tok_skip_space() {
    while ! _tok_eof; do
        _tok_peek
        if _tok_is_space "$_TOK_CHAR"; then
            _tok_advance
        else
            break
        fi
    done
}

# Consume comment to end of line
_tok_consume_comment() {
    local start_line=$_TOK_LINE start_col=$_TOK_COL
    local comment="#"
    _tok_advance  # skip #

    while ! _tok_eof; do
        _tok_peek
        [[ "$_TOK_CHAR" == "$_NL" ]] && break
        comment+="$_TOK_CHAR"
        _tok_advance
    done

    _tok_emit "COMMENT" "$comment" "$start_line" "$start_col"
}

# Consume single-quoted string
_tok_consume_sq_string() {
    local start_line=$_TOK_LINE start_col=$_TOK_COL
    local str="'"
    _tok_advance  # skip opening '

    while ! _tok_eof; do
        _tok_peek
        str+="$_TOK_CHAR"
        _tok_advance
        [[ "$_TOK_CHAR" == "'" ]] && break
    done

    _tok_emit "STRING_SQ" "$str" "$start_line" "$start_col"
}

# Consume double-quoted string (handles escapes and interpolation markers)
_tok_consume_dq_string() {
    local start_line=$_TOK_LINE start_col=$_TOK_COL
    local str='"'
    _tok_advance  # skip opening "

    while ! _tok_eof; do
        _tok_peek

        if [[ "$_TOK_CHAR" == '\' ]]; then
            # Escape sequence
            str+="$_TOK_CHAR"
            _tok_advance
            if ! _tok_eof; then
                _tok_peek
                str+="$_TOK_CHAR"
                _tok_advance
            fi
        elif [[ "$_TOK_CHAR" == '"' ]]; then
            str+="$_TOK_CHAR"
            _tok_advance
            break
        else
            str+="$_TOK_CHAR"
            _tok_advance
        fi
    done

    _tok_emit "STRING_DQ" "$str" "$start_line" "$start_col"
}

# Consume $'...' string
_tok_consume_dollar_sq_string() {
    local start_line=$_TOK_LINE start_col=$_TOK_COL
    local str="\$'"
    _tok_advance 2  # skip $'

    while ! _tok_eof; do
        _tok_peek

        if [[ "$_TOK_CHAR" == '\' ]]; then
            str+="$_TOK_CHAR"
            _tok_advance
            if ! _tok_eof; then
                _tok_peek
                str+="$_TOK_CHAR"
                _tok_advance
            fi
        elif [[ "$_TOK_CHAR" == "'" ]]; then
            str+="$_TOK_CHAR"
            _tok_advance
            break
        else
            str+="$_TOK_CHAR"
            _tok_advance
        fi
    done

    _tok_emit "STRING_DLR" "$str" "$start_line" "$start_col"
}

# Consume variable reference $name or ${...}
_tok_consume_variable() {
    local start_line=$_TOK_LINE start_col=$_TOK_COL
    local var="\$"
    _tok_advance  # skip $

    _tok_peek
    local next="$_TOK_CHAR"

    if [[ "$next" == '{' ]]; then
        # ${...} - braced expansion
        var+="{"
        _tok_advance
        local depth=1

        while ! _tok_eof && (( depth > 0 )); do
            _tok_peek
            var+="$_TOK_CHAR"
            _tok_advance

            case "$_TOK_CHAR" in
                '{') (( depth++ )) ;;
                '}') (( depth-- )) ;;
                '\')  # Skip escaped char
                    if ! _tok_eof; then
                        _tok_peek
                        var+="$_TOK_CHAR"
                        _tok_advance
                    fi
                    ;;
            esac
        done

        _tok_emit "VAR_BRACED" "$var" "$start_line" "$start_col"

    elif [[ "$next" == '(' ]]; then
        _tok_peek_n 2
        local peek2="$_TOK_CHARS"

        if [[ "$peek2" == "((" ]]; then
            # $((...)) - arithmetic expansion
            var+="(("
            _tok_advance 2
            local depth=2

            while ! _tok_eof && (( depth > 0 )); do
                _tok_peek
                var+="$_TOK_CHAR"
                _tok_advance
                case "$_TOK_CHAR" in
                    '(') (( depth++ )) ;;
                    ')') (( depth-- )) ;;
                esac
            done

            _tok_emit "ARITH" "$var" "$start_line" "$start_col"
        else
            # $(...) - command substitution
            var+="("
            _tok_advance
            local depth=1

            while ! _tok_eof && (( depth > 0 )); do
                _tok_peek
                var+="$_TOK_CHAR"
                _tok_advance
                case "$_TOK_CHAR" in
                    '(') (( depth++ )) ;;
                    ')') (( depth-- )) ;;
                    '\')
                        if ! _tok_eof; then
                            _tok_peek
                            var+="$_TOK_CHAR"
                            _tok_advance
                        fi
                        ;;
                esac
            done

            _tok_emit "CMD_SUB" "$var" "$start_line" "$start_col"
        fi

    elif [[ "$next" =~ ^[a-zA-Z_]$ ]]; then
        # $name - simple variable
        while ! _tok_eof; do
            _tok_peek
            if [[ "$_TOK_CHAR" =~ ^[a-zA-Z0-9_]$ ]]; then
                var+="$_TOK_CHAR"
                _tok_advance
            else
                break
            fi
        done

        _tok_emit "VAR_SIMPLE" "$var" "$start_line" "$start_col"

    elif [[ "$next" =~ ^[0-9@#?$!*-]$ ]]; then
        # Special variables: $1 $@ $# $? $$ $! $* $-
        var+="$next"
        _tok_advance
        _tok_emit "VAR_SIMPLE" "$var" "$start_line" "$start_col"

    else
        # Lone $ - treat as word
        _tok_emit "WORD" "$var" "$start_line" "$start_col"
    fi
}

# Consume backtick command substitution
_tok_consume_backtick() {
    local start_line=$_TOK_LINE start_col=$_TOK_COL
    local cmd='`'
    _tok_advance  # skip opening `

    while ! _tok_eof; do
        _tok_peek

        if [[ "$_TOK_CHAR" == '\' ]]; then
            cmd+="$_TOK_CHAR"
            _tok_advance
            if ! _tok_eof; then
                _tok_peek
                cmd+="$_TOK_CHAR"
                _tok_advance
            fi
        elif [[ "$_TOK_CHAR" == '`' ]]; then
            cmd+="$_TOK_CHAR"
            _tok_advance
            break
        else
            cmd+="$_TOK_CHAR"
            _tok_advance
        fi
    done

    _tok_emit "CMD_SUB" "$cmd" "$start_line" "$start_col"
}

# Consume a word (unquoted sequence)
_tok_consume_word() {
    local start_line=$_TOK_LINE start_col=$_TOK_COL
    local word=""

    while ! _tok_eof; do
        _tok_peek

        # End word at metacharacters (use _NL for newline comparison)
        case "$_TOK_CHAR" in
            ' '|$'\t'|';'|'&'|'|'|'<'|'>'|'('|')'|'{'|'}'|'['|']'|'#'|'"'|"'"|'`'|'$')
                break
                ;;
            "$_NL")
                break
                ;;
            '\')
                # Escape - include next char in word
                word+="$_TOK_CHAR"
                _tok_advance
                if ! _tok_eof; then
                    _tok_peek
                    word+="$_TOK_CHAR"
                    _tok_advance
                fi
                ;;
            '=')
                # Could be assignment or part of word
                if [[ -z "$word" ]] || [[ "$word" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
                    # End word here, emit separately or as assignment
                    break
                else
                    word+="$_TOK_CHAR"
                    _tok_advance
                fi
                ;;
            *)
                word+="$_TOK_CHAR"
                _tok_advance
                ;;
        esac
    done

    if [[ -n "$word" ]]; then
        if _tok_is_keyword "$word"; then
            _tok_emit "KW_${word^^}" "$word" "$start_line" "$start_col"
        else
            _tok_emit "WORD" "$word" "$start_line" "$start_col"
        fi
    fi
}

# Consume operator (multi-char aware)
_tok_consume_operator() {
    local start_line=$_TOK_LINE start_col=$_TOK_COL
    _tok_peek
    local char="$_TOK_CHAR"
    _tok_peek_n 2
    local next="$_TOK_CHARS"

    case "$next" in
        '[[') _tok_emit "DBLBRACKET" "[[" "$start_line" "$start_col"; _tok_advance 2; return ;;
        ']]') _tok_emit "DBLBRACKET_END" "]]" "$start_line" "$start_col"; _tok_advance 2; return ;;
        ';;') _tok_emit "DSEMI" ";;" "$start_line" "$start_col"; _tok_advance 2; return ;;
        '&&') _tok_emit "DAMP" "&&" "$start_line" "$start_col"; _tok_advance 2; return ;;
        '||') _tok_emit "DPIPE" "||" "$start_line" "$start_col"; _tok_advance 2; return ;;
        '<<')
            _tok_peek_n 3
            local peek3="$_TOK_CHARS"
            if [[ "$peek3" == '<<<' ]]; then
                _tok_emit "HERESTRING" "<<<" "$start_line" "$start_col"
                _tok_advance 3
            else
                # Check for <<- (strip leading tabs)
                local strip_tabs=0
                if [[ "${_TOK_INPUT:_TOK_POS+2:1}" == '-' ]]; then
                    _tok_emit "HEREDOC" "<<-" "$start_line" "$start_col"
                    _tok_advance 3
                    strip_tabs=1
                else
                    _tok_emit "HEREDOC" "<<" "$start_line" "$start_col"
                    _tok_advance 2
                fi

                # Skip whitespace before delimiter
                _tok_skip_space

                # Read delimiter (may be quoted or unquoted)
                _tok_peek
                local delim=""
                if [[ "$_TOK_CHAR" == "'" || "$_TOK_CHAR" == '"' ]]; then
                    # Quoted delimiter - read until matching quote
                    local q="$_TOK_CHAR"
                    _tok_advance
                    while ! _tok_eof; do
                        _tok_peek
                        [[ "$_TOK_CHAR" == "$q" ]] && { _tok_advance; break; }
                        delim+="$_TOK_CHAR"
                        _tok_advance
                    done
                else
                    # Unquoted delimiter - read word chars
                    while ! _tok_eof; do
                        _tok_peek
                        [[ "$_TOK_CHAR" =~ [a-zA-Z0-9_] ]] || break
                        delim+="$_TOK_CHAR"
                        _tok_advance
                    done
                fi

                # Emit delimiter and queue for body consumption after newline
                if [[ -n "$delim" ]]; then
                    _tok_emit "WORD" "$delim" "$_TOK_LINE" "$_TOK_COL"
                    _TOK_HEREDOCS+=("$delim:$strip_tabs")
                fi
            fi
            return
            ;;
        '>>') _tok_emit "DGREAT" ">>" "$start_line" "$start_col"; _tok_advance 2; return ;;
        '<&') _tok_emit "LESSAND" "<&" "$start_line" "$start_col"; _tok_advance 2; return ;;
        '>&') _tok_emit "GREATAND" ">&" "$start_line" "$start_col"; _tok_advance 2; return ;;
        '<(') _tok_emit "PROC_SUB_IN" "<(" "$start_line" "$start_col"; _tok_advance 2; return ;;
        '>(') _tok_emit "PROC_SUB_OUT" ">(" "$start_line" "$start_col"; _tok_advance 2; return ;;
        '((' )
            # Could be arithmetic (( or subshell start
            _tok_emit "DARITH" "((" "$start_line" "$start_col"
            _tok_advance 2
            return
            ;;
        '))' )
            _tok_emit "DARITH_END" "))" "$start_line" "$start_col"
            _tok_advance 2
            return
            ;;
    esac

    # Single character operators
    case "$char" in
        '(') _tok_emit "LPAREN" "(" "$start_line" "$start_col" ;;
        ')') _tok_emit "RPAREN" ")" "$start_line" "$start_col" ;;
        '{') _tok_emit "LBRACE" "{" "$start_line" "$start_col" ;;
        '}') _tok_emit "RBRACE" "}" "$start_line" "$start_col" ;;
        '[') _tok_emit "LBRACKET" "[" "$start_line" "$start_col" ;;
        ']') _tok_emit "RBRACKET" "]" "$start_line" "$start_col" ;;
        ';') _tok_emit "SEMI" ";" "$start_line" "$start_col" ;;
        '&') _tok_emit "AMP" "&" "$start_line" "$start_col" ;;
        '|') _tok_emit "PIPE" "|" "$start_line" "$start_col" ;;
        '<') _tok_emit "LESS" "<" "$start_line" "$start_col" ;;
        '>') _tok_emit "GREAT" ">" "$start_line" "$start_col" ;;
        '=') _tok_emit "ASSIGN" "=" "$start_line" "$start_col" ;;
        '!') _tok_emit "BANG" "!" "$start_line" "$start_col" ;;
        "$_NL") _tok_emit "NEWLINE" "\\n" "$start_line" "$start_col" ;;
    esac
    _tok_advance
}

# Consume heredoc body after newline
# Reads until delimiter appears alone on a line
_tok_consume_heredoc_body() {
    local delim="$1"
    local strip_tabs="$2"
    local start_line=$_TOK_LINE
    local start_col=$_TOK_COL
    local body=""

    # Read lines until we find the delimiter
    while ! _tok_eof; do
        local line_start=$_TOK_POS
        local line_content=""

        # Read until end of line or EOF
        while ! _tok_eof; do
            _tok_peek
            if [[ "$_TOK_CHAR" == $'\n' ]]; then
                break
            fi
            line_content+="$_TOK_CHAR"
            _tok_advance
        done

        # Check if this line is the delimiter
        local check_line="$line_content"
        if [[ "$strip_tabs" == "1" ]]; then
            check_line="${line_content##$'\t'*}"  # Strip leading tabs
            # Actually need to strip all leading tabs
            while [[ "$check_line" == $'\t'* ]]; do
                check_line="${check_line#$'\t'}"
            done
        fi

        if [[ "$check_line" == "$delim" ]]; then
            # Found the delimiter - consume the newline if present and we're done
            if ! _tok_eof; then
                _tok_peek
                if [[ "$_TOK_CHAR" == $'\n' ]]; then
                    _tok_advance
                fi
            fi
            break
        fi

        # Add line to body (with newline)
        body+="$line_content"
        if ! _tok_eof; then
            _tok_peek
            if [[ "$_TOK_CHAR" == $'\n' ]]; then
                body+=$'\n'
                _tok_advance
            fi
        fi
    done

    _tok_emit "HEREDOC_BODY" "$body" "$start_line" "$start_col"
}

#==============================================================================
# MAIN TOKENIZER
#==============================================================================

bash_cst_tokenize() {
    local input="$1"

    # Reset state
    _TOK_INPUT="$input"
    _TOK_POS=0
    _TOK_LEN=${#input}
    _TOK_LINE=1
    _TOK_COL=1
    _TOK_TOKENS=()
    _TOK_HEREDOCS=()

    while ! _tok_eof; do
        _tok_peek
        _tok_peek_n 2

        # Skip whitespace (not newlines)
        if _tok_is_space "$_TOK_CHAR"; then
            _tok_skip_space
            continue
        fi

        case "$_TOK_CHAR" in
            '#')
                _tok_consume_comment
                ;;
            "'")
                _tok_consume_sq_string
                ;;
            '"')
                _tok_consume_dq_string
                ;;
            '$')
                if [[ "$_TOK_CHARS" == "\$'" ]]; then
                    _tok_consume_dollar_sq_string
                else
                    _tok_consume_variable
                fi
                ;;
            '`')
                _tok_consume_backtick
                ;;
            '('|')'|'{'|'}'|'['|']'|';'|'&'|'|'|'<'|'>'|'='|'!')
                _tok_consume_operator
                ;;
            "$_NL")
                _tok_consume_operator
                # After newline, consume any pending heredoc bodies
                while (( ${#_TOK_HEREDOCS[@]} > 0 )); do
                    local hd="${_TOK_HEREDOCS[0]}"
                    _TOK_HEREDOCS=("${_TOK_HEREDOCS[@]:1}")  # shift
                    local hd_delim="${hd%%:*}"
                    local hd_strip="${hd#*:}"
                    _tok_consume_heredoc_body "$hd_delim" "$hd_strip"
                done
                ;;
            *)
                _tok_consume_word
                ;;
        esac
    done

    # Output tokens
    printf '%s\n' "${_TOK_TOKENS[@]}"
}

# Tokenize to JSON format
bash_cst_tokenize_json() {
    local input="$1"
    bash_cst_tokenize "$input" > /dev/null  # populates _TOK_TOKENS

    echo '{"tokens":['
    local first=true
    for tok in "${_TOK_TOKENS[@]}"; do
        IFS=':' read -r type value line col <<< "$tok"
        [[ "$first" == true ]] || echo ","
        first=false
        printf '{"type":"%s","value":"%s","pos":{"line":%d,"col":%d}}' \
            "$type" "$(_cst_escape_json "$value")" "$line" "$col"
    done
    echo ']}'
}

#==============================================================================
# PARSER STATE
#==============================================================================

declare -ga _PARSE_TOKENS=()   # Token array from tokenizer
declare -g _PARSE_POS=0        # Current token position
declare -g _PARSE_LEN=0        # Number of tokens
declare -g _PARSE_RESULT=""    # Return value from parse functions (avoids subshell)

#==============================================================================
# PARSER PRIMITIVES
#==============================================================================

# Load tokens from tokenizer output
_parse_load_tokens() {
    local input="$1"
    bash_cst_tokenize "$input" > /dev/null
    _PARSE_TOKENS=("${_TOK_TOKENS[@]}")
    _PARSE_POS=0
    _PARSE_LEN=${#_PARSE_TOKENS[@]}
}

# Get current token (sets _PARSE_TYPE, _PARSE_VALUE, _PARSE_LINE, _PARSE_COL)
_parse_current() {
    if (( _PARSE_POS < _PARSE_LEN )); then
        local tok="${_PARSE_TOKENS[_PARSE_POS]}"
        # Split on first 3 colons only (value may contain colons)
        _PARSE_TYPE="${tok%%:*}"
        local rest="${tok#*:}"
        # Find line:col at end (last two colon-separated numbers)
        _PARSE_COL="${rest##*:}"
        rest="${rest%:*}"
        _PARSE_LINE="${rest##*:}"
        _PARSE_VALUE="${rest%:*}"
        return 0
    fi
    _PARSE_TYPE="EOF"
    _PARSE_VALUE=""
    _PARSE_LINE=0
    _PARSE_COL=0
    return 1
}

# Peek at token at offset (default 0 = current)
_parse_peek() {
    local offset="${1:-0}"
    local pos=$(( _PARSE_POS + offset ))
    if (( pos < _PARSE_LEN )); then
        local tok="${_PARSE_TOKENS[pos]}"
        echo "${tok%%:*}"
    else
        echo "EOF"
    fi
}

# Advance to next token
_parse_advance() {
    (( _PARSE_POS++ )) || true
}

# Check if at end
_parse_eof() {
    (( _PARSE_POS >= _PARSE_LEN ))
}

# Expect a specific token type, error if not found
_parse_expect() {
    local expected="$1"
    _parse_current
    if [[ "$_PARSE_TYPE" != "$expected" ]]; then
        echo "Parse error: expected $expected, got $_PARSE_TYPE at line $_PARSE_LINE:$_PARSE_COL" >&2
        return 1
    fi
    _parse_advance
}

# Check if current token matches type
_parse_is() {
    local type="$1"
    _parse_current
    [[ "$_PARSE_TYPE" == "$type" ]]
}

# Check if current token is one of several types
_parse_is_one_of() {
    _parse_current
    for type in "$@"; do
        [[ "$_PARSE_TYPE" == "$type" ]] && return 0
    done
    return 1
}

# Skip newlines and comments
_parse_skip_newlines() {
    while _parse_is_one_of "NEWLINE" "COMMENT"; do
        _parse_advance
    done
}

#==============================================================================
# JSON NODE BUILDERS
#==============================================================================

# Build a JSON node with type and position
_node() {
    local type="$1"
    local line="$2"
    local col="$3"
    shift 3

    local extra=""
    while [[ $# -gt 0 ]]; do
        extra+=",\"$1\":$2"
        shift 2
    done

    printf '{"type":"%s","pos":{"line":%d,"col":%d}%s}' "$type" "$line" "$col" "$extra"
}

# Build node with children array
_node_with_children() {
    local type="$1"
    local line="$2"
    local col="$3"
    local children="$4"
    shift 4

    local extra=""
    while [[ $# -gt 0 ]]; do
        extra+=",\"$1\":$2"
        shift 2
    done

    printf '{"type":"%s","pos":{"line":%d,"col":%d},"children":[%s]%s}' \
        "$type" "$line" "$col" "$children" "$extra"
}

#==============================================================================
# PARSER - EXPRESSIONS
#==============================================================================

# Parse a word/string/variable atom
# Sets _PARSE_RESULT on success
_parse_atom() {
    _parse_current
    local type="$_PARSE_TYPE"
    local value="$_PARSE_VALUE"
    local line="$_PARSE_LINE"
    local col="$_PARSE_COL"

    case "$type" in
        WORD)
            _parse_advance
            _PARSE_RESULT=$(_node "word" "$line" "$col" "value" "\"$(_cst_escape_json "$value")\"")
            ;;
        STRING_SQ|STRING_DQ|STRING_DLR)
            _parse_advance
            _PARSE_RESULT=$(_node "string" "$line" "$col" \
                "value" "\"$(_cst_escape_json "$value")\"" \
                "quote_type" "\"$type\"")
            ;;
        VAR_SIMPLE|VAR_BRACED)
            _parse_advance
            _PARSE_RESULT=$(_node "variable" "$line" "$col" "value" "\"$(_cst_escape_json "$value")\"")
            ;;
        CMD_SUB)
            _parse_advance
            _PARSE_RESULT=$(_node "command_sub" "$line" "$col" "value" "\"$(_cst_escape_json "$value")\"")
            ;;
        ARITH)
            _parse_advance
            _PARSE_RESULT=$(_node "arithmetic" "$line" "$col" "value" "\"$(_cst_escape_json "$value")\"")
            ;;
        *)
            _PARSE_RESULT=""
            return 1
            ;;
    esac
}

# Parse redirection: [n]< [n]> [n]>> etc
# Sets _PARSE_RESULT on success
_parse_redirection() {
    _parse_current
    local line="$_PARSE_LINE"
    local col="$_PARSE_COL"
    local fd=""
    local op=""
    local target=""

    # Check for fd number prefix (e.g., 2>&1)
    if [[ "$_PARSE_TYPE" == "WORD" && "$_PARSE_VALUE" =~ ^[0-9]+$ ]]; then
        fd="$_PARSE_VALUE"
        _parse_advance
        _parse_current
    fi

    case "$_PARSE_TYPE" in
        HEREDOC)
            op="$_PARSE_VALUE"
            _parse_advance
            # Get delimiter
            _parse_current
            local delim=""
            if [[ "$_PARSE_TYPE" == "WORD" ]]; then
                delim="$_PARSE_VALUE"
                _parse_advance
            fi
            # Skip newline before body
            _parse_skip_newlines
            # Get heredoc body
            local body=""
            _parse_current
            if [[ "$_PARSE_TYPE" == "HEREDOC_BODY" ]]; then
                body="$_PARSE_VALUE"
                _parse_advance
            fi
            _PARSE_RESULT=$(_node "heredoc" "$line" "$col" \
                "op" "\"$(_cst_escape_json "$op")\"" \
                "fd" "\"$fd\"" \
                "delimiter" "\"$(_cst_escape_json "$delim")\"" \
                "body" "\"$(_cst_escape_json "$body")\"")
            return 0
            ;;
        LESS|GREAT|DGREAT|DLESS|LESSAND|GREATAND|HERESTRING)
            op="$_PARSE_VALUE"
            _parse_advance
            # Get target
            _parse_current
            if [[ "$_PARSE_TYPE" == "WORD" || "$_PARSE_TYPE" =~ ^STRING ]]; then
                target="$_PARSE_VALUE"
                _parse_advance
            fi
            ;;
        *)
            _PARSE_RESULT=""
            return 1
            ;;
    esac

    _PARSE_RESULT=$(_node "redirection" "$line" "$col" \
        "op" "\"$(_cst_escape_json "$op")\"" \
        "fd" "\"$fd\"" \
        "target" "\"$(_cst_escape_json "$target")\"")
}

#==============================================================================
# PARSER - COMMANDS
#==============================================================================

# Parse simple command: cmd [args...] [redirects...]
# Sets _PARSE_RESULT on success
_parse_simple_command() {
    _parse_current
    local line="$_PARSE_LINE"
    local col="$_PARSE_COL"
    local words=""
    local redirects=""
    local first_word=true
    local first_redirect=true

    while ! _parse_eof; do
        _parse_current

        # Check for redirections
        if _parse_is_one_of "LESS" "GREAT" "DGREAT" "DLESS" "LESSAND" "GREATAND" "HEREDOC" "HERESTRING"; then
            _parse_redirection
            [[ "$first_redirect" == true ]] || redirects+=","
            first_redirect=false
            redirects+="$_PARSE_RESULT"
            continue
        fi

        # Check for word/string/variable
        if _parse_is_one_of "WORD" "STRING_SQ" "STRING_DQ" "STRING_DLR" "VAR_SIMPLE" "VAR_BRACED" "CMD_SUB" "ARITH"; then
            _parse_atom
            local atom_result="$_PARSE_RESULT"

            # Check if this is part of an assignment (WORD ASSIGN VALUE pattern)
            # e.g., "x=1" tokenized as WORD:x, ASSIGN:=, WORD:1
            if _parse_is "ASSIGN"; then
                # Extract the word value from atom_result
                local word_val
                word_val=$(echo "$atom_result" | jq -r '.value // empty' 2>/dev/null)
                if [[ -n "$word_val" ]]; then
                    _parse_advance  # consume ASSIGN
                    local assign_value=""
                    # Get the value after =
                    if _parse_is_one_of "WORD" "STRING_SQ" "STRING_DQ" "STRING_DLR" "VAR_SIMPLE" "VAR_BRACED" "CMD_SUB" "ARITH"; then
                        _parse_atom
                        assign_value=$(echo "$_PARSE_RESULT" | jq -r '.value // empty' 2>/dev/null)
                    fi
                    # Reconstruct as single word: name=value
                    local combined="${word_val}=${assign_value}"
                    atom_result=$(_node "word" "$line" "$col" "value" "\"$(_cst_escape_json "$combined")\"")
                fi
            fi

            [[ "$first_word" == true ]] || words+=","
            first_word=false
            words+="$atom_result"
            continue
        fi

        # Handle bare ASSIGN token (shouldn't happen normally, but be safe)
        if _parse_is "ASSIGN"; then
            _parse_advance
            continue
        fi

        # Check for fd number before redirect
        if [[ "$_PARSE_TYPE" == "WORD" && "$_PARSE_VALUE" =~ ^[0-9]+$ ]]; then
            local peek=$(_parse_peek 1)
            if [[ "$peek" =~ ^(LESS|GREAT|DGREAT|LESSAND|GREATAND)$ ]]; then
                _parse_redirection
                [[ "$first_redirect" == true ]] || redirects+=","
                first_redirect=false
                redirects+="$_PARSE_RESULT"
                continue
            fi
        fi

        # End of simple command
        break
    done

    if [[ -z "$words" ]]; then
        _PARSE_RESULT=""
        return 1
    fi

    _PARSE_RESULT=$(_node "simple_command" "$line" "$col" \
        "words" "[$words]" \
        "redirects" "[$redirects]")
}

# Parse assignment: name=value
# Sets _PARSE_RESULT on success
_parse_assignment() {
    _parse_current
    if [[ "$_PARSE_TYPE" != "WORD" ]]; then
        _PARSE_RESULT=""
        return 1
    fi

    local name="$_PARSE_VALUE"
    local line="$_PARSE_LINE"
    local col="$_PARSE_COL"
    _parse_advance

    if ! _parse_is "ASSIGN"; then
        # Not an assignment, backtrack
        (( _PARSE_POS-- ))
        _PARSE_RESULT=""
        return 1
    fi
    _parse_advance

    # Get value
    local value=""
    if _parse_is_one_of "WORD" "STRING_SQ" "STRING_DQ" "STRING_DLR" "VAR_SIMPLE" "VAR_BRACED" "CMD_SUB" "ARITH"; then
        _parse_atom
        value="$_PARSE_RESULT"
    else
        value='{"type":"word","value":"","pos":{"line":0,"col":0}}'
    fi

    _PARSE_RESULT=$(_node "assignment" "$line" "$col" \
        "name" "\"$(_cst_escape_json "$name")\"" \
        "value" "$value")
}

# Parse function definition: name() { body } or function name { body }
# Sets _PARSE_RESULT on success
_parse_function_def() {
    _parse_current
    local line="$_PARSE_LINE"
    local col="$_PARSE_COL"
    local name=""

    # Check for 'function' keyword style
    if _parse_is "KW_FUNCTION"; then
        _parse_advance
        _parse_current
        if [[ "$_PARSE_TYPE" != "WORD" ]]; then
            _PARSE_RESULT=""
            return 1
        fi
        name="$_PARSE_VALUE"
        _parse_advance

        # Optional ()
        if _parse_is "LPAREN"; then
            _parse_advance
            _parse_expect "RPAREN" || { _PARSE_RESULT=""; return 1; }
        fi
    else
        # POSIX style: name()
        if [[ "$_PARSE_TYPE" != "WORD" ]]; then
            _PARSE_RESULT=""
            return 1
        fi
        name="$_PARSE_VALUE"
        _parse_advance

        if ! _parse_is "LPAREN"; then
            (( _PARSE_POS-- ))
            _PARSE_RESULT=""
            return 1
        fi
        _parse_advance

        if ! _parse_is "RPAREN"; then
            (( _PARSE_POS -= 2 ))
            _PARSE_RESULT=""
            return 1
        fi
        _parse_advance
    fi

    _parse_skip_newlines

    # Expect { body }
    if ! _parse_is "LBRACE"; then
        _PARSE_RESULT=""
        return 1
    fi
    _parse_advance
    _parse_skip_newlines

    # Parse body (compound list)
    _parse_compound_list
    local body="$_PARSE_RESULT"

    _parse_skip_newlines
    _parse_expect "RBRACE" || { _PARSE_RESULT=""; return 1; }

    _PARSE_RESULT=$(_node "function_def" "$line" "$col" \
        "name" "\"$(_cst_escape_json "$name")\"" \
        "body" "$body")
}

#==============================================================================
# PARSER - COMPOUND COMMANDS
#==============================================================================

# Parse a pipeline: cmd1 | cmd2 | cmd3
# Sets _PARSE_RESULT on success
_parse_pipeline() {
    _parse_current
    local line="$_PARSE_LINE"
    local col="$_PARSE_COL"
    local negated="false"

    # Check for ! prefix
    if _parse_is "BANG"; then
        negated="true"
        _parse_advance
        _parse_skip_newlines
    fi

    _parse_command || { _PARSE_RESULT=""; return 1; }
    local first_cmd="$_PARSE_RESULT"
    local commands="$first_cmd"

    while _parse_is "PIPE"; do
        _parse_advance
        _parse_skip_newlines
        _parse_command || { _PARSE_RESULT=""; return 1; }
        commands+=",$_PARSE_RESULT"
    done

    # If only one command and not negated, return it directly
    if [[ "$commands" == "$first_cmd" && "$negated" == "false" ]]; then
        _PARSE_RESULT="$first_cmd"
        return 0
    fi

    _PARSE_RESULT=$(_node "pipeline" "$line" "$col" \
        "commands" "[$commands]" \
        "negated" "$negated")
}

# Parse a list: pipeline && pipeline || pipeline
# Sets _PARSE_RESULT on success
_parse_list() {
    _parse_current
    local line="$_PARSE_LINE"
    local col="$_PARSE_COL"

    _parse_pipeline || { _PARSE_RESULT=""; return 1; }
    local first="$_PARSE_RESULT"
    local items="$first"
    local ops=""
    local first_op=true

    while _parse_is_one_of "DAMP" "DPIPE"; do
        local op="$_PARSE_VALUE"
        _parse_advance
        _parse_skip_newlines

        _parse_pipeline || { _PARSE_RESULT=""; return 1; }
        items+=",$_PARSE_RESULT"
        [[ "$first_op" == true ]] || ops+=","
        first_op=false
        ops+="\"$op\""
    done

    # If only one item, return it directly
    if [[ "$items" == "$first" ]]; then
        _PARSE_RESULT="$first"
        return 0
    fi

    _PARSE_RESULT=$(_node "list" "$line" "$col" \
        "items" "[$items]" \
        "operators" "[$ops]")
}

# Parse compound list (multiple commands separated by ; or newline)
# Sets _PARSE_RESULT on success
_parse_compound_list() {
    local commands=""
    local first=true

    _parse_skip_newlines

    while ! _parse_eof; do
        _parse_current

        # Check for terminators
        if _parse_is_one_of "RBRACE" "KW_FI" "KW_DONE" "KW_ESAC" "KW_THEN" "KW_ELSE" "KW_ELIF" "KW_DO" "RPAREN" "DSEMI"; then
            break
        fi

        _parse_list
        if [[ -n "$_PARSE_RESULT" ]]; then
            [[ "$first" == true ]] || commands+=","
            first=false
            commands+="$_PARSE_RESULT"
        fi

        # Skip separators
        while _parse_is_one_of "SEMI" "NEWLINE" "AMP" "COMMENT"; do
            _parse_advance
        done

        if _parse_eof; then
            break
        fi
    done

    _PARSE_RESULT=$(printf '{"type":"compound_list","commands":[%s]}' "$commands")
}

# Parse a single command (may be simple, compound, or function def)
# Sets _PARSE_RESULT on success
_parse_command() {
    _parse_skip_newlines
    _parse_current

    local type="$_PARSE_TYPE"

    case "$type" in
        KW_FUNCTION)
            _parse_function_def
            ;;
        WORD)
            # Could be function def (name()), assignment (name=), or simple command
            local peek1=$(_parse_peek 1)
            if [[ "$peek1" == "LPAREN" ]]; then
                local peek2=$(_parse_peek 2)
                if [[ "$peek2" == "RPAREN" ]]; then
                    _parse_function_def
                    return $?
                fi
            fi
            if [[ "$peek1" == "ASSIGN" ]]; then
                _parse_assignment
                return $?
            fi
            _parse_simple_command
            ;;
        KW_IF)
            _parse_if_clause
            ;;
        KW_CASE)
            _parse_case_clause
            ;;
        KW_FOR)
            _parse_for_clause
            ;;
        KW_WHILE)
            _parse_while_clause
            ;;
        KW_UNTIL)
            _parse_until_clause
            ;;
        LBRACE)
            _parse_group
            ;;
        LPAREN)
            _parse_subshell
            ;;
        DBLBRACKET)
            _parse_conditional
            ;;
        DARITH)
            _parse_arithmetic_cmd
            ;;
        EOF)
            _PARSE_RESULT=""
            return 1
            ;;
        *)
            # Try simple command for anything else
            _parse_simple_command
            ;;
    esac
}

#==============================================================================
# PARSER - CONTROL FLOW
#==============================================================================

# Parse if clause
# Sets _PARSE_RESULT on success
_parse_if_clause() {
    _parse_current
    local line="$_PARSE_LINE"
    local col="$_PARSE_COL"

    _parse_expect "KW_IF" || { _PARSE_RESULT=""; return 1; }
    _parse_skip_newlines

    _parse_compound_list
    local condition="$_PARSE_RESULT"

    _parse_skip_newlines
    _parse_expect "KW_THEN" || { _PARSE_RESULT=""; return 1; }
    _parse_skip_newlines

    _parse_compound_list
    local then_body="$_PARSE_RESULT"

    local elif_clauses=""
    local else_body=""

    # Handle elif clauses
    while _parse_is "KW_ELIF"; do
        _parse_advance
        _parse_skip_newlines

        _parse_compound_list
        local elif_cond="$_PARSE_RESULT"

        _parse_skip_newlines
        _parse_expect "KW_THEN" || { _PARSE_RESULT=""; return 1; }
        _parse_skip_newlines

        _parse_compound_list
        local elif_body="$_PARSE_RESULT"

        [[ -n "$elif_clauses" ]] && elif_clauses+=","
        elif_clauses+="{\"condition\":$elif_cond,\"body\":$elif_body}"
    done

    # Handle else clause
    if _parse_is "KW_ELSE"; then
        _parse_advance
        _parse_skip_newlines
        _parse_compound_list
        else_body="$_PARSE_RESULT"
    fi

    _parse_skip_newlines
    _parse_expect "KW_FI" || { _PARSE_RESULT=""; return 1; }

    local result
    result=$(_node "if_clause" "$line" "$col" \
        "condition" "$condition" \
        "then_body" "$then_body")

    # Add optional parts
    if [[ -n "$elif_clauses" ]]; then
        result="${result%\}},\"elif_clauses\":[$elif_clauses]}"
    fi
    if [[ -n "$else_body" ]]; then
        result="${result%\}},\"else_body\":$else_body}"
    fi

    _PARSE_RESULT="$result"
}

# Parse for clause
# Sets _PARSE_RESULT on success
_parse_for_clause() {
    _parse_current
    local line="$_PARSE_LINE"
    local col="$_PARSE_COL"

    _parse_expect "KW_FOR" || { _PARSE_RESULT=""; return 1; }
    _parse_skip_newlines

    _parse_current
    local var="$_PARSE_VALUE"
    _parse_expect "WORD" || { _PARSE_RESULT=""; return 1; }

    _parse_skip_newlines

    local items=""
    if _parse_is "KW_IN"; then
        _parse_advance

        # Collect items until ; or newline
        local first_item=true
        while ! _parse_is_one_of "SEMI" "NEWLINE" "KW_DO"; do
            if _parse_eof; then break; fi
            _parse_atom || break
            [[ "$first_item" == true ]] || items+=","
            first_item=false
            items+="$_PARSE_RESULT"
        done
    fi

    # Skip to do
    while _parse_is_one_of "SEMI" "NEWLINE"; do
        _parse_advance
    done

    _parse_expect "KW_DO" || { _PARSE_RESULT=""; return 1; }
    _parse_skip_newlines

    _parse_compound_list
    local body="$_PARSE_RESULT"

    _parse_skip_newlines
    _parse_expect "KW_DONE" || { _PARSE_RESULT=""; return 1; }

    _PARSE_RESULT=$(_node "for_clause" "$line" "$col" \
        "variable" "\"$(_cst_escape_json "$var")\"" \
        "items" "[$items]" \
        "body" "$body")
}

# Parse while clause
# Sets _PARSE_RESULT on success
_parse_while_clause() {
    _parse_current
    local line="$_PARSE_LINE"
    local col="$_PARSE_COL"

    _parse_expect "KW_WHILE" || { _PARSE_RESULT=""; return 1; }
    _parse_skip_newlines

    _parse_compound_list
    local condition="$_PARSE_RESULT"

    _parse_skip_newlines
    _parse_expect "KW_DO" || { _PARSE_RESULT=""; return 1; }
    _parse_skip_newlines

    _parse_compound_list
    local body="$_PARSE_RESULT"

    _parse_skip_newlines
    _parse_expect "KW_DONE" || { _PARSE_RESULT=""; return 1; }

    _PARSE_RESULT=$(_node "while_clause" "$line" "$col" \
        "condition" "$condition" \
        "body" "$body")
}

# Parse until clause
# Sets _PARSE_RESULT on success
_parse_until_clause() {
    _parse_current
    local line="$_PARSE_LINE"
    local col="$_PARSE_COL"

    _parse_expect "KW_UNTIL" || { _PARSE_RESULT=""; return 1; }
    _parse_skip_newlines

    _parse_compound_list
    local condition="$_PARSE_RESULT"

    _parse_skip_newlines
    _parse_expect "KW_DO" || { _PARSE_RESULT=""; return 1; }
    _parse_skip_newlines

    _parse_compound_list
    local body="$_PARSE_RESULT"

    _parse_skip_newlines
    _parse_expect "KW_DONE" || { _PARSE_RESULT=""; return 1; }

    _PARSE_RESULT=$(_node "until_clause" "$line" "$col" \
        "condition" "$condition" \
        "body" "$body")
}

# Parse case clause (simplified)
# Sets _PARSE_RESULT on success
_parse_case_clause() {
    _parse_current
    local line="$_PARSE_LINE"
    local col="$_PARSE_COL"

    _parse_expect "KW_CASE" || { _PARSE_RESULT=""; return 1; }

    _parse_atom || { _PARSE_RESULT=""; return 1; }
    local word="$_PARSE_RESULT"

    _parse_skip_newlines
    _parse_expect "KW_IN" || { _PARSE_RESULT=""; return 1; }
    _parse_skip_newlines

    # Parse case items (simplified - just collect until esac)
    local items=""
    while ! _parse_is "KW_ESAC" && ! _parse_eof; do
        _parse_advance
    done

    _parse_expect "KW_ESAC" || { _PARSE_RESULT=""; return 1; }

    _PARSE_RESULT=$(_node "case_clause" "$line" "$col" \
        "word" "$word" \
        "items" "[]")
}

# Parse group: { list; }
# Sets _PARSE_RESULT on success
_parse_group() {
    _parse_current
    local line="$_PARSE_LINE"
    local col="$_PARSE_COL"

    _parse_expect "LBRACE" || { _PARSE_RESULT=""; return 1; }
    _parse_skip_newlines

    _parse_compound_list
    local body="$_PARSE_RESULT"

    _parse_skip_newlines
    _parse_expect "RBRACE" || { _PARSE_RESULT=""; return 1; }

    _PARSE_RESULT=$(_node "group" "$line" "$col" "body" "$body")
}

# Parse subshell: ( list )
# Sets _PARSE_RESULT on success
_parse_subshell() {
    _parse_current
    local line="$_PARSE_LINE"
    local col="$_PARSE_COL"

    _parse_expect "LPAREN" || { _PARSE_RESULT=""; return 1; }
    _parse_skip_newlines

    _parse_compound_list
    local body="$_PARSE_RESULT"

    _parse_skip_newlines
    _parse_expect "RPAREN" || { _PARSE_RESULT=""; return 1; }

    _PARSE_RESULT=$(_node "subshell" "$line" "$col" "body" "$body")
}

# Parse [[ conditional ]]
# Sets _PARSE_RESULT on success
_parse_conditional() {
    _parse_current
    local line="$_PARSE_LINE"
    local col="$_PARSE_COL"

    _parse_expect "DBLBRACKET" || { _PARSE_RESULT=""; return 1; }

    # Collect expression until ]]
    local expr=""
    while ! _parse_is "DBLBRACKET_END" && ! _parse_eof; do
        _parse_current
        [[ -n "$expr" ]] && expr+=" "
        expr+="$_PARSE_VALUE"
        _parse_advance
    done

    _parse_expect "DBLBRACKET_END" || { _PARSE_RESULT=""; return 1; }

    _PARSE_RESULT=$(_node "conditional" "$line" "$col" "expression" "\"$(_cst_escape_json "$expr")\"")
}

# Parse (( arithmetic ))
# Sets _PARSE_RESULT on success
_parse_arithmetic_cmd() {
    _parse_current
    local line="$_PARSE_LINE"
    local col="$_PARSE_COL"

    _parse_expect "DARITH" || { _PARSE_RESULT=""; return 1; }

    # Collect until ))
    local expr=""
    while ! _parse_eof; do
        _parse_current
        if [[ "$_PARSE_TYPE" == "DARITH_END" ]]; then
            _parse_advance  # consume ))
            break
        fi
        [[ -n "$expr" ]] && expr+=" "
        expr+="$_PARSE_VALUE"
        _parse_advance
    done

    _PARSE_RESULT=$(_node "arithmetic_cmd" "$line" "$col" "expression" "\"$(_cst_escape_json "$expr")\"")
}

#==============================================================================
# PARSER - MAIN ENTRY
#==============================================================================

# Parse script into CST
# Sets _PARSE_RESULT on success
_parse_script() {
    local line=1
    local col=1

    if (( _PARSE_LEN > 0 )); then
        _parse_current
        line="$_PARSE_LINE"
        col="$_PARSE_COL"
    fi

    _parse_compound_list
    local body="$_PARSE_RESULT"

    _PARSE_RESULT=$(_node "script" "$line" "$col" "body" "$body")
}

# Main parse function
bash_cst_parse() {
    local input="$1"

    _parse_load_tokens "$input"
    _parse_script
    echo "$_PARSE_RESULT"
}

# Parse to pretty JSON
bash_cst_parse_pretty() {
    local input="$1"
    local json
    json=$(bash_cst_parse "$input")

    if command -v jq &>/dev/null; then
        echo "$json" | jq .
    else
        echo "$json"
    fi
}

#==============================================================================
# EXPORTS
#==============================================================================

export -f bash_cst_tokenize bash_cst_tokenize_json
export -f bash_cst_parse bash_cst_parse_pretty
export -f _tok_peek _tok_peek_n _tok_advance _tok_eof _tok_emit
export -f _tok_is_space _tok_is_word_char _tok_is_keyword
export -f _tok_skip_space _tok_consume_comment
export -f _tok_consume_sq_string _tok_consume_dq_string _tok_consume_dollar_sq_string
export -f _tok_consume_variable _tok_consume_backtick _tok_consume_word
export -f _tok_consume_operator
export -f _cst_escape_json _cst_pos_json
export -f _parse_load_tokens _parse_current _parse_peek _parse_advance _parse_eof
export -f _parse_expect _parse_is _parse_is_one_of _parse_skip_newlines
export -f _node _node_with_children
export -f _parse_atom _parse_redirection _parse_simple_command _parse_assignment
export -f _parse_function_def _parse_pipeline _parse_list _parse_compound_list _parse_command
export -f _parse_if_clause _parse_for_clause _parse_while_clause _parse_until_clause
export -f _parse_case_clause _parse_group _parse_subshell _parse_conditional _parse_arithmetic_cmd
export -f _parse_script

#==============================================================================
# FUNCTION EXTRACTOR
#==============================================================================

# Extract function definitions from CST JSON
# Walks the tree and finds all function_def nodes
# Output formats: name, json, tsv
_cst_extract_functions() {
    local json="$1"
    local format="${2:-name}"  # name, json, tsv

    # Use jq to recursively find all function_def nodes
    local jq_query='
        .. | objects | select(.type == "function_def") | {
            name: .name,
            line: .pos.line,
            col: .pos.col
        }
    '

    case "$format" in
        name)
            echo "$json" | jq -r "$jq_query | .name"
            ;;
        json)
            echo "$json" | jq -c "[$jq_query]"
            ;;
        tsv)
            echo "$json" | jq -r "$jq_query | [.name, .line, .col] | @tsv"
            ;;
        *)
            echo "Unknown format: $format" >&2
            return 1
            ;;
    esac
}

# Extract functions from a bash file
# Usage: bash_cst_functions file.sh [format]
bash_cst_functions() {
    local input="$1"
    local format="${2:-name}"

    local json
    json=$(bash_cst_parse "$input")

    _cst_extract_functions "$json" "$format"
}

export -f _cst_extract_functions bash_cst_functions

#==============================================================================
# CLI
#==============================================================================

_bash_cst_main() {
    case "${1:-}" in
        -h|--help)
            echo "Usage: bash_cst.sh [options] [file|-]"
            echo ""
            echo "Commands:"
            echo "  tokenize FILE      Tokenize file (one token per line)"
            echo "  tokens FILE        Tokenize to JSON"
            echo "  parse FILE         Parse to CST (JSON output)"
            echo "  functions FILE     Extract function names"
            echo "  functions -j FILE  Extract functions as JSON"
            echo "  functions -t FILE  Extract functions as TSV (name, line, col)"
            echo ""
            echo "Examples:"
            echo "  bash_cst.sh tokenize script.sh"
            echo "  bash_cst.sh functions mylib.sh"
            echo "  bash_cst.sh functions -j mylib.sh | jq ."
            echo "  echo 'foo() { echo hi; }' | bash_cst.sh functions -"
            ;;
        tokenize)
            local input
            if [[ "${2:-}" == "-" ]]; then
                IFS= read -r -d '' input || true
            elif [[ -f "${2:-}" ]]; then
                IFS= read -r -d '' input < "$2" || true
            else
                echo "Error: file not found: ${2:-}" >&2
                return 1
            fi
            bash_cst_tokenize "$input"
            ;;
        tokens)
            local input
            if [[ "${2:-}" == "-" ]]; then
                IFS= read -r -d '' input || true
            elif [[ -f "${2:-}" ]]; then
                IFS= read -r -d '' input < "$2" || true
            else
                echo "Error: file not found: ${2:-}" >&2
                return 1
            fi
            bash_cst_tokenize_json "$input"
            ;;
        parse)
            local input
            if [[ "${2:-}" == "-" ]]; then
                IFS= read -r -d '' input || true
            elif [[ -f "${2:-}" ]]; then
                IFS= read -r -d '' input < "$2" || true
            else
                echo "Error: file not found: ${2:-}" >&2
                return 1
            fi
            bash_cst_parse_pretty "$input"
            ;;
        functions)
            local format="name"
            local file=""
            shift  # remove 'functions'

            # Parse options
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    -j|--json) format="json"; shift ;;
                    -t|--tsv)  format="tsv"; shift ;;
                    -n|--name) format="name"; shift ;;
                    -)
                        file="-"; shift
                        ;;
                    -*)
                        echo "Unknown option: $1" >&2
                        return 1
                        ;;
                    *)
                        file="$1"; shift
                        ;;
                esac
            done

            local input
            if [[ "$file" == "-" ]]; then
                IFS= read -r -d '' input || true
            elif [[ -f "$file" ]]; then
                IFS= read -r -d '' input < "$file" || true
            else
                echo "Error: file not found: ${file:-<none>}" >&2
                return 1
            fi
            bash_cst_functions "$input" "$format"
            ;;
        *)
            echo "Usage: bash_cst.sh [tokenize|tokens|parse|functions] [file|-]" >&2
            return 1
            ;;
    esac
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    _bash_cst_main "$@"
fi
