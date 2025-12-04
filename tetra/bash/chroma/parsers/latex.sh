#!/usr/bin/env bash

# Chroma LaTeX Math Parser
# Renders LaTeX math expressions to UTF-8 terminal output
# Requires Bash 5.2+

#==============================================================================
# UNICODE CHARACTER MAPS
#==============================================================================

# Superscript characters (0-9, +, -, =, (, ), n, i)
declare -gA LATEX_SUPERSCRIPT=(
    [0]="⁰" [1]="¹" [2]="²" [3]="³" [4]="⁴"
    [5]="⁵" [6]="⁶" [7]="⁷" [8]="⁸" [9]="⁹"
    [+]="⁺" [-]="⁻" [=]="⁼" ["("]="⁽" [")"]="⁾"
    [n]="ⁿ" [i]="ⁱ" [x]="ˣ" [y]="ʸ" [a]="ᵃ" [b]="ᵇ"
    [c]="ᶜ" [d]="ᵈ" [e]="ᵉ" [f]="ᶠ" [g]="ᵍ" [h]="ʰ"
    [j]="ʲ" [k]="ᵏ" [l]="ˡ" [m]="ᵐ" [o]="ᵒ" [p]="ᵖ"
    [r]="ʳ" [s]="ˢ" [t]="ᵗ" [u]="ᵘ" [v]="ᵛ" [w]="ʷ"
    [z]="ᶻ"
)

# Bold superscript numbers (using mathematical bold)
declare -gA LATEX_SUPERSCRIPT_BOLD=(
    [0]="⁰" [1]="¹" [2]="𝟐" [3]="𝟑" [4]="𝟒"
    [5]="𝟓" [6]="𝟔" [7]="𝟕" [8]="𝟖" [9]="𝟗"
    [+]="⁺" [-]="⁻" [=]="⁼" ["("]="⁽" [")"]="⁾"
    [n]="ⁿ" [i]="ⁱ" [x]="ˣ"
)

# Subscript characters (0-9, +, -, =, (, ), common letters)
declare -gA LATEX_SUBSCRIPT=(
    [0]="₀" [1]="₁" [2]="₂" [3]="₃" [4]="₄"
    [5]="₅" [6]="₆" [7]="₇" [8]="₈" [9]="₉"
    [+]="₊" [-]="₋" [=]="₌" ["("]="₍" [")"]="₎"
    [a]="ₐ" [e]="ₑ" [h]="ₕ" [i]="ᵢ" [j]="ⱼ"
    [k]="ₖ" [l]="ₗ" [m]="ₘ" [n]="ₙ" [o]="ₒ"
    [p]="ₚ" [r]="ᵣ" [s]="ₛ" [t]="ₜ" [u]="ᵤ"
    [v]="ᵥ" [x]="ₓ"
)

# Greek letters
declare -gA LATEX_GREEK=(
    [alpha]="α"   [beta]="β"    [gamma]="γ"   [delta]="δ"
    [epsilon]="ε" [zeta]="ζ"    [eta]="η"     [theta]="θ"
    [iota]="ι"    [kappa]="κ"   [lambda]="λ"  [mu]="μ"
    [nu]="ν"      [xi]="ξ"      [omicron]="ο" [pi]="π"
    [rho]="ρ"     [sigma]="σ"   [tau]="τ"     [upsilon]="υ"
    [phi]="φ"     [chi]="χ"     [psi]="ψ"     [omega]="ω"
    [Alpha]="Α"   [Beta]="Β"    [Gamma]="Γ"   [Delta]="Δ"
    [Epsilon]="Ε" [Zeta]="Ζ"    [Eta]="Η"     [Theta]="Θ"
    [Iota]="Ι"    [Kappa]="Κ"   [Lambda]="Λ"  [Mu]="Μ"
    [Nu]="Ν"      [Xi]="Ξ"      [Omicron]="Ο" [Pi]="Π"
    [Rho]="Ρ"     [Sigma]="Σ"   [Tau]="Τ"     [Upsilon]="Υ"
    [Phi]="Φ"     [Chi]="Χ"     [Psi]="Ψ"     [Omega]="Ω"
    [varepsilon]="ε" [varphi]="φ" [varpi]="ϖ" [varrho]="ϱ"
    [varsigma]="ς" [vartheta]="ϑ"
)

# Math symbols
declare -gA LATEX_SYMBOLS=(
    [infty]="∞"   [partial]="∂" [nabla]="∇"   [forall]="∀"
    [exists]="∃"  [nexists]="∄" [emptyset]="∅" [varnothing]="∅"
    [in]="∈"      [notin]="∉"   [ni]="∋"      [subset]="⊂"
    [supset]="⊃"  [subseteq]="⊆" [supseteq]="⊇"
    [cup]="∪"     [cap]="∩"     [setminus]="∖"
    [times]="×"   [div]="÷"     [cdot]="·"    [ast]="∗"
    [star]="⋆"    [circ]="∘"    [bullet]="•"
    [pm]="±"      [mp]="∓"      [leq]="≤"     [geq]="≥"
    [neq]="≠"     [approx]="≈"  [equiv]="≡"   [sim]="∼"
    [propto]="∝"  [ll]="≪"      [gg]="≫"
    [to]="→"      [gets]="←"    [leftrightarrow]="↔"
    [Rightarrow]="⇒" [Leftarrow]="⇐" [Leftrightarrow]="⇔"
    [uparrow]="↑" [downarrow]="↓" [updownarrow]="↕"
    [Uparrow]="⇑" [Downarrow]="⇓"
    [implies]="⟹" [iff]="⟺"
    [neg]="¬"     [land]="∧"    [lor]="∨"     [oplus]="⊕"
    [otimes]="⊗"  [perp]="⊥"    [angle]="∠"
    [prime]="′"   [dprime]="″"  [therefore]="∴" [because]="∵"
    [ldots]="…"   [cdots]="⋯"   [vdots]="⋮"   [ddots]="⋱"
    [aleph]="ℵ"   [hbar]="ℏ"    [ell]="ℓ"     [wp]="℘"
    [Re]="ℜ"      [Im]="ℑ"
    [sqrt]="√"    [cbrt]="∛"    [fourthrt]="∜"
    [int]="∫"     [iint]="∬"    [iiint]="∭"   [oint]="∮"
    [prod]="∏"    [coprod]="∐"
    [langle]="⟨"  [rangle]="⟩"  [lceil]="⌈"   [rceil]="⌉"
    [lfloor]="⌊"  [rfloor]="⌋"
)

# Big operators - single char versions for inline
declare -gA LATEX_BIG_OPS=(
    [sum]="∑"
    [prod]="∏"
    [int]="∫"
    [bigcup]="⋃"
    [bigcap]="⋂"
    [bigoplus]="⨁"
    [bigotimes]="⨂"
    [lim]="lim"
)

# Compact 2-line versions for display mode
# Sum: ╲ zigzag ╱, Integral: tall with curve, Prod: pi-like
declare -gA LATEX_BIG_OPS_LARGE_TOP=(
    [sum]="╲▔"
    [prod]="┬─┬"
    [int]=" ╭"
    [lim]="   "
    [bigcup]="╭─╮"
    [bigcap]="╰─╯"
)
declare -gA LATEX_BIG_OPS_LARGE_BOT=(
    [sum]="▁╱"
    [prod]="│ │"
    [int]="╯ "
    [lim]="lim"
    [bigcup]="╰─╯"
    [bigcap]="╭─╮"
)
# For 3-line ops (integral needs 3 for proper curve)
declare -gA LATEX_BIG_OPS_LARGE_MID=(
    [int]="│ "
)

#==============================================================================
# TOKENIZER
#==============================================================================

# Token types
declare -g LATEX_TOK_EOF="EOF"
declare -g LATEX_TOK_NUM="NUM"
declare -g LATEX_TOK_VAR="VAR"
declare -g LATEX_TOK_CMD="CMD"
declare -g LATEX_TOK_LBRACE="LBRACE"
declare -g LATEX_TOK_RBRACE="RBRACE"
declare -g LATEX_TOK_LPAREN="LPAREN"
declare -g LATEX_TOK_RPAREN="RPAREN"
declare -g LATEX_TOK_LBRACK="LBRACK"
declare -g LATEX_TOK_RBRACK="RBRACK"
declare -g LATEX_TOK_CARET="CARET"
declare -g LATEX_TOK_UNDER="UNDER"
declare -g LATEX_TOK_PLUS="PLUS"
declare -g LATEX_TOK_MINUS="MINUS"
declare -g LATEX_TOK_STAR="STAR"
declare -g LATEX_TOK_SLASH="SLASH"
declare -g LATEX_TOK_EQ="EQ"
declare -g LATEX_TOK_COMMA="COMMA"
declare -g LATEX_TOK_SPACE="SPACE"

# Tokenizer state
declare -g _LATEX_INPUT=""
declare -g _LATEX_POS=0
declare -ga _LATEX_TOKENS=()
declare -ga _LATEX_TOKEN_VALS=()
declare -g _LATEX_TOK_IDX=0

# Initialize tokenizer with input string
_latex_tokenize() {
    local input="$1"
    _LATEX_INPUT="$input"
    _LATEX_POS=0
    _LATEX_TOKENS=()
    _LATEX_TOKEN_VALS=()
    _LATEX_TOK_IDX=0

    local len=${#input}

    while (( _LATEX_POS < len )); do
        local ch="${input:_LATEX_POS:1}"

        case "$ch" in
            # Whitespace - skip or mark
            ' '|$'\t'|$'\n')
                (( _LATEX_POS++ ))
                ;;

            # Single-char tokens
            '{')
                _LATEX_TOKENS+=("$LATEX_TOK_LBRACE")
                _LATEX_TOKEN_VALS+=("{")
                (( _LATEX_POS++ ))
                ;;
            '}')
                _LATEX_TOKENS+=("$LATEX_TOK_RBRACE")
                _LATEX_TOKEN_VALS+=("}")
                (( _LATEX_POS++ ))
                ;;
            '(')
                _LATEX_TOKENS+=("$LATEX_TOK_LPAREN")
                _LATEX_TOKEN_VALS+=("(")
                (( _LATEX_POS++ ))
                ;;
            ')')
                _LATEX_TOKENS+=("$LATEX_TOK_RPAREN")
                _LATEX_TOKEN_VALS+=(")")
                (( _LATEX_POS++ ))
                ;;
            '[')
                _LATEX_TOKENS+=("$LATEX_TOK_LBRACK")
                _LATEX_TOKEN_VALS+=("[")
                (( _LATEX_POS++ ))
                ;;
            ']')
                _LATEX_TOKENS+=("$LATEX_TOK_RBRACK")
                _LATEX_TOKEN_VALS+=("]")
                (( _LATEX_POS++ ))
                ;;
            '^')
                _LATEX_TOKENS+=("$LATEX_TOK_CARET")
                _LATEX_TOKEN_VALS+=("^")
                (( _LATEX_POS++ ))
                ;;
            '_')
                _LATEX_TOKENS+=("$LATEX_TOK_UNDER")
                _LATEX_TOKEN_VALS+=("_")
                (( _LATEX_POS++ ))
                ;;
            '+')
                _LATEX_TOKENS+=("$LATEX_TOK_PLUS")
                _LATEX_TOKEN_VALS+=("+")
                (( _LATEX_POS++ ))
                ;;
            '-')
                _LATEX_TOKENS+=("$LATEX_TOK_MINUS")
                _LATEX_TOKEN_VALS+=("-")
                (( _LATEX_POS++ ))
                ;;
            '*')
                _LATEX_TOKENS+=("$LATEX_TOK_STAR")
                _LATEX_TOKEN_VALS+=("*")
                (( _LATEX_POS++ ))
                ;;
            '/')
                _LATEX_TOKENS+=("$LATEX_TOK_SLASH")
                _LATEX_TOKEN_VALS+=("/")
                (( _LATEX_POS++ ))
                ;;
            '=')
                _LATEX_TOKENS+=("$LATEX_TOK_EQ")
                _LATEX_TOKEN_VALS+=("=")
                (( _LATEX_POS++ ))
                ;;
            ',')
                _LATEX_TOKENS+=("$LATEX_TOK_COMMA")
                _LATEX_TOKEN_VALS+=(",")
                (( _LATEX_POS++ ))
                ;;

            # Commands starting with backslash
            \\)
                (( _LATEX_POS++ ))
                local cmd=""
                while (( _LATEX_POS < len )); do
                    local c="${input:_LATEX_POS:1}"
                    if [[ "$c" =~ [a-zA-Z] ]]; then
                        cmd+="$c"
                        (( _LATEX_POS++ ))
                    else
                        break
                    fi
                done
                if [[ -n "$cmd" ]]; then
                    _LATEX_TOKENS+=("$LATEX_TOK_CMD")
                    _LATEX_TOKEN_VALS+=("$cmd")
                fi
                ;;

            # Numbers
            [0-9]|'.')
                local num=""
                while (( _LATEX_POS < len )); do
                    local c="${input:_LATEX_POS:1}"
                    if [[ "$c" =~ [0-9.] ]]; then
                        num+="$c"
                        (( _LATEX_POS++ ))
                    else
                        break
                    fi
                done
                _LATEX_TOKENS+=("$LATEX_TOK_NUM")
                _LATEX_TOKEN_VALS+=("$num")
                ;;

            # Variables (single letters or words)
            [a-zA-Z])
                local var=""
                while (( _LATEX_POS < len )); do
                    local c="${input:_LATEX_POS:1}"
                    if [[ "$c" =~ [a-zA-Z] ]]; then
                        var+="$c"
                        (( _LATEX_POS++ ))
                    else
                        break
                    fi
                done
                _LATEX_TOKENS+=("$LATEX_TOK_VAR")
                _LATEX_TOKEN_VALS+=("$var")
                ;;

            # Unknown - skip
            *)
                (( _LATEX_POS++ ))
                ;;
        esac
    done

    # Add EOF
    _LATEX_TOKENS+=("$LATEX_TOK_EOF")
    _LATEX_TOKEN_VALS+=("")
}

# Get current token type (sets _LATEX_CUR_TOK)
_latex_tok() {
    _LATEX_CUR_TOK="${_LATEX_TOKENS[$_LATEX_TOK_IDX]:-$LATEX_TOK_EOF}"
}

# Get current token value (sets _LATEX_CUR_VAL)
_latex_val() {
    _LATEX_CUR_VAL="${_LATEX_TOKEN_VALS[$_LATEX_TOK_IDX]:-}"
}

# Advance to next token
_latex_advance() {
    (( _LATEX_TOK_IDX++ ))
}

# Check if current token matches (no subshell)
_latex_match() {
    _latex_tok
    [[ "$_LATEX_CUR_TOK" == "$1" ]]
}

# Consume token if it matches
_latex_consume() {
    if _latex_match "$1"; then
        _latex_advance
        return 0
    fi
    return 1
}

#==============================================================================
# AST NODE STORAGE
#==============================================================================

# AST nodes stored in parallel arrays
declare -ga _LATEX_NODE_TYPE=()
declare -ga _LATEX_NODE_VAL=()
declare -ga _LATEX_NODE_LEFT=()
declare -ga _LATEX_NODE_RIGHT=()
declare -ga _LATEX_NODE_EXTRA=()
declare -g _LATEX_NODE_COUNT=0

# Create a new AST node, sets _LATEX_RESULT to node ID
_latex_new_node() {
    local type="$1"
    local val="${2:-}"
    local left="${3:--1}"
    local right="${4:--1}"
    local extra="${5:--1}"

    local id=$_LATEX_NODE_COUNT
    _LATEX_NODE_TYPE[$id]="$type"
    _LATEX_NODE_VAL[$id]="$val"
    _LATEX_NODE_LEFT[$id]="$left"
    _LATEX_NODE_RIGHT[$id]="$right"
    _LATEX_NODE_EXTRA[$id]="$extra"

    (( _LATEX_NODE_COUNT++ ))
    _LATEX_RESULT=$id
}

# Reset AST
_latex_reset_ast() {
    _LATEX_NODE_TYPE=()
    _LATEX_NODE_VAL=()
    _LATEX_NODE_LEFT=()
    _LATEX_NODE_RIGHT=()
    _LATEX_NODE_EXTRA=()
    _LATEX_NODE_COUNT=0
}

#==============================================================================
# RECURSIVE DESCENT PARSER
#==============================================================================

# Grammar (simplified):
#   expr     -> term (('+' | '-') term)*
#   term     -> factor (('*' | implicit_mult) factor)*
#   factor   -> base ('^' factor | '_' factor)*
#   base     -> NUM | VAR | CMD args | '(' expr ')' | '{' expr '}'
#   args     -> ('{' expr '}')* | subscript/superscript

# Parse full expression - sets _LATEX_RESULT
_latex_parse_expr() {
    _latex_parse_term
    local left=$_LATEX_RESULT

    while _latex_match "$LATEX_TOK_PLUS" || _latex_match "$LATEX_TOK_MINUS" || _latex_match "$LATEX_TOK_EQ"; do
        _latex_val
        local op="$_LATEX_CUR_VAL"
        _latex_advance
        _latex_parse_term
        local right=$_LATEX_RESULT
        if [[ "$op" == "+" ]]; then
            _latex_new_node "ADD" "" "$left" "$right"
        elif [[ "$op" == "-" ]]; then
            _latex_new_node "SUB" "" "$left" "$right"
        else
            _latex_new_node "EQ" "" "$left" "$right"
        fi
        left=$_LATEX_RESULT
    done

    _LATEX_RESULT=$left
}

# Check if current token can start a factor (for implicit multiplication)
_latex_can_start_factor() {
    _latex_tok
    case "$_LATEX_CUR_TOK" in
        "$LATEX_TOK_VAR"|"$LATEX_TOK_NUM"|"$LATEX_TOK_CMD"|"$LATEX_TOK_LPAREN"|"$LATEX_TOK_LBRACE")
            return 0 ;;
        *)
            return 1 ;;
    esac
}

# Parse term (multiplicative) - sets _LATEX_RESULT
_latex_parse_term() {
    _latex_parse_factor
    local left=$_LATEX_RESULT

    while true; do
        _latex_tok
        if [[ "$_LATEX_CUR_TOK" == "$LATEX_TOK_STAR" ]]; then
            _latex_advance
            _latex_parse_factor
            local right=$_LATEX_RESULT
            _latex_new_node "MUL" "" "$left" "$right"
            left=$_LATEX_RESULT
        elif [[ "$_LATEX_CUR_TOK" == "$LATEX_TOK_SLASH" ]]; then
            _latex_advance
            _latex_parse_factor
            local right=$_LATEX_RESULT
            _latex_new_node "DIV" "" "$left" "$right"
            left=$_LATEX_RESULT
        elif _latex_can_start_factor; then
            # Implicit multiplication (e.g., "2x" or "xy")
            _latex_parse_factor
            local right=$_LATEX_RESULT
            _latex_new_node "MUL" "" "$left" "$right"
            left=$_LATEX_RESULT
        else
            break
        fi
    done

    _LATEX_RESULT=$left
}

# Parse factor (exponents and subscripts) - sets _LATEX_RESULT
_latex_parse_factor() {
    _latex_parse_base
    local base=$_LATEX_RESULT

    # Handle superscripts and subscripts
    while _latex_match "$LATEX_TOK_CARET" || _latex_match "$LATEX_TOK_UNDER"; do
        _latex_tok
        if [[ "$_LATEX_CUR_TOK" == "$LATEX_TOK_CARET" ]]; then
            _latex_advance
            _latex_parse_base
            local exp=$_LATEX_RESULT
            _latex_new_node "POW" "" "$base" "$exp"
            base=$_LATEX_RESULT
        elif [[ "$_LATEX_CUR_TOK" == "$LATEX_TOK_UNDER" ]]; then
            _latex_advance
            _latex_parse_base
            local sub=$_LATEX_RESULT
            _latex_new_node "SUBSCRIPT" "" "$base" "$sub"
            base=$_LATEX_RESULT
        fi
    done

    _LATEX_RESULT=$base
}

# Parse base element - sets _LATEX_RESULT
_latex_parse_base() {
    _latex_tok
    _latex_val
    local tok="$_LATEX_CUR_TOK"
    local val="$_LATEX_CUR_VAL"

    case "$tok" in
        "$LATEX_TOK_NUM")
            _latex_advance
            _latex_new_node "NUM" "$val"
            ;;

        "$LATEX_TOK_VAR")
            _latex_advance
            _latex_new_node "VAR" "$val"
            ;;

        "$LATEX_TOK_CMD")
            _latex_advance
            _latex_parse_command "$val"
            ;;

        "$LATEX_TOK_LPAREN")
            _latex_advance
            _latex_parse_expr
            local inner=$_LATEX_RESULT
            _latex_consume "$LATEX_TOK_RPAREN" || true
            _latex_new_node "PAREN" "" "$inner"
            ;;

        "$LATEX_TOK_LBRACE")
            _latex_advance
            _latex_parse_expr
            _latex_consume "$LATEX_TOK_RBRACE" || true
            # _LATEX_RESULT already set by _latex_parse_expr
            ;;

        "$LATEX_TOK_MINUS")
            _latex_advance
            _latex_parse_factor
            local operand=$_LATEX_RESULT
            _latex_new_node "NEG" "" "$operand"
            ;;

        *)
            # Empty node for unexpected tokens
            _latex_new_node "EMPTY" ""
            ;;
    esac
}

# Parse LaTeX command with arguments - sets _LATEX_RESULT
_latex_parse_command() {
    local cmd="$1"

    case "$cmd" in
        frac)
            # \frac{num}{den}
            _latex_consume "$LATEX_TOK_LBRACE" || true
            _latex_parse_expr
            local num=$_LATEX_RESULT
            _latex_consume "$LATEX_TOK_RBRACE" || true
            _latex_consume "$LATEX_TOK_LBRACE" || true
            _latex_parse_expr
            local den=$_LATEX_RESULT
            _latex_consume "$LATEX_TOK_RBRACE" || true
            _latex_new_node "FRAC" "" "$num" "$den"
            ;;

        sqrt)
            # \sqrt{expr} or \sqrt[n]{expr}
            local index=-1
            if _latex_match "$LATEX_TOK_LBRACK"; then
                _latex_advance
                _latex_parse_expr
                index=$_LATEX_RESULT
                _latex_consume "$LATEX_TOK_RBRACK" || true
            fi
            _latex_consume "$LATEX_TOK_LBRACE" || true
            _latex_parse_expr
            local radicand=$_LATEX_RESULT
            _latex_consume "$LATEX_TOK_RBRACE" || true
            _latex_new_node "SQRT" "" "$radicand" "$index"
            ;;

        sum|prod|int|bigcup|bigcap|lim)
            # Big operators with optional limits
            local lower=-1 upper=-1 body=-1

            # Check for subscript (lower limit)
            if _latex_match "$LATEX_TOK_UNDER"; then
                _latex_advance
                _latex_parse_base
                lower=$_LATEX_RESULT
            fi

            # Check for superscript (upper limit)
            if _latex_match "$LATEX_TOK_CARET"; then
                _latex_advance
                _latex_parse_base
                upper=$_LATEX_RESULT
            fi

            # Check again for subscript if superscript came first
            if (( lower == -1 )) && _latex_match "$LATEX_TOK_UNDER"; then
                _latex_advance
                _latex_parse_base
                lower=$_LATEX_RESULT
            fi

            _latex_new_node "BIGOP" "$cmd" "$lower" "$upper" "$body"
            ;;

        left)
            # \left( ... \right)
            _latex_val
            local delim="$_LATEX_CUR_VAL"
            _latex_advance
            _latex_parse_expr
            local inner=$_LATEX_RESULT
            # Skip \right and delimiter
            _latex_tok; _latex_val
            if [[ "$_LATEX_CUR_TOK" == "$LATEX_TOK_CMD" && "$_LATEX_CUR_VAL" == "right" ]]; then
                _latex_advance
                _latex_advance 2>/dev/null || true
            fi
            _latex_new_node "PAREN" "$delim" "$inner"
            ;;

        text|mathrm|textit|mathbf)
            # Text commands
            _latex_consume "$LATEX_TOK_LBRACE" || true
            local text=""
            _latex_tok
            while [[ "$_LATEX_CUR_TOK" != "$LATEX_TOK_RBRACE" && "$_LATEX_CUR_TOK" != "$LATEX_TOK_EOF" ]]; do
                _latex_val
                text+="$_LATEX_CUR_VAL"
                _latex_advance
                _latex_tok
            done
            _latex_consume "$LATEX_TOK_RBRACE" || true
            _latex_new_node "TEXT" "$text"
            ;;

        *)
            # Greek letters, symbols, etc.
            if [[ -v "LATEX_GREEK[$cmd]" ]]; then
                _latex_new_node "SYMBOL" "${LATEX_GREEK[$cmd]}"
            elif [[ -v "LATEX_SYMBOLS[$cmd]" ]]; then
                _latex_new_node "SYMBOL" "${LATEX_SYMBOLS[$cmd]}"
            else
                # Unknown command - render as text
                _latex_new_node "TEXT" "\\$cmd"
            fi
            ;;
    esac
}

#==============================================================================
# 2D BOX LAYOUT ENGINE
#==============================================================================

# Box storage: each node gets width, height, baseline, and line array
declare -gA _LATEX_BOX_W=()
declare -gA _LATEX_BOX_H=()
declare -gA _LATEX_BOX_BL=()  # baseline (line index from top)
declare -gA _LATEX_BOX_LINES=()  # newline-separated string of lines

# Compute layout for a node, store results in box arrays
_latex_layout() {
    local id="$1"

    (( id < 0 )) && {
        _LATEX_BOX_W[$id]=0
        _LATEX_BOX_H[$id]=1
        _LATEX_BOX_BL[$id]=0
        _LATEX_BOX_LINES[$id]=""
        return
    }

    local type="${_LATEX_NODE_TYPE[$id]}"
    local val="${_LATEX_NODE_VAL[$id]}"
    local left="${_LATEX_NODE_LEFT[$id]}"
    local right="${_LATEX_NODE_RIGHT[$id]}"
    local extra="${_LATEX_NODE_EXTRA[$id]}"

    case "$type" in
        NUM|VAR|TEXT)
            _LATEX_BOX_W[$id]=${#val}
            _LATEX_BOX_H[$id]=1
            _LATEX_BOX_BL[$id]=0
            _LATEX_BOX_LINES[$id]="$val"
            ;;

        SYMBOL)
            # UTF-8 symbols are usually 1 display width
            _LATEX_BOX_W[$id]=1
            _LATEX_BOX_H[$id]=1
            _LATEX_BOX_BL[$id]=0
            _LATEX_BOX_LINES[$id]="$val"
            ;;

        EMPTY)
            _LATEX_BOX_W[$id]=0
            _LATEX_BOX_H[$id]=1
            _LATEX_BOX_BL[$id]=0
            _LATEX_BOX_LINES[$id]=""
            ;;

        ADD|SUB|EQ)
            _latex_layout "$left"
            _latex_layout "$right"
            local op_char
            case "$type" in
                ADD) op_char="+" ;;
                SUB) op_char="−" ;;
                EQ)  op_char="=" ;;
            esac
            _latex_layout_binop "$id" "$left" "$right" "$op_char"
            ;;

        MUL)
            _latex_layout "$left"
            _latex_layout "$right"
            # Use space for implicit multiplication (cleaner look)
            _latex_layout_binop "$id" "$left" "$right" " "
            ;;

        DIV)
            _latex_layout "$left"
            _latex_layout "$right"
            _latex_layout_binop "$id" "$left" "$right" "÷"
            ;;

        NEG)
            _latex_layout "$left"
            local lw=${_LATEX_BOX_W[$left]}
            local lh=${_LATEX_BOX_H[$left]}
            local lbl=${_LATEX_BOX_BL[$left]}

            _LATEX_BOX_W[$id]=$((lw + 1))
            _LATEX_BOX_H[$id]=$lh
            _LATEX_BOX_BL[$id]=$lbl

            local lines=""
            local i=0
            while IFS= read -r line || [[ -n "$line" ]]; do
                if (( i == lbl )); then
                    lines+="−$line"
                else
                    lines+=" $line"
                fi
                lines+=$'\n'
                (( i++ ))
            done <<< "${_LATEX_BOX_LINES[$left]}"
            _LATEX_BOX_LINES[$id]="${lines%$'\n'}"
            ;;

        POW)
            _latex_layout "$left"
            _latex_layout "$right"
            _latex_layout_power "$id" "$left" "$right"
            ;;

        SUBSCRIPT)
            _latex_layout "$left"
            _latex_layout "$right"
            _latex_layout_subscript "$id" "$left" "$right"
            ;;

        FRAC)
            _latex_layout "$left"
            _latex_layout "$right"
            _latex_layout_fraction "$id" "$left" "$right"
            ;;

        SQRT)
            _latex_layout "$left"
            _latex_layout_sqrt "$id" "$left" "$right"
            ;;

        BIGOP)
            _latex_layout "$left"
            _latex_layout "$right"
            _latex_layout_bigop "$id" "$val" "$left" "$right"
            ;;

        PAREN)
            _latex_layout "$left"
            _latex_layout_paren "$id" "$left"
            ;;

        *)
            _LATEX_BOX_W[$id]=0
            _LATEX_BOX_H[$id]=1
            _LATEX_BOX_BL[$id]=0
            _LATEX_BOX_LINES[$id]=""
            ;;
    esac
}

# Layout binary operator (horizontal concatenation with operator)
_latex_layout_binop() {
    local id="$1" left="$2" right="$3" op="$4"

    local lw=${_LATEX_BOX_W[$left]} lh=${_LATEX_BOX_H[$left]} lbl=${_LATEX_BOX_BL[$left]}
    local rw=${_LATEX_BOX_W[$right]} rh=${_LATEX_BOX_H[$right]} rbl=${_LATEX_BOX_BL[$right]}

    # Align baselines
    local top_above=$(( lbl > rbl ? lbl : rbl ))
    local bot_below_l=$(( lh - lbl - 1 ))
    local bot_below_r=$(( rh - rbl - 1 ))
    local bot_below=$(( bot_below_l > bot_below_r ? bot_below_l : bot_below_r ))

    local new_h=$(( top_above + 1 + bot_below ))
    local new_bl=$top_above
    local new_w=$(( lw + 3 + rw ))  # " op "

    _LATEX_BOX_W[$id]=$new_w
    _LATEX_BOX_H[$id]=$new_h
    _LATEX_BOX_BL[$id]=$new_bl

    # Build lines
    local -a l_arr r_arr
    mapfile -t l_arr <<< "${_LATEX_BOX_LINES[$left]}"
    mapfile -t r_arr <<< "${_LATEX_BOX_LINES[$right]}"

    local lines=""
    for (( i=0; i<new_h; i++ )); do
        local l_idx=$(( i - (top_above - lbl) ))
        local r_idx=$(( i - (top_above - rbl) ))

        local l_line=""
        if (( l_idx >= 0 && l_idx < lh )); then
            l_line="${l_arr[$l_idx]}"
        fi
        printf -v l_line "%-${lw}s" "$l_line"

        local r_line=""
        if (( r_idx >= 0 && r_idx < rh )); then
            r_line="${r_arr[$r_idx]}"
        fi

        local mid=" "
        if (( i == new_bl )); then
            mid="$op"
        fi

        lines+="$l_line $mid $r_line"$'\n'
    done

    _LATEX_BOX_LINES[$id]="${lines%$'\n'}"
}

# Layout power (superscript) - ALWAYS elevated above baseline
_latex_layout_power() {
    local id="$1" base="$2" exp="$3"

    local bw=${_LATEX_BOX_W[$base]} bh=${_LATEX_BOX_H[$base]} bbl=${_LATEX_BOX_BL[$base]}
    local ew=${_LATEX_BOX_W[$exp]} eh=${_LATEX_BOX_H[$exp]}

    # Try to use Unicode superscripts for simple single-char exponents
    local exp_text="${_LATEX_BOX_LINES[$exp]}"
    local use_unicode=0
    local sup_text=""

    # Only use inline superscripts for very simple cases (single digit/letter)
    if (( eh == 1 && ${#exp_text} == 1 )); then
        local ch="${exp_text:0:1}"
        if [[ -v "LATEX_SUPERSCRIPT_BOLD[$ch]" ]]; then
            sup_text="${LATEX_SUPERSCRIPT_BOLD[$ch]}"
            use_unicode=1
        elif [[ -v "LATEX_SUPERSCRIPT[$ch]" ]]; then
            sup_text="${LATEX_SUPERSCRIPT[$ch]}"
            use_unicode=1
        fi
    fi

    if (( use_unicode )); then
        # Inline bold superscript - but still elevated (add blank line above)
        local new_h=$((bh + 1))
        local new_w=$((bw + 1))
        local new_bl=$((bbl + 1))

        _LATEX_BOX_W[$id]=$new_w
        _LATEX_BOX_H[$id]=$new_h
        _LATEX_BOX_BL[$id]=$new_bl

        local -a b_arr
        mapfile -t b_arr <<< "${_LATEX_BOX_LINES[$base]}"

        local lines=""
        # Top line: spaces for base, superscript at right
        printf -v lines "%-${bw}s%s\n" "" "$sup_text"
        # Base lines
        for (( i=0; i<bh; i++ )); do
            lines+="${b_arr[$i]} "$'\n'
        done
        _LATEX_BOX_LINES[$id]="${lines%$'\n'}"
    else
        # Stack exponent fully above-right (no overlap)
        local new_w=$((bw + ew))
        local new_h=$((bh + eh))  # no overlap - exponent fully above
        local new_bl=$((eh + bbl))

        _LATEX_BOX_W[$id]=$new_w
        _LATEX_BOX_H[$id]=$new_h
        _LATEX_BOX_BL[$id]=$new_bl

        local -a b_arr e_arr
        mapfile -t b_arr <<< "${_LATEX_BOX_LINES[$base]}"
        mapfile -t e_arr <<< "${_LATEX_BOX_LINES[$exp]}"

        local lines=""
        # Exponent lines (right-aligned above base)
        for (( i=0; i<eh; i++ )); do
            printf -v lines "%s%-${bw}s%s\n" "$lines" "" "${e_arr[$i]}"
        done
        # Base lines
        for (( i=0; i<bh; i++ )); do
            printf -v lines "%s%-${bw}s%*s\n" "$lines" "${b_arr[$i]}" "$ew" ""
        done
        _LATEX_BOX_LINES[$id]="${lines%$'\n'}"
    fi
}

# Layout subscript
_latex_layout_subscript() {
    local id="$1" base="$2" sub="$3"

    local bw=${_LATEX_BOX_W[$base]} bh=${_LATEX_BOX_H[$base]} bbl=${_LATEX_BOX_BL[$base]}
    local sw=${_LATEX_BOX_W[$sub]} sh=${_LATEX_BOX_H[$sub]}

    # Try Unicode subscripts
    local sub_text="${_LATEX_BOX_LINES[$sub]}"
    local use_unicode=1
    local sub_str=""

    if (( sh == 1 )); then
        for (( i=0; i<${#sub_text}; i++ )); do
            local ch="${sub_text:i:1}"
            if [[ -v "LATEX_SUBSCRIPT[$ch]" ]]; then
                sub_str+="${LATEX_SUBSCRIPT[$ch]}"
            else
                use_unicode=0
                break
            fi
        done
    else
        use_unicode=0
    fi

    if (( use_unicode )); then
        _LATEX_BOX_W[$id]=$((bw + ${#sub_str}))
        _LATEX_BOX_H[$id]=$bh
        _LATEX_BOX_BL[$id]=$bbl

        local -a b_arr
        mapfile -t b_arr <<< "${_LATEX_BOX_LINES[$base]}"

        local lines=""
        for (( i=0; i<bh; i++ )); do
            if (( i == bh - 1 )); then
                lines+="${b_arr[$i]}$sub_str"
            else
                lines+="${b_arr[$i]}$(printf '%*s' ${#sub_str} '')"
            fi
            lines+=$'\n'
        done
        _LATEX_BOX_LINES[$id]="${lines%$'\n'}"
    else
        # Stack subscript below-right
        local new_w=$((bw + sw))
        local new_h=$((bh + sh - 1))
        local new_bl=$bbl

        _LATEX_BOX_W[$id]=$new_w
        _LATEX_BOX_H[$id]=$new_h
        _LATEX_BOX_BL[$id]=$new_bl

        local -a b_arr s_arr
        mapfile -t b_arr <<< "${_LATEX_BOX_LINES[$base]}"
        mapfile -t s_arr <<< "${_LATEX_BOX_LINES[$sub]}"

        local lines=""
        for (( i=0; i<new_h; i++ )); do
            local b_idx=$i
            local s_idx=$(( i - bh + 1 ))

            local b_line=""
            if (( b_idx < bh )); then
                b_line="${b_arr[$b_idx]}"
            fi
            printf -v b_line "%-${bw}s" "$b_line"

            local s_line=""
            if (( s_idx >= 0 && s_idx < sh )); then
                s_line="${s_arr[$s_idx]}"
            fi

            lines+="$b_line$s_line"$'\n'
        done
        _LATEX_BOX_LINES[$id]="${lines%$'\n'}"
    fi
}

# Layout fraction
_latex_layout_fraction() {
    local id="$1" num="$2" den="$3"

    local nw=${_LATEX_BOX_W[$num]} nh=${_LATEX_BOX_H[$num]}
    local dw=${_LATEX_BOX_W[$den]} dh=${_LATEX_BOX_H[$den]}

    local w=$(( nw > dw ? nw : dw ))
    local h=$(( nh + 1 + dh ))
    local bl=$nh  # baseline is the fraction bar

    _LATEX_BOX_W[$id]=$w
    _LATEX_BOX_H[$id]=$h
    _LATEX_BOX_BL[$id]=$bl

    local -a n_arr d_arr
    mapfile -t n_arr <<< "${_LATEX_BOX_LINES[$num]}"
    mapfile -t d_arr <<< "${_LATEX_BOX_LINES[$den]}"

    local lines=""

    # Numerator (centered)
    for (( i=0; i<nh; i++ )); do
        local line="${n_arr[$i]}"
        local pad_left=$(( (w - nw) / 2 ))
        local pad_right=$(( w - nw - pad_left ))
        printf -v line "%*s%s%*s" "$pad_left" "" "$line" "$pad_right" ""
        lines+="$line"$'\n'
    done

    # Fraction bar (use thicker box drawing char)
    local bar=""
    for (( i=0; i<w; i++ )); do
        bar+="━"  # Heavy horizontal (U+2501)
    done
    lines+="$bar"$'\n'

    # Denominator (centered)
    for (( i=0; i<dh; i++ )); do
        local line="${d_arr[$i]}"
        local pad_left=$(( (w - dw) / 2 ))
        local pad_right=$(( w - dw - pad_left ))
        printf -v line "%*s%s%*s" "$pad_left" "" "$line" "$pad_right" ""
        lines+="$line"$'\n'
    done

    _LATEX_BOX_LINES[$id]="${lines%$'\n'}"
}

# Layout square root - using ▁ (U+2581) for lowered top bar
_latex_layout_sqrt() {
    local id="$1" radicand="$2" index="$3"

    local rw=${_LATEX_BOX_W[$radicand]} rh=${_LATEX_BOX_H[$radicand]} rbl=${_LATEX_BOX_BL[$radicand]}

    # Clean layout with lowered top bar:
    #    ▁▁▁▁▁   <- U+2581 LOWER ONE EIGHTH BLOCK
    #  ╲╱content
    # The ▁ sits at the bottom of the cell, creating a lowered bar effect

    local w=$((rw + 3))  # "╲╱ " prefix + content
    local h=$((rh + 1))  # +1 for top bar
    local bl=$((rbl + 1))

    _LATEX_BOX_W[$id]=$w
    _LATEX_BOX_H[$id]=$h
    _LATEX_BOX_BL[$id]=$bl

    local -a r_arr
    mapfile -t r_arr <<< "${_LATEX_BOX_LINES[$radicand]}"

    local lines=""

    # Top bar using ▁ (lowered horizontal bar)
    local topbar="  "
    for (( i=0; i<rw; i++ )); do
        topbar+="▁"  # U+2581 LOWER ONE EIGHTH BLOCK
    done
    lines+="$topbar"$'\n'

    # Content with radical V at left
    for (( i=0; i<rh; i++ )); do
        if (( i == 0 )); then
            lines+="╲╱ ${r_arr[$i]}"
        else
            lines+="   ${r_arr[$i]}"
        fi
        lines+=$'\n'
    done

    _LATEX_BOX_LINES[$id]="${lines%$'\n'}"
}

# Layout big operator (sum, prod, int, etc.)
# Sum/Prod: 2-line compact, Int: 3-line for curve
# Integral upper bound shifted right, centered favoring right
_latex_layout_bigop() {
    local id="$1" op="$2" lower="$3" upper="$4"

    # Get symbol parts - check for mid (3-line) or just top/bot (2-line)
    local sym_top="${LATEX_BIG_OPS_LARGE_TOP[$op]:-__}"
    local sym_bot="${LATEX_BIG_OPS_LARGE_BOT[$op]:-──}"
    local sym_mid=""
    local sym_h=2  # Default 2 lines

    if [[ -v "LATEX_BIG_OPS_LARGE_MID[$op]" ]]; then
        sym_mid="${LATEX_BIG_OPS_LARGE_MID[$op]}"
        sym_h=3
    fi

    local sym_w=${#sym_top}
    (( ${#sym_bot} > sym_w )) && sym_w=${#sym_bot}
    (( ${#sym_mid} > sym_w )) && sym_w=${#sym_mid}
    (( sym_w < 2 )) && sym_w=2

    local total_w=$sym_w

    # Calculate dimensions with limits
    local lw=0 lh=0 uw=0 uh=0

    if (( lower >= 0 )); then
        _latex_layout "$lower"
        lw=${_LATEX_BOX_W[$lower]}
        lh=${_LATEX_BOX_H[$lower]}
    fi

    if (( upper >= 0 )); then
        _latex_layout "$upper"
        uw=${_LATEX_BOX_W[$upper]}
        uh=${_LATEX_BOX_H[$upper]}
    fi

    # Width is max of symbol, lower, upper
    total_w=$(( sym_w > lw ? sym_w : lw ))
    total_w=$(( total_w > uw ? total_w : uw ))

    # For integral, add extra width for right-shifted upper bound
    if [[ "$op" == "int" ]] && (( upper >= 0 )); then
        total_w=$(( sym_w + uw ))
    fi

    local total_h=$((uh + sym_h + lh))
    local bl
    if (( sym_h == 3 )); then
        bl=$((uh + 1))  # Baseline at middle of 3-line symbol
    else
        bl=$((uh + 1))  # Baseline at bottom of 2-line symbol
    fi

    _LATEX_BOX_W[$id]=$total_w
    _LATEX_BOX_H[$id]=$total_h
    _LATEX_BOX_BL[$id]=$bl

    local lines=""

    # Upper limit - integral: shift right; others: center
    if (( upper >= 0 )); then
        local -a u_arr
        mapfile -t u_arr <<< "${_LATEX_BOX_LINES[$upper]}"
        for (( i=0; i<uh; i++ )); do
            local line="${u_arr[$i]}"
            local pad
            if [[ "$op" == "int" ]]; then
                # Shift upper bound right (over the integral)
                pad=$(( sym_w ))
            else
                # Center with slight right bias
                pad=$(( (total_w - uw + 1) / 2 ))
            fi
            printf -v line "%*s%s" "$pad" "" "$line"
            printf -v line "%-${total_w}s" "$line"
            lines+="$line"$'\n'
        done
    fi

    # Symbol top line (left-aligned for symbol portion)
    local sym_line
    printf -v sym_line "%-${sym_w}s" "$sym_top"
    printf -v sym_line "%-${total_w}s" "$sym_line"
    lines+="$sym_line"$'\n'

    # Symbol middle line (only for 3-line operators like integral)
    if [[ -n "$sym_mid" ]]; then
        printf -v sym_line "%-${sym_w}s" "$sym_mid"
        printf -v sym_line "%-${total_w}s" "$sym_line"
        lines+="$sym_line"$'\n'
    fi

    # Symbol bottom line
    printf -v sym_line "%-${sym_w}s" "$sym_bot"
    printf -v sym_line "%-${total_w}s" "$sym_line"
    lines+="$sym_line"$'\n'

    # Lower limit (centered below symbol)
    if (( lower >= 0 )); then
        local -a l_arr
        mapfile -t l_arr <<< "${_LATEX_BOX_LINES[$lower]}"
        for (( i=0; i<lh; i++ )); do
            local line="${l_arr[$i]}"
            local pad=$(( (total_w - lw) / 2 ))
            printf -v line "%*s%s" "$pad" "" "$line"
            printf -v line "%-${total_w}s" "$line"
            lines+="$line"$'\n'
        done
    fi

    _LATEX_BOX_LINES[$id]="${lines%$'\n'}"
}

# Layout parentheses
_latex_layout_paren() {
    local id="$1" inner="$2"

    local iw=${_LATEX_BOX_W[$inner]} ih=${_LATEX_BOX_H[$inner]} ibl=${_LATEX_BOX_BL[$inner]}

    local w=$((iw + 2))  # ( content )
    local h=$ih
    local bl=$ibl

    _LATEX_BOX_W[$id]=$w
    _LATEX_BOX_H[$id]=$h
    _LATEX_BOX_BL[$id]=$bl

    local -a i_arr
    mapfile -t i_arr <<< "${_LATEX_BOX_LINES[$inner]}"

    local lines=""

    if (( ih == 1 )); then
        # Simple parens
        lines+="(${i_arr[0]})"
    else
        # Tall parens using box drawing
        for (( i=0; i<ih; i++ )); do
            local left right
            if (( i == 0 )); then
                left="⎛" right="⎞"
            elif (( i == ih - 1 )); then
                left="⎝" right="⎠"
            else
                left="⎜" right="⎟"
            fi
            lines+="$left${i_arr[$i]}$right"$'\n'
        done
        lines="${lines%$'\n'}"
    fi

    _LATEX_BOX_LINES[$id]="$lines"
}

#==============================================================================
# MAIN RENDER FUNCTION
#==============================================================================

# Render LaTeX math expression to UTF-8
latex_render() {
    local input="$1"

    # Strip $ delimiters if present
    input="${input#\$}"
    input="${input%\$}"
    input="${input#\$}"
    input="${input%\$}"

    # Reset state
    _latex_reset_ast
    _LATEX_BOX_W=()
    _LATEX_BOX_H=()
    _LATEX_BOX_BL=()
    _LATEX_BOX_LINES=()

    # Tokenize
    _latex_tokenize "$input"

    # Parse (no subshell - uses _LATEX_RESULT)
    _latex_parse_expr
    local root=$_LATEX_RESULT

    # Layout
    _latex_layout "$root"

    # Output
    echo "${_LATEX_BOX_LINES[$root]}"
}

#==============================================================================
# CHROMA PARSER INTERFACE
#==============================================================================

# Parse stdin for LaTeX math and render
_chroma_parse_latex() {
    local line in_math=0 math_buf="" display_math=0

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Check for display math $$ ... $$
        if [[ "$line" =~ ^\$\$(.*)$ ]]; then
            if (( in_math )); then
                # End of display math
                latex_render "$math_buf"
                math_buf=""
                in_math=0
                display_math=0
            else
                # Start of display math
                in_math=1
                display_math=1
                math_buf="${BASH_REMATCH[1]}"
            fi
            continue
        fi

        if (( in_math && display_math )); then
            # Accumulate display math
            if [[ "$line" == *'$$'* ]]; then
                math_buf+=" ${line%%\$\$*}"
                latex_render "$math_buf"
                math_buf=""
                in_math=0
                display_math=0
            else
                math_buf+=" $line"
            fi
            continue
        fi

        # Process inline math $...$
        local processed=""
        local remaining="$line"

        while [[ "$remaining" =~ ^([^\$]*)\$([^\$]+)\$(.*)$ ]]; do
            processed+="${BASH_REMATCH[1]}"
            local math="${BASH_REMATCH[2]}"
            remaining="${BASH_REMATCH[3]}"

            # Render inline math (single line only for inline)
            local rendered
            rendered=$(latex_render "$math")
            # For inline, just take first line
            rendered="${rendered%%$'\n'*}"
            processed+="$rendered"
        done
        processed+="$remaining"

        echo "$processed"
    done
}

#==============================================================================
# STANDALONE FUNCTIONS
#==============================================================================

# Quick render function for direct use
latex() {
    if [[ $# -eq 0 ]]; then
        # Read from stdin
        local input
        input=$(cat)
        latex_render "$input"
    else
        # Arguments as input
        latex_render "$*"
    fi
}

# Demo function
latex_demo() {
    cat << 'HEADER'

╔══════════════════════════════════════════════════════════════════════╗
║                  LaTeX → UTF-8 Math Renderer                         ║
║                        Bash 5.2+ Edition                             ║
╚══════════════════════════════════════════════════════════════════════╝

HEADER

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Pythagorean Theorem"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    latex 'x^2 + y^2 = z^2'
    echo
    echo

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Quadratic Formula"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    latex '\frac{-b + \sqrt{b^2 - 4ac}}{2a}'
    echo
    echo

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Summation"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    latex '\sum_{i=1}^{n} x_i^2'
    echo
    echo

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Gaussian Integral"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    latex '\int_{-\infty}^{\infty} e^{-x^2} dx'
    echo
    echo

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Continued Fraction (Golden Ratio)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    latex '\frac{1}{1 + \frac{1}{1 + \frac{1}{1 + x}}}'
    echo
    echo

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Greek Letters"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    latex '\alpha + \beta + \gamma = \delta'
    echo
    echo

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Euler's Identity"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    latex 'e^{i\pi} + 1 = 0'
    echo
    echo

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Square Root"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    latex '\sqrt{a^2 + b^2 + c^2}'
    echo
}

#==============================================================================
# VALIDATION
#==============================================================================

_chroma_parse_latex_validate() {
    # Check bash version
    if (( BASH_VERSINFO[0] < 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] < 2) )); then
        echo "LaTeX parser requires Bash 5.2+" >&2
        return 1
    fi
    return 0
}

#==============================================================================
# INFO
#==============================================================================

_chroma_parse_latex_info() {
    cat <<'EOF'
Renders LaTeX math expressions to UTF-8 terminal output.

Supported constructs:
  Variables       x, y, z, abc
  Numbers         123, 3.14
  Operators       + - * / = ^ _
  Fractions       \frac{num}{den}
  Square roots    \sqrt{x}, \sqrt[n]{x}
  Superscripts    x^2, x^{2+n}
  Subscripts      x_i, x_{i+1}
  Greek letters   \alpha, \beta, \gamma, ...
  Symbols         \infty, \pm, \leq, \geq, ...
  Big operators   \sum, \prod, \int with limits
  Parentheses     (, ), \left( \right)
  Text            \text{...}

Examples:
  latex '\frac{1}{2}'
  latex '\sum_{i=0}^{n} x_i'
  latex 'e^{i\pi} + 1 = 0'
  latex_demo
EOF
}

#==============================================================================
# REGISTRATION
#==============================================================================

chroma_register_parser "latex" "_chroma_parse_latex" "tex latex" \
    "LaTeX math expressions"
